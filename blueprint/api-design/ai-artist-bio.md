# AI Artist Bio

### Endpoint
#### `GET /v1/concerts/{concert_id}/bios`

Liệt kê tất cả bio của concert.

**Query params:** `limit`, `cursor`, `status` (filter theo trạng thái)

**Response `200 OK`:**

```json
{
  "data": [
    {
      "bio_id": "bio_01JXA",
      "artist_name": "Sơn Tùng M-TP",
      "status": "published",
      "published_at": "2025-11-01T10:30:00Z"
    },
    {
      "bio_id": "bio_01JXB",
      "artist_name": "MONO",
      "status": "review_pending"
    }
  ],
  "pagination": {
    "next_cursor": null,
    "has_more": false
  }
}
```


---

#### `GET /v1/concerts/{concert_id}/bios/{bio_id}`

Xem chi tiết một bio. BTC dùng để poll trạng thái processing.

**Response `200 OK` (status = completed):**

```json
{
  "bio_id": "bio_01JXA",
  "concert_id": "crt_01JX",
  "artist_name": "Sơn Tùng M-TP",
  "status": "completed",
  "bio_text": "Sơn Tùng M-TP là ca sĩ...",
  "bio_html": "<p>Sơn Tùng M-TP là ca sĩ...</p>",
  "bio_text_draft": "Sơn Tùng M-TP là ca sĩ...",
  "bio_html_draft": "<p>Sơn Tùng M-TP là ca sĩ...</p>",
  "source_filename": "sontung_presskit.pdf",
  "generated_at": "2025-11-01T09:01:44Z"
}
```

**Response `200 OK` (status = failed):**

```json
{
  "bio_id": "bio_01JXA",
  "status": "failed",
  "error": {
    "code": "pdf_unreadable",
    "message": "Không thể trích xuất văn bản. File PDF có thể bị scan dạng ảnh hoặc bị mã hoá."
  }
}
```

---

#### `PATCH /v1/concerts/{concert_id}/bios/{bio_id}/content`

Chỉnh sửa nội dung bio. Cho phép khi `status ∈ { completed, revision_requested, approved }`.

**Request:**

```json
{
  "bio_text": "...",
  "bio_html": "<p>...</p>"
}
```

Không thay đổi `bio_text_draft` và `bio_html_draft`.

---

#### `PATCH /v1/concerts/{concert_id}/bios/{bio_id}/review`

Thực hiện hành động review.

**Request:**

```json
{
  "action": "approve | reject | request_revision | submit_for_review",
  "reviewer_note": "Nội dung ổn, approved."
}
```

`reviewer_note` bắt buộc khi `action = reject | request_revision`.

---

#### `POST /v1/concerts/{concert_id}/bios/{bio_id}/publish`

Publish bio lên trang concert. Chỉ cho phép khi `status = approved`.

**Response `200 OK`:**

```json
{
  "bio_id": "bio_01JXA",
  "status": "published",
  "published_at": "2025-11-01T10:30:00Z"
}
```

---

#### `POST /v1/concerts/{concert_id}/bios/{bio_id}/unpublish`

Gỡ bio. Chuyển `status → approved`.

---

#### `POST /v1/concerts/{concert_id}/bios/{bio_id}/regenerate`

Generate lại từ PDF cũ. Cho phép khi `status ∈ { failed, rejected }`.

**Response `202 Accepted`:**

```json
{
  "bio_id": "bio_01JXA",
  "status": "processing",
  "job_id": "job_01JXB"
}
```

---

#### `DELETE /v1/concerts/{concert_id}/bios/{bio_id}`

Xoá bio. Không cho phép xoá bio đang `published`.

--- 

### Xử lý lỗi

| HTTP | `error.code`                | Nguyên nhân                                                  |
| ---- | --------------------------- | ------------------------------------------------------------ |
| 400  | `missing_artist_name`       | Không có field `artist_name`                                 |
| 409  | `duplicate_bio`             | Đã có bio `completed/published` cho artist này trong concert |
| 409  | `invalid_status_transition` | Hành động không hợp lệ với status hiện tại                   |
| 413  | `file_too_large`            | PDF > 20MB                                                   |
| 415  | `unsupported_media_type`    | Upload không phải PDF                                        |
| 422  | `reviewer_note_required`    | Thiếu `reviewer_note` khi reject hoặc request_revision       |
| 429  | `rate_limit_exceeded`       | Quá nhiều upload trong thời gian ngắn                        |