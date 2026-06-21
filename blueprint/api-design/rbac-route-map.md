# TicketBox — RBAC & Route Map (Authoritative)

Tài liệu này là **bản đồ route → role chuẩn** sau đợt refactor role/route (sprint 6). Mục tiêu: **mỗi route chỉ đúng 1 role**, tách `/organizer/*` riêng cho ban tổ chức (BTC), `/admin/*` chỉ cho admin, và bổ sung luồng duyệt hồ sơ tổ chức concert.

Tài liệu này là nguồn tham chiếu quyền cho toàn bộ API. Khi một module có file thiết kế riêng (`*-api.md`), route map ở đây vẫn là chuẩn cuối cùng nếu có khác biệt.

Nguồn:

- Kế hoạch refactor `template2.md` (Route map cuối cùng)
- `blueprint/api-design/base-api.md` §1.4 (Authentication & Authorization)
- `blueprint/specs/08-auth-rbac.md`

---

## 1. Nguyên tắc

1. **Một route — một role.** Không còn route nhận đồng thời nhiều role nghiệp vụ (ví dụ `ORGANIZER` + `ADMIN`). Ngoại lệ duy nhất là nhóm cross-cutting ở §8.
2. **`requireAuth` luôn đứng trước `requireRole`.** Gateway/middleware xác thực JWT trước, kiểm tra role sau.
3. **Backend vẫn kiểm tra ownership.** Đúng role chưa đủ; ví dụ `ORGANIZER` chỉ thao tác concert do mình sở hữu, `AUDIENCE` chỉ xem order/vé của mình.
4. **Route nội bộ (`/internal/*`)** không dùng JWT người dùng; được bảo vệ ở tầng network/service mesh, chỉ cho worker và module nội bộ gọi.
5. **Route đã bỏ trả `404`**, không trả `403`, để không lộ sự tồn tại của route cũ.

---

## 2. Bảng role

| Role | Mã | Tiền tố route chính | `redirect_to` sau login |
| --- | --- | --- | --- |
| Guest | (không JWT) | `GET /concerts*`, auth public | — |
| Khán giả | `AUDIENCE` | `/orders*`, `/me/tickets*` | `/` |
| Ban tổ chức | `ORGANIZER` | `/organizer/*` | `/organizer` |
| Nhân sự soát vé | `CHECKER` | `/check-in/*` | `/checker` |
| Admin | `ADMIN` | `/admin/*`, `/auth/admin/*` | `/admin` |

---

## 3. PUBLIC (không bắt buộc JWT)

| Method | Route | Ghi chú |
| --- | --- | --- |
| `POST` | `/v1/auth/otp/request` | Gửi OTP đăng ký. |
| `POST` | `/v1/auth/register` | Đăng ký (kèm OTP). |
| `POST` | `/v1/auth/login` | Đăng nhập, trả `redirect_to`. |
| `POST` | `/v1/auth/refresh` | Cấp lại access token từ refresh cookie. |
| `GET` | `/v1/concerts*` | Toàn bộ catalog public (list, detail, metadata, seat-map, ticket-types, inventory). |
| `POST` | `/v1/payments/webhooks/vnpay` | IPN VNPAY (verify chữ ký, không JWT). |
| `POST` | `/v1/payments/webhooks/momo` | IPN MoMo (verify chữ ký, không JWT). |
| `GET` | `/v1/payments/health` | Health/circuit-breaker (diagnostic). |

Chi tiết auth public: xem [`auth-rbac-api.md`](auth-rbac-api.md). Chi tiết catalog public: xem [`catalog-api.md`](catalog-api.md).

---

## 4. AUDIENCE — `requireRole("AUDIENCE")`

| Method | Route | Mục đích |
| --- | --- | --- |
| `POST` | `/v1/orders` | Tạo order (HELD) + URL thanh toán. |
| `GET` | `/v1/orders/:order_id` | Poll trạng thái order của mình. |
| `POST` | `/v1/orders/:order_id/cancel` | Hủy order HELD của mình. |
| `POST` | `/v1/orders/:order_id/payments` | Tạo payment attempt mới (retry). |
| `GET` | `/v1/me/tickets` | Danh sách vé của mình. |
| `GET` | `/v1/me/tickets/:ticket_id` | Chi tiết vé. |
| `GET` | `/v1/me/tickets/:ticket_id/qr` | QR payload của vé. |

> **Thay đổi guard:** các route trên trước đây nhận `('AUDIENCE','ADMIN')`, nay **chỉ `AUDIENCE`**. Admin không còn thao tác order/vé của user qua các route này.

---

## 5. CHECKER — `requireRole("CHECKER")`

| Method | Route | Mục đích |
| --- | --- | --- |
| `POST` | `/v1/check-in/scan` | Quét vé online. |
| `GET` | `/v1/check-in/preload` | Tải dữ liệu offline cho thiết bị/cổng. |
| `POST` | `/v1/check-in/offline-sync` | Sync batch offline. |
| `POST` | `/v1/check-in/offline-batches` | Tạo/lấy batch offline. |
| `POST` | `/v1/check-in/offline-batches/:batch_id/items` | Gửi item offline vào batch. |
| `GET` | `/v1/check-in/guests/search` | Tra cứu guest tại cổng. |

Chi tiết: xem [`check-in-api.md`](check-in-api.md) và [`guest-list-api.md`](guest-list-api.md).

---

## 6. ORGANIZER — `requireRole("ORGANIZER")` (module mới)

| Method | Route | Mục đích |
| --- | --- | --- |
| `GET` | `/v1/organizer/venues` | List venue seed để chọn khi khai hồ sơ. |
| `GET` | `/v1/organizer/requests` | List hồ sơ xin tổ chức của mình. |
| `POST` | `/v1/organizer/requests` | Tạo hồ sơ (kèm `gate_count`, `checker_count`, `ticket_types[]`). |
| `GET` | `/v1/organizer/requests/:request_id` | Chi tiết hồ sơ. |
| `GET` | `/v1/organizer/concerts` | List concert mình sở hữu. |
| `POST` | `/v1/organizer/concerts/:concert_id` | Sửa trực tiếp concert `DRAFT` của mình. |
| `POST` | `/v1/organizer/concerts/:concert_id/deletion-requests` | Xin xóa concert. |
| `GET` | `/v1/organizer/concerts/:concert_id/analytics` | Thống kê concert. |
| `GET` | `/v1/organizer/orders` | Order của các concert mình sở hữu. |
| `GET` | `/v1/organizer/ticket-types/:ticket_type_id/inventory` | Tồn kho theo loại vé (đã chuyển từ admin). |
| `GET` | `/v1/organizer/checker-accounts` | Danh sách checker account của các concert mình. |
| `GET` | `/v1/organizer/concerts/:concert_id/guests` | Danh sách guest của concert mình. |

Chi tiết: xem [`organizer-api.md`](organizer-api.md).

---

## 7. ADMIN — `requireRole("ADMIN")`

### 7.1. Catalog (admin)

| Method | Route | Mục đích |
| --- | --- | --- |
| `GET` | `/v1/admin/concerts` | List concert quản trị. |
| `PATCH` | `/v1/admin/concerts/:concert_id` | Sửa concert (route admin riêng). |
| `POST` | `/v1/admin/concerts/:concert_id/publish` | Publish concert. |
| `POST` | `/v1/admin/concerts/:concert_id/cancel` | Hủy concert (kéo theo vô hiệu checker). |

### 7.2. Check-in & guest (admin)

| Method | Route | Mục đích |
| --- | --- | --- |
| `GET` | `/v1/admin/check-in/gates` | Chỉ giữ list gate. |
| `POST` | `/v1/guest-list/import` | Import guest (ADMIN). |
| `POST` | `/v1/admin/concerts/:concert_id/guest-import-jobs` | Tạo import job. |
| `GET` | `/v1/admin/concerts/:concert_id/guests` | List guest (admin). |

### 7.3. Notification (admin)

| Method | Route | Mục đích |
| --- | --- | --- |
| `GET` | `/v1/admin/notifications` | Tra cứu notification. |
| `GET` | `/v1/admin/notifications/:notification_id` | Chi tiết notification. |
| `POST` | `/v1/admin/notifications/:notification_id/retry` | Retry notification lỗi. |

> Guard đổi từ `('ORGANIZER','ADMIN')` → **`ADMIN`** (quyết định "suy nghĩ sau" trong `template2.md`). Xem [`notification-api.md`](notification-api.md).

### 7.4. Users (auth admin)

| Method | Route | Mục đích |
| --- | --- | --- |
| `GET` | `/v1/auth/admin/users` | List user. |
| `PATCH` | `/v1/auth/admin/users/role-by-email` | **MỚI** — đổi role theo email. Đặt **trước** route `:user_id/role`. |
| `PATCH` | `/v1/auth/admin/users/:user_id/role` | Đổi role theo id. |
| `PATCH` | `/v1/auth/admin/users/:user_id/status` | Đổi status. |

### 7.5. Duyệt hồ sơ & xóa concert (module mới)

| Method | Route | Mục đích |
| --- | --- | --- |
| `GET` | `/v1/admin/organizer-requests` | List hồ sơ (filter `?status=`). |
| `GET` | `/v1/admin/organizer-requests/:request_id` | Chi tiết hồ sơ. |
| `POST` | `/v1/admin/organizer-requests/:request_id/approve` | Duyệt → tạo concert DRAFT + zones + ticket types + gates + checkers. |
| `POST` | `/v1/admin/organizer-requests/:request_id/reject` | Từ chối hồ sơ. |
| `GET` | `/v1/admin/concert-deletion-requests` | List yêu cầu xóa concert. |
| `POST` | `/v1/admin/concert-deletion-requests/:request_id/approve` | Duyệt → set concert `CANCELLED`. |
| `POST` | `/v1/admin/concert-deletion-requests/:request_id/reject` | Từ chối yêu cầu xóa. |
| `GET` | `/v1/admin/concerts/:concert_id/checker-accounts` | List checker account của concert. |

### 7.6. Order/ticket (admin)

| Method | Route | Mục đích | Thay đổi |
| --- | --- | --- | --- |
| `GET` | `/v1/admin/orders` | List toàn bộ order. | `('ORGANIZER','ADMIN')` → **`ADMIN`**. Order theo concert của BTC nay dùng `GET /v1/organizer/orders`. |
| `POST` | `/v1/internal/tickets/:ticket_id/void` | Void vé (refund/cancel). | Giữ `ADMIN`. |

Chi tiết duyệt hồ sơ: xem [`organizer-admin-api.md`](organizer-admin-api.md). Chi tiết catalog admin: xem [`catalog-api.md`](catalog-api.md).

---

## 8. AUTH cross-cutting — chỉ `requireAuth`

Nhóm ngoại lệ có chủ đích: mọi role đã đăng nhập đều cần, không gắn `requireRole`.

| Method | Route | Mục đích |
| --- | --- | --- |
| `POST` | `/v1/auth/logout` | Đăng xuất, denylist token. |
| `GET` | `/v1/auth/me` | Hồ sơ user hiện tại. |
| `PATCH` | `/v1/auth/me` | **MỚI** — user tự sửa `full_name`/`phone`. |

---

## 9. Module guard-only (order / payment / ticket / inventory)

Bốn module này có file thiết kế riêng — [`order-checkout-api.md`](order-checkout-api.md), [`e-ticket-api.md`](e-ticket-api.md), [`inventory-api.md`](inventory-api.md). Đợt refactor siết guard về single-role + bỏ vài route; bảng dưới tóm tắt thay đổi đã áp vào các doc đó.

### 9.1. Đổi guard sang single-role

| Module | Route | Trước | Sau |
| --- | --- | --- | --- |
| order | `POST /orders` | `AUDIENCE, ADMIN` | `AUDIENCE` |
| order | `GET /orders/:order_id` | `AUDIENCE, ADMIN` | `AUDIENCE` |
| order | `POST /orders/:order_id/cancel` | `AUDIENCE, ADMIN` | `AUDIENCE` |
| order | `GET /admin/orders` | `ORGANIZER, ADMIN` | `ADMIN` |
| payment | `POST /orders/:order_id/payments` | `AUDIENCE, ADMIN` | `AUDIENCE` |
| ticket | `GET /me/tickets` | `AUDIENCE, ADMIN` | `AUDIENCE` |
| ticket | `GET /me/tickets/:ticket_id` | `AUDIENCE, ADMIN` | `AUDIENCE` |
| ticket | `GET /me/tickets/:ticket_id/qr` | `AUDIENCE, ADMIN` | `AUDIENCE` |
| ticket | `POST /internal/tickets/:ticket_id/void` | `ADMIN` | `ADMIN` (giữ) |

### 9.2. Route bị bỏ

| Module | Route | Lý do / thay thế |
| --- | --- | --- |
| inventory | `GET /admin/ticket-types/:ticket_type_id/inventory` | Chuyển sang `GET /v1/organizer/ticket-types/:ticket_type_id/inventory`. |
| inventory | `POST /admin/ticket-types/:ticket_type_id/inventory-adjustments` | Bỏ trong scope refactor này. |

### 9.3. Route giữ nguyên (internal, không JWT người dùng)

`POST /internal/orders/:order_id/expire`, `POST /internal/orders/:order_id/tickets/issue`, `POST /internal/inventory/holds`, `POST /internal/inventory/releases`, `POST /internal/inventory/payment-confirmations`, `POST /internal/notifications/enqueue`, các webhook payment.

---

## 10. Route bị bỏ toàn hệ thống

Trả `404 NOT_FOUND` (không phải `403`).

| Nhóm | Route bị bỏ | Thay thế |
| --- | --- | --- |
| catalog | `GET/POST /admin/venues`, `PATCH /admin/venues/:id` | BTC dùng `GET /v1/organizer/venues` (read-only). |
| catalog | `POST /admin/concerts` | Tạo concert qua duyệt hồ sơ tổ chức. |
| catalog | `POST /admin/concerts/:id/seat-zones`, `PATCH /admin/seat-zones/:id` | Tạo zone khi admin approve hồ sơ. |
| catalog | `POST /admin/concerts/:id/ticket-types`, `PATCH /admin/ticket-types/:id` | Tạo ticket type khi admin approve hồ sơ. |
| check-in | `POST /check-in/scans` (alias) | `POST /check-in/scan`. |
| check-in | `GET /check-in/bootstrap`, `GET /check-in/devices/:id/preload`, `GET /check-in/gates/:id/preload` | `GET /check-in/preload`. |
| check-in | Mọi route gate write, device, gate-zone-mapping (`POST/PATCH/DELETE/PUT`) | Chỉ giữ `GET /admin/check-in/gates`. |
| guest-list | `GET /guest-list/search`, `POST /guest-list/scan`, `POST /check-in/guests/scans` | `GET /check-in/guests/search` (+ check-in guest gộp vào luồng scan). |
| inventory | `GET /admin/ticket-types/:id/inventory`, `POST /admin/ticket-types/:id/inventory-adjustments` | Xem §9.2. |

---

## 11. Hành vi lỗi RBAC

| Tình huống | HTTP | Code |
| --- | --- | --- |
| Thiếu/sai JWT | `401` | `UNAUTHORIZED` |
| Đúng JWT nhưng sai role | `403` | `FORBIDDEN` |
| Truy cập dữ liệu không sở hữu (đúng role) | `403` | `FORBIDDEN` |
| Route đã bị bỏ | `404` | `NOT_FOUND` |

---

## 12. Acceptance criteria

- AUDIENCE → `GET /v1/admin/concerts` = 403; `POST /v1/organizer/requests` = 403.
- ORGANIZER → `POST /v1/admin/concerts/:id/publish` = 403; `GET /v1/organizer/concerts` = 200 (chỉ của mình).
- CHECKER → `GET /v1/organizer/requests` = 403; `POST /v1/check-in/scan` = 200.
- ADMIN → `GET /v1/admin/organizer-requests` = 200.
- Route đã bỏ (vd `POST /v1/admin/concerts`, `GET /v1/guest-list/search`) → 404.
- Login mỗi role trả `redirect_to` đúng (`/`, `/admin`, `/organizer`, `/checker`).
