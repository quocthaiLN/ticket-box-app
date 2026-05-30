# TicketBox — Database Design


### 6.1. `users`


**Nhóm:** Người dùng và phân quyền


**Mục đích:** Lưu tài khoản người dùng của hệ thống: khán giả, ban tổ chức, nhân sự soát vé, admin.


| Trường | Kiểu dữ liệu | Ràng buộc | Ý nghĩa / mục đích sử dụng |
| --- | --- | --- | --- |
| id | UUID | PK, DEFAULT gen_random_uuid() | Định danh duy nhất của user; dùng làm khóa liên kết sang orders, tickets, roles, audit/check-in. |
| email | VARCHAR(255) | NOT NULL, UNIQUE, CHECK chứa @ | Email đăng nhập và nhận thông báo; chống trùng tài khoản. |
| password_hash | TEXT | NOT NULL | Mật khẩu đã băm; không lưu mật khẩu thô. |
| full_name | VARCHAR(255) | NOT NULL | Họ tên hiển thị trên tài khoản, vé, admin/check-in. |
| phone | VARCHAR(20) | UNIQUE, CHECK định dạng hoặc NULL | Số điện thoại liên hệ; hỗ trợ tra cứu/đối soát khi cần. |
| status | user_status | NOT NULL, DEFAULT ACTIVE | Trạng thái tài khoản: ACTIVE/LOCKED/DISABLED. |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Thời điểm tạo tài khoản. |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now(), trigger update | Thời điểm cập nhật gần nhất. |


**Quan hệ chính:**

- 1-n `orders` qua `orders.user_id`.

- n-n `roles` qua `user_roles`.

- 1-n `tickets` qua `tickets.user_id`.

- 1-n `checkin_logs` qua `staff_id` nếu user là nhân sự soát vé.

- 1-n `audit_logs` qua `actor_user_id`.



### 6.2. `roles`


**Nhóm:** Người dùng và phân quyền


**Mục đích:** Lưu danh mục role cho RBAC. Logic phân quyền dùng `code`, không dùng mô tả tự do.


| Trường | Kiểu dữ liệu | Ràng buộc | Ý nghĩa / mục đích sử dụng |
| --- | --- | --- | --- |
| id | UUID | PK, DEFAULT gen_random_uuid() | Định danh role. |
| code | VARCHAR(50) | NOT NULL, UNIQUE, CHECK IN CUSTOMER/ORGANIZER/CHECKIN_STAFF/ADMIN | Mã role dùng trong backend/API Gateway để kiểm tra quyền. |
| name | VARCHAR(100) | NOT NULL | Tên hiển thị của role trên admin. |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Thời điểm tạo role. |


**Quan hệ chính:**

- n-n `users` qua `user_roles`.

- `GUEST` không lưu trong DB; đó là trạng thái chưa đăng nhập.



### 6.3. `user_roles`


**Nhóm:** Người dùng và phân quyền


**Mục đích:** Bảng nối user-role, cho phép một user có nhiều vai trò nếu cần.


| Trường | Kiểu dữ liệu | Ràng buộc | Ý nghĩa / mục đích sử dụng |
| --- | --- | --- | --- |
| user_id | UUID | PK, FK users(id), ON DELETE CASCADE | User được gán role. |
| role_id | UUID | PK, FK roles(id), ON DELETE CASCADE | Role được gán. |
| assigned_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Thời điểm gán quyền. |


**Quan hệ chính:**

- Nối `users` n-n `roles`.

- Xóa user hoặc role thì xóa bản ghi nối tương ứng.



### 6.4. `venues`


**Nhóm:** Concert, địa điểm và khu vực


**Mục đích:** Lưu địa điểm tổ chức concert.


| Trường | Kiểu dữ liệu | Ràng buộc | Ý nghĩa / mục đích sử dụng |
| --- | --- | --- | --- |
| id | UUID | PK, DEFAULT gen_random_uuid() | Định danh venue. |
| name | VARCHAR(255) | NOT NULL | Tên địa điểm. |
| address | TEXT | NOT NULL | Địa chỉ cụ thể. |
| city | VARCHAR(100) | NOT NULL | Thành phố/tỉnh. |
| capacity | INTEGER | NOT NULL, CHECK > 0 | Sức chứa tối đa; dùng kiểm tra hợp lý tổng số vé/khu. |
| map_url | TEXT | NULL | Link bản đồ hoặc sơ đồ địa điểm. |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Thời điểm tạo. |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now(), trigger update | Thời điểm cập nhật. |


**Quan hệ chính:**

- 1-n `concerts` qua `concerts.venue_id`.

- `ON DELETE RESTRICT` từ concerts để không xóa venue khi còn concert tham chiếu.





### 6.9. `ticket_types`


**Nhóm:** Ticketing và tồn kho


**Mục đích:** Cấu hình loại vé bán cho từng khu vực trong concert.


| Trường | Kiểu dữ liệu | Ràng buộc | Ý nghĩa / mục đích sử dụng |
| --- | --- | --- | --- |
| id | UUID | PK, DEFAULT gen_random_uuid() | Định danh loại vé. |
| concert_id | UUID | NOT NULL, FK concerts(id), ON DELETE CASCADE | Concert bán loại vé này. |
| seat_zone_id | UUID | NOT NULL, FK seat_zones(id), ON DELETE RESTRICT | Khu vực mà loại vé cho phép vào. |
| name | VARCHAR(100) | NOT NULL, UNIQUE theo (concert_id, name) | Tên loại vé: SVIP Early Bird, CAT1, GA... |
| description | TEXT | NULL | Mô tả quyền lợi vé. |
| price | NUMERIC(12,2) | NOT NULL, CHECK >= 0 | Giá vé. |
| currency | CHAR(3) | NOT NULL, DEFAULT VND | Đơn vị tiền tệ. |
| total_quantity | INTEGER | NOT NULL, CHECK >= 0 | Tổng số vé mở bán. |
| available_quantity | INTEGER | NOT NULL, CHECK >= 0 | Số lượng còn có thể giữ/bán. |
| held_quantity | INTEGER | NOT NULL, DEFAULT 0, CHECK >= 0 | Số lượng đang giữ trong order chưa thanh toán. |
| sold_quantity | INTEGER | NOT NULL, DEFAULT 0, CHECK >= 0 | Số lượng đã bán/paid. |
| max_per_user | INTEGER | NOT NULL, CHECK > 0 | Giới hạn vé tối đa mỗi tài khoản cho loại vé này. |
| sale_start_at | TIMESTAMPTZ | NOT NULL | Thời điểm mở bán. |
| sale_end_at | TIMESTAMPTZ | NOT NULL, CHECK > sale_start_at | Thời điểm kết thúc bán. |
| status | ticket_type_status | NOT NULL, DEFAULT DRAFT | DRAFT/ON_SALE/SOLD_OUT/CLOSED. |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Thời điểm tạo. |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now(), trigger update | Thời điểm cập nhật. |


**Quan hệ chính:**

- n-1 `concerts`, n-1 `seat_zones`.

- 1-n `order_items`, `tickets`, `user_ticket_type_counters`, `ticket_inventory_events`.

- Ràng buộc tổng: `total_quantity = available_quantity + held_quantity + sold_quantity`.

- Backend lock dòng `ticket_types` bằng transaction khi giữ/trừ vé.



### 6.10. `user_ticket_type_counters`


**Nhóm:** Ticketing và tồn kho


**Mục đích:** Counter theo user và ticket type để enforce `max_per_user` dưới tải cao.


| Trường | Kiểu dữ liệu | Ràng buộc | Ý nghĩa / mục đích sử dụng |
| --- | --- | --- | --- |
| user_id | UUID | PK, FK users(id), ON DELETE CASCADE | User được kiểm soát giới hạn. |
| ticket_type_id | UUID | PK, FK ticket_types(id), ON DELETE CASCADE | Loại vé được kiểm soát. |
| held_quantity | INTEGER | NOT NULL, DEFAULT 0, CHECK >= 0 | Số vé user đang giữ cho loại vé này. |
| paid_quantity | INTEGER | NOT NULL, DEFAULT 0, CHECK >= 0 | Số vé user đã mua thành công cho loại vé này. |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Thời điểm cập nhật counter. |


**Quan hệ chính:**

- Nối `users` với `ticket_types` theo khóa chính `(user_id, ticket_type_id)`.

- Transaction đặt vé lock dòng counter này cùng với `ticket_types`.

- Điều kiện nghiệp vụ: `held_quantity + paid_quantity + requested_quantity <= ticket_types.max_per_user`.



### 6.11. `orders`


**Nhóm:** Order, payment và idempotency


**Mục đích:** Lưu đơn đặt vé ở cấp header.


| Trường | Kiểu dữ liệu | Ràng buộc | Ý nghĩa / mục đích sử dụng |
| --- | --- | --- | --- |
| id | UUID | PK, DEFAULT gen_random_uuid() | Định danh order. |
| user_id | UUID | NOT NULL, FK users(id), ON DELETE RESTRICT | Người đặt vé. |
| concert_id | UUID | NOT NULL, FK concerts(id), ON DELETE RESTRICT | Concert của order. |
| status | order_status | NOT NULL, DEFAULT PENDING | PENDING/HELD/PAID/CANCELLED/EXPIRED/FAILED/REFUNDED. |
| total_amount | NUMERIC(12,2) | NOT NULL, DEFAULT 0, CHECK >= 0 | Tổng tiền order. |
| currency | CHAR(3) | NOT NULL, DEFAULT VND | Đơn vị tiền tệ. |
| hold_expires_at | TIMESTAMPTZ | NULL, bắt buộc khi status = HELD | Thời điểm hết hạn giữ vé. |
| cancelled_reason | TEXT | NULL | Lý do hủy/thất bại/hết hạn nếu có. |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Thời điểm tạo order. |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now(), trigger update | Thời điểm cập nhật. |


**Quan hệ chính:**

- n-1 `users`, n-1 `concerts`.

- 1-n `order_items`, `payments`, `tickets`, `idempotency_keys`, `ticket_inventory_events`.

- State machine hợp lệ: `PENDING -> HELD -> PAID`, `HELD -> EXPIRED/CANCELLED`, `PAID -> REFUNDED`, `PENDING/HELD -> FAILED`.



### 6.12. `order_items`


**Nhóm:** Order, payment và idempotency


**Mục đích:** Lưu từng dòng vé trong một order.


| Trường | Kiểu dữ liệu | Ràng buộc | Ý nghĩa / mục đích sử dụng |
| --- | --- | --- | --- |
| id | UUID | PK, DEFAULT gen_random_uuid() | Định danh dòng order. |
| order_id | UUID | NOT NULL, FK orders(id), ON DELETE CASCADE | Order cha. |
| ticket_type_id | UUID | NOT NULL, FK ticket_types(id), ON DELETE RESTRICT | Loại vé được chọn. |
| quantity | INTEGER | NOT NULL, CHECK > 0 | Số lượng vé đặt cho loại này. |
| unit_price | NUMERIC(12,2) | NOT NULL, CHECK >= 0 | Đơn giá tại thời điểm mua. |
| line_total | NUMERIC(12,2) | GENERATED ALWAYS AS (quantity * unit_price) STORED | Thành tiền của dòng order. |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Thời điểm tạo dòng. |


**Quan hệ chính:**

- n-1 `orders`, n-1 `ticket_types`.

- 1-n `tickets` khi payment thành công và phát hành vé cụ thể.



### 6.13. `ticket_inventory_events`


**Nhóm:** Ticketing và tồn kho


**Mục đích:** Audit mọi biến động tồn kho để truy vết oversell/hold/release/refund/admin adjust.


| Trường | Kiểu dữ liệu | Ràng buộc | Ý nghĩa / mục đích sử dụng |
| --- | --- | --- | --- |
| id | UUID | PK, DEFAULT gen_random_uuid() | Định danh event. |
| ticket_type_id | UUID | NOT NULL, FK ticket_types(id), ON DELETE CASCADE | Loại vé bị tác động. |
| order_id | UUID | FK orders(id), ON DELETE SET NULL | Order liên quan nếu có. |
| event_type | inventory_event_type | NOT NULL | HOLD/RELEASE/PAYMENT_CONFIRMED/REFUND/ADMIN_ADJUST. |
| quantity | INTEGER | NOT NULL, CHECK > 0 | Số lượng thay đổi. |
| before_available | INTEGER | NULL, CHECK >= 0 nếu có | Available trước thay đổi. |
| after_available | INTEGER | NULL, CHECK >= 0 nếu có | Available sau thay đổi. |
| before_held | INTEGER | NULL, CHECK >= 0 nếu có | Held trước thay đổi. |
| after_held | INTEGER | NULL, CHECK >= 0 nếu có | Held sau thay đổi. |
| before_sold | INTEGER | NULL, CHECK >= 0 nếu có | Sold trước thay đổi. |
| after_sold | INTEGER | NULL, CHECK >= 0 nếu có | Sold sau thay đổi. |
| metadata | JSONB | NULL | Thông tin bổ sung như worker/request/user/context. |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Thời điểm ghi event. |


**Quan hệ chính:**

- n-1 `ticket_types`, n-1 `orders`.

- Không quyết định tồn kho hiện tại; chỉ là lịch sử audit.



### 6.14. `payments`


**Nhóm:** Order, payment và idempotency


**Mục đích:** Lưu giao dịch thanh toán cho order.


| Trường | Kiểu dữ liệu | Ràng buộc | Ý nghĩa / mục đích sử dụng |
| --- | --- | --- | --- |
| id | UUID | PK, DEFAULT gen_random_uuid() | Định danh payment. |
| order_id | UUID | NOT NULL, FK orders(id), ON DELETE RESTRICT | Order được thanh toán. |
| provider | payment_provider | NOT NULL | Cổng thanh toán: VNPAY/MOMO. |
| provider_transaction_id | VARCHAR(255) | UNIQUE theo (provider, provider_transaction_id) nếu không null | Mã giao dịch từ provider. |
| amount | NUMERIC(12,2) | NOT NULL, CHECK > 0 | Số tiền thanh toán. |
| currency | CHAR(3) | NOT NULL, DEFAULT VND | Đơn vị tiền tệ. |
| status | payment_status | NOT NULL, DEFAULT PENDING | PENDING/SUCCEEDED/FAILED/CANCELLED/REFUNDED. |
| provider_payload | JSONB | NULL | Payload trả về từ provider để đối soát/debug. |
| paid_at | TIMESTAMPTZ | NULL, bắt buộc khi status = SUCCEEDED | Thời điểm thanh toán thành công. |
| failure_reason | TEXT | NULL | Lý do thất bại/hủy. |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Thời điểm tạo payment. |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now(), trigger update | Thời điểm cập nhật. |


**Quan hệ chính:**

- n-1 `orders`.

- 1-n `payment_webhook_events`.

- Webhook trùng không được tạo giao dịch trùng nhờ unique provider transaction id.



### 6.15. `payment_webhook_events`


**Nhóm:** Order, payment và idempotency


**Mục đích:** Lưu raw webhook/IPN từ VNPAY/MoMo để chống replay và debug payment.


| Trường | Kiểu dữ liệu | Ràng buộc | Ý nghĩa / mục đích sử dụng |
| --- | --- | --- | --- |
| id | UUID | PK, DEFAULT gen_random_uuid() | Định danh webhook event. |
| provider | payment_provider | NOT NULL | Nguồn webhook: VNPAY/MOMO. |
| provider_event_id | VARCHAR(255) | UNIQUE theo provider nếu không null | Mã event từ provider. |
| provider_transaction_id | VARCHAR(255) | UNIQUE theo provider nếu không null | Mã giao dịch provider báo về. |
| order_id | UUID | FK orders(id), ON DELETE SET NULL | Order liên quan sau khi resolve. |
| payment_id | UUID | FK payments(id), ON DELETE SET NULL | Payment liên quan sau khi resolve. |
| raw_payload | JSONB | NOT NULL | Payload gốc để verify/debug/audit. |
| signature_valid | BOOLEAN | NOT NULL, DEFAULT FALSE | Kết quả verify chữ ký webhook. |
| processed | BOOLEAN | NOT NULL, DEFAULT FALSE | Đã xử lý cập nhật payment/order hay chưa. |
| processed_at | TIMESTAMPTZ | NULL, bắt buộc khi processed = TRUE | Thời điểm xử lý xong. |
| error_message | TEXT | NULL | Lỗi xử lý webhook nếu có. |
| received_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Thời điểm server nhận webhook. |


**Quan hệ chính:**

- n-1 `orders`, n-1 `payments`.

- Dùng để xử lý webhook retry/replay idempotently.



### 6.16. `idempotency_keys`


**Nhóm:** Order, payment và idempotency


**Mục đích:** Lưu idempotency key để request đặt vé/payment retry không tạo order/payment trùng.


| Trường | Kiểu dữ liệu | Ràng buộc | Ý nghĩa / mục đích sử dụng |
| --- | --- | --- | --- |
| id | UUID | PK, DEFAULT gen_random_uuid() | Định danh bản ghi idempotency. |
| user_id | UUID | FK users(id), ON DELETE SET NULL | User gửi request nếu có. |
| key | VARCHAR(128) | NOT NULL, UNIQUE | Idempotency key từ client/header. |
| request_hash | VARCHAR(128) | NOT NULL | Hash payload để chống dùng lại key với nội dung khác. |
| status | idempotency_status | NOT NULL, DEFAULT PROCESSING | PROCESSING/SUCCEEDED/FAILED. |
| response_code | INTEGER | NULL | HTTP status đã trả ở lần xử lý đầu. |
| response_body | JSONB | NULL | Response đã trả ở lần xử lý đầu. |
| order_id | UUID | FK orders(id), ON DELETE SET NULL | Order được tạo bởi key này. |
| locked_until | TIMESTAMPTZ | NULL | Khóa xử lý tạm để tránh song song. |
| expires_at | TIMESTAMPTZ | NOT NULL, CHECK > created_at | Thời điểm hết hạn lưu key. |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Thời điểm tạo key. |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now(), trigger update | Thời điểm cập nhật. |


**Quan hệ chính:**

- n-1 `users`, n-1 `orders`.

- Redis có thể giữ key ngắn hạn; PostgreSQL là fallback bền vững.



### 6.17. `tickets`


**Nhóm:** Vé điện tử và check-in


**Mục đích:** Lưu từng e-ticket QR cụ thể được phát hành sau payment thành công.


| Trường | Kiểu dữ liệu | Ràng buộc | Ý nghĩa / mục đích sử dụng |
| --- | --- | --- | --- |
| id | UUID | PK, DEFAULT gen_random_uuid() | Định danh vé. |
| order_id | UUID | NOT NULL, FK orders(id), ON DELETE RESTRICT | Order phát hành vé. |
| order_item_id | UUID | NOT NULL, FK order_items(id), ON DELETE RESTRICT | Dòng order sinh ra vé. |
| user_id | UUID | NOT NULL, FK users(id), ON DELETE RESTRICT | Chủ sở hữu vé. |
| concert_id | UUID | NOT NULL, FK concerts(id), ON DELETE RESTRICT | Concert của vé. |
| ticket_type_id | UUID | NOT NULL, FK ticket_types(id), ON DELETE RESTRICT | Loại vé. |
| seat_zone_id | UUID | NOT NULL, FK seat_zones(id), ON DELETE RESTRICT | Khu vực được phép vào. |
| qr_token | VARCHAR(255) | NOT NULL, UNIQUE | Token QR duy nhất. |
| qr_signature | TEXT | NOT NULL | Chữ ký QR để mobile verify offline. |
| status | ticket_status | NOT NULL, DEFAULT ISSUED | ISSUED/CHECKED_IN/CANCELLED/REFUNDED. |
| issued_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Thời điểm phát hành vé. |
| checked_in_at | TIMESTAMPTZ | NULL, bắt buộc khi status = CHECKED_IN | Thời điểm vào cổng. |
| checked_in_by | UUID | FK users(id), ON DELETE SET NULL | Nhân sự quét thành công. |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Thời điểm tạo bản ghi. |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now(), trigger update | Thời điểm cập nhật. |


**Quan hệ chính:**

- n-1 `orders`, `order_items`, `users`, `concerts`, `ticket_types`, `seat_zones`.

- 1-n `checkin_logs`, `offline_checkin_items`.

- `tickets` là source of truth cho trạng thái check-in vé thường.

- Check-in là một chiều: `ISSUED -> CHECKED_IN`.
