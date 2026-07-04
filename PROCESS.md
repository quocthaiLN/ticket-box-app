# Đánh giá chất lượng, tiến độ và kế hoạch tiếp theo TicketBox

Ngày cập nhật: 2026-07-04  
Phạm vi: blueprint, code trong `ticket-box-app/`, test suite hiện tại, tài liệu setup và trạng thái worktree.

## 1. Trạng thái kiểm chứng hiện tại

| Hạng mục | Kết quả | Ghi chú |
| --- | --- | --- |
| Build toàn workspace | Đạt | `npm.cmd run build` pass khi chạy ngoài sandbox; web có warning chunk JS > 500 kB |
| Docker local | Đạt | Postgres `ticketbox-postgres` chạy `localhost:5433`, Redis `ticketbox-redis` chạy `localhost:6379` |
| Database | Đạt | `npm.cmd run db:validate` pass; `db:generate`, `db:migrate`, `db:seed` đã chạy được trong lượt kiểm chứng cleanup trước đó |
| Test suite sau cleanup | Đạt | `npm.cmd test -w @ticketbox/tests`: 1 file, 7/7 pass; còn warning cấu hình Vitest 4 về `poolOptions` |
| Test inventory cũ | Đã xóa | Folder `ticket-box-app/tests/inventory/` là test cũ, import module không còn tồn tại |
| Test checkout cũ | Đã xóa | Folder `ticket-box-app/tests/checkout/` fail do không khớp flow mới; đã dọn khỏi tree |
| Tài liệu setup | Đã gộp | `WEB_RUN_GUIDE.md` + `MOBILE_TEST_GUIDE.md` được merge thành `SET_UP_GUIDE.md` |
| `.env.example` | Đã chỉnh | Đã cập nhật port DB Docker, `WEB_URL`, `VITE_API_BASE_URL`, payment return URL, mock payment port |

Kết luận ngắn: dự án đã có nền tảng tốt để chốt giai đoạn hiện tại: build được, Docker local chạy được, test suite sau cleanup đã xanh. Phần còn thiếu lớn nhất cho MVP tiếp theo là viết lại test nghiệp vụ checkout/inventory theo flow hiện tại, bổ sung kiểm chứng audit/notification và hoàn thiện demo scripts.

## 2. Lưu ý quan trọng

### 2.1. Test tree sau cleanup

| Folder | Trạng thái | Quyết định |
| --- | --- | --- |
| `ticket-box-app/tests/inventory/` | Test cũ, import `apps/api-server/src/modules/inventory/*` không còn tồn tại | Đã xóa |
| `ticket-box-app/tests/checkout/` | Test cũ kỳ vọng `createOrder` trả `payment_id`/`checkout_url`; implementation hiện đã tách order hold và payment attempt | Đã xóa |
| `ticket-box-app/tests/checkin/` | Pass 7/7, bao phủ online scan, wrong gate, guest scan, offline sync, duplicate/conflict | Giữ lại làm test gate hiện tại |

### 2.2. Module Inventory trong blueprint

Code hiện tại không còn module `inventory` riêng. Năng lực inventory đang nằm ở:

- `orders/repository/hold.ts`: giữ vé, chống oversell, enforce `maxPerUser`.
- `orders` module: cancel/expire held order.
- `payments` module: confirm payment, release khi fail, tạo tickets.
- `tickets` module: đọc/list/detail/QR/void ticket, không phải nơi quản lý tồn kho.

Đánh giá:

- Với MVP, không bắt buộc phục hồi module `inventory` riêng nếu test mới chứng minh được hold/release/confirm chính xác.
- `tickets` và `payments` không thay thế hoàn toàn Inventory; chúng chỉ xử lý các phần sau khi inventory đã được giữ hoặc xác nhận.
- Admin-adjust inventory và reconcile API là việc ngoài scope hiện tại, đưa sang giai đoạn sau này.

## 3. Cleanup worktree

Lưu ý: đây là trạng thái cleanup đã chốt vào commit chuẩn. Các file không nên đưa lên remote đã được untrack/ignore đúng hướng; `Frontend/` vẫn giữ local ignored làm tư liệu tham khảo.

### Đã thực hiện

| Đường dẫn | Hành động |
| --- | --- |
| `ticket-box-app/tests/inventory/` | Xóa folder test cũ |
| `ticket-box-app/tests/checkout/` | Xóa folder test cũ |
| `CHECKER_GUIDE.md` | Giữ trạng thái xóa |
| `TEAMWORK.md` | Giữ trạng thái xóa |
| `WEB_RUN_GUIDE.md` | Merge vào `SET_UP_GUIDE.md`, sau đó xóa |
| `MOBILE_TEST_GUIDE.md` | Merge vào `SET_UP_GUIDE.md`, sau đó xóa |
| `.gitignore` | Thêm `ticket-box-app/apps/*/tsconfig.tsbuildinfo` |
| `.gitignore` | Thêm `Frontend/` để giữ thư mục này làm tham khảo local, không đưa lại lên remote |
| `ticket-box-app/.env.example` | Cập nhật để khớp Docker/code hiện tại |
| `Frontend/` | Untrack khỏi git index; `git status --ignored` hiển thị `D` trong index và `!! Frontend/` local ignored; `ticket-box-app/apps/web` là source of truth cho web app |
| `ticket-box-app/apps/api-server/tsconfig.tsbuildinfo` | Untrack khỏi git index; giữ local/generated |
| `ticket-box-app/apps/payment-mocks/tsconfig.tsbuildinfo` | Untrack khỏi git index; giữ local/generated |
| `ticket-box-app/apps/worker-server/tsconfig.tsbuildinfo` | Untrack khỏi git index; giữ local/generated |
| Tracking check | `git ls-files Frontend ticket-box-app/apps/*/tsconfig.tsbuildinfo ticket-box-app/**/node_modules/* node_modules/*` không trả file nào |

### Quy ước cleanup/commit

| Nhóm file | Quyết định |
| --- | --- |
| `Frontend/` | Xóa khỏi remote bằng cleanup commit riêng. Thư mục vẫn giữ untracked/ignored ở local vì còn mẫu tham khảo cho UI AI Artist Bio và cập nhật CSV/import. |
| `ticket-box-app/apps/*/tsconfig.tsbuildinfo` | Generated metadata, không commit. Nếu tách lịch sử commit kỹ hơn, gom các deletion khỏi index vào cleanup commit riêng cho build artifacts. |
| `node_modules/` | Không commit. Giữ `node_modules/` trong `.gitignore`, chỉ commit `package.json`/lockfile khi dependency thật sự thay đổi. |
| `ticket-box-app/apps/web` | Là source of truth duy nhất cho frontend production/demo; mọi chỉnh UI cần port vào đây thay vì sửa trực tiếp trong `Frontend/`. |

## 4. Đánh giá `.env.example`

`.env.example` hiện đã tương đối đầy đủ cho local development và demo. Các nhóm biến chính đã có:

- Server/Web: `NODE_ENV`, `PORT`, `WEB_URL`, `VITE_API_BASE_URL`.
- Database/Redis: `DATABASE_URL`, `REDIS_URL`.
- Auth: `JWT_SECRET`, `JWT_REFRESH_SECRET`.
- SMTP/notification worker: `SMTP_*`.
- Worker/order policy: `ORDER_HOLD_DURATION_SECONDS`, `EXPIRE_HOLDS_*`.
- Storage/AI/guest import: `STORAGE_*`, `AI_*`, `SUPABASE_*`, `GOOGLE_SERVICE_ACCOUNT_JSON`.
- QR signing: `QR_SIGNING_PRIVATE_KEY_B64`, `QR_SIGNING_PUBLIC_KEY_B64`.
- Payment: `VNPAY_*`, `MOMO_*`, `MOCK_PAYMENTS_PORT`.

Các điểm đã chỉnh:

- `DATABASE_URL` đổi sang Docker Compose local: `ticketbox:ticketbox@localhost:5433/ticketbox?schema=public`.
- Thêm `WEB_URL` và `VITE_API_BASE_URL`.
- Sửa `VNPAY_RETURN_URL`, `MOMO_REDIRECT_URL`, `MOMO_IPN_URL` sang route `/v1`.
- Thêm `MOMO_QUERY_URL` làm alias legacy vì `config/payment.ts` vẫn đọc biến này.
- Thêm `MOCK_PAYMENTS_PORT=4100`.

Đề xuất về sau:

- Tách thêm `.env.production.example` nếu cần triển khai API/worker ngoài Vercel.
- Không đưa secret thật vào `.env.example`.
- Khi CI/CD có test DB riêng, thêm `.env.test.example`.

## 5. Giai đoạn tiếp theo: hoàn thiện MVP

Mục tiêu: đáp ứng sản phẩm MVP theo blueprint, đủ demo và đủ cơ sở đánh giá chất lượng.

| Nhóm việc | Nhiệm vụ | Kết quả mong đợi |
| --- | --- | --- |
| Test nghiệp vụ core | Viết lại checkout/inventory tests theo flow mới | Bao phủ hold, max-per-user, payment success/failure, webhook idempotency, ticket issuance, release inventory |
| Proposal risk tests | Thêm test cho các vấn đề trong proposal: oversell, double charge/idempotency, offline duplicate, guest duplicate, rate limit cơ bản | Test phản ánh đúng rủi ro thiết kế |
| Notification 70-80% blueprint | Kiểm chứng và polish notification hiện có: ticket issued, reminder, admin list/detail/retry, email/log provider rõ ràng | Trình bày được notification trong video/demo |
| Audit log 70-80% blueprint | Chuẩn hóa audit service/API; hiện đã có schema và logging rải rác ở auth, organizer-admin, AI bio, payment webhook payload, check-in log, guest import errors | Truy vết được hành động quan trọng qua một luồng admin rõ ràng |
| Demo scripts | Viết script demo end-to-end cho Audience, Admin Web, Ban tổ chức/Organizer và Checker | Có nhiều kịch bản video 1 phút rõ luồng |
| Docker/setup | Chuẩn hóa Docker Compose, `.env.example`, `SET_UP_GUIDE.md`, seed data | Người mới clone repo chạy được local nhanh |
| Documentation | README + SET_UP_GUIDE + PROCESS.md nhất quán | Tài liệu đủ để nộp/chấm giai đoạn MVP |


## 6. Phân công nhiệm vụ 4 thành viên

### Thái: Backend Core / Checkout / Inventory

Phạm vi chính: bảo đảm luồng bán vé không oversell, không vượt giới hạn mỗi user, không phát vé sai sau thanh toán.

Nhiệm vụ chi tiết:

- Rà soát code hiện tại ở `orders`, `payments`, `tickets` để vẽ lại flow thật: create held order -> create payment attempt -> payment return/webhook -> confirm/release -> issue ticket.
- Viết lại test checkout/inventory theo flow mới, không dùng lại giả định cũ `createOrder` trả thẳng `payment_id`/`checkout_url`.
- Bổ sung test giữ vé thành công, giữ vé quá số lượng còn lại, giữ vé vượt `maxPerUser`, hủy order HELD và expire hold.
- Bổ sung test payment success phát ticket, payment failure/cancel release inventory, webhook duplicate không phát vé hai lần.
- Kiểm tra idempotency key ở create order/create payment/webhook, ghi lại endpoint nào bắt buộc có idempotency key.
- Rà lại transaction isolation/retry quanh `orders/repository/hold.ts`, đặc biệt các nhánh concurrent checkout.
- Chuẩn hóa seed data cho concert/ticket type phục vụ test và demo checkout.
- Cập nhật tài liệu ngắn mô tả trạng thái inventory nằm trong Orders/Payments/Tickets thay vì module `inventory` riêng.

Đầu ra:

- Test checkout/inventory xanh và chạy được bằng `npm test -w @ticketbox/tests`.
- Tài liệu ngắn mô tả flow nghiệp vụ ticketing hiện tại, kèm danh sách edge cases đã test.
- Checklist rủi ro còn lại: oversell, double charge, duplicate webhook, orphan payment, held order quá hạn.

### Quang: Check-in / Mobile Checker

Phạm vi chính: bảo đảm luồng scan tại cổng hoạt động ổn định cho vé và guest pass; trọng tâm là mobile checker, online/offline sync, duplicate và conflict handling.

Nhiệm vụ chi tiết:

- Duy trì `tests/checkin` đang xanh, coi đây là test gate chính cho check-in.
- Đọc lại `checkin` API và mobile checker app để đối chiếu các trạng thái: valid, wrong gate, duplicate, void/cancelled ticket, guest QR.
- Giữ các testcase đã có: guest đúng/sai cổng, offline batch replay, duplicate item, conflict khi online scan trước rồi offline sync sau, offline guest duplicate.
- Bổ sung test cho ticket `CANCELLED`/`REFUNDED`, device inactive/sai staff, gate inactive/sai concert nếu seed và service hiện tại hỗ trợ đủ.
- Chuẩn bị seed data tối thiểu cho checker account, gate, event, ticket và guest pass mẫu để demo scan không phụ thuộc thao tác thủ công.
- Viết kịch bản demo Mobile Checker 1 phút: login -> preload -> online scan -> tắt mạng giả lập -> scan offline -> sync lại.
- Phối hợp với Thuận để nhận guest data/CSV mẫu và xác nhận guest pass sau import check-in được đúng cổng.
- Ghi lại giới hạn hiện tại của mobile/offline: secure storage, background sync, conflict UX, real-device QA.

Đầu ra:

- Check-in test gate ổn định.
- Demo script Mobile Checker 1 phút.
- Ghi chú known issues mobile/offline nếu có.

### Thanh: Notification / Audit / Worker

Phạm vi chính: làm rõ các luồng nền có thể demo được và có truy vết hành động quan trọng.

Nhiệm vụ chi tiết:

- Rà soát `worker-server` hiện có: notification worker, email worker, expire holds, guest import, AI bio worker và scheduler reminder.
- Kiểm chứng notification ở mức demo: ticket issued đã tạo notification khi payment success, reminder scheduler đã tạo notification trước sự kiện, admin list/detail/retry đã có route.
- Làm rõ provider email/log hiện tại: flow nào gửi thật, flow nào mock/log, biến môi trường nào cần cấu hình.
- Chuẩn hóa audit service tập trung để các module gọi chung thay vì ghi rải rác; hiện auth, organizer-admin và AI bio đã ghi `audit_logs`, còn payment/check-in/guest import chủ yếu nằm ở bảng nghiệp vụ.
- Bổ sung audit cho các hành động trọng yếu còn thiếu: payment webhook state change, ticket issue/void, guest import trigger, admin retry notification.
- Thêm admin query/filter audit log cơ bản theo actor, action, entity/resource, time range nếu kịp scope MVP.
- Viết service-level checks/test cơ bản cho notification create/retry và audit write/query.
- Cập nhật hướng dẫn chạy worker và cách kiểm chứng queue/job trong demo.

Đầu ra:

- Notification demo hoạt động rõ.
- Audit log query/filter cơ bản cho admin.
- Worker flow có hướng dẫn chạy và kiểm chứng.

### Thuận: Guest List / Frontend / Demo / Documentation / DevOps

Phạm vi chính: giữ frontend production ở `ticket-box-app/apps/web`, phụ trách Guest List import/CSV/admin UI/demo data, làm demo rõ vai trò, và giữ repo sạch để nộp.

Nhiệm vụ chi tiết:

- Xác nhận mọi chỉnh UI chính đều nằm trong `ticket-box-app/apps/web`; chỉ dùng `Frontend/` làm mẫu tham khảo local cho UI AI Artist Bio, CSV/import và layout cũ.
- Port phần UI còn cần từ `Frontend/` sang `apps/web` theo từng màn hình, không sửa `Frontend/` như app chính.
- Phụ trách Guest List: rà `guest-list` API, worker import CSV/Drive, trang admin/organizer xem guest, trạng thái import job và danh sách lỗi từng dòng.
- Chuẩn bị CSV mẫu/Drive folder mẫu cho guest import, bao gồm guest hợp lệ, guest trùng phone/email, sai zone/gate và dòng lỗi để demo/kiểm thử.
- Chuẩn hóa seed/demo data cho guest list: concert, seat zone, gate mapping, guest VIP, checker handoff data để Quang dùng trong mobile checker demo.
- Viết demo script Guest List 1 phút: cấu hình folder CSV -> trigger/import job -> xem kết quả/lỗi -> tìm guest -> bàn giao sang checker scan guest pass.
- Chuẩn hóa README, `SET_UP_GUIDE.md`, `PROCESS.md` để thống nhất port, lệnh chạy, yêu cầu Docker, seed, test và known gaps.
- Kiểm tra `.env.example` khớp code: API URL, web URL, payment mock, Redis, Postgres, storage, AI, QR signing.
- Chuẩn bị seed/demo accounts cho Audience, Organizer, Checker, Admin, kèm mật khẩu demo rõ trong tài liệu nội bộ nếu được phép.
- Viết demo scripts 1 phút cho Audience, Organizer, Admin Web, Guest List và Checker; mỗi script có mục tiêu, tài khoản, dữ liệu cần có, bước quay, kết quả mong đợi.
- Chuẩn bị checklist trước khi commit: không có `node_modules`, không có secret thật, không có build artifact tracked, `Frontend/` chỉ là ignored local.
- Tách commit cleanup hợp lý: một commit cho untrack `Frontend/`, một commit riêng cho untrack `tsconfig.tsbuildinfo` nếu nhóm muốn lịch sử thật sạch.

Đầu ra:

- Tài liệu setup chạy được từ đầu.
- Demo scripts theo role, bao gồm luồng Guest List import/CSV.
- Worktree sạch trước khi chốt giai đoạn.

## 7. Kết luận chốt hiện tại

- Build và Docker local đã đủ tốt để tiếp tục.
- Test gate hiện tại chỉ nên giữ `checkin`.
- `inventory` và `checkout` tests cũ đã xóa; cần viết lại trong giai đoạn MVP tiếp theo.
- Notification và audit log nên là trọng tâm MVP tiếp theo, đặt mục tiêu 70-80% blueprint.
- Admin-adjust/reconcile API, device/gate polish, anti-bot nâng cao và security hardening chuyển sang giai đoạn sau này.

## 8. Giai đoạn sau này: phát triển dài lâu

Các việc dưới đây quan trọng nhưng vượt scope chốt MVP hiện tại.

| Nhóm việc | Đề xuất |
| --- | --- |
| Admin-adjust inventory API | Tạo `inventory` hoặc `admin-inventory` service; route xem tồn kho, adjust stock, release hold thủ công; bắt buộc audit log |
| Reconcile API/job | Job/admin endpoint đối soát order-payment-ticket: payment success chưa issue ticket, order HELD quá hạn, ticket count lệch order item, webhook duplicate |
| Device/gate polish | Device enrollment, disable/reassign device, gate dashboard, trạng thái thiết bị |
| Anti-bot nâng cao | Captcha, waiting room, bot scoring, adaptive rate limit, IP/device reputation |
| Security hardening | Refresh-token rotation, CSRF nếu dùng cookie, secret management, mobile secure storage, permission matrix test |
| Observability | Structured logs, metrics, tracing, queue dashboard, webhook/payment alerts |
| CI/CD | Pipeline build/test với Postgres/Redis service, coverage, deploy preview |
| Performance/load test | Kịch bản burst traffic 80.000 users/5 phút, cache hit ratio, checkout concurrency |
| Mobile production readiness | Background sync, conflict UX, real-device QA |
| Data governance | Retention policy cho audit/notification/log, backup/restore DB |
