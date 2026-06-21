# TicketBox — Organizer API Design

Tài liệu này thiết kế API cho **Organizer Module** (`/v1/organizer/*`, role `ORGANIZER`) — không gian làm việc của Ban tổ chức (BTC). Module mới của đợt refactor role/route (sprint 6), tách hẳn khỏi `/admin/*`.

Luồng nghiệp vụ: BTC khai **hồ sơ xin tổ chức concert** (kèm số cổng, số checker, danh sách loại vé). Admin duyệt thì hệ thống tự tạo concert `DRAFT` + seat zones + ticket types + gates + checker accounts (xem [`organizer-admin-api.md`](organizer-admin-api.md)). Sau đó BTC tự sửa concert `DRAFT`, xem thống kê, order, tồn kho, checker và guest của concert mình.

Nguồn:

- Kế hoạch refactor `template2.md` (Bước 1, 5)
- `blueprint/api-design/base-api.md`, `blueprint/api-design/rbac-route-map.md`
- `blueprint/api-design/catalog-api.md` (tái dùng concert/zone/ticket-type model)
- `blueprint/database-design.md`

---

## 1. Mục tiêu

- Mỗi BTC chỉ thấy và thao tác dữ liệu **do mình sở hữu** (`organizer_id = current_user.id`).
- BTC **không** tạo concert trực tiếp; phải qua hồ sơ + admin duyệt.
- BTC sửa **trực tiếp** concert `DRAFT` của mình, không cần duyệt lại.
- BTC xin xóa concert → tạo deletion request để admin duyệt.
- Cung cấp thống kê doanh thu, vé bán, tỉ lệ check-in cho concert của BTC.

---

## 2. Base URL và chuẩn response

Mọi route nằm dưới `/v1/organizer`. Envelope `{ data, meta.request_id }`; collection kèm `pagination`; lỗi RFC 7807.

---

## 3. Resource và mapping database

| Resource | Bảng | Vai trò |
| --- | --- | --- |
| `organizer_request` | `organizer_requests` | Hồ sơ xin tổ chức concert. |
| `concert_deletion_request` | `concert_deletion_requests` | Yêu cầu xóa concert. |
| `concert_checker_account` | `concert_checker_accounts` | Gắn checker ↔ concert. |
| `concert` | `concerts` | Concert do BTC sở hữu. |
| `seat_zone` / `ticket_type` | `seat_zones` / `ticket_types` | Khu vực + loại vé (tạo khi duyệt hồ sơ). |
| `order` | `orders` | Order thuộc concert của BTC. |
| `venue` | `venues` | Venue seed để chọn khi khai hồ sơ. |

**Bảng `organizer_requests` (mới):** `id`, `organizer_id`, `venue_id`, `title`, `artist_name`, `description?`, `starts_at`, `ends_at`, `planned_publish_at`, `gate_count` (default 1), `checker_count` (default 1), `press_kit_url?`, `ticket_types` (JSON), `status` (`PENDING`/`APPROVED`/`REJECTED`), `reviewed_by?`, `reviewed_at?`, `review_note?`, `concert_id?`, `created_at`, `updated_at`.

`ticket_types` (JSON) mỗi phần tử: `{ zone_code, zone_name, zone_capacity, name, price, total_quantity, max_per_user, sale_start_at, sale_end_at }`.

---

## 4. RBAC

| Nhóm endpoint | Auth | Quyền |
| --- | --- | --- |
| Toàn bộ `/organizer/*` | `requireRole("ORGANIZER")` | Backend **luôn filter theo `organizer_id`**. |

Truy cập request/concert/order/ticket-type không thuộc sở hữu → `403 FORBIDDEN` hoặc `404` tùy resource (không lộ dữ liệu của BTC khác). Concert không ở `DRAFT` khi sửa → `409 CONCERT_NOT_EDITABLE`.

---

## 5. Endpoint tổng hợp

| Method | Endpoint | Mục đích |
| --- | --- | --- |
| `GET` | `/organizer/venues` | List venue seed để chọn. |
| `GET` | `/organizer/requests` | List hồ sơ của mình. |
| `POST` | `/organizer/requests` | Tạo hồ sơ xin tổ chức. |
| `GET` | `/organizer/requests/:request_id` | Chi tiết hồ sơ. |
| `GET` | `/organizer/concerts` | List concert của mình. |
| `POST` | `/organizer/concerts/:concert_id` | Sửa trực tiếp concert `DRAFT`. |
| `POST` | `/organizer/concerts/:concert_id/deletion-requests` | Xin xóa concert. |
| `GET` | `/organizer/concerts/:concert_id/analytics` | Thống kê concert. |
| `GET` | `/organizer/orders` | Order của các concert mình sở hữu. |
| `GET` | `/organizer/ticket-types/:ticket_type_id/inventory` | Tồn kho theo loại vé. |
| `GET` | `/organizer/checker-accounts` | List checker account của các concert mình. |
| `GET` | `/organizer/concerts/:concert_id/guests` | List guest của concert mình. |

---

## 6. API chi tiết

### 6.1. `GET /organizer/venues`

Trả danh sách venue để BTC chọn khi khai hồ sơ (read-only, tái dùng list venue của catalog).

**Query:** `q?`, `city?`, `limit?` (mặc định 20, tối đa 100), `cursor?`.

**Response `200`**

```json
{
  "data": [
    {
      "id": "ven_01JX9Q2N",
      "name": "Sân vận động Mỹ Đình",
      "address": "Lê Đức Thọ, Nam Từ Liêm",
      "city": "Hà Nội",
      "capacity": 40000
    }
  ],
  "pagination": { "next_cursor": null, "has_more": false, "limit": 20 },
  "meta": { "request_id": "req_01JX9Q6N4E" }
}
```

---

### 6.2. `GET /organizer/requests`

List hồ sơ của BTC hiện tại.

**Query:** `status?` (`PENDING`/`APPROVED`/`REJECTED`), `limit?`, `cursor?`.

**Response `200`**

```json
{
  "data": [
    {
      "id": "oqr_01JX9QR1",
      "title": "Đêm nhạc Indie",
      "artist_name": "The Cassette",
      "venue_id": "ven_01JX9Q2N",
      "starts_at": "2026-09-20T13:00:00Z",
      "ends_at": "2026-09-20T16:00:00Z",
      "planned_publish_at": "2026-08-01T03:00:00Z",
      "gate_count": 2,
      "checker_count": 4,
      "status": "PENDING",
      "concert_id": null,
      "created_at": "2026-06-21T08:00:00Z"
    }
  ],
  "pagination": { "next_cursor": null, "has_more": false, "limit": 20 },
  "meta": { "request_id": "req_01JX9Q6N4E" }
}
```

---

### 6.3. `POST /organizer/requests`

Tạo hồ sơ xin tổ chức concert.

**Request**

```json
{
  "venue_id": "ven_01JX9Q2N",
  "title": "Đêm nhạc Indie",
  "artist_name": "The Cassette",
  "description": "Đêm nhạc indie cuối hè.",
  "starts_at": "2026-09-20T13:00:00Z",
  "ends_at": "2026-09-20T16:00:00Z",
  "planned_publish_at": "2026-08-01T03:00:00Z",
  "gate_count": 2,
  "checker_count": 4,
  "press_kit_url": "https://cdn.ticketbox.vn/press/indie-night.pdf",
  "ticket_types": [
    {
      "zone_code": "GA",
      "zone_name": "General Admission",
      "zone_capacity": 1000,
      "name": "Vé thường",
      "price": { "amount": 500000, "currency": "VND" },
      "total_quantity": 1000,
      "max_per_user": 4,
      "sale_start_at": "2026-08-01T03:00:00Z",
      "sale_end_at": "2026-09-19T17:00:00Z"
    }
  ]
}
```

**Response `201`**

```json
{
  "data": {
    "id": "oqr_01JX9QR1",
    "status": "PENDING",
    "created_at": "2026-06-21T08:00:00Z"
  },
  "meta": { "request_id": "req_01JX9Q6N4E" }
}
```

**Ràng buộc**

- `venue_id` phải tồn tại.
- `gate_count >= 1`, `checker_count >= 1` (int).
- `ticket_types` tối thiểu 1 phần tử.
- Mỗi `ticket_types[i]`: `total_quantity > 0`, `max_per_user > 0`, `sale_end_at > sale_start_at`, `price.amount >= 0`.
- `ends_at > starts_at`; nên có `planned_publish_at <= starts_at`.
- Tổng `total_quantity` theo từng `zone_code` không vượt `zone_capacity`.
- Hồ sơ tạo ở `status = PENDING`, `organizer_id` lấy từ token.
- `ticket_types` lưu nguyên dạng JSON; chỉ vật chất hóa thành seat_zones/ticket_types khi admin duyệt.

---

### 6.4. `GET /organizer/requests/:request_id`

Chi tiết một hồ sơ (chỉ của mình). Trả đầy đủ `ticket_types`, trạng thái duyệt, `review_note`, `concert_id` (nếu đã duyệt).

- Không thuộc sở hữu → `404 ORGANIZER_REQUEST_NOT_FOUND`.

---

### 6.5. `GET /organizer/concerts`

List concert `where organizer_id = me`, mọi trạng thái (`DRAFT`/`PUBLISHED`/`CANCELLED`/`COMPLETED`).

**Query:** `status?`, `q?`, `limit?`, `cursor?`.

**Response `200`**

```json
{
  "data": [
    {
      "id": "crt_01JX9Q2M5P7KZ3R4N8Y6",
      "title": "Đêm nhạc Indie",
      "status": "DRAFT",
      "starts_at": "2026-09-20T13:00:00Z",
      "ends_at": "2026-09-20T16:00:00Z",
      "venue": { "id": "ven_01JX9Q2N", "name": "Sân vận động Mỹ Đình" }
    }
  ],
  "pagination": { "next_cursor": null, "has_more": false, "limit": 20 },
  "meta": { "request_id": "req_01JX9Q6N4E" }
}
```

---

### 6.6. `POST /organizer/concerts/:concert_id`

BTC **sửa trực tiếp** concert `DRAFT` của mình (không cần duyệt). Dùng `POST` (không `PATCH`) theo route map.

**Request** (subset của concert, optional)

```json
{
  "title": "Đêm nhạc Indie 2026",
  "description": "Bản cập nhật mô tả.",
  "artist_name": "The Cassette",
  "starts_at": "2026-09-20T13:00:00Z",
  "ends_at": "2026-09-20T16:30:00Z",
  "cover_image_url": "https://cdn.ticketbox.vn/concerts/indie-night.webp"
}
```

**Response `200`**

```json
{
  "data": {
    "id": "crt_01JX9Q2M5P7KZ3R4N8Y6",
    "status": "DRAFT",
    "updated_at": "2026-06-21T09:00:00Z"
  },
  "meta": { "request_id": "req_01JX9Q6N4E" }
}
```

**Ràng buộc**

- Concert không thuộc sở hữu → `403 CONCERT_NOT_OWNED_BY_ORGANIZER` (hoặc `404`).
- Concert không ở `DRAFT` → `409 CONCERT_NOT_EDITABLE`.
- Không sửa `id`, `organizer_id`, `status`, `slug`.
- Tái dùng `CatalogService.updateConcert` + invalidate cache catalog liên quan.

---

### 6.7. `POST /organizer/concerts/:concert_id/deletion-requests`

BTC xin xóa concert; admin sẽ duyệt (set `CANCELLED`).

**Request**

```json
{ "reason": "Sự kiện bị hoãn vô thời hạn." }
```

**Response `201`**

```json
{
  "data": {
    "id": "cdr_01JX9QS2",
    "concert_id": "crt_01JX9Q2M5P7KZ3R4N8Y6",
    "status": "PENDING",
    "created_at": "2026-06-21T09:10:00Z"
  },
  "meta": { "request_id": "req_01JX9Q6N4E" }
}
```

**Ràng buộc**

- Verify ownership trước khi tạo.
- `reason` optional.
- Tạo `concert_deletion_requests` ở `status = PENDING`.

---

### 6.8. `GET /organizer/concerts/:concert_id/analytics`

Thống kê tổng hợp concert của BTC.

**Response `200`**

```json
{
  "data": {
    "concert_id": "crt_01JX9Q2M5P7KZ3R4N8Y6",
    "revenue": { "amount": 125000000, "currency": "VND" },
    "tickets_sold": 250,
    "tickets_total": 1000,
    "checked_in": 180,
    "check_in_rate": 0.72
  },
  "meta": { "request_id": "req_01JX9Q6N4E" }
}
```

**Cách tính**

- `revenue` = `sum(orders.total_amount)` của order `CONFIRMED` thuộc concert.
- `tickets_sold` = `count(tickets)` (hoặc `sum(ticket_types.sold_quantity)`).
- `checked_in` = `count(tickets status = CHECKED_IN)`.
- `check_in_rate` = `checked_in / tickets_sold` (0 nếu chưa bán vé).

---

### 6.9. `GET /organizer/orders`

Order của tất cả concert mà BTC sở hữu (`where concert.organizer_id = me`).

**Query:** `concert_id?`, `status?`, `limit?`, `cursor?`.

**Response `200`**

```json
{
  "data": [
    {
      "id": "ord_01JX9QA1",
      "concert_id": "crt_01JX9Q2M5P7KZ3R4N8Y6",
      "status": "CONFIRMED",
      "total_amount": { "amount": 1000000, "currency": "VND" },
      "created_at": "2026-08-02T04:00:00Z"
    }
  ],
  "pagination": { "next_cursor": null, "has_more": false, "limit": 20 },
  "meta": { "request_id": "req_01JX9Q6N4E" }
}
```

---

### 6.10. `GET /organizer/ticket-types/:ticket_type_id/inventory`

Tồn kho source-of-truth theo loại vé (chuyển từ route admin cũ `GET /admin/ticket-types/:id/inventory`). Join `ticket_type → concert`, verify `concert.organizer_id = me`.

**Response `200`**

```json
{
  "data": {
    "ticket_type_id": "tkt_01JX9Q5A",
    "total": 1000,
    "held": 20,
    "sold": 250,
    "available": 730
  },
  "meta": { "request_id": "req_01JX9Q6N4E" }
}
```

- `available = total - held - sold`.
- Ticket type không thuộc concert của mình → `404 TICKET_TYPE_NOT_FOUND`.

---

### 6.11. `GET /organizer/checker-accounts`

List checker account của các concert BTC sở hữu (join `concert_checker_accounts` → `concert.organizer_id = me`). **Không** trả password.

**Response `200`**

```json
{
  "data": [
    {
      "id": "cca_01JX9QT3",
      "concert_id": "crt_01JX9Q2M5P7KZ3R4N8Y6",
      "user_id": "usr_01JX9QU4",
      "email": "checker-indie-night-1@ticketbox.local",
      "status": "ACTIVE",
      "created_at": "2026-06-21T08:30:00Z"
    }
  ],
  "pagination": { "next_cursor": null, "has_more": false, "limit": 20 },
  "meta": { "request_id": "req_01JX9Q6N4E" }
}
```

> Checker tự chuyển `DISABLED` khi concert `CANCELLED`/`COMPLETED` (xem `organizer-admin-api.md` §7).

---

### 6.12. `GET /organizer/concerts/:concert_id/guests`

List guest của concert BTC sở hữu. Cùng dạng dữ liệu với guest list admin nhưng scope theo ownership.

**Query:** `q?`, `status?`, `seat_zone_id?`, `limit?`, `cursor?`.

- Concert không thuộc sở hữu → `404 CONCERT_NOT_FOUND`.

---

## 7. Error catalog

| HTTP | Code | Khi nào xảy ra |
| --- | --- | --- |
| `401` | `UNAUTHORIZED` | Thiếu/sai JWT. |
| `403` | `FORBIDDEN` | Không phải `ORGANIZER`. |
| `403` | `CONCERT_NOT_OWNED_BY_ORGANIZER` | Concert không thuộc BTC. |
| `404` | `ORGANIZER_REQUEST_NOT_FOUND` | Hồ sơ không tồn tại/không sở hữu. |
| `404` | `CONCERT_NOT_FOUND` | Concert không tồn tại/không sở hữu. |
| `404` | `TICKET_TYPE_NOT_FOUND` | Ticket type không thuộc concert của BTC. |
| `404` | `VENUE_NOT_FOUND` | Venue không tồn tại khi tạo hồ sơ. |
| `409` | `CONCERT_NOT_EDITABLE` | Sửa concert không ở `DRAFT`. |
| `422` | `VALIDATION_ERROR` | `gate_count`/`checker_count` < 1, `ticket_types` rỗng, sale window/capacity sai. |

---

## 8. Quy tắc triển khai

1. Mọi repository query **bắt buộc** filter theo `organizer_id` — không tin tưởng `concert_id` từ client.
2. Sửa concert chỉ khi `DRAFT` và thuộc sở hữu; sau khi sửa phải invalidate cache catalog.
3. Hồ sơ chỉ lưu `ticket_types` dạng JSON; việc tạo zone/ticket-type/gate/checker thuộc luồng admin approve.
4. Endpoint analytics đọc aggregate từ PostgreSQL; có thể cache ngắn nếu cần.
5. Không trả password checker ở bất kỳ endpoint organizer nào.

---

## 9. Acceptance criteria

- `POST /organizer/requests` (đủ `venue_id`, `ticket_types`, `gate_count`, `checker_count`) → 201 `PENDING`.
- `GET /organizer/concerts` chỉ trả concert của BTC hiện tại.
- `POST /organizer/concerts/:id` sửa được khi `DRAFT`, trả `409 CONCERT_NOT_EDITABLE` khi `PUBLISHED`.
- `POST /organizer/concerts/:id/deletion-requests` → 201 `PENDING`.
- `GET /organizer/checker-accounts` thấy danh sách (không có password).
- BTC A không truy cập được hồ sơ/concert của BTC B.
