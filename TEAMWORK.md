# TicketBox - WBS và kế hoạch Sprint 

## 1. Nguyên tắc phân công

- Mỗi Sprint tính theo giờ, mặc định capacity khả thi mỗi người là 10-12 giờ làm việc tập trung, phần còn lại dành cho daily sync, review, fix bug và demo nội bộ.
- Chia ownership theo module để tránh giẫm chân:
  - Thanh: Lead, Catalog, toàn bộ Web admin + Web client, MinIO/CDN/storage wrapper, integration, review, release/demo.
  - Thuận: Auth/RBAC, API skeleton/shared middleware, worker foundation, notification base, Redis/cache/idempotency integration.
  - Thái: Inventory, Orders, Payment, E-ticket, Circuit Breaker payment, Token Bucket/rate limit logic cho order/payment-sensitive API.
  - Quang: Check-in, Mobile check-in/offline, Guest list, guest import/offline sync.
- Mỗi task có output rõ ràng. Không merge code khi chưa có DoD và review.
- Nếu bị block trên 2 giờ, báo trong daily sync và đổi sang task độc lập trong cùng Sprint.

## 2. WBS tổng quát

| WBS | Hạng mục | Owner chính | Kết quả mong đợi |
| --- | --- | --- | --- |
| 1.0 | Foundation & API skeleton | Thuận | API skeleton, shared middleware, worker foundation, env, coding convention. |
| 2.0 | Auth/RBAC | Thuận | Register/login/me/logout, JWT, role guard, Redis denylist stub. |
| 3.0 | Catalog | Thanh | API concert list/detail/seat-map/ticket-types, admin CRUD cơ bản. |
| 4.0 | Inventory & Orders | Thái | Hold/release/confirm inventory, checkout order, expire order. |
| 5.0 | Payment | Thái | Payment sandbox adapter, webhook idempotent, circuit breaker cơ bản. |
| 6.0 | E-ticket | Thái | Issue ticket, QR payload/hash, user ticket API. |
| 7.0 | Check-in | Quang | Online scan, gate-zone validation, offline batch sync. |
| 8.0 | Guest List | Quang | CSV import job, guest CRUD/search, guest check-in. |
| 9.0 | AI Artist Bio | Quang | Upload job, worker mock/AI adapter, publish bio. |
| 10.0 | Notification, Redis & Worker base | Thuận | Notification enqueue base, Redis cache/idempotency primitives, worker server foundation. |
| 11.0 | Web App | Thanh | Audience flow, admin flow, checkout status, ticket view. |
| 12.0 | Integration, QA, Demo | Thanh | End-to-end demo script, seed, README, bug bash. |
| 13.0 | Storage/CDN | Thanh | MinIO wrapper, bucket convention, upload/download URL, asset integration. |

## Sprint 1 - Foundation và database baseline

Sprint Goal: Tạo nền tảng code chạy được, validate database, chốt contract module để các Sprint sau không bị nghẽn.

| Thành viên | Nhiệm vụ | Giờ | Output |
| --- | --- | ---: | --- |
| Thanh | Chốt module boundaries, route mount convention, sprint board, coding guide ngắn trong README/WORKFLOW nếu cần. | 3h | Cấu trúc apps/packages thống nhất với `structure.md`. |
| Thanh | Scaffold Catalog module và DTO theo `catalog-api.md`. | 3h | Router public/admin đã mount stub. |
| Thanh | Tạo web app skeleton, API client base, layout audience/admin cơ bản. | 4h | Web boot được, route audience/admin placeholder. |
| Thanh | Scaffold MinIO/CDN/storage wrapper: bucket convention, object key convention, upload URL/download URL interface. | 2h | Package storage có interface dùng lại được. |
| Thuận | Tạo root workspace nếu chưa có, apps/api-server skeleton Express, shared middleware request-id/error/response envelope. | 4h | API server boot được, `/health` trả OK. |
| Thuận | Scaffold Auth module: router/service/repository/schema/types, password hash util, JWT util. | 3h | Khung Auth sẵn sàng implement. |
| Thuận | Scaffold Worker server: queue connection stub, worker registry, scheduler placeholder. | 3h | Worker process boot được. |
| Thuận | Scaffold Redis/cache/idempotency package và notification base module. | 3h | Redis/notification interface có stub. |
| Thái | Cài deps package database, chạy `prisma validate`, `prisma generate`, `tsc build`; fix lỗi schema/TS nếu có. | 4h | Database package build/validate xanh. |
| Thái | Thêm database helper release hold và payment-confirmation design stub/test cases. | 4h | PR nhỏ với interface rõ, chưa cần full flow nếu quá tải. |
| Thái | Kiểm tra seed data 4 concert và document lệnh seed. | 2h | Seed guide ngắn. |
| Quang | Scaffold Check-in module: router/service/repository/schema/types. | 3h | Route stub cho scan/preload/offline. |
| Quang | Scaffold Guest list module: router/service/repository/schema/types. | 3h | Route stub cho guest import/search/scan. |
| Quang | Đề xuất mapping mobile local SQLite/offline payload, chốt có/không thêm `client_item_id`. | 3h | Decision note cho offline sync. |

Definition of Done:

- Repo có API server, worker server, web skeleton boot được bằng lệnh local.
- Database package validate/build được sau khi cài dependencies.
- Tất cả module có folder skeleton theo ownership, không import vòng.
- Các gap database/API được ghi rõ để xử lý trong Sprint 2.

## Sprint 2 - Auth, Catalog và Inventory core

Sprint Goal: Hoàn thành các nền tảng nghiệp vụ đọc/ghi đầu tiên: auth, catalog public và hold inventory an toàn.

| Thành viên | Nhiệm vụ | Giờ | Output |
| --- | --- | ---: | --- |
| Thanh | Implement Catalog public: list/detail/metadata/seat-map/ticket-types/inventory read. | 4h | API public đúng response envelope. |
| Thanh | Implement Catalog admin CRUD cơ bản: venue, concert, seat zone, ticket type. | 3h | Admin API tạo/cập nhật catalog được. |
| Thanh | Tích hợp storage wrapper cho cover image, seat map URL, press-kit/object URL convention. | 2h | Catalog/admin dùng được object URL thống nhất. |
| Thanh | Review PR Auth/Catalog/Inventory và giải quyết conflict. | 2h | Merge checkpoint Sprint 2. |
| Thuận | Hoàn thiện middleware auth/role guard, ownership guard stub, request validation hook. | 3h | Guard dùng được trong module. |
| Thuận | Implement Auth API: register, login, logout, me, update role admin. | 4h | Auth endpoints theo `auth-rbac-api.md`. |
| Thuận | Implement Redis client/cache helper/idempotency helper, có fallback/mock local nếu chưa có Redis. | 3h | Redis primitives dùng được bởi Catalog/Orders/Payment. |
| Thuận | Notification base: model mapper, enqueue service stub, worker consume stub. | 2h | Notification flow có skeleton dùng chung. |
| Thái | Implement hold transaction: lock `ticket_types`, counter per-user, create order/order_items, update held. | 6h | `POST /orders` hoặc internal hold tạo order HELD. |
| Thái | Implement release transaction: cancel/expire order idempotent, giảm held/counter. | 4h | Cancel/expire không release 2 lần. |
| Thái | Unit/integration tests cho oversell và max_per_user. | 3h | Test xanh cho inventory critical path. |
| Quang | Implement check-in bootstrap/preload read API cho device/gate/valid tickets/guests. | 4h | Mobile/web checker lấy dữ liệu preload được. |
| Quang | Implement Check-in gate/device admin CRUD cơ bản. | 3h | Admin tạo gate, map zone, tạo device. |
| Quang | Worker expire-holds skeleton: query held expired và gọi release service. | 4h | Worker chạy dry-run hoặc local schedule. |

Definition of Done:

- User login được, JWT protected route hoạt động.
- Catalog list/detail lấy data từ PostgreSQL, cache key được định nghĩa.
- Checkout hold tạo order HELD và không oversell trong test.
- Release/cancel/expire idempotent.

## Sprint 3 - Payment, E-ticket và Online Check-in

Sprint Goal: Đóng được luồng mua vé từ order HELD đến payment success, issue ticket và scan online.

| Thành viên | Nhiệm vụ | Giờ | Output |
| --- | --- | ---: | --- |
| Thanh | Web audience: login/register integration, catalog list/detail, chọn ticket type/quantity. | 4h | Audience xem concert và chọn vé được. |
| Thanh | Web checkout/order detail: tạo order, polling status, ticket list placeholder. | 3h | User thấy order HELD/CONFIRMED. |
| Thanh | Web admin catalog CRUD polish: venue/concert/ticket type/seat zone basic forms. | 3h | Admin tạo/cập nhật concert demo. |
| Thanh | Integration review order-payment-ticket-checkin. | 2h | Flow contract khớp giữa module. |
| Thuận | Tích hợp Redis idempotency middleware cho `POST /orders` và payment webhook. | 4h | Duplicate request trả response ổn định. |
| Thuận | Thêm problem-details error catalog dùng chung, map lỗi domain sang HTTP. | 3h | Lỗi API đồng nhất. |
| Thuận | Hoàn thiện worker foundation: queue names, job payload types, enqueue/consume helper. | 4h | API và worker dùng chung contract. |
| Thái | Implement payment sandbox adapter VNPAY/MoMo mock, create payment PENDING và checkout URL. | 4h | Checkout trả payment URL mock. |
| Thái | Implement webhook: verify mock signature, amount check, unique transaction, confirm order, convert held to sold. | 5h | Payment success idempotent. |
| Thái | Implement issue tickets + QR payload/hash sau payment success. | 4h | Tickets được tạo đúng quantity. |
| Quang | Implement online ticket scan: verify QR hash/signature layer, lock ticket, gate-zone validation, ghi log. | 5h | `POST /check-in/scans` SUCCESS/WRONG_GATE/ALREADY. |
| Quang | Implement guest online scan basic theo guest_id/phone. | 3h | Guest check-in đúng gate-zone. |
| Quang | Mobile-checkin skeleton Expo hoặc web mobile fallback: scan form/manual QR input. | 4h | Checker demo scan online được. |

Definition of Done:

- End-to-end API: login -> catalog -> checkout -> mock payment webhook -> ticket issued.
- Payment webhook retry không issue ticket lần hai.
- Online check-in đúng gate thành công, scan lại trả already checked-in.
- Web audience thấy ticket sau khi order confirmed.

## Sprint 4 - Guest CSV, AI Bio, Notification và Offline Sync

Sprint Goal: Hoàn thành các worker/background flow và offline check-in MVP để phù hợp blueprint.

| Thành viên | Nhiệm vụ | Giờ | Output |
| --- | --- | ---: | --- |
| Thanh | Web admin Guest UI: upload CSV job, xem job/errors, search guest. | 3h | Admin quản lý guest list. |
| Thanh | Web admin Artist Bio UI: tạo job, xem status, publish bio. | 3h | Admin publish bio vào concert. |
| Thanh | Web ticket QR view và checkout polish cho audience. | 2h | Audience xem QR ticket được. |
| Thanh | Cross-module integration review và audit logging hook cho publish/import/AI. | 2h | Audit helper được gọi ở flow quan trọng. |
| Thuận | Notification enqueue API/internal event hooks từ payment/ticket/check-in. | 4h | Notification tạo row PENDING. |
| Thuận | Notification worker retry/error status base. | 3h | Notification SENT/FAILED rõ ràng. |
| Thuận | Redis cache invalidation helpers cho Catalog và idempotency response cache polish. | 4h | Cache/idempotency helper dùng ổn định. |
| Thái | Payment failure/cancel flow: update payment, release hold nếu order HELD. | 3h | Fail payment trả vé về inventory. |
| Thái | Circuit breaker cơ bản cho payment adapter, fail-fast và release hold policy. | 3h | Payment provider unavailable có behavior rõ. |
| Thái | E-ticket API: `/me/tickets`, detail, QR endpoint. | 3h | Audience xem QR ticket. |
| Thái | Token Bucket/rate limit policy cho checkout/order/payment-sensitive API. | 2h | Order/payment API có policy chống spam. |
| Quang | Guest CSV import worker: parse, validate, upsert guest, log row errors, PARTIAL/DONE. | 4h | CSV lỗi từng dòng không fail cả batch. |
| Quang | AI Artist Bio worker: extract mock text, call adapter/mock AI, save generated bio, retry/error. | 3h | Job PENDING -> PROCESSING -> DONE/FAILED. |
| Quang | Offline batch sync: create batch idempotent, process items, conflict/wrong gate, write logs. | 4h | Offline retry không trùng lặp. |

Definition of Done:

- Worker server xử lý được guest import, AI bio, notification và expire hold.
- Offline batch retry bằng `batch_token` không tạo duplicate effect.
- Payment failure/circuit breaker có release policy rõ và test được.
- Admin có màn hình demo guest import và AI bio.

## Sprint 5 - Integration, UI completion và hardening

Sprint Goal: Nối các mảnh thành sản phẩm demo liền mạch, giảm bug race condition, chuẩn bị kịch bản nghiệm thu.

| Thành viên | Nhiệm vụ | Giờ | Output |
| --- | --- | ---: | --- |
| Thanh | Lập end-to-end test matrix và demo script: happy path, oversell, duplicate payment, wrong gate, offline sync. | 4h | Checklist QA chạy được. |
| Thanh | Docker compose hoặc local run script cho postgres/redis/minio/api/worker/web. | 5h | Một lệnh start local nếu khả thi. |
| Thanh | Polish toàn bộ Web audience: catalog filters, checkout UX, order status, ticket QR view. | 4h | Demo audience trọn luồng. |
| Thanh | Polish toàn bộ Web admin: concert/ticket/guest/AI/notification pages, loading/error states. | 4h | Demo admin đủ thao tác cần thiết. |
| Thuận | Hardening API skeleton/shared middleware: validation, auth errors, request-id, rate-limit middleware base. | 4h | Middleware ổn định và đồng nhất. |
| Thuận | Hardening Redis/notification/worker foundation, graceful fallback khi Redis/worker lỗi. | 4h | Infra phụ trợ không làm vỡ demo. |
| Thuận | Support Thanh tích hợp auth redirect/API client trên web nếu bị nghẽn. | 3h | Auth-web integration không block. |
| Thái | Integration tests cho order/payment/ticket: duplicate Idempotency-Key, webhook retry, expire/cancel. | 4h | Test critical payment xanh. |
| Thái | Fix race condition inventory/counter, transaction isolation, deadlock retry nếu cần. | 3h | Checkout ổn định hơn khi concurrent. |
| Thái | Payment admin/debug endpoint hoặc mock callback page cho demo. | 2h | Demo payment nhanh không phụ thuộc provider thật. |
| Thái | Tune Circuit Breaker và Token Bucket thresholds cho demo tải cao. | 2h | Policy resilience/rate-limit có cấu hình rõ. |
| Quang | Mobile/checker UI polish: preload, scan online, offline capture, sync status. | 5h | Checker demo offline/online được. |
| Quang | Integration tests cho check-in ticket/guest/offline conflicts. | 4h | Test scan critical xanh. |
| Quang | Guest list/check-in/offline edge case polish. | 3h | Guest/offline demo ổn định. |

Definition of Done:

- Có thể demo từ đầu đến cuối trên seed data.
- Các flow rủi ro cao có test: oversell, max per user, webhook duplicate, check-in duplicate, offline retry.
- UI có loading/error state tối thiểu.
- Không còn blocker P0/P1 trước Sprint 6.

## Sprint 6 - Stabilization, demo và bàn giao

Sprint Goal: Đóng băng phạm vi, sửa lỗi cuối, hoàn thiện tài liệu và bàn giao đúng hạn.

| Thành viên | Nhiệm vụ | Giờ | Output |
| --- | --- | ---: | --- |
| Thanh | Freeze scope, quản lý bug bash, phân loại P0/P1/P2, điều phối fix. | 3h | Bug board rõ ưu tiên. |
| Thanh | Viết README runbook: setup, env, migrate, seed, run, demo accounts. | 3h | Người mới chạy được project. |
| Thanh | Final UI polish toàn bộ web, responsive, form validation, screenshots/user flow audience/admin. | 4h | Web sẵn sàng demo và có tài liệu demo UI. |
| Thanh | Tổng duyệt architecture/design consistency và cập nhật WORKFLOW nếu có quyết định mới. | 2h | Tài liệu không lệch code. |
| Thuận | Final hardening Auth/API skeleton/Redis/worker foundation/notification base. | 5h | Shared infra checklist pass. |
| Thuận | README phần Auth/API/Redis/worker, env và troubleshooting. | 3h | Runbook hạ tầng rõ. |
| Thuận | Fix bug backend shared P0/P1. | 3h | Shared/backend critical cleared. |
| Thái | Final hardening order/payment/ticket, verify counters sau mọi scenario. | 5h | Data integrity checklist pass. |
| Thái | Seed/reset script và demo payment scripts. | 3h | Demo có thể reset nhanh. |
| Thái | Fix bug backend P0/P1 trong checkout/payment/rate-limit/circuit breaker. | 3h | Payment/order critical cleared. |
| Quang | Final hardening check-in/offline/guest/AI/notification workers. | 5h | Worker/checker checklist pass. |
| Quang | Chuẩn bị demo offline scenario và CSV/press-kit sample. | 3h | Demo assets đầy đủ. |
| Quang | Fix bug backend/mobile P0/P1. | 3h | Check-in/worker critical cleared. |

Definition of Done:

- Tất cả P0/P1 fixed hoặc có workaround chấp nhận được cho demo.
- README/runbook đầy đủ lệnh cài đặt, migrate, seed, run API/worker/web/mobile.
- Demo script chạy được trong 20-30 phút với seed data.
- Không thêm feature mới trong Sprint 6, chỉ fix bug, polish và tài liệu.
