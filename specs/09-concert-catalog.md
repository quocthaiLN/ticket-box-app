# Đặc tả: Concert Catalog

## 1. Mô tả

Đặc tả hiển thị danh sách concert, chi tiết concert, địa điểm, sơ đồ khu vực và số vé còn lại.

## 2. Actor / Thành phần tham gia

- Khán giả
- Catalog Module
- Redis Cache
- PostgreSQL
- CDN/Object Storage

## 3. Bảng dữ liệu liên quan

- `concerts`
- `venues`
- `seat_zones`
- `ticket_types`
- `artist_bios`

## 4. Luồng chính

1. Client gọi API danh sách concert sắp diễn ra.
2. Catalog Module đọc cache; nếu miss, query PostgreSQL các concert `PUBLISHED`.
3. Client chọn concert và gọi API chi tiết.
4. API trả metadata: title, artist, venue, time, cover, active artist bio, seat zones/SVG URL.
5. Client gọi API inventory riêng để lấy `available_quantity` theo ticket type/zone.
6. Inventory response lấy từ Redis nếu có, fallback PostgreSQL nếu cache miss.
7. Admin cập nhật concert/ticket type thì cache metadata và inventory liên quan bị invalidate.

## 5. Kịch bản lỗi

- Cache miss nhiều request đồng thời: dùng singleflight/mutex để tránh cache stampede.
- Redis lỗi: fallback DB nếu tải cho phép hoặc trả trạng thái inventory đang cập nhật.
- Concert CANCELLED: không cho mua, vẫn có thể hiển thị trạng thái hủy nếu cần.
- SVG không tải được: client dùng map_url fallback hoặc hiển thị danh sách zone dạng text.

## 6. Ràng buộc nghiệp vụ và kỹ thuật

- Chỉ concert `PUBLISHED` mới hiện ở public catalog.
- Thông tin ít thay đổi cache TTL dài; inventory TTL ngắn hoặc invalidate chủ động.
- Số vé hiển thị chỉ mang tính gần đúng; quyết định mua vé dựa trên PostgreSQL transaction.
- Seat zone code phải unique theo concert.
- Ticket type name phải unique theo concert.

## 7. Tiêu chí chấp nhận

- Người dùng xem được danh sách và chi tiết concert.
- Chi tiết có venue, time, seat zones, ticket types và bio nếu có.
- Inventory không làm quá tải DB khi refresh nhiều.
- Admin update làm dữ liệu public được refresh theo chính sách cache.
