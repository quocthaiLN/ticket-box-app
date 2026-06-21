# Báo cáo tiến độ & Kế hoạch hoàn thành — TicketBox

- **Ngày lập:** 21/06/2026
- **Deadline bàn giao:** **27/06/2026** (còn **6 ngày**)
- **Nhóm:** Thanh (Lead/Catalog/Web), Thuận (Auth-RBAC/Foundation/Worker), Thái (Inventory/Order/Payment/E-ticket), Quang (Check-in/Guest/Offline/AI Bio)

---

## 1. Tóm tắt điều hành

- **Sản phẩm lõi (Sprint 1–5)** đã chạy được end-to-end: auth, catalog, inventory/order/payment/e-ticket, check-in online/offline, guest list, notification/worker, web audience + admin. Ước tính **~85–90%**.
- **Tài liệu blueprint** (api-design + specs) đã **hoàn tất 100%** và nhất quán với thiết kế refactor mới.
- **Điểm nghẽn (critical path):** đợt **refactor role/route + module Organizer** (theo `template2.md`) **mới chỉ xong tài liệu, code = 0%**. Đây là khối lượng còn lại lớn nhất và quyết định việc kịp deadline.
- **Mức hoàn thành tổng thể (tính cả scope refactor): ~70–75%.**

> ⚠️ Toàn bộ phần Organizer (BTC nộp hồ sơ → Admin duyệt → tự sinh concert + checker), single-role guard, 3 model DB mới, và 3 endpoint auth mới **chưa có dòng code nào**. Cần dồn lực 6 ngày tới cho phần này.

---

## 2. Hiện trạng hoàn thành theo hạng mục

| Hạng mục | Owner | Trạng thái | % | Ghi chú |
| --- | --- | --- | ---: | --- |
| Foundation / shared middleware / worker | Thuận | Done | 95% | Đã hardening ở Sprint 5 (memory 2026-06-08). |
| Auth / RBAC (register/login/otp/me/logout/refresh, admin users) | Thuận | Done (core) | 90% | **Thiếu**: `redirect_to`, `PATCH /me`, `role-by-email`. |
| Catalog (public + admin CRUD) | Thanh | Done | 90% | **Thiếu**: single-role + tách quyền tạo về luồng duyệt. |
| Inventory (hold/release/confirm, anti-oversell) | Thái | Done | 95% | **Thiếu**: bỏ route admin inventory, chuyển sang organizer. |
| Order checkout + retry + expire | Thái | Done | 95% | **Thiếu**: siết guard single-role AUDIENCE. |
| Payment (VNPAY/MoMo mock, webhook idempotent, circuit breaker) | Thái | Done | 95% | OK. |
| E-ticket (issue, QR, /me/tickets) | Thái | Done | 95% | Guard `/me/tickets` đã là AUDIENCE-only. |
| Check-in online + offline sync + gate-zone | Quang | Done | 90% | **Thiếu**: single-role CHECKER, bỏ alias. |
| Guest list (import CSV, search, guest check-in) | Quang | Done | 90% | **Thiếu**: guard ADMIN/CHECKER, bỏ alias. |
| AI Artist Bio | Quang | Done | 90% | Không bị refactor đụng tới. |
| Notification + Redis cache/idempotency + worker | Thuận | Done | 95% | **Thiếu**: guard về ADMIN. |
| Storage / CDN (MinIO) | Thanh | Done | 90% | OK. |
| Web App (audience + admin + auth integration) | Thanh | Đang làm | ~70% | **Thiếu**: UI Organizer workspace + UI Admin duyệt hồ sơ. |
| Blueprint docs (api-design + specs) | Cả nhóm | **Done** | 100% | Vừa hoàn tất, đã đồng bộ refactor. |
| **Refactor role/route + Organizer (template2.md)** | — | **Chưa làm (code)** | **0%** | **Đường găng — xem §3, §4.** |
| Demo / README runbook / seed / bug bash | Thanh | Một phần | ~40% | WORKFLOW đã cập nhật; còn runbook + script demo. |

---

## 3. Công việc còn lại (gap) — bám theo `template2.md`

### A. Triển khai refactor (BẮT BUỘC, đường găng)

| # | Hạng mục | Bước trong template2 | Quy mô |
| --- | --- | --- | --- |
| A1 | DB: 3 model mới (`OrganizerRequest`, `ConcertDeletionRequest`, `ConcertCheckerAccount`) + enum `ApprovalStatus` + `planned_publish_at` + quan hệ ngược + migration + generate | Bước 1 | Vừa |
| A2 | Shared error helpers (`organizerRequestNotPending`, `concertNotEditable`, `userNotFoundByEmail`, …) | Bước 2 | Nhỏ |
| A3 | Auth: `redirect_to` khi login, `PATCH /auth/me`, `PATCH /auth/admin/users/role-by-email` | Bước 3 | Nhỏ–Vừa |
| A4 | Single-role guard + bỏ route thừa ở 8 router (catalog, checkin, order, payment, ticket, inventory, guest-list, notification) | Bước 4 | Vừa (chia nhỏ theo owner) |
| A5 | Module **Organizer** (`/organizer/*`): schema/repo/service/controller/router — 12 endpoint | Bước 5 | Lớn |
| A6 | Module **Organizer-Admin** (duyệt hồ sơ/xóa concert): approve-transaction tạo concert+zones+ticket-types+gates+checkers | Bước 6 | Lớn |
| A7 | Checker tự `DISABLED` trong `setConcertStatus` | Bước 7 | Nhỏ |
| A8 | Mount router + dọn import thừa + build + test | Bước 8–9 | Vừa |
| A9 | **Web UI**: Organizer workspace (hồ sơ, concert, analytics) + Admin duyệt hồ sơ (không có trong template2 nhưng cần để demo) | — | Lớn |

### B. Ổn định & bàn giao (theo TEAMWORK Sprint 6)

- README/runbook: setup, env, migrate, seed, run api/worker/web, demo accounts.
- Seed bổ sung: venue, tài khoản organizer/admin/checker mẫu.
- Demo script 20–30 phút (luồng organizer → duyệt → bán vé → check-in → hủy).
- Bug bash, phân loại P0/P1, fix.

---

## 4. Phân công chi tiết theo thành viên

> Nguyên tắc: mỗi người làm refactor trong **đúng domain mình sở hữu**; phần guard single-role tách theo router để không giẫm chân. Ước lượng giờ cho 6 ngày.

### 🟦 Thuận — Foundation, Auth/RBAC, hồ sơ duyệt
| Task | Map | Giờ |
| --- | --- | ---: |
| A1 — Viết 3 model + enum + `planned_publish_at` + quan hệ ngược, chạy `migrate dev` + `generate` | Bước 1 | 4h |
| A2 — Bổ sung `Errors.*` helpers dùng chung | Bước 2 | 1h |
| A3 — Auth: `redirect_to`, `PATCH /me`, `role-by-email` (đặt route trước `:user_id/role`) + schema/service/repo | Bước 3 | 4h |
| A6 — Module **Organizer-Admin**: approve/reject hồ sơ, approve/reject deletion, list checker; **transaction provisioning** (tái dùng `hashPassword`, `CatalogService`) | Bước 6 | 8h |
| A4 — Guard `notification.router` → ADMIN | Bước 4 | 0.5h |
| README phần Auth/Redis/worker + troubleshooting | B | 2h |

### 🟩 Thanh — Catalog, Module Organizer, Web, Lead/Integration
| Task | Map | Giờ |
| --- | --- | ---: |
| A5 — Module **Organizer** backend (`/organizer/*`): venues, requests, concerts (sửa DRAFT), deletion-requests, analytics, orders, inventory, checker-accounts, guests | Bước 5 | 8h |
| A4 — `catalog.router` single-role ADMIN + bỏ route venues/seat-zones/ticket-types (giữ method service) | Bước 4 | 1.5h |
| A7 — `setConcertStatus` disable checker | Bước 7 | 1h |
| A9 — **Web**: trang Organizer (nộp/list hồ sơ, list concert, analytics) + trang Admin duyệt hồ sơ + hiển thị password checker 1 lần + `redirect_to` theo role | A9 | 10h |
| Integration end-to-end + điều phối bug bash + README runbook chính | A8/B | 4h |

### 🟨 Thái — Order/Payment/Ticket/Inventory
| Task | Map | Giờ |
| --- | --- | ---: |
| A4 — Single-role: `order.router` (AUDIENCE; `/admin/orders`→ADMIN), `payment.router` (AUDIENCE), `ticket.router` (AUDIENCE; void giữ ADMIN) | Bước 4 | 2h |
| A4 — `inventory.router`: bỏ `GET/POST /admin/ticket-types/:id/inventory*`; cung cấp service `getInventory` cho Organizer module dùng lại | Bước 4 | 1.5h |
| Integration test order/payment/ticket sau khi đổi guard (đảm bảo không vỡ luồng cũ) | Bước 9 | 3h |
| Seed/reset script + demo payment script | B | 3h |
| Hỗ trợ Thanh/Thuận transaction provisioning (phần ticket type/inventory khi approve) | A6 | 3h |

### 🟧 Quang — Check-in, Guest, Offline, Checker accounts
| Task | Map | Giờ |
| --- | --- | ---: |
| A4 — `checkin.router` single-role CHECKER + bỏ alias (`scans`, `bootstrap`, `devices/:id/preload`, `gates/:id/preload`); admin chỉ giữ `GET /admin/check-in/gates` | Bước 4 | 2h |
| A4 — `guest-list.router`: ADMIN/CHECKER single-role + bỏ alias (`/guest-list/search`, `/guest-list/scan`, `/check-in/guests/scans`) | Bước 4 | 1.5h |
| Verify checker account tự sinh (từ approve) **đăng nhập + check-in được**; checker `DISABLED` khi concert hủy thì bị chặn | A6/A7 | 3h |
| `GET /organizer/concerts/:id/guests` (phối hợp Thanh) + test guest theo ownership | A5 | 2h |
| Integration test check-in/guest/offline sau refactor + chuẩn bị demo offline + CSV/press-kit mẫu | Bước 9/B | 4h |

---

## 5. Lịch trình 6 ngày (21 → 27/06)

| Ngày | Mốc | Ai |
| --- | --- | --- |
| **D1 — 21–22/6** | Verify build/test baseline xanh. **A1** (schema+migration), **A2** (errors), **A3** (auth) xong. Mỗi người bắt đầu **A4** guard refactor router của mình. | Thuận (A1-A3), cả nhóm (A4) |
| **D2 — 23/6** | Hoàn tất toàn bộ **A4** (8 router single-role, bỏ route → 404). **A5** organizer backend & **A6** organizer-admin bắt đầu. **A7** checker-disable. | Cả nhóm |
| **D3 — 24/6** | **A5 + A6** xong backend; **A8** mount + build xanh. Test luồng API: nộp hồ sơ → approve → concert DRAFT + checker accounts. | Thanh, Thuận, Thái |
| **D4 — 25/6** | **A9** Web Organizer + Admin duyệt (lõi). Quang verify checker login/check-in/disable. Bắt đầu integration end-to-end. | Thanh (web), Quang |
| **D5 — 26/6** | Integration full: organizer→duyệt→bán vé→check-in→hủy→checker DISABLED. Bug bash P0/P1. Seed accounts + demo script. | Cả nhóm |
| **D6 — 27/6** | Freeze scope. Fix nốt P0/P1. README/runbook hoàn chỉnh. Tổng duyệt demo 20–30’. **Bàn giao.** | Cả nhóm |

---

## 6. Rủi ro & khuyến nghị

1. **Thời gian rất căng.** 6 ngày cho cả refactor lớn + ổn định + demo. **Khuyến nghị:** đóng băng mọi feature ngoài `template2.md`; không thêm scope.
2. **Thanh quá tải** (organizer backend + toàn bộ web + integration). **Khuyến nghị:** Thái/Quang sau khi xong A4 (D2) chuyển sang hỗ trợ Thanh phần web/test; cân nhắc Thuận làm trọn organizer-admin để Thanh tập trung organizer + web.
3. **Migration phá dữ liệu seed cũ.** A1 đổi schema → cần seed lại. **Khuyến nghị:** chạy migration sớm (D1) để các module khác có schema mới làm việc.
4. **Phương án giảm phạm vi (nếu chậm đến D5):** ưu tiên giữ **luồng lõi** (nộp hồ sơ → approve sinh concert+checker → sửa DRAFT → cancel→disable checker). Có thể tạm hạ ưu tiên: `analytics`, `deletion-requests`, UI organizer chi tiết → để placeholder/đơn giản hóa cho demo.
5. **Build verification.** Memory ghi build xanh 2026-06-08; đã có nhiều commit sau đó → **D1 phải verify lại** `pnpm -r build` + test trước khi sửa tiếp.
6. **artist-bio** giữ guard cũ (ORGANIZER+ADMIN) — ngoài phạm vi refactor; thống nhất để nguyên hay siết single-role (quyết định nhanh ở daily D1).

---

## 7. Definition of Done (nghiệm thu 27/6)

- [ ] `prisma migrate` + `generate` sạch; `pnpm -r build` xanh; test critical xanh.
- [ ] Guard single-role đúng: AUDIENCE/ORGANIZER/CHECKER/ADMIN; route đã bỏ trả 404; route sai role trả 403.
- [ ] Login trả `redirect_to` đúng; `role-by-email` + `PATCH /me` hoạt động.
- [ ] Organizer: nộp hồ sơ (PENDING) → Admin approve → tạo concert DRAFT + zones + ticket types + gates + N checker (trả password 1 lần).
- [ ] Organizer sửa concert DRAFT; xin xóa → Admin approve → concert CANCELLED → checker `DISABLED`.
- [ ] Web demo được luồng organizer + admin duyệt; audience vẫn mua vé/check-in bình thường.
- [ ] README/runbook + seed accounts (organizer/admin/checker) + demo script 20–30’ chạy được trên seed data.
- [ ] Không còn P0/P1 cho luồng demo.
