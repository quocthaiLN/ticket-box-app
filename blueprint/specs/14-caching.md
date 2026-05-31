# Đặc tả: Caching

## 1. Mô tả

Đặc tả cache danh sách concert, chi tiết concert, sơ đồ zone và số lượng vé còn lại bằng Redis/local cache/CDN.

## 2. Actor / Thành phần tham gia

- Client
- API Gateway
- Catalog Module
- Inventory Module
- Redis
- PostgreSQL
- CDN

## 3. Bảng dữ liệu liên quan

- `concerts`
- `venues`
- `seat_zones`
- `ticket_types`
- `concerts.artist_bio`

## 4. Luồng chính

1. Catalog API kiểm tra cache theo key `catalog:list` hoặc `catalog:concert:{id}`.
2. Nếu cache hit, trả dữ liệu metadata ngay.
3. Nếu cache miss, query PostgreSQL và ghi cache TTL dài.
4. Inventory API đọc Redis key `inventory:ticket_type:{id}` cho số vé còn lại.
5. Ticketing Module sau hold/payment/release update hoặc invalidate Redis inventory.
6. Admin update concert/ticket type/zone/bio thì publish event invalidate cache.
7. Client/CDN cache asset tĩnh như ảnh, SVG hoặc map URL.

## 5. Kịch bản lỗi

- Redis lỗi: fallback DB có circuit breaker hoặc trả inventory đang cập nhật.
- Cache stampede: dùng singleflight/mutex cho metadata cache miss.
- Cache stale sau admin update: invalidate chủ động theo concert id.
- Inventory lệch do Redis update fail: TTL ngắn và job reconcile từ DB.

## 6. Ràng buộc nghiệp vụ và kỹ thuật

- Metadata cache TTL dài hơn inventory cache.
- Không dùng cache để quyết định cuối cùng khi bán vé.
- Inventory cache có thể eventual consistency nhưng DB phải ACID.
- Cache key phải phân tách môi trường và concert/ticket type rõ ràng.
- Admin update phải invalidate cache liên quan.

## 7. Tiêu chí chấp nhận

- Trang danh sách/chi tiết chịu được refresh lớn mà không dội thẳng DB.
- Số vé còn lại cập nhật gần đúng sau hold/payment/release.
- Cache lỗi không làm toàn bộ hệ thống sập nếu fallback hoạt động.
- Dữ liệu admin update không bị stale quá TTL/chính sách invalidate.
