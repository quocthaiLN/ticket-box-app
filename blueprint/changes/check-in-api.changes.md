# TicketBox — Check-in API — Modification (sprint 6 role/route refactor)

Tài liệu này mô tả **thay đổi** áp lên [`check-in-api.md`](check-in-api.md) theo đợt refactor role/route (`template2.md`).

Tóm tắt: check-in chuyển về **single-role `CHECKER`**; gom về **route chuẩn duy nhất** cho scan/preload (bỏ alias); admin check-in **chỉ còn `GET /admin/check-in/gates`** với guard `ADMIN` (bỏ mọi route gate write, device, gate-zone-mapping).

---

## 1. Route checker — chuẩn hóa + đổi guard sang `CHECKER`

| Route chuẩn | Trước | Sau |
| --- | --- | --- |
| `POST /check-in/scan` | `CHECKER, ADMIN` | **`CHECKER`** |
| `GET /check-in/preload` | `CHECKER, ADMIN` | **`CHECKER`** |
| `POST /check-in/offline-sync` | `CHECKER, ADMIN` | **`CHECKER`** |
| `POST /check-in/offline-batches` | `CHECKER, ADMIN` | **`CHECKER`** |
| `POST /check-in/offline-batches/:batch_id/items` | `CHECKER, ADMIN` | **`CHECKER`** |
| `GET /check-in/guests/search` | `CHECKER, ADMIN` | **`CHECKER`** (xem `guest-list-api.changes.md`) |

Cập nhật doc gốc §3: route quét chuẩn là `POST /check-in/scan` (không phải `/check-in/scans`); preload chuẩn là `GET /check-in/preload` (không phải `/devices/:id/bootstrap`).

---

## 2. Route/alias bị bỏ

Trả `404`:

| Route bỏ | Thay thế |
| --- | --- |
| `POST /check-in/scans` (alias) | `POST /check-in/scan` |
| `GET /check-in/bootstrap` | `GET /check-in/preload` |
| `GET /check-in/devices/:device_id/preload` | `GET /check-in/preload?device_id=` |
| `GET /check-in/gates/:gate_id/preload` | `GET /check-in/preload?gate_id=` |
| `POST /check-in/guests/scans` | Gộp vào luồng scan / `guest-list` (xem doc guest-list) |

Bỏ import handler thừa trong `checkin.router.ts` để tránh lỗi TS `noUnusedLocals`.

---

## 3. Admin check-in — chỉ giữ list gate

Doc gốc §3 và §4.7 liệt kê nhiều route admin gate/device/mapping. Cập nhật:

| Route | Trước | Sau |
| --- | --- | --- |
| `GET /admin/check-in/gates` | `ORGANIZER, ADMIN` | **`ADMIN`** (giữ) |
| `GET /admin/concerts/:concert_id/check-in/gates` | `ORGANIZER, ADMIN` | **bỏ** |
| `POST /admin/concerts/:concert_id/check-in/gates` | `ORGANIZER, ADMIN` | **bỏ** |
| `POST /admin/check-in/gates` | `ORGANIZER, ADMIN` | **bỏ** |
| `GET /admin/check-in/gates/:gate_id` | `ORGANIZER, ADMIN` | **bỏ** |
| `PATCH /admin/check-in/gates/:gate_id` | `ORGANIZER, ADMIN` | **bỏ** |
| `DELETE /admin/check-in/gates/:gate_id` | `ORGANIZER, ADMIN` | **bỏ** |
| `PUT /admin/check-in/gates/:gate_id/zones` | `ORGANIZER, ADMIN` | **bỏ** |
| `POST/GET/PATCH/DELETE /admin/check-in/devices*` | `ORGANIZER, ADMIN` | **bỏ** |
| `POST/GET/DELETE /admin/check-in/gate-zone-mappings*` | `ORGANIZER, ADMIN` | **bỏ** |

> Gate, device, gate-zone-mapping nay được tạo trong luồng **admin approve hồ sơ** (gates) hoặc seed; không còn route write qua API trong scope này. Mục §4.7 của doc gốc đánh dấu **DEPRECATED**.

---

## 4. Acceptance criteria (bổ sung)

- CHECKER → `POST /v1/check-in/scan` = 200; `GET /v1/check-in/preload` = 200.
- `POST /v1/check-in/scans` (alias cũ) → 404.
- ORGANIZER → mọi route check-in = 403.
- `GET /v1/admin/check-in/gates` (ADMIN) = 200; mọi route gate/device write → 404.
