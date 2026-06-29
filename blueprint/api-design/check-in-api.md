# TicketBox — Check-in API Design

Tài liệu này thiết kế API cho mobile app soát vé online/offline, device bootstrap, gate-zone validation và sync batch.

Nguồn nghiệp vụ chính:

- `blueprint/specs/04-offline-checkin-sync.md`
- `blueprint/specs/12-checkin-online.md`
- `blueprint/specs/13-guest-checkin.md`
- `blueprint/database-design.md`

---

## 1. Mục tiêu

- Online scan xác thực QR, device, concert, gate-zone và cập nhật ticket/guest trong transaction.
- Offline preload cho mobile tải trước valid tickets/guests, allowed zones và public key/signature metadata.
- Offline sync idempotent bằng `batch_token`.
- Mọi lần scan, kể cả lỗi, phải ghi log hoặc item audit.
- Gate-zone validation là bắt buộc cho cả ticket và guest.

---

## 2. Resource và mapping database

| Resource | Bảng | Vai trò |
| --- | --- | --- |
| `checkin_device` | `checkin_devices` | Thiết bị mobile được gán staff/concert/gate. |
| `checkin_gate` | `checkin_gates` | Cổng soát vé của concert. |
| `checkin_gate_zone` | `checkin_gate_zones` | Mapping cổng và khu được phép vào. |
| `checkin_scan` | `checkin_logs` | Audit mọi lần quét. |
| `offline_batch` | `offline_checkin_batches` | Batch sync offline. |
| `offline_item` | `offline_checkin_items` | Item scan offline. |
| `ticket` | `tickets` | Vé thường. |
| `guest` | `guest_list` | Khách mời VIP. |

---

## 3. Endpoint tổng hợp

| Method | Endpoint | Auth | Mục đích |
| --- | --- | --- | --- |
| `POST` | `/check-in/scan` | `CHECKER` | Quét vé online. |
| `GET` | `/check-in/preload` | `CHECKER` | Tải dữ liệu offline cho thiết bị/cổng. |
| `POST` | `/check-in/offline-sync` | `CHECKER` | Sync batch offline. |
| `POST` | `/check-in/offline-batches` | `CHECKER` | Tạo/lấy batch sync offline. |
| `POST` | `/check-in/offline-batches/{batch_id}/items` | `CHECKER` | Gửi item offline vào batch. |
| `POST` | `/check-in/offline-batches/{batch_id}/complete` | `CHECKER` | Chốt batch. |
| `GET` | `/check-in/offline-batches/{batch_id}` | `CHECKER` | Xem trạng thái batch. |
| `GET` | `/check-in/guests/search` | `CHECKER` | Tra cứu guest tại cổng (xem `guest-list-api.md`). |
| `GET` | `/admin/check-in/gates` | `ADMIN` | Danh sách cổng. |

> **Sprint 6 (single-role + bỏ alias):** route quét chuẩn là `POST /check-in/scan` (không phải `/check-in/scans`); preload chuẩn là `GET /check-in/preload` (không phải `/check-in/devices/{id}/bootstrap`). **Bỏ** (trả `404`): `POST /check-in/scans`, `GET /check-in/bootstrap`, `GET /check-in/devices/{id}/preload`, `GET /check-in/gates/{id}/preload`, `POST /check-in/guests/scans`. Admin check-in **chỉ còn** `GET /admin/check-in/gates` (`ADMIN`); mọi route gate write, device, gate-zone-mapping đã bỏ.

---

## 4. API chi tiết

### 4.1. `GET /check-in/devices/{device_id}/bootstrap` — ĐÃ BỎ (dùng `GET /check-in/preload`)

Route bootstrap đã bỏ ở sprint 6; mobile dùng `GET /check-in/preload` (xem §4.2) sau khi checker đăng nhập. Dữ liệu device/concert/gate/allowed_seat_zones bên dưới nay được trả trong preload.

Response `200`:

```json
{
  "data": {
    "device": {
      "id": "dev_01JX9Q7A",
      "device_name": "Scanner SVIP 01",
      "last_sync_at": "2026-05-30T09:00:00Z"
    },
    "concert": {
      "id": "crt_01JX9Q2M5P7KZ3R4N8Y6",
      "title": "Anh Trai Say Hi",
      "starts_at": "2026-08-10T12:00:00Z"
    },
    "gate": {
      "id": "gat_01JX9Q9C",
      "code": "SVIP_GATE",
      "name": "Cổng SVIP",
      "is_active": true
    },
    "allowed_seat_zones": [
      {
        "id": "zon_01JX9Q4A",
        "code": "SVIP",
        "name": "SVIP"
      }
    ]
  },
  "meta": {
    "request_id": "req_01JX9Q6N4E"
  }
}
```

### 4.2. `GET /check-in/preload`

Query:

| Tên | Bắt buộc | Mô tả |
| --- | --- | --- |
| `concert_id` | Có | Concert cần tải. |
| `gate_id` | Có | Cổng hiện tại. |
| `device_id` | Có | Thiết bị tải dữ liệu. |
| `include_guests` | Không | Có tải guest list hay không. |
| `cursor` | Không | Phân trang. |
| `limit` | Không | Mặc định `1000`. |

Response `200`:

```json
{
  "data": {
    "snapshot_id": "snap_01JX9QAB",
    "concert_id": "crt_01JX9Q2M5P7KZ3R4N8Y6",
    "gate_id": "gat_01JX9Q9C",
    "device_id": "dev_01JX9Q7A",
    "generated_at": "2026-05-30T10:15:30Z",
    "allowed_seat_zone_ids": ["zon_01JX9Q4A"],
    "tickets": [
      {
        "ticket_id": "tic_01JX9QC1",
        "concert_id": "crt_01JX9Q2M5P7KZ3R4N8Y6",
        "ticket_type_id": "tkt_01JX9Q5A",
        "seat_zone_id": "zon_01JX9Q4A",
        "qr_token_hash": "sha256:8b4f...",
        "qr_signature": "base64-signature",
        "status_snapshot": "ISSUED"
      }
    ],
    "guests": [
      {
        "guest_id": "gst_01JX9QD2",
        "concert_id": "crt_01JX9Q2M5P7KZ3R4N8Y6",
        "seat_zone_id": "zon_01JX9Q4A",
        "phone_masked": "******789",
        "full_name": "Nguyen Van A",
        "status_snapshot": "INVITED"
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

### 4.3. `POST /check-in/scan`

Quét vé online. (Route chuẩn sprint 6; alias `POST /check-in/scans` đã bỏ.)

```json
{
  "concert_id": "crt_01JX9Q2M5P7KZ3R4N8Y6",
  "device_id": "dev_01JX9Q7A",
  "gate_id": "gat_01JX9Q9C",
  "qr_token": "qr_live_token_or_signed_payload",
  "scanned_at": "2026-08-10T11:30:00Z"
}
```

Response `200`:

```json
{
  "data": {
    "result": "SUCCESS",
    "ticket": {
      "id": "tic_01JX9QC1",
      "concert_id": "crt_01JX9Q2M5P7KZ3R4N8Y6",
      "seat_zone_id": "zon_01JX9Q4A",
      "zone_code": "SVIP",
      "status": "CHECKED_IN",
      "checked_in_at": "2026-08-10T11:30:01Z"
    },
    "log_id": "log_01JX9QF4"
  },
  "meta": {
    "request_id": "req_01JX9Q6N4E"
  }
}
```

Validation order:

1. Verify role `CHECKER`.
2. Device tồn tại và thuộc staff hiện tại.
3. Gate thuộc concert và `is_active = TRUE`.
4. Verify QR signature/token.
5. Ticket thuộc concert.
6. Ticket `status = ISSUED`.
7. `ticket.seat_zone_id` nằm trong `checkin_gate_zones` của `gate_id`.
8. Update ticket và ghi `checkin_logs` trong transaction.

### 4.4. `POST /check-in/guests/scans` — ĐÃ BỎ (sprint 6)

Route check-in guest riêng đã bỏ; check-in khách mời VIP gộp vào luồng scan/`check-in`. Tra cứu guest tại cổng dùng `GET /check-in/guests/search` (role `CHECKER`, xem `guest-list-api.md`). Mô tả bên dưới giữ làm tham chiếu lịch sử.

```json
{
  "concert_id": "crt_01JX9Q2M5P7KZ3R4N8Y6",
  "device_id": "dev_01JX9Q7A",
  "gate_id": "gat_01JX9Q9C",
  "guest_id": "gst_01JX9QD2",
  "phone": "+84901234789",
  "scanned_at": "2026-08-10T11:35:00Z"
}
```

`guest_id` được ưu tiên. Nếu không có, server tìm theo `(concert_id, phone)`.

### 4.5. `POST /check-in/offline-batches`

Idempotent theo `batch_token`.

Headers:

```http
Idempotency-Key: batch_dev_01JX9Q7A_20260810_0001
```

Request:

```json
{
  "batch_token": "batch_dev_01JX9Q7A_20260810_0001",
  "concert_id": "crt_01JX9Q2M5P7KZ3R4N8Y6",
  "device_id": "dev_01JX9Q7A",
  "gate_id": "gat_01JX9Q9C",
  "started_at": "2026-08-10T11:00:00Z",
  "ended_at": "2026-08-10T12:00:00Z"
}
```

### 4.6. `POST /check-in/offline-batches/{batch_id}/items`

Request:

```json
{
  "items": [
    {
      "client_item_id": "local_scan_0001",
      "type": "TICKET",
      "qr_token": "qr_live_token_or_signed_payload",
      "ticket_id": "tic_01JX9QC1",
      "concert_id": "crt_01JX9Q2M5P7KZ3R4N8Y6",
      "gate_id": "gat_01JX9Q9C",
      "seat_zone_id": "zon_01JX9Q4A",
      "local_result": "SUCCESS",
      "local_scanned_at": "2026-08-10T11:20:00Z"
    }
  ]
}
```

Server không tin tuyệt đối local result; luôn validate lại với PostgreSQL.

### 4.7. Admin gate/device configuration — ĐÃ BỎ (sprint 6)

> **Sprint 6:** mọi route admin gate write, device và gate-zone-mapping đã bỏ (trả `404`). Admin check-in **chỉ còn** `GET /admin/check-in/gates` (role `ADMIN`) để xem danh sách cổng. Gate nay được tạo trong luồng admin duyệt hồ sơ (xem `organizer-admin-api.md`). Các ví dụ bên dưới chỉ giữ làm tham chiếu lịch sử.

Tạo cổng (đã bỏ):

```http
POST /v1/admin/concerts/{concert_id}/check-in/gates
```

```json
{
  "code": "SVIP_GATE",
  "name": "Cổng SVIP",
  "is_active": true
}
```

Cấu hình mapping:

```http
PUT /v1/admin/check-in/gates/{gate_id}/zones
```

```json
{
  "seat_zone_ids": ["zon_01JX9Q4A"]
}
```

Đăng ký thiết bị:

```http
POST /v1/admin/check-in/devices
```

```json
{
  "device_name": "Scanner SVIP 01",
  "staff_id": "usr_01JX9Q8B",
  "concert_id": "crt_01JX9Q2M5P7KZ3R4N8Y6",
  "gate_id": "gat_01JX9Q9C"
}
```

---

## 5. Error/result catalog

| HTTP | Result/Code | Ý nghĩa |
| --- | --- | --- |
| `200` | `SUCCESS` | Check-in thành công. |
| `404` | `INVALID_TICKET` | QR không tồn tại/sai chữ ký. |
| `404` | `GUEST_NOT_FOUND` | Không tìm thấy guest. |
| `409` | `ALREADY_CHECKED_IN` | Ticket/guest đã vào cổng. |
| `409` | `WRONG_CONCERT` | Vé/guest thuộc concert khác. |
| `409` | `WRONG_GATE` | Đúng concert nhưng sai cổng/khu. |
| `409` | `CONFLICT` | Hai thiết bị/cổng sync cùng một lượt. |
| `422` | `DEVICE_NOT_ASSIGNED` | Device không tồn tại hoặc không khớp staff/concert/gate. |
| `422` | `GATE_NOT_ACTIVE` | Gate inactive hoặc không thuộc concert. |

---

## 6. Acceptance criteria

- Vé hợp lệ check-in thành công đúng một lần.
- Vé sai concert hoặc sai cổng/khu bị từ chối và ghi log.
- Offline preload chỉ trả ticket/guest thuộc allowed zones.
- Batch offline retry bằng cùng `batch_token` không xử lý trùng.
- Conflict/wrong-gate được ghi rõ trong `offline_checkin_items` và `checkin_logs`.
- CHECKER → `POST /check-in/scan` = 200; alias `POST /check-in/scans` → 404.
- ORGANIZER → mọi route check-in = 403; admin check-in chỉ còn `GET /admin/check-in/gates` (`ADMIN`).
