# TicketBox — Database Design

## 6. Mô tả chi tiết từng bảng

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



### 6.5. `concerts`


**Nhóm:** Concert, địa điểm và khu vực


**Mục đích:** Lưu thông tin chính của concert/sự kiện.


| Trường | Kiểu dữ liệu | Ràng buộc | Ý nghĩa / mục đích sử dụng |
| --- | --- | --- | --- |
| id | UUID | PK, DEFAULT gen_random_uuid() | Định danh concert. |
| venue_id | UUID | NOT NULL, FK venues(id), ON DELETE RESTRICT | Địa điểm tổ chức. |
| organizer_id | UUID | FK users(id), ON DELETE SET NULL | Ban tổ chức phụ trách; có thể null nếu user bị xóa. |
| title | VARCHAR(255) | NOT NULL | Tên concert hiển thị. |
| slug | VARCHAR(255) | NOT NULL, UNIQUE | Định danh URL thân thiện. |
| description | TEXT | NULL | Mô tả concert. |
| artist_name | VARCHAR(255) | NULL | Tên nghệ sĩ/lineup chính. |
| starts_at | TIMESTAMPTZ | NOT NULL | Thời điểm bắt đầu. |
| ends_at | TIMESTAMPTZ | NOT NULL, CHECK ends_at > starts_at | Thời điểm kết thúc. |
| status | concert_status | NOT NULL, DEFAULT DRAFT | DRAFT/PUBLISHED/CANCELLED/COMPLETED. |
| cover_image_url | TEXT | NULL | Ảnh bìa lưu ở object storage/CDN. |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Thời điểm tạo. |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now(), trigger update | Thời điểm cập nhật. |


**Quan hệ chính:**

- n-1 `venues`, n-1 `users` qua `organizer_id`.

- 1-n `seat_zones`, `checkin_gates`, `ticket_types`, `orders`, `tickets`, `checkin_logs`, `guest_list`, `artist_bio_jobs`, `guest_import_jobs`.

- Concert không nên bị xóa vật lý khi đã có giao dịch; dùng `status = CANCELLED`.



### 6.6. `seat_zones`


**Nhóm:** Concert, địa điểm và khu vực


**Mục đích:** Lưu khu vực chỗ ngồi/khu đứng trong một concert: GA, SVIP, VIP, CAT1, CAT2.


| Trường | Kiểu dữ liệu | Ràng buộc | Ý nghĩa / mục đích sử dụng |
| --- | --- | --- | --- |
| id | UUID | PK, DEFAULT gen_random_uuid() | Định danh zone. |
| concert_id | UUID | NOT NULL, FK concerts(id), ON DELETE CASCADE | Concert sở hữu zone. |
| code | VARCHAR(50) | NOT NULL, UNIQUE theo (concert_id, code) | Mã zone: GA/SVIP/VIP/CAT1/CAT2. |
| name | VARCHAR(100) | NOT NULL | Tên hiển thị của zone. |
| description | TEXT | NULL | Mô tả khu vực. |
| capacity | INTEGER | NOT NULL, CHECK > 0 | Sức chứa của zone. |
| svg_path | TEXT | NULL | Đường path SVG hoặc metadata vị trí trên sơ đồ. |
| sort_order | INTEGER | NOT NULL, DEFAULT 0 | Thứ tự hiển thị. |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Thời điểm tạo. |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now(), trigger update | Thời điểm cập nhật. |


**Quan hệ chính:**

- 1-n `ticket_types` qua `ticket_types.seat_zone_id`.

- n-n `checkin_gates` qua `checkin_gate_zones` để xác định cổng nào được phép cho zone nào.

- 1-n `tickets` và `guest_list` để xác định vé/guest thuộc khu nào.



### 6.7. `checkin_gates`


**Nhóm:** Cổng soát vé và gate-zone validation


**Mục đích:** Lưu cổng soát vé của một concert. Mỗi cổng có thể cho phép một hoặc nhiều khu vực.


| Trường | Kiểu dữ liệu | Ràng buộc | Ý nghĩa / mục đích sử dụng |
| --- | --- | --- | --- |
| id | UUID | PK, DEFAULT gen_random_uuid() | Định danh cổng. |
| concert_id | UUID | NOT NULL, FK concerts(id), ON DELETE CASCADE | Concert mà cổng thuộc về. |
| code | VARCHAR(50) | NOT NULL, UNIQUE theo (concert_id, code) | Mã cổng: GA_GATE, SVIP_GATE, VIP_GATE, CAT1_GATE, CAT2_GATE. |
| name | VARCHAR(255) | NOT NULL | Tên hiển thị của cổng. |
| is_active | BOOLEAN | NOT NULL, DEFAULT TRUE | Bật/tắt cổng mà không xóa dữ liệu. |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Thời điểm tạo. |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now(), trigger update | Thời điểm cập nhật. |


**Quan hệ chính:**

- n-1 `concerts`.

- n-n `seat_zones` qua `checkin_gate_zones`.

- 1-n `checkin_devices`, `checkin_logs`, `offline_checkin_batches`, `offline_checkin_items`.

- Cổng chỉ hợp lệ khi `is_active = TRUE`.



### 6.8. `checkin_gate_zones`


**Nhóm:** Cổng soát vé và gate-zone validation


**Mục đích:** Bảng mapping cổng soát vé với các khu vực được phép vào ở cổng đó.


| Trường | Kiểu dữ liệu | Ràng buộc | Ý nghĩa / mục đích sử dụng |
| --- | --- | --- | --- |
| gate_id | UUID | PK, FK checkin_gates(id), ON DELETE CASCADE | Cổng soát vé. |
| seat_zone_id | UUID | PK, FK seat_zones(id), ON DELETE CASCADE | Khu vực được cổng này cho phép. |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Thời điểm tạo mapping. |


**Quan hệ chính:**

- Nối `checkin_gates` n-n `seat_zones`.

- Khi check-in, `ticket.seat_zone_id` hoặc `guest_list.seat_zone_id` phải tồn tại trong mapping của `gate_id` hiện tại.

- Nếu không khớp thì kết quả scan là `WRONG_GATE`.



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


### 6.26. `artist_bios`


**Nhóm:** AI Artist Bio


**Mục đích:** Lưu nội dung bio do AI sinh hoặc được ghi đè từ job mới.


| Trường | Kiểu dữ liệu | Ràng buộc | Ý nghĩa / mục đích sử dụng |
| --- | --- | --- | --- |
| id | UUID | PK, DEFAULT gen_random_uuid() | Định danh bio. |
| concert_id | UUID | NOT NULL, FK concerts(id), ON DELETE CASCADE | Concert sở hữu bio. |
| job_id | UUID | FK artist_bio_jobs(id), ON DELETE SET NULL | Job sinh ra bio. |
| bio_text | TEXT | NOT NULL, CHECK không rỗng | Nội dung bio hiển thị. |
| language | CHAR(2) | NOT NULL, DEFAULT vi | Ngôn ngữ bio. |
| is_active | BOOLEAN | NOT NULL, DEFAULT TRUE, unique partial mỗi concert | Bio đang được dùng. |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Thời điểm tạo. |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now(), trigger update | Thời điểm cập nhật. |


**Quan hệ chính:**

- n-1 `concerts`, n-1 `artist_bio_jobs`.

- Partial unique index đảm bảo mỗi concert chỉ có một bio active.