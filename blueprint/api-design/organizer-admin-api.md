# TicketBox — Organizer Admin API Design

Tài liệu này thiết kế API cho **luồng admin duyệt hồ sơ tổ chức concert** (`/v1/admin/organizer-requests/*`, `/v1/admin/concert-deletion-requests/*`, `/v1/admin/concerts/:id/checker-accounts`, role `ADMIN`). Module mới của đợt refactor role/route (sprint 6), bổ trợ cho [`organizer-api.md`](organizer-api.md).

Điểm cốt lõi: khi admin **approve** một hồ sơ, hệ thống tự tạo trong một transaction: `Concert (DRAFT)` + `SeatZone[]` + `TicketType[]` + `CheckinGate[]` + `User(CHECKER)[]` + `ConcertCheckerAccount[]`, và trả mật khẩu checker **một lần duy nhất**.

Nguồn:

- Kế hoạch refactor `template2.md` (Bước 6, 7)
- `blueprint/api-design/base-api.md`, `blueprint/api-design/rbac-route-map.md`
- `blueprint/api-design/catalog-api.md` (tái dùng `createSeatZone`/`createTicketType`/`setConcertStatus`)
- `blueprint/api-design/auth-rbac-api.md` (tái dùng `hashPassword`, status user)

---

## 1. Mục tiêu

- Admin xem, duyệt, từ chối hồ sơ xin tổ chức concert.
- Approve = vật chất hóa hồ sơ thành concert vận hành đầy đủ trong **một transaction** (all-or-nothing).
- Admin xem, duyệt, từ chối yêu cầu xóa concert; approve = set concert `CANCELLED`.
- Checker account của concert tự `DISABLED` khi concert kết thúc/hủy.
- Admin xem danh sách checker account theo concert (không lộ password).

---

## 2. Resource và mapping database

| Resource | Bảng | Vai trò |
| --- | --- | --- |
| `organizer_request` | `organizer_requests` | Hồ sơ cần duyệt. |
| `concert_deletion_request` | `concert_deletion_requests` | Yêu cầu xóa concert. |
| `concert_checker_account` | `concert_checker_accounts` | Gắn checker ↔ concert. |
| `concert` / `seat_zone` / `ticket_type` | `concerts` / `seat_zones` / `ticket_types` | Tạo khi approve. |
| `checkin_gate` | `checkin_gates` | Tạo `gate_count` cổng khi approve. |
| `user` | `users` | Tạo `checker_count` tài khoản `CHECKER`. |

Enum dùng chung `approval_status`: `PENDING`, `APPROVED`, `REJECTED`.

---

## 3. RBAC

| Nhóm endpoint | Auth |
| --- | --- |
| Toàn bộ duyệt hồ sơ/xóa concert/checker | `requireRole("ADMIN")` |

---

## 4. Endpoint tổng hợp

| Method | Endpoint | Mục đích |
| --- | --- | --- |
| `GET` | `/admin/organizer-requests` | List hồ sơ (filter `?status=`). |
| `GET` | `/admin/organizer-requests/:request_id` | Chi tiết hồ sơ. |
| `POST` | `/admin/organizer-requests/:request_id/approve` | Duyệt → tạo concert + zones + ticket types + gates + checkers. |
| `POST` | `/admin/organizer-requests/:request_id/reject` | Từ chối hồ sơ. |
| `GET` | `/admin/concert-deletion-requests` | List yêu cầu xóa concert. |
| `POST` | `/admin/concert-deletion-requests/:request_id/approve` | Duyệt → set concert `CANCELLED`. |
| `POST` | `/admin/concert-deletion-requests/:request_id/reject` | Từ chối yêu cầu xóa. |
| `GET` | `/admin/concerts/:concert_id/checker-accounts` | List checker account của concert. |

---

## 5. API chi tiết — duyệt hồ sơ tổ chức

### 5.1. `GET /admin/organizer-requests`

**Query:** `status?` (`PENDING`/`APPROVED`/`REJECTED`), `limit?`, `cursor?`.

**Response `200`**

```json
{
  "data": [
    {
      "id": "oqr_01JX9QR1",
      "organizer_id": "usr_01JX9Q9C",
      "title": "Đêm nhạc Indie",
      "artist_name": "The Cassette",
      "venue_id": "ven_01JX9Q2N",
      "starts_at": "2026-09-20T13:00:00Z",
      "ends_at": "2026-09-20T16:00:00Z",
      "gate_count": 2,
      "checker_count": 4,
      "status": "PENDING",
      "created_at": "2026-06-21T08:00:00Z"
    }
  ],
  "pagination": { "next_cursor": null, "has_more": false, "limit": 20 },
  "meta": { "request_id": "req_01JX9Q6N4E" }
}
```

---

### 5.2. `GET /admin/organizer-requests/:request_id`

Chi tiết hồ sơ, đầy đủ `ticket_types` (JSON), `review_note`, `reviewed_by`, `reviewed_at`, `concert_id` (nếu đã duyệt).

- Không tồn tại → `404 ORGANIZER_REQUEST_NOT_FOUND`.

---

### 5.3. `POST /admin/organizer-requests/:request_id/approve`

Duyệt hồ sơ. **Chạy trong `prisma.$transaction`** — all-or-nothing.

**Các bước trong transaction**

1. Lấy request; nếu `status != PENDING` → `409 ORGANIZER_REQUEST_NOT_PENDING`.
2. Tạo `Concert` `{ venue_id, organizer_id, title, slug: slugify(title)+random ngắn, artist_name, description, starts_at, ends_at, planned_publish_at, status: "DRAFT" }`.
3. Với mỗi `zone_code` distinct trong `ticket_types`: tạo `SeatZone { concert_id, code, name, capacity }`.
4. Với mỗi `ticket_types[i]`: tạo `TicketType { concert_id, seat_zone_id (map theo zone_code), name, price, total_quantity, max_per_user, sale_start_at, sale_end_at }`.
5. Tạo `gate_count` `CheckinGate { concert_id, code: "GATE-i", name: "Cổng i" }`.
6. Tạo `checker_count` `User { role: "CHECKER", email: checker-{slug}-{i}@ticketbox.local, password_hash: hash(random) }`; lưu plaintext password tạm để trả về **một lần**. Tạo `ConcertCheckerAccount { concert_id, user_id, organizer_request_id }`.
7. Update request: `status = APPROVED`, `reviewed_by = adminId`, `reviewed_at = now`, `concert_id`.

**Response `201`**

```json
{
  "data": {
    "concert": {
      "id": "crt_01JX9Q2M5P7KZ3R4N8Y6",
      "title": "Đêm nhạc Indie",
      "slug": "dem-nhac-indie-a1b2",
      "status": "DRAFT"
    },
    "seat_zones_created": 1,
    "ticket_types_created": 1,
    "gates_created": 2,
    "checker_accounts": [
      {
        "user_id": "usr_01JX9QU4",
        "email": "checker-dem-nhac-indie-1@ticketbox.local",
        "password": "Xy7$kQp2mN"
      },
      {
        "user_id": "usr_01JX9QU5",
        "email": "checker-dem-nhac-indie-2@ticketbox.local",
        "password": "Aa9#vRt4wZ"
      }
    ]
  },
  "meta": { "request_id": "req_01JX9Q6N4E" }
}
```

> **`password` chỉ hiển thị một lần** ở response approve. Các endpoint list checker khác không bao giờ trả password. Admin phải bàn giao ngay cho BTC/checker.

**Ràng buộc**

- Idempotent theo trạng thái: request đã `APPROVED`/`REJECTED` → `409 ORGANIZER_REQUEST_NOT_PENDING`.
- Tái dùng `hashPassword` từ `auth.utils.ts`.
- Có thể tái dùng `CatalogService.createSeatZone/createTicketType` để validate capacity; nhưng trong transaction nên gọi prisma trực tiếp cho gọn.
- Ghi `audit_logs` loại `APPROVE_ORGANIZER_REQUEST`.

---

### 5.4. `POST /admin/organizer-requests/:request_id/reject`

Từ chối hồ sơ.

**Request**

```json
{ "review_note": "Thiếu hợp đồng địa điểm." }
```

**Response `200`**

```json
{
  "data": {
    "id": "oqr_01JX9QR1",
    "status": "REJECTED",
    "reviewed_at": "2026-06-21T10:00:00Z"
  },
  "meta": { "request_id": "req_01JX9Q6N4E" }
}
```

- Set `status = REJECTED`, `review_note`, `reviewed_by`, `reviewed_at`.
- Request không `PENDING` → `409 ORGANIZER_REQUEST_NOT_PENDING`.

---

## 6. API chi tiết — duyệt xóa concert

### 6.1. `GET /admin/concert-deletion-requests`

**Query:** `status?`, `limit?`, `cursor?`.

**Response `200`**

```json
{
  "data": [
    {
      "id": "cdr_01JX9QS2",
      "concert_id": "crt_01JX9Q2M5P7KZ3R4N8Y6",
      "organizer_id": "usr_01JX9Q9C",
      "reason": "Sự kiện bị hoãn vô thời hạn.",
      "status": "PENDING",
      "created_at": "2026-06-21T09:10:00Z"
    }
  ],
  "pagination": { "next_cursor": null, "has_more": false, "limit": 20 },
  "meta": { "request_id": "req_01JX9Q6N4E" }
}
```

---

### 6.2. `POST /admin/concert-deletion-requests/:request_id/approve`

Duyệt yêu cầu xóa: verify `PENDING` → `setConcertStatus(concert_id, "CANCELLED")` → set request `APPROVED`. Việc set `CANCELLED` kéo theo vô hiệu checker (xem §7).

**Response `200`**

```json
{
  "data": {
    "id": "cdr_01JX9QS2",
    "concert_id": "crt_01JX9Q2M5P7KZ3R4N8Y6",
    "concert_status": "CANCELLED",
    "status": "APPROVED",
    "reviewed_at": "2026-06-21T10:05:00Z"
  },
  "meta": { "request_id": "req_01JX9Q6N4E" }
}
```

- Request không `PENDING` → `409`.
- Không xóa vật lý concert đã có giao dịch; chỉ chuyển trạng thái `CANCELLED`.
- Ghi `audit_logs` loại `APPROVE_CONCERT_DELETION`.

---

### 6.3. `POST /admin/concert-deletion-requests/:request_id/reject`

**Request**

```json
{ "review_note": "Concert đã bán vé, không thể xóa." }
```

**Response `200`** — set `status = REJECTED`, concert giữ nguyên trạng thái.

---

## 7. Checker tự vô hiệu khi concert kết thúc/hủy

Trong `catalog.repository.setConcertStatus`, sau khi cập nhật concert sang `CANCELLED`/`COMPLETED`, **trong cùng transaction**:

1. Lấy `user_id[]` từ `ConcertCheckerAccount.findMany({ where: { concert_id } })`.
2. `prisma.user.updateMany({ where: { id: { in: userIds } }, data: { status: "DISABLED" } })`.

Áp dụng cho cả `cancelConcert` (admin) và `approveDeletion` (qua `setConcertStatus`). Nếu sau này có endpoint chuyển `COMPLETED` thì tự động hưởng. Checker bị `DISABLED` không đăng nhập được (xem `auth-rbac-api.md`).

---

## 8. `GET /admin/concerts/:concert_id/checker-accounts`

List checker account của một concert. **Không** trả password.

**Response `200`**

```json
{
  "data": [
    {
      "id": "cca_01JX9QT3",
      "user_id": "usr_01JX9QU4",
      "email": "checker-dem-nhac-indie-1@ticketbox.local",
      "status": "ACTIVE",
      "created_at": "2026-06-21T08:30:00Z"
    }
  ],
  "pagination": { "next_cursor": null, "has_more": false, "limit": 20 },
  "meta": { "request_id": "req_01JX9Q6N4E" }
}
```

---

## 9. Error catalog

| HTTP | Code | Khi nào xảy ra |
| --- | --- | --- |
| `401` | `UNAUTHORIZED` | Thiếu/sai JWT. |
| `403` | `FORBIDDEN` | Không phải `ADMIN`. |
| `404` | `ORGANIZER_REQUEST_NOT_FOUND` | Hồ sơ không tồn tại. |
| `404` | `DELETION_REQUEST_NOT_FOUND` | Yêu cầu xóa không tồn tại. |
| `404` | `CONCERT_NOT_FOUND` | Concert không tồn tại. |
| `409` | `ORGANIZER_REQUEST_NOT_PENDING` | Approve/reject hồ sơ đã xử lý. |
| `409` | `DELETION_REQUEST_NOT_PENDING` | Approve/reject yêu cầu xóa đã xử lý. |
| `422` | `VALIDATION_ERROR` | `ticket_types` trong hồ sơ sai (capacity/sale window). |

---

## 10. Quy tắc triển khai

1. Approve hồ sơ phải all-or-nothing trong `prisma.$transaction`; lỗi bất kỳ bước nào thì rollback toàn bộ.
2. Password checker chỉ trả ở response approve, **không** lưu/không log plaintext.
3. `slug` concert phải unique (slugify + random ngắn).
4. `setConcertStatus` là nơi duy nhất disable checker — không nhân bản logic ở nhiều chỗ.
5. Mọi hành động duyệt ghi `audit_logs` với actor admin.
6. Không cho duyệt lại hồ sơ/yêu cầu đã `APPROVED`/`REJECTED`.

---

## 11. Acceptance criteria

- `POST /admin/organizer-requests/:id/approve` tạo Concert `DRAFT` + seat zones + ticket types + `gate_count` gates + `checker_count` checker accounts; response trả password checker đúng một lần.
- Approve lần hai cùng hồ sơ → `409 ORGANIZER_REQUEST_NOT_PENDING`.
- `POST /admin/concert-deletion-requests/:id/approve` → concert `CANCELLED`, checker của concert chuyển `DISABLED` (kiểm tra DB).
- `GET /admin/concerts/:id/checker-accounts` trả email/status/created_at, không có password.
- Reject hồ sơ set `REJECTED` + `review_note`.
