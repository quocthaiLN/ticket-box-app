# TicketBox — Order Checkout API Design

Tài liệu này thiết kế API cho checkout: tạo order giữ vé, tạo payment URL, polling trạng thái order và xử lý webhook thanh toán.

Nguồn nghiệp vụ chính:

- `blueprint/specs/01-ticket-inventory.md`
- `blueprint/specs/02-per-user-ticket-limit.md`
- `blueprint/specs/03-payment-idempotency.md`
- `blueprint/specs/10-order-checkout.md`
- `blueprint/database-design.md`
- `blueprint/api-design/base-api.md`
- `blueprint/api-design/inventory-api.md`
- `blueprint/api-design/e-ticket-api.md`

---

## 1. Mục tiêu

- Checkout hợp lệ tạo order `HELD` và payment URL.
- Hold vé, kiểm tra tồn kho và kiểm tra `max_per_user` trong cùng PostgreSQL transaction.
- Không tạo payment nếu hold vé thất bại.
- Client retry không tạo order/payment trùng nhờ `Idempotency-Key`.
- Webhook VNPAY/MoMo idempotent, verify chữ ký và không phát hành vé hai lần.
- Order hết hạn release vé và quota user.

---

## 2. Resource và mapping database

| Resource | Bảng | Vai trò |
| --- | --- | --- |
| `order` | `orders` | Đơn hàng và trạng thái nghiệp vụ checkout. |
| `order_item` | `order_items` | Dòng vé trong order. |
| `payment` | `payments` | Payment attempt, trạng thái thanh toán và raw webhook payload cuối. |
| `ticket_type` | `ticket_types` | Tồn kho, sale window và per-user limit source. |
| `user_ticket_type_counter` | `user_ticket_type_counters` | Giới hạn vé mỗi user. |
| `ticket` | `tickets` | Vé phát hành sau payment success. |
| `audit_log` | `audit_logs` | Audit thao tác admin/nghiệp vụ nếu cần. |

Order status MVP: `HELD`, `CONFIRMED`, `CANCELLED`, `EXPIRED`.

Payment status: `PENDING`, `SUCCEEDED`, `FAILED`, `CANCELLED`, `REFUNDED`.

Idempotency runtime nằm ở Redis. PostgreSQL chỉ giữ unique constraint trên `orders.idempotency_key` và `payments.idempotency_key` để bảo vệ cuối cùng.

---

## 3. Endpoint tổng hợp

| Method | Endpoint | Auth | Mục đích |
| --- | --- | --- | --- |
| `POST` | `/orders` | `AUDIENCE` | Tạo order held và payment URL. |
| `GET` | `/orders/{order_id}` | `AUDIENCE`, `ADMIN` | Poll trạng thái order. |
| `POST` | `/orders/{order_id}/cancel` | `AUDIENCE` | Hủy order còn `HELD`. |
| `POST` | `/orders/{order_id}/payments` | `AUDIENCE` | Tạo payment attempt mới (retry). |
| `POST` | `/payments/webhooks/{provider}` | Public + signature | Webhook/IPN VNPAY/MoMo. |
| `POST` | `/internal/orders/{order_id}/expire` | Internal/Worker | Expire order hết TTL. |
| `GET` | `/admin/orders` | `ORGANIZER`, `ADMIN` | Tra cứu order quản trị. |

---

## 4. API chi tiết

### 4.1. `POST /orders`

Tạo order và payment URL.

**Headers**

```http
Authorization: Bearer <jwt>
Idempotency-Key: <uuid_v4>
Content-Type: application/json
```

**Request**

```json
{
  "concert_id": "crt_01JX9Q2M5P7KZ3R4N8Y6",
  "payment_provider": "VNPAY",
  "items": [
    {
      "ticket_type_id": "tkt_01JX9Q5A",
      "quantity": 2
    }
  ]
}
```

**Response `201`**

```json
{
  "data": {
    "order_id": "ord_01JX9QA1",
    "concert_id": "crt_01JX9Q2M5P7KZ3R4N8Y6",
    "status": "HELD",
    "total_amount": {
      "amount": 9000000,
      "currency": "VND"
    },
    "hold_expires_at": "2026-05-30T10:25:30Z",
    "payment": {
      "id": "pay_01JX9QB2",
      "provider": "VNPAY",
      "status": "PENDING",
      "checkout_url": "https://sandbox.vnpayment.vn/payment/vnpay.html?token=vnp_01JXC"
    },
    "items": [
      {
        "ticket_type_id": "tkt_01JX9Q5A",
        "quantity": 2,
        "unit_price": {
          "amount": 4500000,
          "currency": "VND"
        },
        "line_total": {
          "amount": 9000000,
          "currency": "VND"
        }
      }
    ]
  },
  "meta": {
    "request_id": "req_01JX9Q6N4E"
  }
}
```

**Transaction rules**

1. Idempotency middleware lock key trạng thái `PROCESSING` trong Redis.
2. Lock `ticket_types` rows bằng `SELECT ... FOR UPDATE`.
3. Lock hoặc tạo `user_ticket_type_counters`.
4. Kiểm tra:
   - ticket type thuộc concert;
   - sale window hợp lệ;
   - computed `available_quantity = total_quantity - held_quantity - sold_quantity` đủ cho `quantity`;
   - `held_quantity + paid_quantity + quantity <= max_per_user`.
5. Tạo order `HELD`, `hold_expires_at = now() + TTL`.
6. Tạo order items, tính total amount.
7. Cập nhật inventory và user counters.
8. Commit transaction.
9. Tạo payment `PENDING` và checkout URL.
10. Cache idempotency response trong Redis.

Nếu payment provider circuit breaker đang open, backend có thể fail-fast và release hold ngay, hoặc giữ order đến TTL tùy policy. Khuyến nghị với đồ án: fail-fast, release hold, trả `503 PAYMENT_PROVIDER_UNAVAILABLE`.

---

### 4.2. `GET /orders/{order_id}`

Khán giả poll trạng thái order sau khi quay về từ payment provider.

Auth: JWT Bearer token. `user_id` extract từ JWT để verify ownership (`order.user_id === token.sub`). Admin không cần check ownership.

**Headers**

```http
Authorization: Bearer <jwt>
```

**Response `200` khi `HELD`**

```json
{
  "data": {
    "order_id": "ord_01JX9QA1",
    "status": "HELD",
    "hold_expires_at": "2026-05-30T10:25:30Z",
    "payment": {
      "id": "pay_01JX9QB2",
      "provider": "VNPAY",
      "status": "PENDING"
    },
    "tickets": []
  },
  "meta": {
    "request_id": "req_01JX9Q6N4E"
  }
}
```

**Response `200` khi `CONFIRMED`**

```json
{
  "data": {
    "order_id": "ord_01JX9QA1",
    "status": "CONFIRMED",
    "payment": {
      "id": "pay_01JX9QB2",
      "status": "SUCCEEDED",
      "paid_at": "2026-05-30T10:18:30Z"
    },
    "total_amount": {
      "amount": 9000000,
      "currency": "VND"
    },
    "created_at": "2026-05-30T10:15:30Z",
    "updated_at": "2026-05-30T10:18:35Z",
    "tickets": [
      {
        "ticket_id": "tic_01JX9QC1",
        "ticket_type_name": "SVIP Early Bird",
        "seat_zone_code": "SVIP",
        "status": "ISSUED"
      }
    ]
  },
  "meta": {
    "request_id": "req_01JX9Q6N4E"
  }
}
```

Headers:

```http
Cache-Control: no-store
```

Ownership:

- AUDIENCE chỉ xem order của chính mình.
- Organizer/Admin xem order qua `/admin/orders` theo scope.

---

### 4.3. `POST /orders/{order_id}/cancel`

User hủy order còn `HELD` trước khi thanh toán.

Auth: JWT Bearer token. `user_id` extract từ JWT để verify ownership trước khi cho phép hủy — không nhận `user_id` từ body.

**Headers**

```http
Authorization: Bearer <jwt>
```

**Response `200`**

```json
{
  "data": {
    "order_id": "ord_01JX9QA1",
    "status": "CANCELLED",
    "released_at": "2026-05-30T10:20:00Z"
  },
  "meta": {
    "request_id": "req_01JX9Q6N4E"
  }
}
```

Ràng buộc:

- Chỉ hủy order `HELD`.
- Release inventory và user held counter trong transaction.
- Không hủy order `CONFIRMED`; refund là flow riêng của Payment/Admin.

---

### 4.4. `POST /payments/webhooks/{provider}`

Webhook/IPN từ VNPAY/MoMo. Endpoint public nhưng bắt buộc verify signature.

Auth: Không có user JWT. Xác thực duy nhất là verify chữ ký HMAC/hash của provider trong payload. Không có `user_id` trong flow này — identity được xác định qua `order_id` từ payload.

**Path parameters**

| Tên | Giá trị |
| --- | --- |
| `provider` | `vnpay`, `momo` |

**Lưu ý: ReturnUrl vs IPN**

VNPAY và MoMo đều có hai loại callback. Backend chỉ xử lý IPN (server-to-server). `ReturnUrl` là browser redirect về frontend — frontend hiển thị màn hình "đang xử lý" và poll `GET /orders/{order_id}`, không gọi backend để confirm.

**VNPAY IPN payload ví dụ**

```json
{
  "vnp_Amount": "900000000",
  "vnp_BankCode": "NCB",
  "vnp_BankTranNo": "VNP14829301",
  "vnp_OrderInfo": "Thanh toan don hang ord_01JX9QA1",
  "vnp_PayDate": "20260530101830",
  "vnp_ResponseCode": "00",
  "vnp_TmnCode": "TBOX01",
  "vnp_TransactionNo": "7482910",
  "vnp_TxnRef": "ord_01JX9QA1",
  "vnp_SecureHash": "a5b6c7d8e9f0123456789abcdef"
}
```

Signature: HMAC-SHA512 trên chuỗi query params đã sort theo key, dùng `VNPAY_HASH_SECRET`. `vnp_ResponseCode = "00"` là thành công.

**MoMo IPN payload ví dụ**

```json
{
  "partnerCode": "TICKETBOX",
  "orderId": "ord_01JX9QA1",
  "requestId": "ord_01JX9QA1",
  "amount": 9000000,
  "orderInfo": "Thanh toan don hang ord_01JX9QA1",
  "orderType": "momo_wallet",
  "transId": 4082488746,
  "resultCode": 0,
  "message": "Successful.",
  "payType": "qr",
  "responseTime": 1748600310000,
  "extraData": "",
  "signature": "abc123def456"
}
```

Signature: HMAC-SHA256 trên raw string `accessKey=...&amount=...&extraData=...&message=...&orderId=...&orderInfo=...&orderType=...&partnerCode=...&payType=...&requestId=...&responseTime=...&resultCode=...&transId=...`, dùng `MOMO_SECRET_KEY`. `resultCode = 0` là thành công.

**Response `200` theo provider (VNPAY)**

```json
{
  "RspCode": "00",
  "Message": "Confirm Success"
}
```

**Response `200` theo provider (MoMo)**

```json
{
  "status": 200,
  "message": "success"
}
```

**Webhook processing rules**

1. Resolve order/payment theo provider payload.
2. Lưu raw payload cuối vào `payments.webhook_payload`, `webhook_received_at`.
3. Verify chữ ký provider, set `payments.webhook_signature_valid`.
4. Kiểm tra amount khớp order.
5. Dùng unique constraint `(provider, provider_transaction_id)` để chống webhook trùng.
6. Nếu success:
   - update `payments.status = SUCCEEDED`;
   - update `orders.status = CONFIRMED`;
   - chuyển inventory held sang sold;
   - chuyển user counter held sang paid;
   - phát hành tickets;
   - publish notification event.
7. Nếu fail/cancel:
   - update payment failed/cancelled;
   - release hold nếu order còn `HELD`.
8. Cache webhook/idempotency result nếu cần để provider retry nhận `200` ổn định.

Webhook trùng phải trả `200` idempotent nhưng không phát hành vé lần hai.

---

### 4.5. `POST /internal/orders/{order_id}/expire`

Worker gọi khi order quá `hold_expires_at`.

Auth: Internal service auth, không có user JWT. Trong modular monolith thường là direct module call; nếu expose HTTP thì chỉ private network + service token.

**Response `200`**

```json
{
  "data": {
    "order_id": "ord_01JX9QA1",
    "status": "EXPIRED",
    "released_items": [
      {
        "ticket_type_id": "tkt_01JX9Q5A",
        "quantity": 2
      }
    ]
  },
  "meta": {
    "request_id": "req_01JX9Q6N4E"
  }
}
```

Idempotent: nếu order đã `CONFIRMED`, `CANCELLED` hoặc `EXPIRED`, không release lần hai.

---

### 4.6. `GET /admin/orders`

Admin/Organizer tra cứu order.

Auth: JWT Bearer token với role `ORGANIZER` hoặc `ADMIN`. Organizer scope (concert nào được xem) derive từ JWT claims, không nhận từ query params.

**Headers**

```http
Authorization: Bearer <jwt>  (role = ORGANIZER | ADMIN)
```

**Query parameters**

| Tên | Mô tả |
| --- | --- |
| `concert_id` | Lọc theo concert. |
| `status` | Lọc theo order status. |
| `user_id` | Lọc theo user. |
| `from`, `to` | Lọc theo `created_at`. |
| `limit`, `cursor` | Phân trang. |

Organizer chỉ xem order thuộc concert mình quản lý.

---

### 4.7. `POST /orders/{order_id}/payments`

Tạo payment attempt mới khi payment trước đó `FAILED`. Order phải còn `HELD` và chưa hết hạn.

Auth: JWT Bearer token. `user_id` từ JWT để verify ownership.

**Headers**

```http
Authorization: Bearer <jwt>
```

**Request**

```json
{
  "payment_provider": "MOMO"
}
```

**Response `201`**

```json
{
  "data": {
    "payment_id": "pay_01JX9QD3",
    "provider": "MOMO",
    "status": "PENDING",
    "checkout_url": "https://test-payment.momo.vn/v2/gateway/...",
    "order_id": "ord_01JX9QA1",
    "hold_expires_at": "2026-05-30T10:25:30Z"
  },
  "meta": {
    "request_id": "req_01JX9Q6N4E"
  }
}
```

Ràng buộc:

- Order phải `HELD` và `hold_expires_at > now()`.
- Order không được có payment `SUCCEEDED` hoặc `PENDING` đang active.
- Không tạo thêm payment nếu đã có `PENDING` — trả `409 PAYMENT_ALREADY_PENDING` để tránh double payment.
- Không thay đổi inventory hold.

---

## 5. State machine

Order transitions hợp lệ:

```text
HELD -> CONFIRMED
HELD -> CANCELLED
HELD -> EXPIRED
```

Không phát hành ticket nếu payment chưa `SUCCEEDED` hoặc order chưa `CONFIRMED`.

Payment transitions hợp lệ:

```text
PENDING -> SUCCEEDED
PENDING -> FAILED
PENDING -> CANCELLED
SUCCEEDED -> REFUNDED
```

---

## 6. Idempotency và consistency

- `POST /orders` bắt buộc `Idempotency-Key`.
- Redis lưu key trạng thái nhanh với TTL tối thiểu 24h.
- PostgreSQL unique constraint trên `orders.idempotency_key` và `payments.idempotency_key`.
- Nếu key đang `PROCESSING`, trả `409 IDEMPOTENCY_IN_PROGRESS`.
- Nếu key đã hoàn tất, trả response cũ.
- Webhook idempotent theo provider transaction id và unique `(provider, provider_transaction_id)`.
- Nếu Redis mất dữ liệu, PostgreSQL unique constraint là lớp bảo vệ cuối.

---

## 7. Error catalog

| HTTP | Code | Khi nào xảy ra |
| --- | --- | --- |
| `400` | `INVALID_CHECKOUT_REQUEST` | Body sai format hoặc item rỗng. |
| `401` | `UNAUTHORIZED` | Chưa đăng nhập. |
| `403` | `ORDER_ACCESS_DENIED` | User không sở hữu order. |
| `404` | `ORDER_NOT_FOUND` | Order không tồn tại hoặc không được phép lộ. |
| `409` | `TICKET_SOLD_OUT` | Không đủ vé. |
| `409` | `IDEMPOTENCY_IN_PROGRESS` | Request cùng key đang xử lý. |
| `409` | `ORDER_ALREADY_FINALIZED` | Hủy/expire order đã confirmed/cancelled/expired. |
| `409` | `PAYMENT_ALREADY_PENDING` | Retry khi đã có payment PENDING active. |
| `422` | `ORDER_NOT_HELD` | Retry payment nhưng order không còn HELD. |
| `422` | `PER_USER_LIMIT_EXCEEDED` | Vượt giới hạn mỗi user. |
| `422` | `TICKET_TYPE_NOT_ON_SALE` | Loại vé chưa mở bán/hết hạn/closed. |
| `422` | `PAYMENT_SIGNATURE_INVALID` | Webhook sai chữ ký. |
| `422` | `PAYMENT_AMOUNT_MISMATCH` | Amount webhook không khớp order. |
| `503` | `PAYMENT_PROVIDER_UNAVAILABLE` | Circuit breaker payment mở. |
| `503` | `LOCK_TIMEOUT_RETRYABLE` | DB lock timeout/deadlock. |

---

## 8. RBAC

| Endpoint group | `GUEST` | `AUDIENCE` | `ORGANIZER` | `ADMIN` | Provider/Internal |
| --- | --- | --- | --- | --- | --- |
| `POST /orders` | 401 | Allow | 403 | Allow for test/support only | 403 |
| `GET /orders/{id}` | 401 | Own order only | 403 | Allow | 403 |
| `POST /orders/{id}/cancel` | 401 | Own held order only | 403 | Allow | 403 |
| `POST /orders/{id}/payments` | 401 | Own held order only | 403 | Allow | 403 |
| Payment webhook | Allow only with valid signature | 403 | 403 | 403 | Provider |
| Internal expire | 403 | 403 | 403 | 403 | Internal only |
| Admin order search | 401 | 403 | Scoped by concert | Allow | 403 |

---

## 9. Acceptance criteria

- Checkout hợp lệ tạo order `HELD`, order items, payment `PENDING` và checkout URL.
- Retry cùng `Idempotency-Key` không tạo order/payment trùng.
- User không thể vượt `max_per_user` dù gửi nhiều request song song.
- Hai người mua vé cuối cùng chỉ một người hold thành công.
- Order hết hạn release inventory và quota user.
- Webhook success verify đúng chữ ký/amount mới chuyển order `CONFIRMED`.
- Webhook trùng không phát hành vé trùng.
- Payment provider lỗi không làm sập catalog/check-in.