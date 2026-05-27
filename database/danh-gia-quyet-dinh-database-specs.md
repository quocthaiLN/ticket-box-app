# Đánh giá và quyết định chủ chốt khi thiết kế Database và Specs cho TicketBox

## 1. Dữ kiện đầu vào dùng để đánh giá

Tôi đánh giá database và viết specs dựa trên các nhóm yêu cầu sau:

1. TicketBox là hệ thống bán vé concert có các nhóm người dùng chính:
   - Khán giả
   - Ban tổ chức
   - Nhân sự soát vé

2. Các chức năng chính của hệ thống gồm:
   - Xem danh sách concert
   - Xem chi tiết concert
   - Mua vé
   - Thanh toán qua VNPAY/MoMo
   - Nhận e-ticket dạng QR
   - Quản trị concert
   - Cấu hình loại vé
   - Soát vé tại cổng
   - Hỗ trợ soát vé offline
   - AI Artist Bio từ PDF/Press Kit
   - Import guest list VIP từ CSV
   - Gửi notification qua app/email và mở rộng SMS/Zalo OA

3. Các vấn đề kỹ thuật trọng tâm cần xử lý:
   - Chống bán quá số vé
   - Giới hạn số vé mỗi tài khoản
   - Chống trừ tiền hai lần
   - Xử lý payment timeout/webhook retry
   - Chống check-in trùng vé
   - Đồng bộ offline check-in
   - Import CSV có dòng lỗi hoặc dữ liệu trùng
   - Giảm tải database bằng caching
   - Chống spam request và scalper bot

4. Hướng kiến trúc đã được xác định:
   - Event-Driven Modular Monolith
   - API Gateway
   - PostgreSQL làm primary database
   - Redis cho cache, rate limit, idempotency TTL ngắn hạn
   - Message Broker/BullMQ cho xử lý bất đồng bộ
   - SQLite cho mobile offline check-in
   - Object Storage cho PDF, SVG, CSV, ảnh tĩnh

---

## 2. Tiêu chí đánh giá database

Tôi không đánh giá database theo hướng “có đủ bảng là xong”, mà đánh giá theo khả năng triển khai thực tế.

| Tiêu chí | Câu hỏi kiểm tra |
|---|---|
| Đủ dữ liệu nghiệp vụ | Có lưu được user, concert, vé, order, payment, QR, check-in, notification, AI bio, guest list không? |
| Đủ ràng buộc toàn vẹn | Có PK, FK, UNIQUE, CHECK để chống dữ liệu sai hoặc trùng không? |
| Đủ cơ chế nhất quán | Có hỗ trợ transaction, row lock, idempotency, chống oversell, chống payment double-processing không? |
| Đủ khả năng quan sát/debug | Có log trạng thái, webhook event, inventory event, audit log, notification log không? |
| Đủ để viết specs triển khai | Mỗi feature trong specs có bảng dữ liệu tương ứng để implement không? |

### Kết luận đánh giá

Database ban đầu đã đủ phần nghiệp vụ chính, nhưng chưa đủ chắc cho các tình huống cạnh tranh cao. Vì vậy tôi bổ sung các bảng sau:

- `user_ticket_type_counters`
- `ticket_inventory_events`
- `payment_webhook_events`
- `checkin_devices`
- `notification_dead_letters`

---

## 3. Các quyết định chủ chốt

## 3.1. Quyết định 1 — PostgreSQL là nguồn dữ liệu chính cho nghiệp vụ tiền/vé

### Lý do

Nghiệp vụ mua vé cần:

- ACID transaction
- Khóa dòng ở cấp database
- Foreign key để giữ toàn vẹn dữ liệu
- Unique constraint để chống trùng
- Check constraint để chống dữ liệu âm hoặc sai trạng thái
- Rollback khi payment/order/ticket lỗi giữa chừng

Các vấn đề như:

- Không cấp vé cuối cùng cho hai người
- Không trừ tiền hai lần
- Không tạo hai payment cho một order
- Không check-in cùng một vé hai lần

không nên giao hoàn toàn cho cache hoặc queue.

### Hệ quả thiết kế

Các bảng lõi phải nằm trong PostgreSQL:

- `orders`
- `order_items`
- `payments`
- `tickets`
- `ticket_types`
- `idempotency_keys`
- `payment_webhook_events`

Redis chỉ hỗ trợ tốc độ, TTL, cache, rate limit và idempotency ngắn hạn. Redis không thay thế PostgreSQL cho trạng thái tài chính cuối cùng.

---

## 3.2. Quyết định 2 — Tách `ticket_types` khỏi `tickets`

### Ý nghĩa của từng bảng

| Bảng | Vai trò |
|---|---|
| `ticket_types` | Lưu cấu hình loại vé: tên vé, giá, tổng số lượng, số còn lại, số đang giữ, số đã bán, giới hạn mỗi user |
| `tickets` | Lưu từng e-ticket cụ thể được phát hành cho người dùng, có QR riêng và trạng thái check-in riêng |

### Lý do

`tickets` và `ticket_types` là hai khái niệm khác nhau.

- `ticket_types` là kho vé theo loại.
- `tickets` là từng vé cụ thể của từng người dùng.

Nếu gộp hai khái niệm này sẽ khó xử lý:

- Lock kho vé khi đặt vé
- Trừ số lượng còn lại
- Giữ vé tạm thời
- Phát hành từng QR riêng
- Check-in từng vé riêng
- Audit trạng thái từng vé

### Hệ quả thiết kế

Khi user đặt vé, hệ thống lock dòng `ticket_types` tương ứng để kiểm tra và trừ kho. Sau khi thanh toán thành công, hệ thống phát hành nhiều dòng `tickets`, mỗi vé có QR token/signature riêng.

---

## 3.3. Quyết định 3 — Bổ sung `user_ticket_type_counters` để enforce per-user limit

### Vấn đề

Yêu cầu hệ thống quy định mỗi tài khoản chỉ được mua tối đa một số lượng vé nhất định cho mỗi loại vé.

Ví dụ:

- SVIP tối đa 2 vé/tài khoản
- CAT1 tối đa 4 vé/tài khoản

Nếu chỉ query tổng số vé user đã mua từ `tickets` hoặc `order_items`, hai request song song có thể cùng đọc thấy user chưa vượt giới hạn, sau đó cùng tạo order.

### Quyết định

Bổ sung bảng:

```sql
user_ticket_type_counters
```

Khóa chính:

```text
(user_id, ticket_type_id)
```

### Mục đích

Bảng này giúp lock đúng cặp:

```text
user + loại vé
```

trong cùng transaction.

### Luồng xử lý

1. User gửi request đặt vé.
2. Hệ thống mở transaction.
3. Lock dòng `ticket_types` để kiểm tra tồn kho.
4. Lock dòng `user_ticket_type_counters` để kiểm tra giới hạn user.
5. Nếu không vượt giới hạn, tăng `held_quantity`.
6. Tạo order/order_items.
7. Commit transaction.

### Lý do khoa học

Cách này biến bài toán “đếm tổng động từ nhiều bảng” thành bài toán “lock một dòng counter”. Điều này giúp xử lý request song song an toàn hơn.

---

## 3.4. Quyết định 4 — Bổ sung `payment_webhook_events` vì webhook có thể gửi lặp

### Vấn đề

Cổng thanh toán có thể gửi IPN/webhook nhiều lần cho cùng một giao dịch.

Nếu chỉ dựa vào bảng `payments`, hệ thống vẫn thiếu nơi lưu:

- Raw payload webhook
- Provider event id
- Chữ ký có hợp lệ không
- Webhook đã xử lý hay chưa
- Lỗi xử lý webhook
- Lịch sử replay webhook

### Quyết định

Bổ sung bảng:

```sql
payment_webhook_events
```

### Mục đích

Bảng này phục vụ:

- Chống xử lý webhook trùng
- Lưu raw payload để debug
- Kiểm tra chữ ký webhook
- Audit toàn bộ callback từ VNPAY/MoMo
- Hỗ trợ retry/replay có kiểm soát

### Lý do khoa học

Trong hệ thống thanh toán, webhook là dữ liệu ngoại lai đến từ bên thứ ba. Không nên xử lý webhook mà không lưu dấu vết. Lưu webhook event giúp hệ thống có khả năng kiểm toán và phục hồi khi xảy ra lỗi.

---

## 3.5. Quyết định 5 — Bổ sung `ticket_inventory_events` để truy vết kho vé

### Vấn đề

Chống oversell không chỉ cần kiểm tra:

```sql
available_quantity >= 0
```

Hệ thống còn cần biết vì sao số vé thay đổi.

Các sự kiện làm thay đổi kho vé gồm:

- Hold vé
- Release vé do order hết hạn
- Payment thành công
- Refund
- Admin điều chỉnh số lượng

### Quyết định

Bổ sung bảng:

```sql
ticket_inventory_events
```

### Mục đích

Bảng này ghi lại lịch sử thay đổi kho vé:

```text
HOLD → RELEASE → PAYMENT_CONFIRMED → REFUND → ADMIN_ADJUST
```

### Lý do khoa học

Nếu chỉ lưu số lượng hiện tại trong `ticket_types`, hệ thống biết “đang còn bao nhiêu vé” nhưng không biết “vì sao còn chừng đó vé”.

Với `ticket_inventory_events`, hệ thống có thể debug các lỗi như:

- Lệch số lượng vé còn lại
- Order bị timeout nhưng chưa release vé
- Payment success nhưng chưa chuyển vé sang sold
- Refund nhưng chưa trả lại kho
- Admin chỉnh sai số lượng

---

## 3.6. Quyết định 6 — Bổ sung `checkin_devices` vì offline check-in không chỉ là log

### Vấn đề

Schema ban đầu có:

- `offline_checkin_batches`
- `offline_checkin_items`
- `checkin_logs`

Nhưng chưa có bảng quản lý thiết bị quét vé.

Trong offline check-in, hệ thống cần biết:

- Thiết bị nào quét
- Nhân sự nào dùng thiết bị
- Thiết bị thuộc concert nào
- Thiết bị có bị revoke/lost không
- Lần sync cuối khi nào
- Public key hoặc định danh thiết bị là gì

### Quyết định

Bổ sung bảng:

```sql
checkin_devices
```

### Mục đích

Bảng này giúp quản lý mobile app soát vé như một thực thể riêng, không chỉ là chuỗi `device_id` tự do.

### Lý do khoa học

Offline check-in là nghiệp vụ có độ rủi ro cao vì dữ liệu được ghi trước ở thiết bị, sau đó mới đồng bộ về server. Nếu không quản lý thiết bị, hệ thống khó xử lý:

- Thiết bị bị mất
- Thiết bị bị revoke
- Nhân sự dùng sai thiết bị
- Batch sync từ thiết bị không hợp lệ
- Dữ liệu offline bị gửi lại nhiều lần

---

## 3.7. Quyết định 7 — Bổ sung `notification_dead_letters` vì notification là bất đồng bộ

### Vấn đề

Notification không nên nằm trong luồng thanh toán chính.

Sau khi payment thành công, hệ thống nên phát event và worker gửi:

- App notification
- Email kèm QR e-ticket
- Reminder trước concert 24 giờ
- SMS/Zalo OA trong tương lai

Nếu nhà cung cấp email/SMS/Zalo lỗi nhiều lần, hệ thống cần nơi lưu payload lỗi cuối cùng.

### Quyết định

Bổ sung bảng:

```sql
notification_dead_letters
```

### Mục đích

Bảng này lưu các notification thất bại sau khi đã retry quá số lần cho phép.

### Lý do khoa học

Nếu chỉ có `notification_logs`, hệ thống biết notification đã thất bại. Nhưng nếu có `notification_dead_letters`, hệ thống có thể:

- Lưu payload lỗi
- Cho admin xử lý lại
- Cho worker retry thủ công
- Không làm mất thông báo quan trọng
- Không chặn luồng mua vé chính

---

## 3.8. Quyết định 8 — Không đưa Redis, SQLite, Object Storage thành database chính

### Vai trò đúng của từng loại lưu trữ

| Thành phần | Vai trò |
|---|---|
| PostgreSQL | Nguồn dữ liệu chính cho order, payment, ticket, check-in, guest list, audit |
| Redis | Cache, rate limit, idempotency TTL ngắn hạn, inventory read model gần realtime |
| SQLite | Local database trên mobile app để check-in offline |
| Object Storage | Lưu PDF, SVG, CSV, ảnh nghệ sĩ, file tĩnh |
| Message Broker/BullMQ | Queue xử lý notification, AI bio, CSV import, job bất đồng bộ |

### Lý do

Order, payment và ticket là dữ liệu tài chính/nghiệp vụ lõi. Chúng cần toàn vẹn mạnh, transaction và ràng buộc quan hệ. Vì vậy PostgreSQL phải là nguồn dữ liệu cuối cùng.

Redis, SQLite và Object Storage chỉ là các lớp hỗ trợ theo từng mục đích cụ thể.

---

# 4. Logic chọn các specs

Tôi chọn specs theo chuỗi rủi ro và phụ thuộc triển khai, không chọn ngẫu nhiên.

---

## 4.1. Nhóm ưu tiên 1 — Các feature có rủi ro mất tiền/mất vé

### 1. `ticket-inventory.md`

#### Lý do chọn

Oversell là rủi ro nghiêm trọng nhất của hệ thống bán vé.

Spec này cần mô tả:

- Lock kho vé
- Hold vé
- Release vé
- Payment confirmed
- Refund
- Không cho `available_quantity` âm
- Ghi `ticket_inventory_events`

#### Bảng liên quan

- `ticket_types`
- `orders`
- `order_items`
- `ticket_inventory_events`

---

### 2. `per-user-ticket-limit.md`

#### Lý do chọn

Giới hạn số vé mỗi tài khoản là yêu cầu nghiệp vụ rõ ràng và dễ bị lách bằng request đồng thời.

Spec này cần mô tả:

- Cách tính số vé user đã giữ/đã mua
- Lock `user_ticket_type_counters`
- Xử lý order timeout
- Xử lý payment failed
- Xử lý payment success

#### Bảng liên quan

- `ticket_types`
- `orders`
- `order_items`
- `tickets`
- `user_ticket_type_counters`

---

### 3. `payment-idempotency.md`

#### Lý do chọn

Payment lỗi có thể gây:

- Trừ tiền hai lần
- Tạo hai order
- Cấp hai lần vé
- Webhook xử lý lặp

Spec này cần mô tả:

- Idempotency key từ client
- Idempotency key cho webhook
- Webhook replay protection
- Payment timeout
- Provider transaction unique
- Raw webhook event

#### Bảng liên quan

- `payments`
- `idempotency_keys`
- `payment_webhook_events`
- `orders`

---

### 4. `order-checkout.md`

#### Lý do chọn

Order là trục nối giữa inventory, payment và ticket issuance.

Spec này cần mô tả:

- Tạo order
- Tạo order item
- Hold vé 10 phút
- Expire order
- Cancel order
- Payment success/failure
- Release kho vé khi hết hạn

#### Bảng liên quan

- `orders`
- `order_items`
- `ticket_types`
- `payments`

---

## 4.2. Nhóm ưu tiên 2 — Các feature sau thanh toán

### 5. `e-ticket-qr.md`

#### Lý do chọn

Sau khi payment thành công, hệ thống phải phát hành vé thật cho user.

Spec này cần mô tả:

- Sinh QR token
- Sinh QR signature
- Gắn ticket với order/user/ticket type
- Trạng thái vé
- Quy tắc verify QR

#### Bảng liên quan

- `tickets`
- `orders`
- `payments`
- `ticket_types`

---

### 6. `checkin-online.md`

#### Lý do chọn

Check-in online là luồng xác thực vé trực tiếp tại cổng.

Spec này cần mô tả:

- Quét QR
- Verify token/signature
- Kiểm tra ticket tồn tại
- Kiểm tra đúng concert
- Kiểm tra chưa check-in
- Cập nhật trạng thái `CHECKED_IN`
- Ghi log mọi lần quét

#### Bảng liên quan

- `tickets`
- `checkin_logs`
- `users`

---

### 7. `offline-checkin-sync.md`

#### Lý do chọn

Sân vận động có thể mất mạng, nhưng app vẫn phải cho phép check-in.

Spec này cần mô tả:

- Tải dữ liệu về SQLite
- Quét QR offline
- Chống trùng cục bộ
- Tạo offline batch
- Đồng bộ lại server
- Conflict resolution
- Idempotent sync

#### Bảng liên quan

- `checkin_devices`
- `offline_checkin_batches`
- `offline_checkin_items`
- `tickets`
- `checkin_logs`

---

## 4.3. Nhóm ưu tiên 3 — Các feature vận hành bất đồng bộ

### 8. `guest-list-import.md`

#### Lý do chọn

Guest list đến từ CSV một chiều, có thể lỗi dòng hoặc trùng dữ liệu.

Spec này cần mô tả:

- Tạo import job
- Validate từng dòng
- Ghi lỗi dòng sai
- Upsert dòng hợp lệ
- Deduplicate theo `(concert_id, phone)`
- Không làm gián đoạn hệ thống đang chạy

#### Bảng liên quan

- `guest_import_jobs`
- `guest_import_errors`
- `guest_list`

---

### 9. `guest-checkin.md`

#### Lý do chọn

Khách mời VIP không nhất thiết có order/payment/ticket thường. Vì vậy cần spec riêng.

Spec này cần mô tả:

- Tra cứu khách mời theo phone/name
- Check-in khách mời
- Chống check-in trùng
- Đồng bộ với mobile app nếu offline

#### Bảng liên quan

- `guest_list`
- `checkin_logs`
- `offline_checkin_items`

---

### 10. `artist-bio-ai.md`

#### Lý do chọn

AI Artist Bio là tác vụ bất đồng bộ và có thể thất bại mà không được làm hỏng luồng tạo concert.

Spec này cần mô tả:

- Upload PDF/Press Kit
- Validate file
- Tạo job
- Worker trích xuất text
- Gọi AI model
- Retry khi lỗi
- Lưu kết quả bio
- Fallback manual nếu AI fail

#### Bảng liên quan

- `artist_bio_jobs`
- `artist_bios`
- `concerts`

---

### 11. `notification.md`

#### Lý do chọn

Notification cần gửi sau payment success và reminder trước concert 24 giờ, nhưng không được chặn luồng thanh toán.

Spec này cần mô tả:

- Template notification
- Gửi app/email
- Retry
- Dead Letter Queue
- Mở rộng SMS/Zalo OA
- Log trạng thái gửi

#### Bảng liên quan

- `notification_templates`
- `notification_logs`
- `notification_dead_letters`

---

## 4.4. Nhóm ưu tiên 4 — Nền tảng hệ thống

### 12. `auth-rbac.md`

#### Lý do chọn

Hệ thống có nhiều vai trò khác nhau. Admin, organizer, check-in staff và customer không được dùng chung quyền.

Spec này cần mô tả:

- Đăng ký/đăng nhập
- JWT/session
- Role-based access control
- Quyền truy cập API
- Quyền vào admin dashboard
- Quyền vào mobile check-in

#### Bảng liên quan

- `users`
- `roles`
- `user_roles`
- `audit_logs`

---

### 13. `concert-catalog.md`

#### Lý do chọn

Trang danh sách và chi tiết concert là luồng đọc lớn nhất, cần cache để tránh làm quá tải database.

Spec này cần mô tả:

- Danh sách concert
- Chi tiết concert
- Artist bio
- Venue
- Seat zone
- Ticket type
- Inventory API riêng
- Cache metadata và inventory

#### Bảng liên quan

- `concerts`
- `venues`
- `seat_zones`
- `ticket_types`
- `artist_bios`

---

### 14. `admin-concert-management.md`

#### Lý do chọn

Ban tổ chức cần tạo/cập nhật/hủy concert và cấu hình vé.

Spec này cần mô tả:

- Tạo concert
- Cập nhật concert
- Hủy concert
- Cấu hình ticket type
- Cấu hình max per user
- Upload sơ đồ ghế/SVG
- Ghi audit log

#### Bảng liên quan

- `concerts`
- `venues`
- `seat_zones`
- `ticket_types`
- `audit_logs`

---

### 15. `caching.md`

#### Lý do chọn

Trang concert có thể bị đọc hàng nghìn request/giây. Nếu mọi request đều truy vấn PostgreSQL thì database có nguy cơ quá tải.

Spec này cần mô tả:

- Cache-aside
- Metadata cache TTL dài
- Inventory cache TTL ngắn
- Active invalidation khi admin cập nhật
- Redis `DECRBY` hoặc invalidate khi bán vé
- Fallback khi Redis lỗi

#### Bảng liên quan

- PostgreSQL làm source of truth
- Redis làm cache/read model

---

### 16. `rate-limiting-anti-bot.md`

#### Lý do chọn

Tải đột biến và scalper bot là rủi ro lớn khi mở bán.

Spec này cần mô tả:

- Token Bucket
- Rate limit theo IP
- Rate limit theo user
- Rate limit theo route
- HTTP 429
- Retry-After
- Ghi log hành vi nghi ngờ

#### Bảng liên quan

- Redis là chính
- `audit_logs` nếu cần lưu sự kiện nghi ngờ

---

### 17. `audit-logging.md`

#### Lý do chọn

Các thao tác quan trọng cần truy vết.

Spec này cần mô tả log cho:

- Tạo/cập nhật/hủy concert
- Cấu hình vé
- Thay đổi quyền
- Import guest list
- Check-in
- Payment xử lý thủ công
- Admin adjust inventory

#### Bảng liên quan

- `audit_logs`
- Các bảng nghiệp vụ liên quan theo từng action

---

# 5. Vì sao thứ tự specs này hợp lý

Thứ tự tôi chọn dựa trên mức độ rủi ro và phụ thuộc:

```text
Inventory → Per-user Limit → Payment → Order → Ticket QR → Check-in → Offline Sync
```

Lý do:

1. Không có inventory đúng thì order/payment phía sau đều sai.
2. Không có per-user limit thì hệ thống không đảm bảo công bằng.
3. Không có payment idempotency thì có nguy cơ trừ tiền hai lần.
4. Không có order checkout thì không có điểm nối giữa giữ vé và thanh toán.
5. Không có ticket QR thì user không có vé để vào cổng.
6. Không có check-in thì QR không có giá trị vận hành.
7. Không có offline sync thì hệ thống không đáp ứng môi trường sân vận động mất mạng.
8. Các feature AI, CSV, notification là bất đồng bộ nên có thể triển khai sau nhóm lõi.
9. Auth/RBAC, catalog, admin, caching, rate limit, audit là nền tảng vận hành và bảo vệ hệ thống.

---

# 6. Giới hạn và giả định

## 6.1. Giới hạn

Các đánh giá trên dựa trên tài liệu yêu cầu và thiết kế, không phải benchmark chạy thật.

Các điểm sau chưa đủ dữ liệu để xác minh:

- PostgreSQL schema đã chạy thành công trên database thật hay chưa.
- Transaction có đạt throughput mong muốn dưới 80.000 người/5 phút hay không.
- Redis/BullMQ/worker implementation có đúng như specs hay không.
- Offline sync có xử lý mọi conflict thực tế hay chưa.
- Payment webhook verify chữ ký có đúng chuẩn VNPAY/MoMo thật hay chưa.
- Rate limiting có đủ chống scalper bot thật hay không.

## 6.2. Giả định thiết kế

Tôi dùng các giả định sau khi bổ sung database và specs:

1. PostgreSQL là source of truth cho dữ liệu lõi.
2. Redis chỉ dùng cho cache, rate limit và trạng thái ngắn hạn.
3. Payment gateway dùng sandbox/mô phỏng, chưa tích hợp live production.
4. QR token có chữ ký để mobile app có thể verify offline.
5. Mobile app có SQLite để lưu dữ liệu check-in tạm thời.
6. Worker xử lý AI/CSV/notification chạy bất đồng bộ qua queue.
7. Admin dashboard có phân quyền riêng, không dùng chung quyền với customer.
8. Guest list VIP là luồng riêng, không bắt buộc phải có order/payment.

---

# 7. Kết luận

Database và specs được bổ sung theo hướng ưu tiên tính nhất quán dữ liệu, khả năng chống lỗi và khả năng triển khai thực tế.

Các quyết định quan trọng nhất gồm:

1. Dùng PostgreSQL làm source of truth cho order/payment/ticket.
2. Tách `ticket_types` và `tickets` để phân biệt kho vé và vé cụ thể.
3. Thêm `user_ticket_type_counters` để enforce per-user limit dưới tải cao.
4. Thêm `payment_webhook_events` để xử lý webhook lặp và audit payment.
5. Thêm `ticket_inventory_events` để truy vết biến động kho vé.
6. Thêm `checkin_devices` để offline check-in có định danh thiết bị rõ ràng.
7. Thêm `notification_dead_letters` để notification async có cơ chế DLQ.
8. Tách specs theo rủi ro: inventory, per-user limit, payment, checkout, QR, check-in, offline sync trước; các feature async và nền tảng triển khai sau.

Kết luận khoa học nhất: bộ database + specs hiện tại đủ cơ sở thiết kế để triển khai TicketBox, nhưng cần kiểm thử migration, transaction concurrency, webhook replay, offline sync conflict và rate limiting trước khi khẳng định đạt chất lượng runtime.
