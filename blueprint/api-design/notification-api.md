# TicketBox — Notification API Design

Tài liệu này thiết kế API cho thông báo bất đồng bộ trong MVP. Database mới gộp lịch gửi, log gửi và lỗi provider vào một bảng `notifications`; template có thể nằm trong code/config worker, còn dữ liệu render nằm trong `notifications.payload`.

Nguồn nghiệp vụ chính:

- `blueprint/specs/07-notification.md`
- `blueprint/database-design.md`

---

## 1. Mục tiêu

- Không gửi notification đồng bộ trong request thanh toán.
- Worker consume event từ BullMQ/Message Broker và gọi provider Email/App/SMS/Zalo.
- Mỗi lần gửi hoặc lịch gửi được ghi vào `notifications`.
- Retry lỗi provider bằng `attempts`, queue delay và `error_message`.
- Admin/Organizer tra cứu trạng thái gửi, không cần bảng template hoặc bảng lỗi riêng trong MVP.

---

## 2. Resource và mapping database

| Resource | Bảng | Vai trò |
| --- | --- | --- |
| `notification` | `notifications` | Queue/log gửi, lỗi provider và payload render. |
| `ticket` | `tickets` | Nguồn gửi e-ticket/reminder. |
| `concert` | `concerts` | Dữ liệu render reminder. |
| `user` | `users` | Người nhận notification. |

---

## 3. Endpoint tổng hợp

| Method | Endpoint | Auth | Mục đích |
| --- | --- | --- | --- |
| `GET` | `/admin/notifications` | `ORGANIZER`, `ADMIN` | Tra cứu notification theo concert/channel/status. |
| `GET` | `/admin/notifications/{notification_id}` | `ORGANIZER`, `ADMIN` | Chi tiết notification. |
| `POST` | `/admin/notifications/{notification_id}/retry` | `ORGANIZER`, `ADMIN` | Retry notification lỗi. |
| `POST` | `/internal/notifications/enqueue` | Internal | Module khác enqueue notification event. |

---

## 4. API chi tiết

### 4.1. `GET /admin/notifications`

**Query parameters**

| Tên | Kiểu | Mô tả |
| --- | --- | --- |
| `concert_id` | string | Lọc theo concert. |
| `ticket_id` | string | Lọc theo ticket nếu có. |
| `channel` | string | `APP`, `EMAIL`, `SMS`, `ZALO`. |
| `status` | string | `PENDING`, `SENT`, `FAILED`. |
| `limit` | number | Mặc định `20`, tối đa `100`. |
| `cursor` | string | Cursor trang tiếp theo. |

**Response `200`**

```json
{
  "data": [
    {
      "id": "ntf_01JX9QU2",
      "user_id": "usr_01JX9Q8B",
      "concert_id": "crt_01JX9Q2M5P7KZ3R4N8Y6",
      "ticket_id": "tic_01JX9QB1",
      "channel": "EMAIL",
      "type": "TICKET_ISSUED",
      "status": "SENT",
      "attempts": 1,
      "sent_at": "2026-05-30T10:16:30Z",
      "payload": {
        "recipient": "audience@example.com",
        "title": "Vé của bạn đã sẵn sàng",
        "template_code": "ticket_issued_email"
      }
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

### 4.2. `GET /admin/notifications/{notification_id}`

Trả chi tiết payload, lỗi cuối và metadata.

### 4.3. `POST /admin/notifications/{notification_id}/retry`

Retry notification `FAILED`.

Response `202`:

```json
{
  "data": {
    "id": "ntf_01JX9QU2",
    "status": "PENDING",
    "attempts": 2
  },
  "meta": {
    "request_id": "req_01JX9Q6N4E"
  }
}
```

### 4.4. `POST /internal/notifications/enqueue`

Endpoint nội bộ để module khác enqueue notification event.

```json
{
  "type": "TICKET_ISSUED",
  "channel": "EMAIL",
  "user_id": "usr_01JX9Q8B",
  "concert_id": "crt_01JX9Q2M5P7KZ3R4N8Y6",
  "ticket_id": "tic_01JX9QB1",
  "payload": {
    "order_id": "ord_01JX9QA1",
    "recipient": "audience@example.com",
    "title": "Vé của bạn đã sẵn sàng",
    "body": "Mở ứng dụng TicketBox để xem QR check-in.",
    "template_code": "ticket_issued_email"
  }
}
```

Rules:

- Tạo `notifications` trạng thái `PENDING`.
- Nếu event retry trùng, dedupe theo business key phù hợp, ví dụ `ticket_id + channel + type`.
- Không chặn luồng payment/ticket nếu notification provider lỗi.

---

## 5. Worker rules

1. Consume event từ BullMQ/Message Broker hoặc lấy `notifications.status = PENDING`.
2. Render nội dung từ `payload` hoặc template trong code/config.
3. Gọi provider tương ứng.
4. Thành công: cập nhật `status = SENT`, `sent_at`, tăng `attempts`.
5. Timeout/5xx: tăng `attempts`, ghi `error_message`, đưa job vào queue delay; DB có thể giữ `PENDING` cho lần retry tiếp theo.
6. Vượt retry: set `status = FAILED`, ghi `error_message`.
7. Reminder trước concert 24h chỉ gửi cho ticket còn hiệu lực.

---

## 6. RBAC

| Endpoint group | `GUEST` | `AUDIENCE` | `ORGANIZER` | `ADMIN` |
| --- | --- | --- | --- | --- |
| Notification list/detail | 401 | 403 | Allow scoped by concert | Allow |
| Retry notification | 401 | 403 | Allow scoped by concert | Allow |
| Internal enqueue | Internal only | Internal only | Internal only | Internal only |

---

## 7. Error catalog

| HTTP | Code | Khi nào xảy ra |
| --- | --- | --- |
| `401` | `UNAUTHORIZED` | Thiếu JWT. |
| `403` | `FORBIDDEN` | Không đủ role hoặc không sở hữu concert. |
| `404` | `NOTIFICATION_NOT_FOUND` | Notification không tồn tại. |
| `409` | `NOTIFICATION_NOT_RETRYABLE` | Notification không ở trạng thái retry được. |
| `422` | `INVALID_CHANNEL` | Channel không thuộc enum. |

---

## 8. Acceptance criteria

- Payment/ticket issuing không phụ thuộc provider notification.
- Mỗi notification được lưu trong `notifications` với status rõ ràng.
- Retry không gửi trùng do click lặp.
- Organizer chỉ thấy notification thuộc concert mình quản lý.