# TicketBox - Process và kế hoạch demo final

Ngày cập nhật: 2026-07-09

Phạm vi: đánh giá trạng thái local nhánh `thanh` sau khi merge `origin/thai` và `origin/Quang`, code trong `ticket-box-app/`, test suite hiện có, tài liệu setup/demo và các việc cần chốt trong 1 ngày trước demo final.

## 1. Trạng thái kiểm chứng hiện tại

### 1.1. Kết quả mới nhất

| Hạng mục | Trạng thái | Ghi chú |
| --- | --- | --- |
| Branch local | Đạt | Đang ở branch `thanh`; đã merge `origin/thai` và `origin/Quang`. |
| Docker local | Đạt | `ticketbox-postgres` đang chạy `localhost:5433`, `ticketbox-redis` đang chạy `localhost:6379`. |
| Database migrate | Đạt | `npm.cmd run db:migrate` pass; đã apply migration `20260707120000_organizer_request_seat_map`. |
| Prisma generate | Đạt | `npm.cmd run db:generate` pass sau merge. |
| Prisma validate | Đạt | `npm.cmd run db:validate` pass. |
| Build workspace | Đạt | `npm.cmd run build` pass khi chạy ngoài sandbox; web còn warning chunk JS lớn khoảng `718.38 kB`. |
| Integration tests | Đạt | `npm.cmd test -w @ticketbox/tests`: 3 test files, 18/18 tests pass. |
| Vitest config | Cần sửa nhỏ | Có warning Vitest 4: `test.poolOptions` đã bị remove, nên chuyển cấu hình forks lên top-level option sau demo. |

### 1.2. Chi tiết test suite đã xanh

| Nhóm test | File | Kết quả | Bao phủ chính |
| --- | --- | --- | --- |
| Audit | `ticket-box-app/tests/audit/audit.integration.test.ts` | 2/2 pass | Record audit sanitized metadata, filter theo action/actor/entity/time range, cursor pagination. |
| Worker auto-publish | `ticket-box-app/tests/worker/auto-publish.integration.test.ts` | 3/3 pass | Publish concert DRAFT tới hạn, mở ticket type `ON_SALE`, skip concert thiếu dữ liệu, idempotency. |
| Check-in | `ticket-box-app/tests/checkin/checkin.integration.test.ts` | 13/13 pass | Online scan, wrong gate, guest pass, offline sync/replay, duplicate/conflict, ticket `CANCELLED`/`REFUNDED`, device revoked, gate inactive, concert mismatch. |

### 1.3. Kết luận trạng thái

Dự án hiện đạt mức sẵn sàng khoảng 85% cho demo final. Các trụ cột audit, auto-publish và check-in đã có test gate xanh. Rủi ro lớn nhất còn lại nằm ở smoke end-to-end của luồng Audience checkout/payment/issue ticket và việc thiếu Vitest integration test riêng cho checkout/inventory theo flow mới.

## 2. Các mục đã chốt

### 2.1. Kiến trúc và source of truth

| Mục | Đã chốt |
| --- | --- |
| Monorepo chính | Source code production nằm trong `ticket-box-app/`. |
| Frontend production | `ticket-box-app/apps/web` là source of truth cho web app. Không sửa `Frontend/` như app chính nếu thư mục cũ còn tồn tại local. |
| Mobile checker | `ticket-box-app/apps/mobile-checker` là app mobile checker; web checker vẫn có route riêng để demo nhanh. |
| Database | Prisma schema nằm tại `ticket-box-app/packages/database/prisma/schema.prisma`; mỗi lần merge migration/schema phải `db:migrate` + `db:generate`. |
| Redis/Queue | Redis dùng cho cache, idempotency, queue/worker; demo worker cần Redis đang chạy. |
| Payment mock | Package mock hiện có script riêng `dev:payment:momo` và `dev:payment:vnpay`; tài liệu không nên ghi một lệnh chung nếu package chưa có alias. |

### 2.2. Các luồng nghiệp vụ đã có

| Luồng | Trạng thái | Bằng chứng trong repo |
| --- | --- | --- |
| Catalog public theo slug | Đã có | Web link `/concerts/${concert.slug}`; backend public catalog resolve slug/UUID. |
| Preview Admin/Organizer | Đã có | Route web `/admin/concerts/:concertId/preview`, `/organizer/concerts/:concertId/preview`; backend có API metadata preview cho admin. |
| Seat map / zone selection | Đã có | `SeatMapPanel`, upload/preview seat map, zone/ticket type mapping. |
| Order hold / inventory trong Orders | Đã có | Inventory không còn module riêng; năng lực hold/release/confirm nằm trong `orders`, `payments`, `tickets`. |
| Payment VNPay/MoMo | Đã có | Gateway, mock server, return/webhook handling, circuit breaker/bulkhead scripts. |
| Ticket issue / QR / void | Đã có | `tickets` module, audit issue/void, QR ticket cho audience. |
| Check-in online/offline | Đã có | Backend check-in + mobile checker + 13 integration tests pass. |
| Guest List import | Đã có | API trigger/list job/errors, worker import CSV/Drive, `GuestListPanel`, guest pass handoff cho checker. |
| Notification | Đã có ở mức demo | Worker notification/email, reminder type `CONCERT_REMINDER`, retry route và audit retry. |
| Audit log | Đã có | Audit module API, admin audit UI, audit cho retry notification, payment webhook, ticket issue/void, guest import, auto-publish. |
| Auto-publish | Đã có | Worker scheduler, readiness check, auto `ON_SALE`, cache invalidation, audit `CONCERT_AUTO_PUBLISHED`, 3 tests pass. |
| Demo guide | Đã có | `GUIDE_TEST_DEMO/DEMO/DEMO_END_TO_END.md`, `GUIDE_TEST_DEMO/DEMO/DEMO_MOBILE_CHECKER.md`, `GUIDE_TEST_DEMO/GUIDE/TEST_GUIDE.md`. |

### 2.3. Quy ước demo

| Mục | Quy ước |
| --- | --- |
| Demo chính | Ưu tiên theo `GUIDE_TEST_DEMO/DEMO/DEMO_END_TO_END.md`: Organizer tạo/submit -> Admin duyệt/preview -> Worker auto-publish -> Audience mua vé -> Ticket QR -> Checker scan -> Admin xem audit. |
| Demo payment | Nếu sandbox thật không ổn định, dùng payment mock và nói rõ đây là môi trường giả lập gateway. |
| Demo notification | Nếu SMTP thật chưa cấu hình, demo bằng notification status + audit log; không hứa email thật nếu không có credential. |
| Demo guest list | Nếu Google Drive credential chưa sẵn sàng, demo gán folder/job UI và guest seed/pass mẫu; không phụ thuộc import Drive thật trong buổi demo. |
| Demo mobile checker | Có thể demo web checker nếu Expo/device gặp lỗi; mobile app dùng để chứng minh preload/offline/sync nếu thời gian cho phép. |

## 3. Các vấn đề còn tồn đọng

### 3.1. P0 - cần chốt trước demo final

| Vấn đề | Ảnh hưởng | Hướng xử lý |
| --- | --- | --- |
| Chưa smoke end-to-end checkout/payment mới nhất | Có thể fail ở bước mua vé, redirect, issue ticket dù test audit/check-in đã xanh. | Chạy thử 1 luồng Audience: chọn vé -> tạo order -> thanh toán VNPay/MoMo mock hoặc sandbox -> redirect -> thấy QR trong My Tickets. |
| Thiếu Vitest checkout/inventory theo flow mới | Test gate chưa cover oversell, max-per-user, payment success/failure, webhook duplicate bằng unit/integration Vitest. | Trong 1 ngày cuối chỉ smoke/manual; sau demo bổ sung test có hệ thống. |
| Tài liệu lệnh payment mock có thể lệch script | Demo bị đứng nếu người chạy dùng `npm run dev:payment` nhưng package chỉ có `dev:payment:momo`/`dev:payment:vnpay`. | Sửa docs hoặc thêm alias script nếu cần. |
| Seed/demo data cần ổn định | Tạo data live tốn thời gian và dễ sai thao tác. | Chuẩn bị trước account, concert, ticket type, gate, checker, QR vé, guest pass, planned publish concert. |
| Worktree chưa chốt commit | Dễ sót thay đổi PROCESS/docs khi nộp. | Review `git status`, commit `PROCESS.md` sau khi nhóm đồng ý. |

### 3.2. P1 - nên làm để demo mượt

| Vấn đề | Ảnh hưởng | Hướng xử lý |
| --- | --- | --- |
| Web chunk JS lớn | Không chặn demo, nhưng build warning. | Để sau demo hoặc code split route admin/audience nếu có thời gian. |
| Vitest config warning `poolOptions` | Không fail test, nhưng noise trong log. | Đổi cấu hình forks theo Vitest 4 sau demo nếu không muốn chạm logic. |
| SMTP/Google Drive/Supabase credential | Các luồng external có thể không chạy thật. | Chuẩn bị credential trước, hoặc ghi rõ fallback demo. |
| Mobile real-device QA | Camera/offline network thật có thể khác emulator. | Test nhanh trên 1 thiết bị/emulator; nếu lỗi, demo web checker. |
| Admin audit filter data | Audit page có thể ít bản ghi nếu demo mới bắt đầu. | Chạy trước auto-publish/payment/guest trigger để tạo audit data. |

### 3.3. P2 - chuyển sang sau demo

| Hạng mục | Lý do để sau |
| --- | --- |
| Admin-adjust inventory API | Vượt scope demo, để sau khi có checkout/inventory tests đầy đủ. |
| Reconcile job order-payment-ticket | Quan trọng cho production, nhưng không nên mở rộng trong ngày cuối. |
| Observability/queue dashboard | Tốt cho vận hành, không cần cho demo final. |
| Security hardening mobile | AsyncStorage -> SecureStore, background sync, conflict UX chi tiết cần làm sau. |
| Anti-bot nâng cao | Rate limit cơ bản đã có; captcha/waiting room để giai đoạn sau. |
| CI/CD đầy đủ | Nên làm sau khi repo/tài liệu/test gate ổn định. |

## 4. Phân công công việc chi tiết

Ghi chú chung cho tất cả thành viên:

- Mỗi thành viên phải kiểm tra lại `ticket-box-app/.env.example` và `GUIDE_TEST_DEMO/GUIDE/ENV_GUIDE.md` theo đúng phần mình phụ trách, bảo đảm các biến môi trường/port/service mà Thuận setup đã đủ để chạy demo.
- Mỗi thành viên phải đọc lại `GUIDE_TEST_DEMO/DEMO/DEMO_END_TO_END.md`, đối chiếu với nghiệp vụ mình nắm và báo ngay nếu có bước demo sai flow, thiếu dữ liệu, thiếu service hoặc dễ gây gián đoạn khi quay.
- Nếu phát hiện docs lệch code, ưu tiên sửa docs/script nhỏ ngay; không mở rộng scope code lớn trong ngày cuối nếu không trực tiếp chặn demo.

### 4.1. Thái - Backend Core / Checkout / Inventory / Payment

Mục tiêu: đảm bảo luồng bán vé không oversell, không double charge, không issue ticket sai và demo payment đi hết luồng.

| Việc cần làm | Mức ưu tiên | Đầu ra cần có |
| --- | --- | --- |
| Smoke luồng checkout end-to-end với data demo | P0 | 1 order thành công, ticket issued, QR hiện trong My Tickets. |
| Smoke payment failure/cancel release inventory | P0 | Chứng minh order/hold không bị kẹt khi payment fail/cancel. |
| Kiểm tra webhook duplicate/idempotency bằng mock hoặc thao tác lặp lại | P0 | Webhook lặp không issue ticket 2 lần. |
| Xác nhận command payment mock đúng với docs | P0 | Docs/script khớp `dev:payment:momo`, `dev:payment:vnpay` hoặc có alias mới. |
| Kiểm tra env/docs cho checkout/payment | P0 | Xác nhận `.env.example` và `GUIDE_TEST_DEMO/GUIDE/ENV_GUIDE.md` có đủ `VNPAY_*`, `MOMO_*`, return URL, mock URL/port, timeout/circuit breaker nếu cần demo. |
| Đối chiếu `GUIDE_TEST_DEMO/DEMO/DEMO_END_TO_END.md` phần mua vé/thanh toán | P0 | Luồng Audience chọn vé -> checkout -> payment -> redirect -> My Tickets đúng với code hiện tại. |
| Ghi nhanh các gap checkout/inventory test còn thiếu | P1 | Danh sách case sau demo: oversell, max-per-user, success/failure, duplicate webhook, orphan payment, expired hold. |
| Sau demo: viết Vitest checkout/inventory theo flow mới | P2 | Test gate bổ sung cho hold/release/confirm/issue ticket. |

### 4.2. Quang - Check-in / Mobile Checker

Mục tiêu: đảm bảo scan vé/guest pass tại cổng hoạt động ổn định, có phương án demo web và mobile.

| Việc cần làm | Mức ưu tiên | Đầu ra cần có |
| --- | --- | --- |
| Chạy lại `npm.cmd test -w @ticketbox/tests` trước demo | P0 | Xác nhận 13/13 check-in tests vẫn pass trong tổng 18/18. |
| Smoke web checker bằng QR seed/demo | P0 | Scan vé hợp lệ thành công, scan lại bị từ chối, vé cancelled/refunded bị từ chối. |
| Smoke mobile checker trên Expo/emulator nếu demo mobile | P0 | Login, preload, scan online, scan offline, sync lại. |
| Chuẩn bị checker account/gate/device code để đọc trong demo | P0 | Email/password/device code không phải tìm live lúc quay. |
| Kiểm tra env/docs cho checker | P0 | Xác nhận `.env.example` và `GUIDE_TEST_DEMO/GUIDE/ENV_GUIDE.md` có đủ API base URL, auth/JWT, QR signing public/private key và các biến cần cho web/mobile checker. |
| Đối chiếu `GUIDE_TEST_DEMO/DEMO/DEMO_END_TO_END.md` phần check-in | P0 | Bước lấy QR, đăng nhập checker, scan vé/guest, scan trùng/sai cổng khớp với behavior backend/mobile hiện tại. |
| Ghi rõ known issues mobile/offline khi bị hỏi | P1 | AsyncStorage, manual sync, conflict UX, real-device QA. |
| Phối hợp với Thuận về guest pass sau import/seed | P1 | Guest pass mẫu scan được đúng gate. |

### 4.3. Thanh - Notification / Audit / Worker

Mục tiêu: đảm bảo worker chạy ổn định, auto-publish và audit có bằng chứng rõ trong demo.

| Việc cần làm | Mức ưu tiên | Đầu ra cần có |
| --- | --- | --- |
| Chạy worker cùng Redis trước demo | P0 | Worker log không crash; auto-publish tick hoạt động. |
| Smoke auto-publish với concert DRAFT `planned_publish_at` gần hiện tại | P0 | Concert chuyển `PUBLISHED`, ticket type DRAFT -> `ON_SALE`, audit `CONCERT_AUTO_PUBLISHED`. |
| Mở admin audit page và chuẩn bị filter sẵn | P0 | Filter được `CONCERT_AUTO_PUBLISHED`, `PAYMENT_WEBHOOK_SUCCEEDED`, `TICKET_ISSUED`, `GUEST_IMPORT_TRIGGERED`. |
| Kiểm tra notification retry/audit retry | P1 | Retry notification FAILED có audit `RETRY_NOTIFICATION`. |
| Kiểm tra env/docs cho worker/notification/audit | P0 | Xác nhận `.env.example` và `GUIDE_TEST_DEMO/GUIDE/ENV_GUIDE.md` có đủ `REDIS_URL`, `SMTP_*`, worker interval, audit/notification config và hướng dẫn chạy worker. |
| Đối chiếu `GUIDE_TEST_DEMO/DEMO/DEMO_END_TO_END.md` phần auto-publish/audit/notification | P0 | Bước worker auto-publish, audit log, notification fallback khớp code và không hứa service external nếu env chưa sẵn sàng. |
| Chốt repo trước nộp | P0 | `git status` chỉ còn thay đổi mong muốn; không secret, không `node_modules`, không build artifact tracked. |
| Xác nhận SMTP mode | P1 | Nếu có credential thì gửi email thật; nếu không thì demo fallback rõ ràng. |
| Sau demo: sửa warning Vitest config nếu cần | P2 | Test log gọn hơn, không còn deprecated warning. |

### 4.4. Thuận - Guest List / Frontend / Demo / Docs / DevOps

Mục tiêu: đảm bảo UI, docs, demo data và repo sạch cho buổi demo/nộp bài.

| Việc cần làm | Mức ưu tiên | Đầu ra cần có |
| --- | --- | --- |
| Tổng duyệt `GUIDE_TEST_DEMO/DEMO/DEMO_END_TO_END.md` theo flow A -> C -> E | P0 | Kịch bản demo 1 mạch, người quay không bị thiếu bước. |
| Kiểm tra docs setup và payment mock command | P0 | Lệnh trong docs khớp package scripts hiện tại. |
| Tổng hợp xác nhận env/docs từ các thành viên | P0 | `.env.example` và `GUIDE_TEST_DEMO/GUIDE/ENV_GUIDE.md` phản ánh đủ phần checkout/payment, checker, worker/audit/notification, guest list/frontend. |
| Đối chiếu `GUIDE_TEST_DEMO/DEMO/DEMO_END_TO_END.md` với UI/frontend | P0 | Route slug, preview, seat map, checkout UI, My Tickets, audit page, Guest List Panel đúng với màn hình hiện tại. |
| Chuẩn bị demo data | P0 | Account admin/audience/organizer/checker, concert, ticket, gate, QR, guest pass, planned publish concert. |
| Smoke UI web desktop/mobile viewport | P0 | Home, detail slug, seats, checkout, my tickets, admin audit, preview không vỡ layout. |
| Chốt Guest List fallback | P1 | Có CSV/Drive mẫu nếu credential sẵn sàng; có guest seed/pass mẫu nếu Drive không demo thật. |

### 4.5. Cả nhóm - tổng duyệt cuối

| Việc | Người chính | Kết quả cần đạt |
| --- | --- | --- |
| Tổng duyệt môi trường | Thuận | Docker, DB, Redis, API, Web, Worker, payment mock/sandbox sẵn sàng. |
| Tổng duyệt Audience checkout | Thái | Mua vé thành công, QR ticket sẵn sàng cho checker. |
| Tổng duyệt Admin/Organizer | Thuận + Thanh | Tạo/duyệt/preview/auto-publish và audit có đủ bằng chứng. |
| Tổng duyệt Checker | Quang | Scan hợp lệ/trùng/hủy/sai cổng và optional offline sync. |
| Tổng duyệt audit evidence | Thanh | Audit page có data mới và filter chạy được. |

## 5. Checklist demo final

### 5.1. Trước khi demo

- [ ] Docker Desktop đang chạy.
- [ ] `docker compose up -d postgres redis` đã chạy.
- [ ] `npm.cmd run db:migrate` pass.
- [ ] `npm.cmd run db:generate` pass.
- [ ] `npm.cmd run db:seed` đã chạy nếu cần reset demo data.
- [ ] `npm.cmd test -w @ticketbox/tests` pass 18/18.
- [ ] API server đang chạy: `npm run dev:api`.
- [ ] Web đang chạy: `npm run dev:web`.
- [ ] Worker đang chạy: `npm run dev:worker`.
- [ ] Payment mock/sandbox sẵn sàng: MoMo/VNPay theo script đã chốt.
- [ ] Tài khoản demo đã chuẩn bị: Admin, Audience, Organizer, Checker.
- [ ] Concert demo có zone, ticket type, gate, checker, seat map, slug.
- [ ] QR ticket/guest pass demo đã sẵn sàng hoặc có cách tạo nhanh.
- [ ] Admin audit page có data để filter.
- [ ] Không có secret thật trong file docs/env mẫu.
- [ ] `git status` chỉ còn các thay đổi được nhóm chấp nhận.

### 5.2. Luồng demo ưu tiên

| Thứ tự | Luồng | Kết quả cần cho khán giả thấy |
| --- | --- | --- |
| 1 | Organizer tạo/submits concert | Concert có thông tin, zone, ticket type, planned publish, seat map/guest config. |
| 2 | Admin preview và duyệt | Admin xem trước DRAFT, accept request, checker account/gate được tạo. |
| 3 | Worker auto-publish | Concert từ `DRAFT` -> `PUBLISHED`, ticket type -> `ON_SALE`, audit log có `CONCERT_AUTO_PUBLISHED`. |
| 4 | Audience xem slug/detail/seat map | URL thân thiện, seat map/zone/ticket hiện đúng. |
| 5 | Audience checkout/payment | Order được giữ, thanh toán thành công, redirect về app. |
| 6 | My Tickets / QR | Ticket issued và QR sẵn sàng scan. |
| 7 | Checker scan | Vé hợp lệ thành công, scan lại bị từ chối; nếu kịp demo cancelled/refunded/wrong gate. |
| 8 | Admin audit log | Audit trace được auto-publish, payment webhook, ticket issued, guest import/retry notification nếu có. |
| 9 | Guest List | Demo import/guest panel hoặc guest pass seed, bàn giao sang checker. |

### 5.3. Lệnh nhanh để chạy lại

```powershell
cd "D:\U\Y3\S2\Software Design\ticket-box-app\ticket-box-app"
docker compose up -d postgres redis
npm.cmd run db:migrate
npm.cmd run db:generate
npm.cmd test -w @ticketbox/tests
npm.cmd run build
```

Chạy service trong các terminal riêng:

```powershell
npm run dev:api
npm run dev:web
npm run dev:worker
npm run dev:payment:momo
npm run dev:payment:vnpay
```

### 5.4. Tiêu chí go/no-go

| Tiêu chí | Go | No-go |
| --- | --- | --- |
| Test gate | 18/18 pass | Có test fail logic chưa rõ nguyên nhân. |
| Checkout/payment | Mua vé demo thành công ít nhất 1 lần. | Không issue được ticket/QR. |
| Worker auto-publish | Concert demo publish tự động hoặc có fallback publish thủ công rõ ràng. | Worker crash không có fallback. |
| Checker | Scan QR demo thành công. | Không scan được vé hợp lệ. |
| Audit | Audit page hiện đủ action chính. | Không có bằng chứng cho hành động nền. |
| Docs/demo script | Người demo đi được theo script. | Lệnh/tài khoản/data thiếu, phải sửa live quá nhiều. |

Nếu sát giờ demo có sự cố external service, ưu tiên fallback local: payment mock, guest seed/pass mẫu, web checker thay mobile, audit log thay email thật.
