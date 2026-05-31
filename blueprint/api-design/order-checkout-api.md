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
| `order` | `orders` | Đơn hàng và trạng thái checkout. |
| `order_item` | `order_items` | Dòng vé trong order. |
| `payment` | `payments` | Payment attempt với VNPAY/MoMo. |
| `payment_webhook_event` | `payment_webhook_events` | Raw webhook/IPN và audit xử lý. |
| `idempotency_key` | `idempotency_keys` | Chống request tạo order/payment trùng. |
| `ticket_type` | `ticket_types` | Tồn kho và sale window. |
| `user_ticket_type_counter` | `user_ticket_type_counters` | Giới hạn vé mỗi user. |
| `ticket` | `tickets` | Vé phát hành sau payment success. |

Order status: `HELD`, `PAID`, `CANCELLED`, `EXPIRED`, `FAILED`, `REFUNDED`.

Payment status: `PENDING`, `SUCCEEDED`, `FAILED`, `CANCELLED`, `REFUNDED`.

---

## 3. Endpoint tổng hợp

| Method | Endpoint | Auth | Mục đích |
| --- | --- | --- | --- |
| `POST` | `/orders` | `AUDIENCE` | Tạo order held và payment URL. |
| `GET` | `/orders/{order_id}` | `AUDIENCE`, `ADMIN` | Poll trạng thái order. |
| `POST` | `/orders/{order_id}/cancel` | `AUDIENCE` | Hủy order còn `HELD`. |
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

1. Idempotency middleware tạo/lock key trạng thái `PROCESSING`.
2. Lock `ticket_types` rows bằng `SELECT ... FOR UPDATE`.
3. Lock hoặc tạo `user_ticket_type_counters`.
4. Kiểm tra:
   - ticket type thuộc concert;
   - sale window hợp lệ;
   - `available_quantity >= quantity`;
   - `held_quantity + paid_quantity + quantity <= max_per_user`.
5. Tạo order `HELD`, `hold_expires_at = now() + TTL`.
6. Tạo order items, tính total amount.
7. Cập nhật inventory và user counters.
8. Ghi `ticket_inventory_events = HOLD`.
9. Commit transaction.
10. Tạo payment `PENDING` và checkout URL.
11. Cập nhật idempotency response.

Nếu payment provider circuit breaker đang open, backend có thể fail-fast và release hold ngay, hoặc giữ order đến TTL tùy policy. Khuyến nghị với đồ án: fail-fast, release hold, trả `503 PAYMENT_PROVIDER_UNAVAILABLE`.

---

### 4.2. `GET /orders/{order_id}`

Khán giả poll trạng thái order sau khi quay về từ payment provider.

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

**Response `200` khi `PAID`**

```json
{
  "data": {
    "order_id": "ord_01JX9QA1",
    "status": "PAID",
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
- Không hủy order `PAID`; refund là flow riêng.

---

### 4.4. `POST /payments/webhooks/{provider}`

Webhook/IPN từ VNPAY/MoMo. Endpoint public nhưng bắt buộc verify signature.

**Path parameters**

| Tên | Giá trị |
| --- | --- |
| `provider` | `vnpay`, `momo` |

**VNPAY raw request ví dụ**

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

**Response `200` theo provider**

```json
{
  "RspCode": "00",
  "Message": "Confirm Success"
}
```

**Webhook processing rules**

1. Lưu raw payload vào `payment_webhook_events` trước khi xử lý.
2. Verify chữ ký provider, set `signature_valid`.
3. Resolve order/payment.
4. Kiểm tra amount khớp order.
5. Dùng unique constraint provider transaction/event để chống webhook trùng.
6. Nếu success:
   - update `payments.status = SUCCEEDED`;
   - update `orders.status = PAID`;
   - chuyển inventory held sang sold;
   - chuyển user counter held sang paid;
   - phát hành tickets;
   - publish notification event.
7. Nếu fail/cancel:
   - update payment failed/cancelled;
   - release hold nếu order còn `HELD`.
8. Mark webhook `processed = TRUE`.

Webhook trùng phải trả `200` idempotent nhưng không phát hành vé lần hai.

---

### 4.5. `POST /internal/orders/{order_id}/expire`

Worker gọi khi order quá `hold_expires_at`.

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

Idempotent: nếu order đã `PAID`, `CANCELLED` hoặc `EXPIRED`, không release lần hai.

---

### 4.6. `GET /admin/orders`

Admin/Organizer tra cứu order.

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

## 5. State machine

Order transitions hợp lệ:

```text
HELD -> PAID
HELD -> CANCELLED
HELD -> EXPIRED
HELD -> FAILED
PAID -> REFUNDED
```

Không phát hành ticket nếu order chưa `PAID`.

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
- PostgreSQL unique constraint trên `idempotency_keys.key`.
- Nếu key đang `PROCESSING`, trả `409 IDEMPOTENCY_IN_PROGRESS`.
- Nếu key `SUCCEEDED`, trả response cũ.
- Webhook idempotent theo provider event/transaction id.
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
| `409` | `ORDER_ALREADY_FINALIZED` | Hủy/expire order đã paid/refunded. |
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
- Webhook success verify đúng chữ ký/amount mới chuyển order `PAID`.
- Webhook trùng không phát hành vé trùng.
- Payment provider lỗi không làm sập catalog/check-in.
