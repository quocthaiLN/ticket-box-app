# TicketBox Database Design

## 1. Mục tiêu thiết kế

Thiết kế database TicketBox theo hướng MVP: đủ cho demo mua vé, thanh toán, QR ticket, check-in đúng cổng/khu, guest CSV, AI Artist Bio, notification và audit; không giữ các bảng enterprise chưa cần cho đồ án.

Nguyên tắc chính:

- PostgreSQL là source of truth cho dữ liệu nghiệp vụ.
- Redis dùng cho cache, rate limit, idempotency runtime và inventory read model ngắn hạn.
- Object Storage lưu ảnh, SVG seat map, CSV, PDF/Press Kit; PostgreSQL chỉ lưu URL/metadata.
- Luồng hold vé dùng transaction và khóa dòng `ticket_types`.
- Phân quyền dùng `users.role`, không dùng RBAC động nhiều bảng.
- Payment status nằm ở `payments.status`; `orders.status` chỉ mô tả vòng đời nghiệp vụ của order.

## 2. Database được sử dụng

Database chính: PostgreSQL.

Lý do:

- Cần transaction ACID cho hold vé, release vé, xác nhận payment và phát hành ticket.
- Cần row-level lock để chống oversell.
- Cần foreign key và unique constraint cho ticket QR, guest dedup, idempotency, gate-zone validation.
- Cần audit/log dài hạn cho payment, check-in, import CSV và admin action.

Thành phần ngoài PostgreSQL:

| Thành phần | Vai trò |
| --- | --- |
| Redis | Cache catalog/inventory, rate limit, idempotency runtime, JWT denylist. |
| Object Storage | Ảnh concert, SVG seat map, CSV guest, PDF/Press Kit. |
| Mobile SQLite | Lưu dữ liệu preload và scan offline trước khi sync. |
| Queue/Worker | Hết hạn hold, gửi notification, xử lý AI bio, import CSV. |

## 3. Quyết định refactor MVP

- RBAC: bỏ `roles`, `user_roles`, `permissions`, `role_permissions`; dùng enum `users.role` với `AUDIENCE`, `ORGANIZER`, `CHECKER`, `ADMIN`.
- Catalog: bỏ `artists`, `concert_artists`, `seat_maps`; dùng `concerts.artist_name`, `concerts.artist_bio`, `concerts.seat_map_url`, `seat_zones.svg_path`.
- Inventory: bỏ `ticket_inventory`, `inventory_reservations`; gom tồn kho vào `ticket_types.total_quantity`, `held_quantity`, `sold_quantity`.
- Per-user limit: giữ `user_ticket_type_counters`.
- Order/payment: bỏ order `PENDING`; dùng `HELD`, `CONFIRMED`, `CANCELLED`, `EXPIRED`. Payment dùng `PENDING`, `SUCCEEDED`, `FAILED`, `CANCELLED`, `REFUNDED`.
- Idempotency: bỏ bảng `idempotency_keys`; Redis xử lý runtime, PostgreSQL giữ unique trên `orders.idempotency_key` và `payments.idempotency_key`.
- Webhook payment: bỏ `payment_webhook_events`; raw payload cuối và metadata xử lý nằm trong `payments.webhook_payload`, `webhook_received_at`, `webhook_signature_valid`.
- Notification: gộp template/log/dead-letter thành một bảng `notifications`.
- AI Artist Bio: gộp `artist_bios` vào `artist_bio_jobs.generated_bio`; nội dung public nằm ở `concerts.artist_bio`.
- Rate limit: bỏ `rate_limit_buckets`; rate limit nằm trong Redis.

## 4. Danh sách bảng chính

| Bảng | Mục đích |
| --- | --- |
| `users` | Tài khoản và role chính. |
| `venues` | Địa điểm tổ chức concert. |
| `concerts` | Thông tin concert, artist public bio, seat map URL. |
| `seat_zones` | Khu vé trong từng concert. |
| `checkin_gates` | Cổng check-in theo concert. |
| `checkin_gate_zones` | Mapping gate được phép nhận zone. |
| `ticket_types` | Loại vé, giá, sale window, tồn kho. |
| `user_ticket_type_counters` | Counter giới hạn vé mỗi user. |
| `orders` | Order giữ vé/xác nhận/hủy/hết hạn. |
| `order_items` | Dòng vé trong order. |
| `payments` | Payment attempt và raw webhook payload MVP. |
| `tickets` | E-ticket QR đã phát hành. |
| `checkin_devices` | Thiết bị/staff/gate dùng để check-in. |
| `checkin_logs` | Log mọi lần scan online hoặc sync. |
| `offline_checkin_batches` | Batch sync offline từ mobile. |
| `offline_checkin_items` | Từng item scan offline. |
| `guest_import_jobs` | Job import CSV guest. |
| `guest_list` | Danh sách khách mời. |
| `guest_import_errors` | Lỗi từng dòng CSV. |
| `artist_bio_jobs` | Job AI bio và kết quả sinh. |
| `notifications` | Notification queue/log MVP. |
| `audit_logs` | Audit thao tác nghiệp vụ/admin. |

## 5. Mô tả chi tiết từng nhóm bảng

### 5.1 User & Access Control

#### 5.1.1 `users`

- **Mục đích:** lưu tài khoản audience, organizer, checker, admin.
- **Quan hệ chính:** organizer của `concerts`, owner của `orders/tickets`, checker của `checkin_devices/checkin_logs`, actor của `audit_logs`.
- **Constraint/index:** unique `email`, unique `phone`, index `role`, index `status`, check định dạng email/phone.

| Field | Kiểu | Ràng buộc chính | Ý nghĩa |
| --- | --- | --- | --- |
| `id` | UUID | PK, default `gen_random_uuid()` | Định danh user. |
| `email` | VARCHAR(255) | NOT NULL, UNIQUE, check có `@` | Email đăng nhập. |
| `password_hash` | TEXT | NOT NULL | Mật khẩu đã hash. |
| `full_name` | VARCHAR(255) | NOT NULL | Tên hiển thị. |
| `phone` | VARCHAR(20) | UNIQUE, nullable, check format | Số điện thoại liên hệ. |
| `role` | `user_role` | NOT NULL, default `AUDIENCE`, index | Role chính để phân quyền. |
| `status` | `user_status` | NOT NULL, default `ACTIVE`, index | Trạng thái tài khoản. |
| `created_at` | TIMESTAMP | NOT NULL | Thời điểm tạo. |
| `updated_at` | TIMESTAMP | NOT NULL, auto update | Thời điểm cập nhật gần nhất. |
| `deleted_at` | TIMESTAMP | nullable | Soft delete nếu cần. |

Role hợp lệ:

```text
AUDIENCE, ORGANIZER, CHECKER, ADMIN
```

`users.role` là nguồn phân quyền chính. Permission chi tiết nằm ở code/API policy, không nằm trong schema MVP.

### 5.2 Concert, Venue & Seat Zone

#### 5.2.1 `venues`

- **Mục đích:** lưu địa điểm tổ chức.
- **Quan hệ chính:** một venue có nhiều `concerts`.
- **Constraint/index:** `capacity > 0`, index `city`.

| Field | Kiểu | Ràng buộc chính | Ý nghĩa |
| --- | --- | --- | --- |
| `id` | UUID | PK | Định danh venue. |
| `name` | VARCHAR(255) | NOT NULL | Tên địa điểm. |
| `address` | TEXT | NOT NULL | Địa chỉ. |
| `city` | VARCHAR(100) | NOT NULL, index | Thành phố để lọc catalog. |
| `capacity` | INTEGER | nullable, check `> 0` | Sức chứa tham khảo. |
| `map_url` | TEXT | nullable | Link bản đồ. |
| `created_at` | TIMESTAMP | NOT NULL | Thời điểm tạo. |
| `updated_at` | TIMESTAMP | NOT NULL, auto update | Thời điểm cập nhật. |

#### 5.2.2 `concerts`

- **Mục đích:** lưu thông tin concert public/admin.
- **Quan hệ chính:** thuộc `venues`, thuộc organizer `users`, có `seat_zones`, `ticket_types`, `checkin_gates`.
- **Constraint/index:** unique `slug`, `ends_at > starts_at`, index `(status, starts_at)`, `(organizer_id, status)`.

| Field | Kiểu | Ràng buộc chính | Ý nghĩa |
| --- | --- | --- | --- |
| `id` | UUID | PK | Định danh concert. |
| `venue_id` | UUID | FK `venues.id`, index | Địa điểm tổ chức. |
| `organizer_id` | UUID | FK `users.id`, index | Organizer quản lý concert. |
| `title` | VARCHAR(255) | NOT NULL | Tên concert. |
| `slug` | VARCHAR(255) | NOT NULL, UNIQUE | URL/public key dễ đọc. |
| `description` | TEXT | nullable | Mô tả concert. |
| `artist_name` | VARCHAR(255) | NOT NULL | Tên nghệ sĩ/lineup hiển thị. |
| `artist_bio` | TEXT | nullable | Bio public hiện hành. |
| `starts_at` | TIMESTAMP | NOT NULL, index cùng `status` | Thời điểm bắt đầu. |
| `ends_at` | TIMESTAMP | NOT NULL, check `ends_at > starts_at` | Thời điểm kết thúc. |
| `status` | `concert_status` | NOT NULL, default `DRAFT`, index | Trạng thái publish. |
| `cover_image_url` | TEXT | nullable | Ảnh bìa trên Object Storage/CDN. |
| `seat_map_url` | TEXT | nullable | URL sơ đồ tổng. |
| `created_at` | TIMESTAMP | NOT NULL | Thời điểm tạo. |
| `updated_at` | TIMESTAMP | NOT NULL, auto update | Thời điểm cập nhật. |

#### 5.2.3 `seat_zones`

- **Mục đích:** mô tả khu SVIP/VIP/CAT1/CAT2/GA trong từng concert.
- **Quan hệ chính:** thuộc `concerts`, được `ticket_types` tham chiếu, được `checkin_gate_zones` dùng để validate.
- **Constraint/index:** unique `(concert_id, code)`, unique `(id, concert_id)` để khóa cùng concert, index `(concert_id, sort_order)`.

| Field | Kiểu | Ràng buộc chính | Ý nghĩa |
| --- | --- | --- | --- |
| `id` | UUID | PK | Định danh zone. |
| `concert_id` | UUID | FK `concerts.id`, UNIQUE cùng `code` | Concert sở hữu zone. |
| `code` | VARCHAR(50) | NOT NULL | Mã zone như `SVIP`, `VIP`, `GA`. |
| `name` | VARCHAR(100) | NOT NULL | Tên hiển thị. |
| `description` | TEXT | nullable | Mô tả zone. |
| `capacity` | INTEGER | NOT NULL, check `> 0` | Sức chứa zone. |
| `svg_path` | TEXT | nullable | Path SVG để tô vùng trên sơ đồ. |
| `sort_order` | INTEGER | NOT NULL, default `0`, index | Thứ tự hiển thị. |
| `created_at` | TIMESTAMP | NOT NULL | Thời điểm tạo. |
| `updated_at` | TIMESTAMP | NOT NULL, auto update | Thời điểm cập nhật. |

### 5.3 Gate & Gate-Zone Validation

#### 5.3.1 `checkin_gates`

- **Mục đích:** cổng check-in của từng concert.
- **Quan hệ chính:** thuộc `concerts`, có nhiều `checkin_gate_zones`, được `checkin_devices` gán vào.
- **Constraint/index:** unique `(concert_id, code)`, unique `(id, concert_id)`, index `(concert_id, is_active)`.

| Field | Kiểu | Ràng buộc chính | Ý nghĩa |
| --- | --- | --- | --- |
| `id` | UUID | PK, UNIQUE cùng `concert_id` | Định danh gate. |
| `concert_id` | UUID | FK `concerts.id`, UNIQUE cùng `code` | Concert của gate. |
| `code` | VARCHAR(50) | NOT NULL | Mã gate như `VIP_GATE`. |
| `name` | VARCHAR(255) | NOT NULL | Tên gate. |
| `description` | TEXT | nullable | Ghi chú gate. |
| `is_active` | BOOLEAN | NOT NULL, default `true`, index | Gate còn nhận check-in hay không. |
| `sort_order` | INTEGER | NOT NULL, default `0` | Thứ tự hiển thị. |
| `created_at` | TIMESTAMP | NOT NULL | Thời điểm tạo. |
| `updated_at` | TIMESTAMP | NOT NULL, auto update | Thời điểm cập nhật. |

#### 5.3.2 `checkin_gate_zones`

- **Mục đích:** gate được phép nhận zone nào.
- **Quan hệ chính:** FK kép `(gate_id, concert_id)` sang `checkin_gates` và `(seat_zone_id, concert_id)` sang `seat_zones`.
- **Constraint/index:** PK `(gate_id, seat_zone_id)`, index `seat_zone_id`, `concert_id`.

| Field | Kiểu | Ràng buộc chính | Ý nghĩa |
| --- | --- | --- | --- |
| `gate_id` | UUID | PK cùng `seat_zone_id`, FK kép với `concert_id` | Gate được phép check-in. |
| `seat_zone_id` | UUID | PK cùng `gate_id`, FK kép với `concert_id` | Zone được gate chấp nhận. |
| `concert_id` | UUID | NOT NULL, index | Khóa cùng concert cho gate và zone. |
| `created_at` | TIMESTAMP | NOT NULL | Thời điểm tạo mapping. |

Flow validate sai cổng/sai khu:

```text
QR -> tickets
tickets -> ticket_types
ticket_types -> seat_zones
request gate -> checkin_gates
checkin_gates + seat_zones -> checkin_gate_zones
không có mapping hoặc gate inactive -> reject
```

### 5.4 Ticket Type & Inventory

#### 5.4.1 `ticket_types`

- **Mục đích:** loại vé, giá, sale window và tồn kho.
- **Quan hệ chính:** thuộc `concerts`, thuộc `seat_zones`, được `order_items/tickets/user_ticket_type_counters` tham chiếu.
- **Constraint/index:** unique `(concert_id, name)`, check `total_quantity >= held_quantity + sold_quantity`, check sale window, index `(concert_id, status)`, sale window.

| Field | Kiểu | Ràng buộc chính | Ý nghĩa |
| --- | --- | --- | --- |
| `id` | UUID | PK, UNIQUE cùng `concert_id` | Định danh loại vé. |
| `concert_id` | UUID | FK `concerts.id`, UNIQUE cùng `name`, index | Concert bán vé. |
| `seat_zone_id` | UUID | FK kép với `concert_id`, index | Zone của loại vé. |
| `name` | VARCHAR(100) | NOT NULL | Tên loại vé. |
| `description` | TEXT | nullable | Mô tả loại vé. |
| `price` | DECIMAL(12,2) | NOT NULL, check `>= 0` | Giá vé. |
| `currency` | CHAR(3) | NOT NULL, default `VND` | Tiền tệ. |
| `total_quantity` | INTEGER | NOT NULL, check không âm | Tổng số vé được bán. |
| `held_quantity` | INTEGER | NOT NULL, default `0`, check không âm | Vé đang hold trong order `HELD`. |
| `sold_quantity` | INTEGER | NOT NULL, default `0`, check không âm | Vé đã bán/xác nhận. |
| `max_per_user` | INTEGER | NOT NULL, check `> 0` | Giới hạn mỗi user. |
| `sale_start_at` | TIMESTAMP | NOT NULL, index | Thời điểm mở bán. |
| `sale_end_at` | TIMESTAMP | NOT NULL, check sau `sale_start_at` | Thời điểm đóng bán. |
| `status` | `ticket_type_status` | NOT NULL, default `DRAFT`, index | Trạng thái loại vé. |
| `created_at` | TIMESTAMP | NOT NULL | Thời điểm tạo. |
| `updated_at` | TIMESTAMP | NOT NULL, auto update | Thời điểm cập nhật. |

Ghi chú: không có cột `available_quantity`; số còn lại được tính bằng `total_quantity - held_quantity - sold_quantity`.

Số vé còn lại không lưu riêng:

```text
available_quantity = total_quantity - held_quantity - sold_quantity
```

Chống oversell:

1. Backend mở transaction.
2. Lock dòng `ticket_types` bằng `SELECT ... FOR UPDATE`.
3. Tính available từ `total - held - sold`.
4. Lock/upsert `user_ticket_type_counters`.
5. Nếu đủ vé và chưa vượt `max_per_user`, tăng `held_quantity` và tạo order `HELD`.
6. Payment success chuyển `held_quantity -> sold_quantity`, order `CONFIRMED`, phát hành `tickets`.
7. Order hết hạn/hủy giảm `held_quantity`.

#### 5.4.2 `user_ticket_type_counters`

- **Mục đích:** chống user spam nhiều request để vượt giới hạn.
- **Quan hệ chính:** thuộc `users` và `ticket_types`.
- **Constraint/index:** PK `(user_id, ticket_type_id)`, index `ticket_type_id`, check counter không âm.

| Field | Kiểu | Ràng buộc chính | Ý nghĩa |
| --- | --- | --- | --- |
| `user_id` | UUID | PK cùng `ticket_type_id`, FK `users.id` | User mua/hold vé. |
| `ticket_type_id` | UUID | PK cùng `user_id`, FK `ticket_types.id`, index | Loại vé được đếm quota. |
| `held_quantity` | INTEGER | NOT NULL, default `0`, check không âm | Số vé user đang hold. |
| `paid_quantity` | INTEGER | NOT NULL, default `0`, check không âm | Số vé user đã thanh toán. |
| `updated_at` | TIMESTAMP | NOT NULL, auto update | Thời điểm cập nhật counter. |

### 5.5 Order & Payment

#### 5.5.1 `orders`

- **Mục đích:** giữ trạng thái nghiệp vụ tối thiểu của checkout.
- **Quan hệ chính:** thuộc `users/concerts`, có `order_items`, `payments`, `tickets`.
- **Constraint/index:** unique `idempotency_key`, index `(user_id, status, created_at)`, `(concert_id, status)`, `hold_expires_at`.

| Field | Kiểu | Ràng buộc chính | Ý nghĩa |
| --- | --- | --- | --- |
| `id` | UUID | PK | Định danh order. |
| `user_id` | UUID | FK `users.id`, index | Người tạo order. |
| `concert_id` | UUID | FK `concerts.id`, index | Concert của order. |
| `idempotency_key` | VARCHAR(128) | NOT NULL, UNIQUE | Chống tạo order trùng. |
| `status` | `order_status` | NOT NULL, default `HELD`, index | Vòng đời order. |
| `total_amount` | DECIMAL(12,2) | NOT NULL, check `>= 0` | Tổng tiền. |
| `currency` | CHAR(3) | NOT NULL, default `VND` | Tiền tệ. |
| `hold_expires_at` | TIMESTAMP | bắt buộc khi `HELD`, index | Hạn giữ vé. |
| `confirmed_at` | TIMESTAMP | bắt buộc khi `CONFIRMED` | Lúc xác nhận order. |
| `cancelled_at` | TIMESTAMP | bắt buộc khi `CANCELLED` | Lúc hủy order. |
| `expired_at` | TIMESTAMP | bắt buộc khi `EXPIRED` | Lúc hết hạn hold. |
| `cancelled_reason` | TEXT | nullable | Lý do hủy. |
| `created_at` | TIMESTAMP | NOT NULL | Thời điểm tạo. |
| `updated_at` | TIMESTAMP | NOT NULL, auto update | Thời điểm cập nhật. |

Order status:

```text
HELD, CONFIRMED, CANCELLED, EXPIRED
```

#### 5.5.2 `order_items`

- **Mục đích:** từng loại vé trong order.
- **Quan hệ chính:** thuộc `orders`, tham chiếu `ticket_types`, là nguồn phát hành `tickets`.
- **Constraint/index:** `quantity > 0`, `line_total = quantity * unit_price`, trigger supplement đảm bảo ticket type cùng concert với order.

| Field | Kiểu | Ràng buộc chính | Ý nghĩa |
| --- | --- | --- | --- |
| `id` | UUID | PK | Định danh dòng order. |
| `order_id` | UUID | FK `orders.id`, index | Order cha. |
| `ticket_type_id` | UUID | FK `ticket_types.id`, index | Loại vé được mua. |
| `quantity` | INTEGER | NOT NULL, check `> 0` | Số lượng vé. |
| `unit_price` | DECIMAL(12,2) | NOT NULL, check `>= 0` | Giá tại thời điểm mua. |
| `line_total` | DECIMAL(12,2) | NOT NULL, check `quantity * unit_price` | Thành tiền dòng. |
| `created_at` | TIMESTAMP | NOT NULL | Thời điểm tạo. |

#### 5.5.3 `payments`

- **Mục đích:** payment attempt, trạng thái thanh toán và raw webhook payload MVP.
- **Quan hệ chính:** thuộc `orders`.
- **Constraint/index:** unique `idempotency_key`, unique `(provider, provider_transaction_id)`, index `(order_id, status)`, `(status, created_at)`.

| Field | Kiểu | Ràng buộc chính | Ý nghĩa |
| --- | --- | --- | --- |
| `id` | UUID | PK | Định danh payment attempt. |
| `order_id` | UUID | FK `orders.id`, index | Order được thanh toán. |
| `provider` | `payment_provider` | NOT NULL, UNIQUE cùng `provider_transaction_id` | Cổng thanh toán. |
| `provider_transaction_id` | VARCHAR(255) | nullable | Mã giao dịch từ provider. |
| `idempotency_key` | VARCHAR(128) | NOT NULL, UNIQUE | Chống tạo payment trùng. |
| `amount` | DECIMAL(12,2) | NOT NULL, check `> 0` | Số tiền thanh toán. |
| `currency` | CHAR(3) | NOT NULL, default `VND` | Tiền tệ. |
| `status` | `payment_status` | NOT NULL, default `PENDING`, index | Trạng thái thanh toán. |
| `checkout_url` | TEXT | nullable | URL redirect sang provider. |
| `provider_payload` | JSONB | nullable | Payload tạo payment/provider response. |
| `webhook_payload` | JSONB | nullable | Raw webhook/IPN gần nhất. |
| `webhook_received_at` | TIMESTAMP | nullable | Lúc nhận webhook. |
| `webhook_signature_valid` | BOOLEAN | nullable | Kết quả verify chữ ký. |
| `paid_at` | TIMESTAMP | bắt buộc khi `SUCCEEDED` | Lúc thanh toán thành công. |
| `failure_reason` | TEXT | nullable | Lý do lỗi/thất bại. |
| `created_at` | TIMESTAMP | NOT NULL | Thời điểm tạo. |
| `updated_at` | TIMESTAMP | NOT NULL, auto update | Thời điểm cập nhật. |

Idempotency:

- Redis lưu trạng thái runtime và cached response theo TTL.
- PostgreSQL giữ unique constraint trên `orders.idempotency_key` và `payments.idempotency_key` làm lớp bảo vệ cuối.
- Không giữ bảng `idempotency_keys` riêng trong MVP.

### 5.6 E-ticket & QR

#### 5.6.1 `tickets`

- **Mục đích:** vé thật sau payment success.
- **Quan hệ chính:** thuộc order/order item/user/concert/ticket type/seat zone.
- **Constraint/index:** unique `qr_token_hash`, index QR lookup qua unique hash, index `(user_id, concert_id, status)`, `(user_id, ticket_type_id, status)`, `(ticket_type_id, status)`.

| Field | Kiểu | Ràng buộc chính | Ý nghĩa |
| --- | --- | --- | --- |
| `id` | UUID | PK | Định danh ticket. |
| `order_id` | UUID | FK `orders.id`, index | Order phát hành vé. |
| `order_item_id` | UUID | FK `order_items.id`, index | Dòng order phát hành vé. |
| `user_id` | UUID | FK `users.id`, index | Chủ sở hữu vé. |
| `concert_id` | UUID | FK `concerts.id`, index | Concert của vé. |
| `ticket_type_id` | UUID | FK kép với `concert_id`, index | Loại vé. |
| `seat_zone_id` | UUID | FK kép với `concert_id`, index | Zone để check-in nhanh. |
| `qr_token_hash` | VARCHAR(255) | NOT NULL, UNIQUE | Hash token QR. |
| `qr_payload` | JSONB | nullable | Payload QR đã ký/encode. |
| `qr_signature` | TEXT | nullable | Chữ ký QR. |
| `status` | `ticket_status` | NOT NULL, default `ISSUED`, index | Trạng thái vé. |
| `issued_at` | TIMESTAMP | NOT NULL | Lúc phát hành vé. |
| `checked_in_at` | TIMESTAMP | bắt buộc khi `CHECKED_IN` | Lúc check-in thành công. |
| `checked_in_by` | UUID | FK `users.id`, nullable | Checker thực hiện check-in. |
| `created_at` | TIMESTAMP | NOT NULL | Thời điểm tạo. |
| `updated_at` | TIMESTAMP | NOT NULL, auto update | Thời điểm cập nhật. |

`tickets.seat_zone_id` là denormalized để check-in nhanh. Source nghiệp vụ vẫn là `ticket -> order_item -> ticket_type -> seat_zone`; supplement trigger giữ các field denormalized đồng bộ.

### 5.7 Online/Offline Check-in

#### 5.7.1 `checkin_devices`

- **Mục đích:** map thiết bị với staff, concert và gate.
- **Quan hệ chính:** staff `users`, concert, gate.
- **Constraint/index:** unique `device_code`, index `(staff_id, status)`, `(concert_id, gate_id, status)`.

| Field | Kiểu | Ràng buộc chính | Ý nghĩa |
| --- | --- | --- | --- |
| `id` | UUID | PK | Định danh thiết bị. |
| `device_code` | VARCHAR(100) | NOT NULL, UNIQUE | Mã thiết bị mobile/checker. |
| `staff_id` | UUID | FK `users.id`, index | Nhân sự sử dụng thiết bị. |
| `concert_id` | UUID | FK `concerts.id`, index | Concert được phép check-in. |
| `gate_id` | UUID | FK kép với `concert_id`, index | Gate mặc định của thiết bị. |
| `name` | VARCHAR(255) | nullable | Tên thiết bị dễ đọc. |
| `status` | `device_status` | NOT NULL, default `ACTIVE`, index | Trạng thái thiết bị. |
| `last_seen_at` | TIMESTAMP | nullable | Lần cuối app online. |
| `created_at` | TIMESTAMP | NOT NULL | Thời điểm tạo. |
| `updated_at` | TIMESTAMP | NOT NULL, auto update | Thời điểm cập nhật. |

#### 5.7.2 `checkin_logs`

- **Mục đích:** audit mọi lần scan online/sync, kể cả reject.
- **Quan hệ chính:** ticket hoặc guest, concert, gate, device, staff.
- **Constraint/index:** index `(ticket_id, scanned_at)`, `(concert_id, scanned_at)`, `(gate_id, scanned_at)`, `(device_id, scanned_at)`.

| Field | Kiểu | Ràng buộc chính | Ý nghĩa |
| --- | --- | --- | --- |
| `id` | UUID | PK | Định danh log scan. |
| `ticket_id` | UUID | FK `tickets.id`, nullable, index | Vé được scan nếu có. |
| `guest_id` | UUID | FK `guest_list.id`, nullable, index | Guest được scan nếu có. |
| `concert_id` | UUID | FK `concerts.id`, index | Concert check-in. |
| `seat_zone_id` | UUID | FK kép với `concert_id`, nullable | Zone thực tế của ticket/guest. |
| `gate_id` | UUID | FK kép với `concert_id`, nullable, index | Gate quét. |
| `device_id` | UUID | FK `checkin_devices.id`, nullable, index | Thiết bị quét. |
| `staff_id` | UUID | FK `users.id`, nullable | Checker thao tác. |
| `scan_token_hash` | VARCHAR(255) | nullable | QR hash/raw lookup hash. |
| `result` | `checkin_result` | NOT NULL | Kết quả scan. |
| `reason` | TEXT | nullable | Lý do reject/lỗi. |
| `scanned_at` | TIMESTAMP | NOT NULL, index cùng ticket/gate/device | Thời điểm scan. |
| `metadata` | JSONB | nullable | Metadata từ app/provider. |
| `created_at` | TIMESTAMP | NOT NULL | Thời điểm ghi log. |

Online flow:

```text
Checker chọn concert/gate hoặc dùng gate của device
Scan QR -> tìm ticket theo qr_token_hash
Lock ticket
Lấy seat_zone từ ticket/ticket_type
Kiểm tra gate-zone mapping
Nếu hợp lệ: tickets.status = CHECKED_IN, ghi checkin_logs SUCCESS
Nếu sai: ghi checkin_logs WRONG_GATE/WRONG_CONCERT/INVALID_TICKET
```

#### 5.7.3 `offline_checkin_batches`

- **Mục đích:** một lần sync từ mobile offline.
- **Constraint/index:** unique `batch_token`, index `(concert_id, status)`, `(device_id, status)`, `(gate_id, status)`.

| Field | Kiểu | Ràng buộc chính | Ý nghĩa |
| --- | --- | --- | --- |
| `id` | UUID | PK | Định danh batch. |
| `batch_token` | VARCHAR(128) | NOT NULL, UNIQUE | Idempotency token cho batch sync. |
| `device_id` | UUID | FK `checkin_devices.id`, index | Thiết bị gửi batch. |
| `staff_id` | UUID | FK `users.id` | Checker gửi batch. |
| `concert_id` | UUID | FK `concerts.id`, index | Concert offline. |
| `gate_id` | UUID | FK kép với `concert_id`, index | Gate offline. |
| `status` | `offline_batch_status` | NOT NULL, default `PENDING`, index | Trạng thái sync. |
| `item_count` | INTEGER | NOT NULL, check không âm | Tổng item trong batch. |
| `accepted_count` | INTEGER | NOT NULL, check không âm | Số item accepted. |
| `conflict_count` | INTEGER | NOT NULL, check không âm | Số item conflict. |
| `synced_at` | TIMESTAMP | nullable | Lúc sync xong. |
| `created_at` | TIMESTAMP | NOT NULL | Thời điểm tạo. |
| `updated_at` | TIMESTAMP | NOT NULL, auto update | Thời điểm cập nhật. |

#### 5.7.4 `offline_checkin_items`

- **Mục đích:** từng scan offline trong batch.
- **Constraint/index:** unique `(batch_id, qr_token_hash)`, check có target `qr_token_hash` hoặc `ticket_id` hoặc `guest_id`, index `(batch_id, result)`.

| Field | Kiểu | Ràng buộc chính | Ý nghĩa |
| --- | --- | --- | --- |
| `id` | UUID | PK | Định danh item offline. |
| `batch_id` | UUID | FK `offline_checkin_batches.id`, UNIQUE cùng `qr_token_hash` | Batch cha. |
| `ticket_id` | UUID | FK `tickets.id`, nullable, index | Vé resolve được. |
| `guest_id` | UUID | FK `guest_list.id`, nullable, index | Guest resolve được. |
| `qr_token_hash` | VARCHAR(255) | nullable | QR hash scan offline. |
| `gate_id` | UUID | FK `checkin_gates.id`, nullable, index | Gate lúc scan. |
| `seat_zone_id` | UUID | FK `seat_zones.id`, nullable | Zone lúc scan/resolve. |
| `result` | `offline_item_status` | NOT NULL, default `PENDING`, index | Kết quả xử lý item. |
| `error_code` | VARCHAR(100) | nullable | Mã lỗi nếu reject. |
| `error_message` | TEXT | nullable | Lỗi chi tiết. |
| `scanned_at` | TIMESTAMP | NOT NULL | Thời điểm scan trên mobile. |
| `synced_at` | TIMESTAMP | nullable | Thời điểm server xử lý. |
| `metadata` | JSONB | nullable | Metadata offline. |
| `created_at` | TIMESTAMP | NOT NULL | Thời điểm ghi item. |

Offline sync vẫn validate lại trên server bằng `checkin_gate_zones`; mobile local chỉ là cache tạm.

### 5.8 Guest CSV Import

#### 5.8.1 `guest_import_jobs`

- **Mục đích:** theo dõi import CSV một chiều.
- **Constraint/index:** index `(concert_id, status)`, counters không âm.

| Field | Kiểu | Ràng buộc chính | Ý nghĩa |
| --- | --- | --- | --- |
| `id` | UUID | PK | Định danh job import. |
| `concert_id` | UUID | FK `concerts.id`, index | Concert nhận guest. |
| `uploaded_by` | UUID | FK `users.id` | Organizer/admin upload file. |
| `file_url` | TEXT | NOT NULL | CSV trên Object Storage. |
| `status` | `import_status` | NOT NULL, default `PENDING`, index | Trạng thái import. |
| `total_rows` | INTEGER | NOT NULL, check không âm | Tổng dòng đọc được. |
| `success_rows` | INTEGER | NOT NULL, check không âm | Dòng import thành công. |
| `error_rows` | INTEGER | NOT NULL, check không âm | Dòng lỗi. |
| `started_at` | TIMESTAMP | nullable | Lúc bắt đầu xử lý. |
| `completed_at` | TIMESTAMP | nullable | Lúc hoàn tất. |
| `error_message` | TEXT | nullable | Lỗi cấp job nếu có. |
| `created_at` | TIMESTAMP | NOT NULL | Thời điểm tạo. |
| `updated_at` | TIMESTAMP | NOT NULL, auto update | Thời điểm cập nhật. |

#### 5.8.2 `guest_list`

- **Mục đích:** danh sách khách mời và trạng thái check-in.
- **Constraint/index:** unique `(concert_id, phone)` để deduplicate, unique `(concert_id, code)`, index `(concert_id, status)`, `phone`.

| Field | Kiểu | Ràng buộc chính | Ý nghĩa |
| --- | --- | --- | --- |
| `id` | UUID | PK | Định danh guest. |
| `concert_id` | UUID | FK `concerts.id`, UNIQUE cùng `phone/code`, index | Concert khách được mời. |
| `seat_zone_id` | UUID | FK kép với `concert_id`, nullable, index | Zone của guest. |
| `import_job_id` | UUID | FK `guest_import_jobs.id`, nullable | Job import tạo guest. |
| `full_name` | VARCHAR(255) | NOT NULL | Tên khách mời. |
| `phone` | VARCHAR(20) | NOT NULL, UNIQUE cùng `concert_id`, index | Số điện thoại deduplicate. |
| `email` | VARCHAR(255) | nullable | Email khách mời. |
| `code` | VARCHAR(100) | nullable, UNIQUE cùng `concert_id` | Mã guest/QR guest nếu có. |
| `status` | `guest_status` | NOT NULL, default `INVITED`, index | Trạng thái guest. |
| `checked_in_at` | TIMESTAMP | nullable | Lúc guest check-in. |
| `checked_in_by` | UUID | FK `users.id`, nullable | Checker check-in guest. |
| `note` | TEXT | nullable | Ghi chú. |
| `created_at` | TIMESTAMP | NOT NULL | Thời điểm tạo. |
| `updated_at` | TIMESTAMP | NOT NULL, auto update | Thời điểm cập nhật. |

#### 5.8.3 `guest_import_errors`

- **Mục đích:** log lỗi từng dòng CSV để file lỗi một phần không làm hỏng cả job.
- **Constraint/index:** unique `(job_id, row_number, error_code)`, index `job_id`.

| Field | Kiểu | Ràng buộc chính | Ý nghĩa |
| --- | --- | --- | --- |
| `id` | UUID | PK | Định danh lỗi import. |
| `job_id` | UUID | FK `guest_import_jobs.id`, index | Job phát sinh lỗi. |
| `row_number` | INTEGER | NOT NULL, check `> 0`, UNIQUE cùng job/error | Dòng CSV lỗi. |
| `raw_data` | JSONB | nullable | Dữ liệu gốc của dòng lỗi. |
| `error_code` | VARCHAR(100) | NOT NULL | Mã lỗi. |
| `error_message` | TEXT | NOT NULL | Nội dung lỗi. |
| `created_at` | TIMESTAMP | NOT NULL | Thời điểm ghi lỗi. |

### 5.9 AI Artist Bio

#### 5.9.1 `artist_bio_jobs`

- **Mục đích:** một bảng job duy nhất cho upload PDF/Press Kit, extracted text, generated bio và lỗi.
- **Quan hệ chính:** thuộc `concerts`, optional user requester.
- **Constraint/index:** index `(concert_id, status)`, `(status, created_at)`.

| Field | Kiểu | Ràng buộc chính | Ý nghĩa |
| --- | --- | --- | --- |
| `id` | UUID | PK | Định danh job AI bio. |
| `concert_id` | UUID | FK `concerts.id`, index | Concert cần bio. |
| `requested_by` | UUID | FK `users.id`, nullable | Người tạo job. |
| `status` | `artist_bio_job_status` | NOT NULL, default `PENDING`, index | Trạng thái xử lý. |
| `source_file_url` | TEXT | NOT NULL | PDF/Press Kit nguồn. |
| `extracted_text` | TEXT | nullable | Text đã extract. |
| `generated_bio` | TEXT | nullable | Bio AI sinh ra. |
| `error_message` | TEXT | nullable | Lỗi nếu failed. |
| `created_at` | TIMESTAMP | NOT NULL | Thời điểm tạo. |
| `updated_at` | TIMESTAMP | NOT NULL, auto update | Thời điểm cập nhật. |

Flow:

```text
Upload source -> artist_bio_jobs PENDING
Worker extract text -> PROCESSING
AI sinh bio -> generated_bio, status DONE
Admin/worker publish -> copy generated_bio sang concerts.artist_bio
```

### 5.10 Notification

#### 5.10.1 `notifications`

- **Mục đích:** queue/log tối giản cho APP/EMAIL/SMS/ZALO.
- **Quan hệ chính:** optional user/concert/ticket.
- **Constraint/index:** `attempts >= 0`, index `(status, created_at)` cho worker, `(user_id, created_at)`, `(concert_id, status)`.

| Field | Kiểu | Ràng buộc chính | Ý nghĩa |
| --- | --- | --- | --- |
| `id` | UUID | PK | Định danh notification. |
| `user_id` | UUID | FK `users.id`, nullable, index | Người nhận. |
| `concert_id` | UUID | FK `concerts.id`, nullable, index | Concert liên quan. |
| `ticket_id` | UUID | FK `tickets.id`, nullable, index | Ticket liên quan. |
| `channel` | `notification_channel` | NOT NULL | Kênh gửi. |
| `type` | `notification_type` | NOT NULL | Loại thông báo. |
| `status` | `notification_status` | NOT NULL, default `PENDING`, index | Trạng thái worker. |
| `payload` | JSONB | NOT NULL | Nội dung/tham số gửi. |
| `attempts` | INTEGER | NOT NULL, default `0`, check không âm | Số lần thử gửi. |
| `error_message` | TEXT | nullable | Lỗi gần nhất. |
| `sent_at` | TIMESTAMP | nullable | Lúc gửi thành công. |
| `created_at` | TIMESTAMP | NOT NULL | Thời điểm enqueue. |
| `updated_at` | TIMESTAMP | NOT NULL, auto update | Thời điểm cập nhật. |

Status:

```text
PENDING, SENT, FAILED
```

### 5.11 Audit Log

#### 5.11.1 `audit_logs`

- **Mục đích:** audit thao tác quan trọng như publish concert, đổi role, import guest, tạo AI job.
- **Quan hệ chính:** optional actor `users`.
- **Constraint/index:** `(entity_type, entity_id, created_at)`, `(actor_user_id, created_at)`.

| Field | Kiểu | Ràng buộc chính | Ý nghĩa |
| --- | --- | --- | --- |
| `id` | UUID | PK | Định danh audit log. |
| `actor_user_id` | UUID | FK `users.id`, nullable, index | User thực hiện hành động. |
| `action` | VARCHAR(100) | NOT NULL | Tên hành động. |
| `entity_type` | VARCHAR(100) | NOT NULL, index cùng `entity_id` | Loại entity. |
| `entity_id` | VARCHAR(100) | nullable, index cùng `entity_type` | ID entity bị tác động. |
| `metadata` | JSONB | nullable | Dữ liệu bổ sung. |
| `ip_address` | VARCHAR(45) | nullable | IP caller. |
| `user_agent` | TEXT | nullable | User agent. |
| `created_at` | TIMESTAMP | NOT NULL | Thời điểm ghi audit. |

## 6. Quan hệ chính giữa các bảng

```text
users -> concerts (organizer)
venues -> concerts
concerts -> seat_zones -> ticket_types
concerts -> checkin_gates -> checkin_gate_zones -> seat_zones
users -> orders -> order_items -> ticket_types
orders -> payments
orders/order_items/ticket_types -> tickets
checkin_devices -> checkin_logs
offline_checkin_batches -> offline_checkin_items
concerts -> guest_import_jobs -> guest_import_errors
concerts -> guest_list
concerts -> artist_bio_jobs
users/concerts/tickets -> notifications
users -> audit_logs
```

## 7. Constraint và index quan trọng

| Nhu cầu | Constraint/index |
| --- | --- |
| Concert listing | `concerts(status, starts_at)`, `venues(city)`. |
| Ticket availability | `ticket_types(concert_id, status)`, partial index supplement cho ticket type còn vé. |
| Chống oversell | row lock trên `ticket_types`, check `total_quantity >= held_quantity + sold_quantity`. |
| Per-user limit | PK `user_ticket_type_counters(user_id, ticket_type_id)`. |
| Order lookup | `orders(user_id, status, created_at)`, `orders(concert_id, status)`. |
| Order idempotency | unique `orders.idempotency_key`. |
| Payment idempotency | unique `payments.idempotency_key`, unique `(provider, provider_transaction_id)`. |
| QR lookup | unique `tickets.qr_token_hash`. |
| Check-in sync | `checkin_logs(ticket_id, scanned_at)`, `offline_checkin_batches(batch_token)`, `offline_checkin_items(batch_id, qr_token_hash)`. |
| Gate-zone validation | PK `checkin_gate_zones(gate_id, seat_zone_id)` và FK kép theo `concert_id`. |
| Guest lookup | unique `guest_list(concert_id, phone)`, index `guest_list(phone)`. |
| Notification worker | `notifications(status, created_at)` và partial pending index supplement. |

## 8. Mapping với yêu cầu đồ án

| Yêu cầu | Cách đáp ứng |
| --- | --- |
| Chống oversell | `ticket_types` + transaction lock + `orders/order_items`. |
| Giới hạn vé theo user | `user_ticket_type_counters`. |
| Idempotency order/payment | Redis + unique key trên `orders` và `payments`. |
| E-ticket QR | `tickets.qr_token_hash`, `qr_payload`, `qr_signature`. |
| Online check-in | `checkin_logs`, `tickets.status`. |
| Offline check-in | `checkin_devices`, `offline_checkin_batches`, `offline_checkin_items`. |
| Sai cổng/sai khu | `checkin_gates`, `checkin_gate_zones`, `seat_zones`. |
| Guest CSV | `guest_import_jobs`, `guest_list`, `guest_import_errors`. |
| AI Artist Bio | `artist_bio_jobs`, `concerts.artist_bio`. |
| Notification | `notifications`. |
| Audit | `audit_logs`. |
| Cache/rate limit | Redis, không có PostgreSQL table riêng. |

## 9. Các bảng đã bỏ/gộp và lý do

| Bảng cũ | Quyết định | Lý do |
| --- | --- | --- |
| `roles`, `user_roles`, `permissions`, `role_permissions` | Bỏ | MVP dùng `users.role`; policy chi tiết nằm trong code. |
| `artists`, `concert_artists` | Bỏ | Catalog MVP chỉ cần `concerts.artist_name` và `artist_bio`. |
| `seat_maps` | Bỏ | Dùng `concerts.seat_map_url` và `seat_zones.svg_path`. |
| `ticket_inventory`, `inventory_reservations` | Bỏ | Tồn kho nằm trong `ticket_types`; hold TTL nằm ở `orders.hold_expires_at`. |
| `idempotency_keys` | Bỏ | Redis xử lý runtime; PostgreSQL unique key bảo vệ cuối. |
| `payment_webhook_events` | Gộp vào `payments` | MVP lưu raw webhook payload cuối trong payment. |
| `notification_templates`, `notification_logs`, `notification_dead_letters` | Gộp vào `notifications` | Một bảng đủ cho queue/log demo. |
| `artist_bios` | Gộp vào `artist_bio_jobs` | Job chứa luôn `generated_bio`; public bio nằm ở `concerts.artist_bio`. |
| `rate_limit_buckets` | Bỏ | Rate limit là Redis token bucket/sliding window. |

Không giữ bảng nào trong danh sách loại bỏ.

## 10. Ghi chú triển khai Prisma/PostgreSQL

- Prisma schema là nguồn model chính cho app.
- `schema.sql` phản ánh cùng danh sách bảng/enum/index/foreign key với Prisma và thêm check constraint cơ bản.
- `schema-supplement.sql` chỉ giữ trigger/index bổ sung: partial worker indexes, validate order item cùng concert, sync denormalized ticket fields và chặn đổi nguồn sau khi phát hành ticket.
- Nếu dùng migrations hiện có, cần tạo migration mới hoặc reset migrations cho đồ án vì các migration cũ vẫn thuộc thiết kế trước refactor.
- Khi checkout, backend phải dùng transaction `Serializable` hoặc row lock `SELECT ... FOR UPDATE` trên `ticket_types`.
- Khi Redis idempotency mất dữ liệu, unique key trong PostgreSQL vẫn chặn duplicate order/payment.
- Payment webhook phải verify signature trước khi cập nhật `payments.status` và chuyển `orders.status` sang `CONFIRMED`.
