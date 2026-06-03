# TicketBox Workflow Handoff

Tài liệu này dùng để giúp một context window mới nắm nhanh dự án TicketBox, các vấn đề chính, quyết định kỹ thuật đã chốt và cách tiếp tục làm việc trong repo.

## 1. Bối cảnh dự án

TicketBox là hệ thống bán vé concert/sự kiện, số hóa toàn bộ quy trình từ xem concert, mua vé, thanh toán, nhận e-ticket đến soát vé tại cổng.

Các kênh bán vé rời rạc như Zalo OA, Google Form và chuyển khoản thủ công không còn đủ vì:

- Dễ sập khi mở bán do tải đột biến, ví dụ 80.000 người trong 5 phút đầu.
- Dễ xảy ra tranh chấp vé, trừ tiền nhưng không ra vé, hoặc cấp vé cuối cùng cho nhiều người.
- Scalper/bot có thể vét vé nhanh hơn khán giả thật.
- Người dùng có thể spam request để lách giới hạn số vé mỗi tài khoản.
- Trang danh sách và chi tiết concert đọc DB quá nhiều, gây quá tải database.
- Soát vé tại sân vận động/nhà thi đấu có thể mất mạng, cần offline mode.
- Danh sách khách mời VIP chỉ được đồng bộ một chiều qua CSV nên phải xử lý lỗi an toàn.

## 2. Mục tiêu chính

- Chịu tải mở bán lớn mà không sập backend/database.
- Đảm bảo không bán lố vé và enforce đúng giới hạn vé theo tài khoản.
- Chống bot, spam request và scalping.
- Không để người dùng bị trừ tiền hai lần hoặc trừ tiền nhưng không nhận vé.
- Tối ưu luồng đọc bằng Redis cache cho trang danh sách và chi tiết concert.
- Hỗ trợ mobile app soát vé offline, sau đó đồng bộ lại an toàn.
- Tự động sinh Artist Bio từ PDF/Press kit bằng AI worker.
- Import CSV guest list định kỳ, strict validation, không làm gián đoạn hệ thống.

## 3. Người dùng chính

- Khán giả: xem concert, chọn vé, thanh toán qua VNPAY/MoMo sandbox, nhận e-ticket, check-in bằng QR.
- Ban tổ chức: quản trị concert, cấu hình ticket type, giới hạn vé, xem thống kê, upload press kit/CSV.
- Nhân sự soát vé: dùng mobile app quét QR, hoạt động được khi offline và sync khi có mạng.

## 4. Phạm vi đồ án

In scope:

- Blueprint kiến trúc, C4 diagram, high-level architecture, database design, access control.
- Thiết kế và cài đặt các cơ chế: Rate Limiting, Circuit Breaker, Idempotency Key, Caching.
- App chạy được với các tính năng xem/mua vé, admin, thông báo, offline check-in, AI Artist Bio, CSV guest sync.
- README hướng dẫn chạy và seed data ít nhất 4 concert cùng sơ đồ chỗ ngồi.

Out of scope:

- Production deployment thật.
- Tích hợp payment gateway live; chỉ mô phỏng/sandbox.
- Gọi API trực tiếp sang hệ thống khách mời của nhãn hàng; bắt buộc dùng CSV.

## 5. Kiến trúc đã chốt

Kiến trúc chính: Event-Driven Modular Monolith.

Lý do:

- Giữ được ranh giới domain rõ như microservices nhưng giảm độ phức tạp DevOps.
- Tránh distributed transaction trong đồ án.
- Dễ chạy local/demo hơn.
- Có thể dùng queue và worker để cô lập tác vụ nặng hoặc phụ thuộc bên thứ ba.

Các module/lớp chính:

- Client layer: Web App cho khán giả/admin, Mobile App cho soát vé.
- Gateway layer: API Gateway/Nginx xử lý routing, JWT verify, rate limiting.
- Backend modules:
  - Catalog: concert, artist, venue, seat map.
  - Ticketing/Order: đặt vé, giữ vé, kiểm soát quota, chống race condition.
  - Payment: VNPAY/MoMo sandbox, webhook, idempotency.
  - Check-in: QR check-in, offline sync.
  - Notification: email/app push/nhắc lịch.
- Data/queue:
  - PostgreSQL cho dữ liệu cốt lõi.
  - Redis cho cache, rate limit, idempotency key, JWT denylist, số vé còn lại.
  - BullMQ cho queue/background jobs.
  - MinIO cho file tĩnh: ảnh, SVG seat map, press kit, CSV.
- Workers:
  - AI worker sinh Artist Bio.
  - CSV sync worker import guest list.
  - Notification/reminder worker.

## 6. Quyết định kỹ thuật quan trọng

### ADR 1 - Event-Driven Modular Monolith

Chọn modular monolith kết hợp event/queue thay vì microservices. Đánh đổi là không scale độc lập từng module, nhưng phù hợp với đồ án và giảm complexity.

### ADR 2 - PostgreSQL + Pessimistic Locking

Chọn PostgreSQL và `SELECT ... FOR UPDATE` cho các thao tác bán vé nhạy cảm.

Mục tiêu là chính xác tuyệt đối, không bán lố vé. Optimistic locking có thể khiến quá nhiều user bị lỗi retry khi tải cao. NoSQL không phù hợp bằng cho transaction/locking nghiệp vụ này.

### ADR 3 - JWT Stateless + Redis Denylist

JWT giúp API Gateway xác thực nhanh mà không cần gọi DB/cache liên tục. Redis denylist dùng cho logout/ban token vì JWT thuần không revoke tức thời được.

### ADR 4 - Background Workers

Các tác vụ nặng hoặc dễ timeout như AI, email, CSV import chạy qua worker/queue thay vì xử lý đồng bộ trong request. Mục tiêu là API phản hồi nhanh và cô lập lỗi.

## 7. Cơ chế bảo vệ hệ thống

Rate Limiting:

- Đặt tại API Gateway, dùng Redis counter.
- Luồng public read có ngưỡng rộng hơn.
- API đặt vé `/api/v1/orders` giới hạn nghiêm ngặt theo User ID để chống spam/scalper.
- Khi vượt ngưỡng trả `429 Too Many Requests` kèm `Retry-After`.

Circuit Breaker:

- Đặt trong Payment Module khi gọi VNPAY/MoMo sandbox.
- Trạng thái: Closed, Open, Half-Open.
- Ví dụ cấu hình: timeout 5s, failure rate > 50% trong sliding window 10s với tối thiểu 20 request.
- Khi payment lỗi, hệ thống fail-fast và vẫn cho xem concert/check-in bình thường.
- Vé đang `HELD` được trả lại kho khi hết TTL, ví dụ 10 phút.

Idempotency Key:

- Frontend sinh UUID cho luồng tạo order và gửi qua header `Idempotency-Key`.
- Webhook payment dùng key từ `OrderID + TransactionID`.
- Redis lưu trạng thái `IN_PROGRESS`/`COMPLETED` với TTL 24h.
- PostgreSQL có unique constraint trên `idempotency_key` ở bảng order/webhook log làm lớp bảo vệ cuối.
- Request trùng khi đang xử lý trả conflict; request trùng đã hoàn tất trả lại response cũ.

Caching:

- Dữ liệu tĩnh như danh sách concert, chi tiết concert, seat map dùng cache-aside, TTL 1-24h, active invalidation khi admin cập nhật.
- Số vé còn lại dùng TTL ngắn 5-10s và có thể cập nhật chủ động bằng Redis `DECRBY` sau khi chốt order.
- UI chấp nhận eventual consistency vài giây; tính đúng tuyệt đối vẫn nằm ở transaction/lock trong DB.

Offline Check-in:

- Mobile app dùng SQLite/Local DB để preload danh sách vé hợp lệ.
- Khi mất mạng, app ghi nhận check-in cục bộ.
- Khi có mạng, sync idempotent lên server.
- Cần ưu tiên chống check-in trùng và xử lý conflict rõ ràng.

CSV Guest Sync:

- Nhập danh sách khách mời VIP từ CSV một chiều.
- Worker chạy ngầm, validate chặt, bỏ qua dòng lỗi/trùng, không làm hỏng cả batch.

AI Artist Bio:

- Admin upload PDF/Press kit.
- Worker trích xuất/làm sạch text, gọi OpenAI/Gemini, lưu Artist Bio.
- Nếu AI lỗi/rate limit, retry hoặc báo trạng thái lỗi mà không ảnh hưởng luồng bán vé.

## 8. Tech stack đề xuất

- Web frontend: React + Vite + React Router.
- Mobile frontend: React Native (Expo).
- API Gateway: Nginx.
- Backend: Node.js + Express.js, tổ chức theo module.
- Primary DB: PostgreSQL.
- Cache/session auxiliary: Redis.
- Queue: BullMQ.
- Object Storage: MinIO.
- Local mobile DB: SQLite.
- AI: OpenAI API, ưu tiên `gpt-4o-mini` theo tài liệu thiết kế hiện tại.

## 9. Các tài liệu nền cần đọc khi tiếp quản

- `blueprint/proposal.md`: bối cảnh, vấn đề, mục tiêu, người dùng, phạm vi và rủi ro.
- `blueprint/design.md`: kiến trúc, C4, sequence flows, database design, access control, cơ chế bảo vệ, ADR, tech stack.
- `blueprint/api-design/base-api.md`: quy ước chung cho API.
- `blueprint/api-design/`: các thiết kế API theo từng module/use case.
- `blueprint/specs/README.md`: specs/requirements nếu cần đối chiếu nghiệp vụ.
- `ticket-box-app/`: mã nguồn ứng dụng nếu đã bắt đầu implement.

## 10. Cách làm việc tiếp trong repo

Khi mở context mới:

1. Đọc file này trước để nắm tổng quan.
2. Kiểm tra `git status` để không ghi đè thay đổi của người khác.
3. Đọc tài liệu liên quan trực tiếp tới task, ưu tiên `blueprint/proposal.md`, `blueprint/design.md`, `blueprint/api-design/base-api.md` và file đang được sửa.
4. Nếu sửa API/design, giữ nhất quán với các quyết định: modular monolith, PostgreSQL lock, Redis cache/idempotency, BullMQ worker, Nginx rate limit.
5. Nếu sửa code trong `ticket-box-app/`, bám theo cấu trúc hiện có; không tự ý đổi stack hoặc refactor rộng khi không cần.
6. Sau mỗi thay đổi đáng kể, cập nhật `WORKFLOW.md` nếu có quyết định mới, thay đổi phạm vi, hoặc phát hiện ràng buộc quan trọng.
7. Khi cài đặt thêm kiến thức, module, pattern hoặc dependency mới trong `apps/api-server`, `apps/web`, `packages/database`, `packages/storage`, phải cập nhật `description.md` tương ứng trong folder đó. Mỗi file `description.md` là sổ tay sống của folder: vai trò, hiện trạng, cách đọc, quy ước cần giữ, nguồn học thêm và ghi chú cần update ở sprint sau.

## 11. Trạng thái ghi nhận hiện tại

Sprint 1 - Thanh:

- Root npm workspace được scaffold trong `ticket-box-app/` theo `blueprint/structure.md`.
- `apps/api-server` có Express API skeleton, request-id middleware, response envelope, problem-details error middleware và Catalog router mount dưới `/v1`.
- Catalog module đã có public/admin route stubs, DTO/types, query parser, service/repository/cache key skeleton theo `blueprint/api-design/catalog-api.md`.
- `apps/web` có React + Vite + React Router skeleton với audience home, concert detail placeholder, admin home và admin catalog placeholder.
- `packages/storage` có MinIO/CDN wrapper contract: bucket convention, object key convention, public URL, upload URL và download URL interface.
- README đã ghi module boundaries, route mount convention và lệnh local cơ bản.
- Đã tạo `description.md` cho `apps/api-server`, `apps/web`, `packages/database`, `packages/storage` để team vừa làm vừa research và cập nhật dần qua từng sprint.

Sprint 1 - Quang:

- `apps/api-server/src/modules/checkin` đã có scaffold router/service/repository/schema/types và `checkin.sync.ts`.
- Check-in route theo prompt đã có: `/v1/check-in/scan`, `/v1/check-in/preload`, `/v1/check-in/offline-sync`.
- Check-in route alias theo blueprint đã có: `/v1/check-in/scans`, `/v1/check-in/offline-batches`, `/v1/check-in/offline-batches/:batch_id/items`.
- `apps/api-server/src/modules/guest-list` đã có scaffold router/service/repository/schema/types.
- Guest list route theo prompt đã có: `/v1/guest-list/import`, `/v1/guest-list/search`, `/v1/guest-list/scan`.
- Guest list route alias theo blueprint đã có: `/v1/admin/concerts/:concert_id/guest-import-jobs`, `/v1/check-in/guests/search`, `/v1/admin/concerts/:concert_id/guests`, `/v1/check-in/guests/scans`.
- Decision note offline check-in sync nằm ở `docs/decisions/offline-checkin-sync.md`.

Quyết định cập nhật:

- Team chọn React + Vite + React Router cho web audience/admin thay vì Next.js vì phù hợp kiến thức hiện tại của nhóm hơn.
- Offline check-in sync dùng `client_item_id` cho từng offline scan item để server xử lý idempotency theo từng dòng khi mobile retry batch.
