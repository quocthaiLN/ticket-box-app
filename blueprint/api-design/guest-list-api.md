# TicketBox — Guest List API Design

Tài liệu này thiết kế API quản lý khách mời VIP, import CSV và tra cứu guest cho check-in.

Nguồn nghiệp vụ chính:

- `blueprint/specs/05-guest-list-import.md`
- `blueprint/specs/13-guest-checkin.md`
- `blueprint/database-design.md`

---

## 1. Mục tiêu

- Import guest list từ CSV một chiều, không tích hợp API đối tác ngoài.
- Lưu file vào object storage, xử lý bằng worker.
- Dòng lỗi không rollback toàn bộ batch.
- Deduplicate guest theo `(concert_id, phone)`.
- Guest được gán `seat_zone_id` để check đúng gate-zone online/offline.

---

## 2. Resource và mapping database

| Resource | Bảng | Vai trò |
| --- | --- | --- |
| `guest_import_job` | `guest_import_jobs` | Job upload/import CSV. |
| `guest_import_error` | `guest_import_errors` | Lỗi từng dòng. |
| `guest` | `guest_list` | Danh sách khách mời hợp lệ. |
| `seat_zone` | `seat_zones` | Khu/cổng khách được phép vào. |

---

## 3. Endpoint tổng hợp

| Method | Endpoint | Auth | Mục đích |
| --- | --- | --- | --- |
| `POST` | `/admin/concerts/{concert_id}/guest-import-jobs` | `ADMIN` | Upload CSV và tạo import job. |
| `GET` | `/admin/guest-import-jobs/{job_id}` | `ADMIN` | Xem trạng thái job. |
| `GET` | `/admin/guest-import-jobs/{job_id}/errors` | `ADMIN` | Xem lỗi từng dòng. |
| `GET` | `/admin/concerts/{concert_id}/guests` | `ADMIN` | Danh sách guest. |
| `POST` | `/admin/concerts/{concert_id}/guests` | `ADMIN` | Tạo guest thủ công. |
| `PATCH` | `/admin/guests/{guest_id}` | `ADMIN` | Cập nhật guest. |
| `POST` | `/admin/guests/{guest_id}/cancel` | `ADMIN` | Hủy guest. |
| `GET` | `/check-in/guests/search` | `CHECKER` | Tra cứu guest tại cổng. |

Check-in guest online thực hiện trong luồng check-in (xem `check-in-api.md`); alias cũ `POST /check-in/guests/scans`, `GET /guest-list/search`, `POST /guest-list/scan` đã bỏ (trả `404`). BTC xem guest của concert mình qua `GET /organizer/concerts/{concert_id}/guests` (xem `organizer-api.md`).

---

## 4. API chi tiết

### 4.1. `POST /admin/concerts/{concert_id}/guest-import-jobs`

Upload CSV. Dùng `multipart/form-data`.

Fields:

| Tên | Bắt buộc | Mô tả |
| --- | --- | --- |
| `file` | Có | CSV guest list. |
| `default_seat_zone_id` | Không | Zone mặc định nếu dòng không có zone. |
| `dry_run` | Không | Nếu `true`, validate nhưng không upsert guest. |

Response `202`:

```json
{
  "data": {
    "job_id": "gij_01JX9QD2",
    "concert_id": "crt_01JX9Q2M5P7KZ3R4N8Y6",
    "status": "PENDING",
    "file_url": "s3://ticketbox/guest-imports/gij_01JX9QD2.csv"
  },
  "meta": {
    "request_id": "req_01JX9Q6N4E"
  }
}
```

Ràng buộc:

- Chỉ nhận CSV.
- File được lưu object storage; DB chỉ lưu URL/metadata.
- Worker xử lý async để không chặn admin request.

### 4.2. `GET /admin/guest-import-jobs/{job_id}`

Response `200`:

```json
{
  "data": {
    "id": "gij_01JX9QD2",
    "concert_id": "crt_01JX9Q2M5P7KZ3R4N8Y6",
    "status": "PARTIAL",
    "total_rows": 1000,
    "success_rows": 982,
    "error_rows": 18,
    "started_at": "2026-05-30T10:15:30Z",
    "completed_at": "2026-05-30T10:16:12Z"
  },
  "meta": {
    "request_id": "req_01JX9Q6N4E"
  }
}
```

### 4.3. `GET /admin/guest-import-jobs/{job_id}/errors`

Response `200`:

```json
{
  "data": [
    {
      "id": "gie_01JX9QE3",
      "row_number": 17,
      "raw_data": {
        "full_name": "",
        "phone": "0901234567",
        "zone": "SVIP"
      },
      "error_message": "full_name is required"
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

### 4.4. `GET /admin/concerts/{concert_id}/guests`

Query:

| Tên | Mô tả |
| --- | --- |
| `q` | Tìm theo tên/phone. |
| `status` | `INVITED`, `CHECKED_IN`, `CANCELLED`. |
| `seat_zone_id` | Lọc theo khu. |
| `limit`, `cursor` | Phân trang. |

Response `200`:

```json
{
  "data": [
    {
      "id": "gst_01JX9QD2",
      "concert_id": "crt_01JX9Q2M5P7KZ3R4N8Y6",
      "seat_zone_id": "zon_01JX9Q4A",
      "full_name": "Nguyen Van A",
      "phone": "+84901234789",
      "email": "guest@example.com",
      "status": "INVITED"
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

### 4.5. `POST /admin/concerts/{concert_id}/guests`

Tạo guest thủ công.

```json
{
  "full_name": "Nguyen Van A",
  "phone": "+84901234789",
  "email": "guest@example.com",
  "seat_zone_id": "zon_01JX9Q4A",
  "note": "Khách mời nhà tài trợ"
}
```

Response `201`:

```json
{
  "data": {
    "id": "gst_01JX9QD2",
    "status": "INVITED"
  },
  "meta": {
    "request_id": "req_01JX9Q6N4E"
  }
}
```

Ràng buộc:

- Normalize phone trước khi lưu.
- Upsert/deduplicate theo `(concert_id, phone)` nếu policy cho phép.
- `seat_zone_id` phải thuộc concert.

### 4.6. `GET /check-in/guests/search`

Tra cứu guest cho staff tại cổng.

Query:

| Tên | Bắt buộc | Mô tả |
| --- | --- | --- |
| `concert_id` | Có | Concert hiện tại. |
| `gate_id` | Có | Cổng đang check-in. |
| `q` | Có | Phone hoặc tên. |

Response chỉ trả guest thuộc allowed zones của gate.

---

## 5. Worker rules

1. Validate header CSV và từng dòng.
2. Bắt buộc `full_name`, `phone`.
3. Normalize phone.
4. Map `zone` hoặc `seat_zone_id` sang `seat_zones.id`.
5. Dòng lỗi ghi `guest_import_errors`, không fail toàn file.
6. Dòng hợp lệ upsert `guest_list` theo `(concert_id, phone)`.
7. Job cuối cùng là `DONE`, `FAILED` hoặc `PARTIAL`.

---

## 6. Error catalog

| HTTP | Code | Khi nào xảy ra |
| --- | --- | --- |
| `400` | `INVALID_CSV` | File không parse được. |
| `404` | `GUEST_IMPORT_JOB_NOT_FOUND` | Không tìm thấy job. |
| `404` | `GUEST_NOT_FOUND` | Không tìm thấy guest. |
| `409` | `GUEST_ALREADY_CHECKED_IN` | Guest đã check-in. |
| `409` | `GUEST_PHONE_ALREADY_EXISTS` | Tạo thủ công bị trùng phone. |
| `422` | `SEAT_ZONE_NOT_FOUND` | Zone không thuộc concert. |
| `422` | `GUEST_CANCELLED` | Guest đã bị hủy. |
| `415` | `UNSUPPORTED_MEDIA_TYPE` | Upload không phải CSV. |

---

## 7. Acceptance criteria

- Import file có dòng lỗi vẫn lưu dòng hợp lệ.
- Import lại cùng phone không tạo duplicate.
- Admin xem được số dòng thành công/lỗi.
- Guest được gán zone để check đúng cổng.
- Guest sai gate-zone bị từ chối trong check-in.
- `ADMIN` quản lý import/guest; `ORGANIZER` gọi route admin guest → 403.
- `CHECKER` tra cứu guest qua `GET /check-in/guests/search`; alias cũ (`/guest-list/search`, `/guest-list/scan`) → 404.
