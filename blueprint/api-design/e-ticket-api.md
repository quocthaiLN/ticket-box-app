# TicketBox — E-ticket API Design

Tài liệu này thiết kế API phát hành, xem và xác thực e-ticket QR. Check-in online/offline dùng QR payload/signature trong tài liệu này.

Nguồn nghiệp vụ chính:

- `blueprint/specs/11-e-ticket-qr.md`
- `blueprint/database-design.md`

---

## 1. Mục tiêu

- Sau payment success, phát hành đúng số lượng ticket.
- Mỗi ticket có `qr_token_hash` unique và `qr_signature`.
- QR đủ dữ liệu để mobile app kiểm tra offline: `ticket_id`, `concert_id`, `ticket_type_id`, `seat_zone_id`, `issued_at`, token/payload đã ký.
- Không lưu dữ liệu nhạy cảm không cần thiết trong QR.
- Email/push lỗi không làm mất ticket; user vẫn xem được trong tài khoản.

---

## 2. Resource và mapping database

| Resource | Bảng | Vai trò |
| --- | --- | --- |
| `ticket` | `tickets` | Vé điện tử đã phát hành. |
| `ticket_type` | `ticket_types` | Nguồn giá/khu của ticket. |
| `seat_zone` | `seat_zones` | Khu được phép vào. |
| `order` | `orders`, `order_items` | Nguồn phát hành ticket. |
| `payment` | `payments` | Điều kiện thanh toán thành công. |
| `notification` | `notifications` | Gửi email/app chứa e-ticket. |

---

## 3. Endpoint tổng hợp

| Method | Endpoint | Auth | Mục đích |
| --- | --- | --- | --- |
| `GET` | `/me/tickets` | `AUDIENCE` | Danh sách vé của user. |
| `GET` | `/me/tickets/{ticket_id}` | `AUDIENCE` | Chi tiết e-ticket. |
| `GET` | `/me/tickets/{ticket_id}/qr` | `AUDIENCE` | QR payload/signature để hiển thị. |
| `POST` | `/internal/orders/{order_id}/tickets/issue` | Internal/Ticketing | Phát hành ticket sau payment success. |
| `POST` | `/internal/tickets/{ticket_id}/void` | Internal/Admin/Payment | Hủy ticket khi refund/cancel. |
| `POST` | `/internal/tickets/resolve-qr` | Internal/Check-in | Resolve QR token cho check-in. |

---

## 4. API chi tiết

### 4.1. `GET /me/tickets`

Query:

| Tên | Kiểu | Mô tả |
| --- | --- | --- |
| `concert_id` | string | Lọc theo concert. |
| `status` | string | `ISSUED`, `CHECKED_IN`, `CANCELLED`, `REFUNDED`. |
| `limit` | number | Mặc định `20`, tối đa `100`. |
| `cursor` | string | Cursor trang tiếp theo. |

Response `200`:

```json
{
  "data": [
    {
      "id": "tic_01JX9QC1",
      "concert_id": "crt_01JX9Q2M5P7KZ3R4N8Y6",
      "concert_title": "Anh Trai Say Hi",
      "ticket_type_id": "tkt_01JX9Q5A",
      "ticket_type_name": "SVIP",
      "seat_zone_id": "zon_01JX9Q4A",
      "zone_code": "SVIP",
      "status": "ISSUED",
      "issued_at": "2026-05-30T10:15:30Z"
    }
  ],
  "pagination": {
    "next_cursor": null,
    "has_more": false,
    "limit": 20
  },
  "meta": {
    "request_id": "req_01JX9Q6N4E"
  }
}
```

### 4.2. `GET /me/tickets/{ticket_id}`

Response `200`:

```json
{
  "data": {
    "id": "tic_01JX9QC1",
    "order_id": "ord_01JX9QA1",
    "concert": {
      "id": "crt_01JX9Q2M5P7KZ3R4N8Y6",
      "title": "Anh Trai Say Hi",
      "starts_at": "2026-08-10T12:00:00Z"
    },
    "ticket_type": {
      "id": "tkt_01JX9Q5A",
      "name": "SVIP"
    },
    "seat_zone": {
      "id": "zon_01JX9Q4A",
      "code": "SVIP",
      "name": "SVIP"
    },
    "status": "ISSUED",
    "issued_at": "2026-05-30T10:15:30Z",
    "checked_in_at": null
  },
  "meta": {
    "request_id": "req_01JX9Q6N4E"
  }
}
```

Ownership rule: AUDIENCE chỉ xem ticket của chính mình; admin/organizer dùng endpoint quản trị riêng nếu cần.

### 4.3. `GET /me/tickets/{ticket_id}/qr`

Response `200`:

```json
{
  "data": {
    "ticket_id": "tic_01JX9QC1",
    "payload": {
      "ticket_id": "tic_01JX9QC1",
      "concert_id": "crt_01JX9Q2M5P7KZ3R4N8Y6",
      "ticket_type_id": "tkt_01JX9Q5A",
      "seat_zone_id": "zon_01JX9Q4A",
      "issued_at": "2026-05-30T10:15:30Z",
      "qr_token": "qr_live_token_or_signed_payload"
    },
    "qr_signature": "base64-signature",
    "expires_at": null
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

### 4.4. `POST /internal/orders/{order_id}/tickets/issue`

Phát hành ticket sau khi payment success.

Headers:

```http
Idempotency-Key: issue_ord_01JX9QA1
```

Response `201`:

```json
{
  "data": {
    "order_id": "ord_01JX9QA1",
    "tickets": [
      {
        "id": "tic_01JX9QC1",
        "ticket_type_id": "tkt_01JX9Q5A",
        "seat_zone_id": "zon_01JX9Q4A",
        "status": "ISSUED"
      }
    ]
  },
  "meta": {
    "request_id": "req_01JX9Q6N4E"
  }
}
```

Ràng buộc:

- Payment phải `SUCCEEDED`.
- Order phải `CONFIRMED`.
- Số ticket phát hành bằng tổng `order_items.quantity`.
- `qr_token_hash` unique.
- Retry cùng idempotency key không tạo thêm ticket.
- Sau khi phát hành, publish event cho Notification Module gửi e-ticket.

---

## 5. Error catalog

| HTTP | Code | Khi nào xảy ra |
| --- | --- | --- |
| `403` | `TICKET_ACCESS_DENIED` | User không sở hữu ticket. |
| `404` | `TICKET_NOT_FOUND` | Ticket không tồn tại hoặc không được phép lộ. |
| `409` | `TICKETS_ALREADY_ISSUED` | Order đã phát hành ticket trước đó. |
| `409` | `QR_TOKEN_CONFLICT` | Unique constraint chặn token trùng. |
| `422` | `ORDER_NOT_CONFIRMED` | Order chưa xác nhận thành công. |
| `422` | `PAYMENT_NOT_SUCCEEDED` | Payment chưa thành công. |
| `422` | `TICKET_NOT_USABLE` | Ticket cancelled/refunded nên không trả QR dùng được. |

---

## 6. Acceptance criteria

- Payment success tạo đúng số lượng ticket.
- Mỗi ticket có QR riêng và verify được offline.
- QR chứa hoặc resolve được `seat_zone_id`.
- QR bị sửa bị check-in từ chối.
- User luôn xem được ticket trong tài khoản dù notification lỗi.