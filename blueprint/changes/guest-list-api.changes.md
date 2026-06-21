# TicketBox — Guest List API — Modification (sprint 6 role/route refactor)

Tài liệu này mô tả **thay đổi** áp lên [`guest-list-api.md`](guest-list-api.md) theo đợt refactor role/route (`template2.md`).

Tóm tắt: guest-list admin chuyển về **single-role `ADMIN`**; tra cứu guest tại cổng về **single-role `CHECKER`**; **bỏ** các alias `/guest-list/search`, `/guest-list/scan`, `/check-in/guests/scans`. BTC xem guest qua [`organizer-api.md`](organizer-api.md) `GET /organizer/concerts/:id/guests`.

---

## 1. Thay đổi guard

| Route | Trước | Sau |
| --- | --- | --- |
| `POST /guest-list/import` | `ORGANIZER, ADMIN` | **`ADMIN`** |
| `POST /admin/concerts/:concert_id/guest-import-jobs` | `ORGANIZER, ADMIN` | **`ADMIN`** |
| `GET /admin/guest-import-jobs/:job_id` | `ORGANIZER, ADMIN` | **`ADMIN`** |
| `GET /admin/guest-import-jobs/:job_id/errors` | `ORGANIZER, ADMIN` | **`ADMIN`** |
| `GET /admin/concerts/:concert_id/guests` | `ORGANIZER, ADMIN` | **`ADMIN`** |
| `POST /admin/concerts/:concert_id/guests` | `ORGANIZER, ADMIN` | **`ADMIN`** |
| `PATCH /admin/guests/:guest_id` | `ORGANIZER, ADMIN` | **`ADMIN`** |
| `POST /admin/guests/:guest_id/cancel` | `ORGANIZER, ADMIN` | **`ADMIN`** |
| `GET /check-in/guests/search` | `CHECKER, ADMIN` | **`CHECKER`** |

Cập nhật bảng endpoint §3 và header doc gốc theo cột "Sau". Guest của BTC: dùng `GET /organizer/concerts/:concert_id/guests` (scope theo ownership).

---

## 2. Route/alias bị bỏ

Trả `404`:

| Route bỏ | Thay thế |
| --- | --- |
| `GET /guest-list/search` | `GET /check-in/guests/search` |
| `POST /guest-list/scan` | Gộp vào luồng check-in guest |
| `POST /check-in/guests/scans` | Gộp vào luồng check-in guest |

Bỏ import handler thừa (`scanGuest` nếu không còn route) trong `guest-list.router.ts`.

---

## 3. Lưu ý cross-module

- Check-in guest online: doc gốc §3 trỏ tới `POST /check-in/guests/scans` — route này **bỏ**. Cập nhật ghi chú: check-in guest thực hiện trong luồng `check-in` (xem `check-in-api.changes.md`).
- `GET /check-in/guests/search` vẫn chỉ trả guest thuộc allowed zones của gate (không đổi nghiệp vụ).

---

## 4. Acceptance criteria (bổ sung)

- ADMIN → `POST /v1/guest-list/import` = 200; ORGANIZER → 403.
- CHECKER → `GET /v1/check-in/guests/search` = 200.
- `GET /v1/guest-list/search` (alias cũ) → 404.
- BTC xem guest concert mình qua `GET /v1/organizer/concerts/:id/guests` = 200.
