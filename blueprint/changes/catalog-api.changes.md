# TicketBox — Catalog API — Modification (sprint 6 role/route refactor)

Tài liệu này mô tả **thay đổi** áp lên [`catalog-api.md`](catalog-api.md) theo đợt refactor role/route (`template2.md`). Doc gốc giữ nguyên làm tham chiếu; phần dưới là delta cần áp dụng.

Tóm tắt: admin catalog chuyển về **single-role `ADMIN`**; **bỏ** các route tạo/sửa venue, tạo concert, seat-zone, ticket-type khỏi catalog (việc tạo zone/ticket-type nay nằm trong luồng admin duyệt hồ sơ — xem [`organizer-admin-api.md`](organizer-admin-api.md)); BTC dùng module [`organizer-api.md`](organizer-api.md).

---

## 1. Thay đổi guard

Doc gốc §4 (RBAC) và §5.2 ghi nhóm admin là `ORGANIZER, ADMIN`. Cập nhật:

| Route | Trước | Sau |
| --- | --- | --- |
| `GET /admin/concerts` | `ORGANIZER, ADMIN` | **`ADMIN`** |
| `PATCH /admin/concerts/:concert_id` | `ORGANIZER, ADMIN` | **`ADMIN`** |
| `POST /admin/concerts/:concert_id/publish` | `ORGANIZER, ADMIN` | **`ADMIN`** |
| `POST /admin/concerts/:concert_id/cancel` | `ORGANIZER, ADMIN` | **`ADMIN`** |

Public catalog (`GET /concerts*`) **không đổi**.

Cập nhật bảng RBAC §4: bỏ dòng "Admin catalog write/read = ORGANIZER, ADMIN", thay bằng "Admin catalog = `ADMIN`". Quyền đọc/sửa concert của BTC chuyển sang `GET /organizer/concerts` + `POST /organizer/concerts/:id` (chỉ `DRAFT`).

---

## 2. Route bị bỏ

Xóa khỏi `catalog.router.ts` và khỏi bảng endpoint §5.2 / §7 của doc gốc (trả `404`):

| Route | Thay thế |
| --- | --- |
| `GET /admin/venues` | `GET /organizer/venues` (read-only cho BTC). |
| `POST /admin/venues` | — (không còn tạo venue qua API trong scope này; dùng seed). |
| `PATCH /admin/venues/:venue_id` | — |
| `POST /admin/concerts` | Tạo concert qua `POST /admin/organizer-requests/:id/approve`. |
| `POST /admin/concerts/:concert_id/seat-zones` | Tạo zone khi approve hồ sơ. |
| `PATCH /admin/seat-zones/:seat_zone_id` | — |
| `POST /admin/concerts/:concert_id/ticket-types` | Tạo ticket type khi approve hồ sơ. |
| `PATCH /admin/ticket-types/:ticket_type_id` | — |

> **Giữ method trong controller/service/repository** (`createConcert`, `createSeatZone`, `createTicketType`, `listVenues`, …) vì luồng admin approve tái dùng. Chỉ bỏ **route** + import handler không còn dùng trong router.

Các phần doc gốc §7.1–§7.3 (venues), §7.5 (POST concerts), §7.9–§7.12 (seat-zones, ticket-types) đánh dấu **DEPRECATED — moved**; ghi chú trỏ tới luồng approve.

---

## 3. Bổ sung field `planned_publish_at`

Thêm vào `Concert` (và phản ánh trong response detail/metadata nếu cần):

```prisma
plannedPublishAt DateTime? @map("planned_publish_at")
```

Giá trị lấy từ hồ sơ `organizer_requests.planned_publish_at` khi approve.

---

## 4. Side effect mới: `setConcertStatus` vô hiệu checker

Bổ sung vào doc gốc §7.8 (`cancel`) và mục cache/side-effect:

- Trong `catalog.repository.setConcertStatus`, khi concert chuyển `CANCELLED`/`COMPLETED`, **trong cùng transaction** set `status = DISABLED` cho mọi `User` trong `concert_checker_accounts` của concert đó.
- Áp dụng cho `POST /admin/concerts/:id/cancel` (admin) và luồng approve deletion (`organizer-admin-api.md` §7).

---

## 5. Cache/invalidation

Không đổi cơ chế. Lưu ý: việc tạo zone/ticket-type nay xảy ra trong transaction approve hồ sơ — bước đó phải invalidate `catalog:metadata:{concert_id}`, `catalog:ticket-types:{concert_id}:*`, `inventory:concert:{concert_id}` như khi tạo qua route cũ.

---

## 6. Acceptance criteria (bổ sung)

- `POST /v1/admin/concerts` → 404 (route đã bỏ).
- `GET /v1/admin/venues` → 404; BTC dùng `GET /v1/organizer/venues` → 200.
- ORGANIZER gọi `POST /v1/admin/concerts/:id/publish` → 403.
- `POST /v1/admin/concerts/:id/cancel` → checker của concert chuyển `DISABLED`.
