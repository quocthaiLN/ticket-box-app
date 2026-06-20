# Kế hoạch: Sửa path + role đơn cho từng route — TicketBox

## Nguyên tắc

Mỗi route chỉ `requireRole` đúng **1 role**. Không có route nào cho phép nhiều role cùng lúc.

---

## Toàn bộ routes đúng theo vai trò

### PUBLIC — không cần auth

```
POST   /v1/auth/otp/request                                    ← Gửi OTP xác thực email trước khi đăng ký
POST   /v1/auth/register                                       ← Đăng ký tài khoản, luôn tạo role AUDIENCE
POST   /v1/auth/login                                          ← Đăng nhập, trả về tokens + redirect_to theo role
POST   /v1/auth/refresh                                        ← Làm mới access token bằng refresh token
GET    /v1/concerts                                            ← Danh sách concert đang PUBLISHED
GET    /v1/concerts/:concert_id                                ← Chi tiết concert
GET    /v1/concerts/:concert_id/metadata                       ← Venue, seat zones, ticket types
GET    /v1/concerts/:concert_id/seat-map                       ← SVG sơ đồ chỗ ngồi
GET    /v1/concerts/:concert_id/ticket-types                   ← Danh sách loại vé
GET    /v1/concerts/:concert_id/inventory                      ← Số lượng vé còn lại
```

### AUDIENCE — `requireRole("AUDIENCE")`

(Còn cần thêm route cho sửa thông tin người dùng)

```
POST   /v1/auth/logout                                         ← Đăng xuất, thu hồi access token
GET    /v1/auth/me                                             ← Thông tin tài khoản hiện tại
POST   /v1/orders                                              ← Tạo order + giữ chỗ (hold vé)
GET    /v1/orders/:order_id                                    ← Xem trạng thái order của mình
POST   /v1/orders/:order_id/cancel                             ← Hủy order đang HELD
POST   /v1/orders/:order_id/payments                           ← Tạo payment URL (VNPay/MoMo)
GET    /v1/me/tickets                                          ← Danh sách e-ticket đã mua
GET    /v1/me/tickets/:ticket_id                               ← Chi tiết vé
GET    /v1/me/tickets/:ticket_id/qr                            ← QR code để check-in tại cổng
```

### CHECKER — `requireRole("CHECKER")`

(Quét QR giống nhau cho mọi loại vé)

```
(mobile) POST   /v1/check-in/scan                                       ← Quét QR vé tại cổng
(bỏ) POST   /v1/check-in/scans                                      ← Alias của /check-in/scan
(mobile) GET    /v1/check-in/preload                                    ← Tải dữ liệu concert/vé để dùng offline
(bỏ) GET    /v1/check-in/bootstrap                                  ← Alias của /check-in/preload
(bỏ) GET    /v1/check-in/devices/:device_id/preload                 ← Preload theo thiết bị cụ thể
(bỏ) GET    /v1/check-in/gates/:gate_id/preload                     ← Preload theo cổng cụ thể
(mobile) POST   /v1/check-in/offline-sync                               ← Sync các lượt scan offline lên server
(mobile) POST   /v1/check-in/offline-batches                            ← Tạo batch để gom scan offline
(mobile) POST   /v1/check-in/offline-batches/:batch_id/items            ← Thêm scan items vào batch
(bỏ) GET    /v1/guest-list/search                                   ← Tìm kiếm guest trong danh sách khách mời
GET    /v1/check-in/guests/search                              ← Tìm kiếm guest trong danh sách khách mời
(bỏ) POST   /v1/guest-list/scan                                     ← Scan và xác nhận check-in guest
(bỏ) POST   /v1/check-in/guests/scans                               ← Alias của /guest-list/scan
```

### ORGANIZER — `requireRole("ORGANIZER")` — TẤT CẢ LÀ ROUTE MỚI

(Thêm api yêu cầu tạo, xóa concert)
(Phải thêm thông tin về số cổng, số vé bán)
(Loại vé -> Xử lý với UI)

```
GET    /v1/organizer/orders                                        ← Xem TẤT CẢ orders toàn hệ thống
GET    /v1/organizer/ticket-types/:ticket_type_id/inventory        ← Xem tồn kho thực tế loại vé
GET    /v1/organizer/requests                                  ← Danh sách hồ sơ xin tổ chức concert đã gửi
POST   /v1/organizer/requests                                  ← Gửi hồ sơ mới kèm press kit, thông tin concert, số checker
GET    /v1/organizer/requests/:request_id                      ← Chi tiết + trạng thái hồ sơ (PENDING/APPROVED/REJECTED)
GET    /v1/organizer/concerts                                  ← Danh sách concert DRAFT/PUBLISHED thuộc mình
GET    /v1/organizer/concerts/:concert_id/analytics            ← Doanh thu, số vé bán, tỉ lệ check-in của concert mình
POST   /v1/organizer/concerts/:concert_id                      ← Chỉnh sửa thông tin concert
GET    /v1/organizer/checker-accounts                          ← Danh sách checker account đã được admin cấp
```

### ADMIN — `requireRole("ADMIN")`

#### Concert & Venue

```
// Địa điểm cố định dữ liệu trong database, không cần thêm xóa, sửa, organizer chỉ cần chọn
(bỏ) GET    /v1/admin/venues                                        ← Danh sách địa điểm tổ chức
(bỏ) POST   /v1/admin/venues                                        ← Tạo địa điểm mới
(bỏ) PATCH  /v1/admin/venues/:venue_id                              ← Cập nhật thông tin địa điểm
----
GET    /v1/admin/concerts                                      ← Danh sách TẤT CẢ concert (mọi status)
(bỏ) POST   /v1/admin/concerts                                      ← Tạo concert trực tiếp (hoặc auto khi approve request)
PATCH  /v1/admin/concerts/:concert_id                          ← Duyệt yêu cầu chỉnh sửa thông tin concert
POST   /v1/admin/concerts/:concert_id/publish                  ← Publish concert từ DRAFT → PUBLISHED
POST   /v1/admin/concerts/:concert_id/cancel                   ← Hủy concert

---
// Seat zone sẵn theo nơi tổ chức
// Bỏ hết
POST   /v1/admin/concerts/:concert_id/seat-zones               ← Thêm khu vực chỗ ngồi
PATCH  /v1/admin/seat-zones/:seat_zone_id                      ← Cập nhật khu vực chỗ ngồi
POST   /v1/admin/concerts/:concert_id/ticket-types             ← Thêm loại vé
PATCH  /v1/admin/ticket-types/:ticket_type_id                  ← Cập nhật loại vé
```

#### Gate & Device config

```
GET    /v1/admin/check-in/gates                                ← Danh sách tất cả cổng
---
// Bỏ hết
POST   /v1/admin/concerts/:concert_id/check-in/gates           ← Tạo cổng check-in cho concert
GET    /v1/admin/check-in/gates                                ← Danh sách tất cả cổng
POST   /v1/admin/check-in/gates                                ← Tạo cổng mới
GET    /v1/admin/check-in/gates/:gate_id                       ← Chi tiết cổng
PATCH  /v1/admin/check-in/gates/:gate_id                       ← Cập nhật cổng
DELETE /v1/admin/check-in/gates/:gate_id                       ← Xóa cổng
PUT    /v1/admin/check-in/gates/:gate_id/zones                 ← Gắn khu vực vào cổng
POST   /v1/admin/check-in/devices                              ← Đăng ký thiết bị quét
GET    /v1/admin/check-in/devices                              ← Danh sách thiết bị
PATCH  /v1/admin/check-in/devices/:device_id                   ← Cập nhật thiết bị
DELETE /v1/admin/check-in/devices/:device_id                   ← Xóa thiết bị
POST   /v1/admin/check-in/gate-zone-mappings                   ← Tạo mapping cổng-khu vực
GET    /v1/admin/check-in/gate-zone-mappings                   ← Danh sách mapping
DELETE /v1/admin/check-in/gate-zone-mappings/:mapping_id       ← Xóa mapping
```

#### Orders, Inventory, Notifications

```

(bỏ) POST   /v1/admin/ticket-types/:ticket_type_id/inventory-adjustments ← Điều chỉnh tồn kho thủ công

// Suy nghĩ sau
GET    /v1/admin/notifications                                 ← Danh sách notifications (email, push)
GET    /v1/admin/notifications/:notification_id                ← Chi tiết notification
POST   /v1/admin/notifications/:notification_id/retry          ← Gửi lại notification bị FAILED
```

#### Guest list

```
// Xem lại luồng để chỉnh sửa
POST   /v1/guest-list/import                                   ← Import danh sách guest bằng CSV
POST   /v1/admin/concerts/:concert_id/guest-import-jobs        ← Import CSV guest list cho concert cụ thể
GET    /v1/admin/concerts/:concert_id/guests                   ← Xem toàn bộ guest list của concert
```

#### User management

```
GET    /v1/auth/admin/users                                    ← Danh sách tài khoản toàn hệ thống
PATCH  /v1/auth/admin/users/:user_id/role                      ← Đổi role tài khoản theo user_id
PATCH  /v1/auth/admin/users/:user_id/status                    ← Khóa/mở khóa tài khoản
PATCH  /v1/auth/admin/users/role-by-email                      ← MỚI: Nâng cấp AUDIENCE → ORGANIZER bằng email
```

#### Analytics & Organizer request management — TẤT CẢ MỚI

(Thêm tạo lô tài khoản checker cho ban tổ chức, chỉ tồn tại đến khi xong sự kiện)

```
GET    /v1/admin/organizer-requests                            ← Danh sách hồ sơ BTC gửi (filter by status)
GET    /v1/admin/organizer-requests/:request_id                ← Chi tiết hồ sơ: thông tin concert, press kit, số checker
POST   /v1/admin/organizer-requests/:request_id/approve        ← Duyệt → auto tạo Concert DRAFT + checker accounts
POST   /v1/admin/organizer-requests/:request_id/reject         ← Từ chối hồ sơ, lưu lý do
GET    /v1/admin/concerts/:concert_id/checker-accounts         ← Danh sách checker account đã cấp cho concert
```

---
