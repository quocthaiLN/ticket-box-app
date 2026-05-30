# VIP Guest Sync

### Endpoint


#### `POST /v1/concerts/{concert_id}/vip-invitations`

BTC tạo invitation, hệ thống tự gửi email cho nhãn hàng.

**Request:**

```json
{
  "sponsor_name": "Heineken Vietnam",
  "contact_email": "events@heineken.com.vn",
  "max_guests": 150,
  "submit_deadline": "2025-11-14T23:59:00+07:00",
  "note": "Khu vực VIP Gold, cổng B"
}
```

**Response `201 Created`:**

```json
{
  "invitation_id": "inv_01JXC",
  "concert_id": "crt_01JX",
  "sponsor_name": "Heineken Vietnam",
  "contact_email": "events@heineken.com.vn",
  "max_guests": 150,
  "submit_deadline": "2025-11-14T23:59:00+07:00",
  "form_url": "https://ticketbox.vn/vip-form?token=tkn_a1b2c3d4",
  "status": "pending",
  "created_at": "2025-11-01T08:00:00Z"
}
```

---

#### `GET /v1/concerts/{concert_id}/vip-invitations`

BTC xem danh sách invitations và trạng thái từng nhãn hàng.

**Response `200 OK`:**

```json
{
  "data": [
    {
      "invitation_id": "inv_01JXC",
      "sponsor_name": "Heineken Vietnam",
      "status": "synced",
      "guest_count": 148,
      "synced_at": "2025-11-13T08:02:11Z"
    },
    {
      "invitation_id": "inv_01JXD",
      "sponsor_name": "Samsung Vietnam",
      "status": "pending",
      "submit_deadline": "2025-11-14T23:59:00+07:00"
    }
  ],
  "pagination": { "next_cursor": null, "has_more": false }
}
```

---

#### `GET /v1/vip-form?token={token}`

Public endpoint — web form SPA đọc metadata để hiển thị thông tin pre-filled cho nhãn hàng.

**Response `200 OK`:**

```json
{
  "sponsor_name": "Heineken Vietnam",
  "concert_name": "Anh Trai Say Hi — Live Concert",
  "concert_date": "2025-11-15",
  "max_guests": 150,
  "submit_deadline": "2025-11-14T23:59:00+07:00",
  "note": "Khu vực VIP Gold, cổng B"
}
```

---

#### `POST /v1/vip-form/submit`

Nhãn hàng submit danh sách khách. Không cần tài khoản, chỉ cần token.

**Header:** `X-VIP-Token: tkn_a1b2c3d4`

**Request:**

```json
{
  "guests": [
    {
      "full_name": "Nguyễn Thị An",
      "email": "an@heineken.vn",
      "phone": "0901234567",
      "note": "Brand Manager"
    },
    {
      "full_name": "Trần Văn Bình",
      "phone": "0912345678"
    }
  ]
}
```

**Xử lý server:**

1. Validate token (còn hạn, chưa bị revoke).
2. Validate sơ bộ — `full_name` bắt buộc, phải có ít nhất `email` hoặc `phone`, số lượng không vượt `max_guests`.
3. Serialize payload thành JSON, ghi vào object storage tại path: `vip-submissions/{concert_id}/{invitation_id}/{iso_timestamp}.json`.
4. Cập nhật `vip_invitation.status = submitted`.
5. Trả về `202 Accepted`.

**Response `202 Accepted`:**

```json
{
  "invitation_id": "inv_01JXC",
  "status": "submitted",
  "guest_count": 2,
  "submitted_at": "2025-11-13T07:55:00Z",
  "message": "Danh sách đã được tiếp nhận. Dữ liệu sẽ được xử lý trong vòng 15 phút."
}
```

---

#### `GET /v1/concerts/{concert_id}/vip-guests`

Nhân sự xem danh sách khách mời để soát vé.

**Query params:** `invitation_id` (filter theo nhãn hàng), `checked_in` (filter đã/chưa check-in), `search` (tìm theo tên, email, phone)

**Response `200 OK`:**

```json
{
  "data": [
    {
      "guest_id": "gst_01JXA",
      "full_name": "Nguyễn Thị An",
      "phone": "0901234567",
      "sponsor_name": "Heineken Vietnam",
      "checked_in": false
    }
  ],
  "pagination": { "next_cursor": null, "has_more": false }
}
```

---

#### `PATCH /v1/concerts/{concert_id}/vip-guests/{guest_id}/check-in`

Nhân sự xác nhận khách tại cổng VIP.

**Request:**

```json
{ "checked_in": true }
```

**Response `200 OK`:**

```json
{
  "guest_id": "gst_01JXA",
  "full_name": "Nguyễn Thị An",
  "checked_in": true,
  "checked_in_at": "2025-11-15T17:32:00Z",
  "checked_in_by": "staff_user_01"
}
```

---

#### `POST /v1/concerts/{concert_id}/vip-invitations/{invitation_id}/resend-email`

BTC gửi lại email chứa link form cho nhãn hàng (khi cần).

---

### Xử lý lỗi


| HTTP | `error.code`           | Nguyên nhân                               |
| ---- | ---------------------- | ----------------------------------------- |
| 400  | `missing_full_name`    | Thiếu `full_name` trong một guest         |
| 400  | `missing_contact`      | Không có cả `email` lẫn `phone`           |
| 400  | `guest_limit_exceeded` | Số lượng vượt `max_guests`                |
| 401  | `invalid_token`        | Token không tồn tại hoặc sai              |
| 410  | `token_expired`        | Đã qua `submit_deadline`                  |
| 410  | `token_revoked`        | BTC đã thu hồi invitation                 |
| 429  | `rate_limit_exceeded`  | Submit quá nhiều lần trong thời gian ngắn |


---

### Phân quyền 
| Role                             | Feature A                                                                         | Feature B                                   |
| -------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------- |
| `organizer` (BTC)                | Upload, xem, chỉnh sửa nội dung, submit for review, publish sau khi approved, xoá | Tạo invitation, xem danh sách, resend email |
| `reviewer`                       | Approve, reject, request revision                                                 | —                                           |
| `staff` (nhân sự soát vé)        | Xem bio đã published                                                              | Xem guest list, check-in                    |
| `public` (nhãn hàng, dùng token) | —                                                                                 | Xem form metadata, submit danh sách         |

Ghi chú: `reviewer` không thể tự publish — bắt buộc phải qua tay BTC sau khi approved, đảm bảo không bypass quy trình duyệt.
