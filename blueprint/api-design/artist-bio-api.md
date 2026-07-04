# TicketBox — Artist Bio API Design

Tài liệu này thiết kế API cho luồng sinh Artist Bio bằng AI theo database-design mới. Kết quả sinh lưu ở `artist_bio_jobs.generated_bio` và được publish vào `concerts.artist_bio`.

Nguồn nghiệp vụ chính:

- `blueprint/specs/06-artist-bio-ai.md`
- `blueprint/database-design.md`

---

## 1. Mục tiêu

- Admin/Organizer upload PDF/Press Kit cho concert.
- Backend lưu file vào Object Storage và tạo `artist_bio_jobs`.
- AI Worker trích xuất text, làm sạch nội dung, gọi AI Model API và cập nhật `generated_bio`.
- Khi job thành công, worker hoặc admin publish bio vào `concerts.artist_bio`.
- Lỗi AI/PDF không làm gián đoạn luồng xem concert hoặc mua vé.

---

## 2. Resource và mapping database

| Resource | Bảng | Vai trò |
| --- | --- | --- |
| `artist_bio_job` | `artist_bio_jobs` | Job xử lý PDF/Press Kit bất đồng bộ và lưu kết quả AI. |
| `concert` | `concerts` | Lưu `artist_name`, `artist_bio`; dữ liệu hiển thị public. |
| `audit_log` | `audit_logs` | Audit upload, sửa, publish bio. |

---

## 3. Endpoint tổng hợp

| Method | Endpoint | Auth | Mục đích |
| --- | --- | --- | --- |
| `POST` | `/admin/concerts/{concert_id}/artist-bio-jobs` | `ORGANIZER`, `ADMIN` | Upload PDF/Press Kit và tạo AI job. |
| `GET` | `/admin/artist-bio-jobs/{job_id}` | `ORGANIZER`, `ADMIN` | Poll trạng thái job. |
| `POST` | `/admin/artist-bio-jobs/{job_id}/retry` | `ORGANIZER`, `ADMIN` | Retry job lỗi. |
| `POST` | `/admin/artist-bio-jobs/{job_id}/publish` | `ORGANIZER`, `ADMIN` | Publish `generated_bio` vào concert. |
| `PATCH` | `/admin/concerts/{concert_id}/artist-bio` | `ORGANIZER`, `ADMIN` | Chỉnh sửa bio hiện tại của concert. |
| `GET` | `/concerts/{concert_id}/artist-bio` | Public | Lấy bio public từ `concerts.artist_bio`. |

---

## 4. API chi tiết

### 4.1. `POST /admin/concerts/{concert_id}/artist-bio-jobs`

Upload file PDF/Press Kit. Dùng `multipart/form-data`.

| Field | Bắt buộc | Mô tả |
| --- | --- | --- |
| `file` | Có | PDF/DOCX/TXT hoặc ZIP press kit nếu backend hỗ trợ. |
| `artist_name` | Không | Tên nghệ sĩ nếu khác `concerts.artist_name`. |
| `language` | Không | Mặc định `vi`. |
| `prompt_profile` | Không | Profile prompt, mặc định `artist_bio_short`. |

Response `202`:

```json
{
  "data": {
    "job_id": "abj_01JX9QK1",
    "concert_id": "crt_01JX9Q2M5P7KZ3R4N8Y6",
    "status": "PENDING",
    "source_file_url": "s3://ticketbox/press-kits/crt_01JX9Q2M5P7KZ3R4N8Y6.pdf"
  },
  "meta": {
    "request_id": "req_01JX9Q6N4E"
  }
}
```

Side effects:

- Upload file vào Object Storage.
- Tạo `artist_bio_jobs`.
- Publish event `ProcessArtistBioJob`.
- Ghi audit log `CREATE_ARTIST_BIO_JOB`.

### 4.2. `GET /admin/artist-bio-jobs/{job_id}`

Response `200`:

```json
{
  "data": {
    "id": "abj_01JX9QK1",
    "concert_id": "crt_01JX9Q2M5P7KZ3R4N8Y6",
    "status": "DONE",
    "generated_bio": "Bản giới thiệu ngắn gọn do AI hỗ trợ biên tập.",
    "model_name": "gpt-4o-mini",
    "error_message": null,
    "completed_at": "2026-05-30T10:16:45Z"
  },
  "meta": {
    "request_id": "req_01JX9Q6N4E"
  }
}
```

### 4.3. `POST /admin/artist-bio-jobs/{job_id}/retry`

Retry job lỗi.

Ràng buộc:

- Chỉ retry job `FAILED`.
- Reset `status = PENDING`, clear `error_message`.
- Publish lại event worker.

### 4.4. `POST /admin/artist-bio-jobs/{job_id}/publish`

Publish `generated_bio` của job thành bio public của concert.

Response `200`:

```json
{
  "data": {
    "concert_id": "crt_01JX9Q2M5P7KZ3R4N8Y6",
    "artist_bio": "Bản giới thiệu ngắn gọn do AI hỗ trợ biên tập.",
    "updated_at": "2026-05-30T10:18:00Z"
  },
  "meta": {
    "request_id": "req_01JX9Q6N4E"
  }
}
```

Side effects:

- Cập nhật `concerts.artist_bio`.
- Invalidate `catalog:concert:{concert_id}` và metadata CDN nếu có.
- Ghi audit log `PUBLISH_ARTIST_BIO`.

### 4.5. `PATCH /admin/concerts/{concert_id}/artist-bio`

Cho phép Organizer/Admin chỉnh sửa bio public hiện tại.

```json
{
  "artist_bio": "Nội dung bio đã được biên tập thủ công."
}
```

Side effects:

- Cập nhật `concerts.artist_bio`.
- Invalidate Catalog cache.
- Ghi audit log `UPDATE_CONCERT_ARTIST_BIO`.

### 4.6. `GET /concerts/{concert_id}/artist-bio`

Public endpoint đọc `concerts.artist_bio`.

Nếu chưa có bio, trả `data: null` để frontend hiển thị fallback.

---

## 5. Worker rules

1. Worker lấy job `PENDING`, chuyển sang `PROCESSING`.
2. Download file từ Object Storage.
3. Extract text; nếu file lỗi, set `FAILED`.
4. Làm sạch text, giới hạn token và bỏ nội dung nhiễu.
5. Gọi AI Model API theo prompt chuẩn.
6. Khi thành công, cập nhật `artist_bio_jobs.generated_bio`, `model_name`, `status = DONE`, `completed_at`.
7. Nếu cấu hình auto-publish, cập nhật `concerts.artist_bio` trong cùng luồng worker.
8. Lỗi AI/rate limit ghi `FAILED` hoặc retry theo queue policy.

---

## 6. Error catalog

| HTTP | Code | Khi nào xảy ra |
| --- | --- | --- |
| `400` | `INVALID_UPLOAD` | Thiếu file hoặc request multipart sai. |
| `403` | `FORBIDDEN` | Organizer không sở hữu concert. |
| `404` | `ARTIST_BIO_JOB_NOT_FOUND` | Job không tồn tại hoặc không được phép xem. |
| `404` | `CONCERT_NOT_FOUND` | Concert không tồn tại hoặc không được phép xem. |
| `409` | `JOB_NOT_RETRYABLE` | Retry job không ở trạng thái `FAILED`. |
| `409` | `JOB_NOT_DONE` | Publish job chưa có `generated_bio`. |
| `413` | `FILE_TOO_LARGE` | File vượt kích thước cho phép. |

---

## 7. Acceptance criteria

- Upload press kit trả `202` và tạo job.
- Job AI thành công lưu `generated_bio`.
- Publish job cập nhật `concerts.artist_bio` và invalidate cache.
- AI lỗi không ảnh hưởng mua vé/xem concert.
