# Hướng dẫn Checker


## 1. Mã QR

```json
{
  "ticket_id": "...",
  "concert_id": "...",
  "ticket_type_id": "...",
  "seat_zone_id": "...",
  "gate_id": "...",
  "issued_at": "2026-...Z",
  "qr_token": "<hash>",
  "qr_signature": "<base64 Ed25519>"
}
```

> Chữ ký được tính trên đúng các field còn lại (sau khi bỏ `qr_signature`, sort key).


## 2. Kiểm tra gì

- **Chữ ký Ed25519**: verify bằng public key. Sai/giả mạo → `INVALID_TICKET` (kèm `reason: QR_SIGNATURE_INVALID`).
- **Đúng cổng / đúng concert**: `gate_id`, `concert_id` trên vé phải khớp cổng đang quét.
- **Thiết bị hợp lệ**: `device_id` phải đang active và gán cho đúng concert/gate.
- **Trạng thái vé**: chỉ vé `ISSUED` mới vào được; đã `CHECKED_IN` sẽ báo trùng.
- **Idempotent**: quét lại đúng vé đó không làm hỏng dữ liệu.

Public key được nhúng sẵn nên máy soát **verify được cả khi mất mạng** - đọc trong .env
