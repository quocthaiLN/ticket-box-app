# Đặc tả: Ticket Inventory / Chống oversell

## 1. Mô tả

Đặc tả cơ chế quản lý tồn kho vé theo từng `ticket_type`, đảm bảo không bán quá số lượng vé được cấu hình kể cả khi nhiều người đặt cùng lúc.

## 2. Actor / Thành phần tham gia

- Khán giả
- Ticketing Module
- PostgreSQL
- Redis Inventory Cache
- Background Worker hết hạn hold

## 3. Bảng dữ liệu liên quan

- `ticket_types`
- `orders`
- `order_items`
- `ticket_inventory_events`

## 4. Luồng chính

1. Khán giả gửi request giữ vé với `concert_id`, `ticket_type_id`, `quantity`.
2. Backend mở database transaction.
3. Backend khóa dòng `ticket_types` bằng `SELECT ... FOR UPDATE` theo `ticket_type_id`.
4. Backend kiểm tra loại vé đang mở bán, thời gian hiện tại nằm trong `sale_start_at` và `sale_end_at`, `available_quantity >= quantity`.
5. Nếu hợp lệ, cập nhật `ticket_types`: giảm `available_quantity`, tăng `held_quantity`.
6. Backend tạo `orders` trạng thái `HELD` và `order_items` tương ứng.
7. Backend ghi `ticket_inventory_events` với `event_type = HOLD` để audit thay đổi tồn kho.
8. Transaction commit; Redis inventory cache được cập nhật/invalidate sau commit.
9. Worker định kỳ quét order hết `hold_expires_at`, release vé và ghi event `RELEASE`.

## 5. Kịch bản lỗi

- Không đủ vé: rollback transaction, trả lỗi `TICKET_SOLD_OUT`, không tạo order.
- Loại vé chưa mở bán hoặc đã hết hạn bán: rollback, trả lỗi `TICKET_TYPE_NOT_ON_SALE`.
- Database lock timeout/deadlock: rollback, trả lỗi retryable, không thay đổi tồn kho.
- Redis lỗi sau commit: không rollback DB; đánh dấu cache stale và để lần đọc sau lấy lại từ PostgreSQL.
- Worker release trùng: dùng trạng thái order để đảm bảo chỉ release một lần.

## 6. Ràng buộc nghiệp vụ và kỹ thuật

- `ticket_types.total_quantity = available_quantity + held_quantity + sold_quantity` luôn đúng.
- `available_quantity`, `held_quantity`, `sold_quantity` không được âm.
- Mọi thao tác hold/release/payment-confirmed/refund phải nằm trong transaction.
- Không được dựa vào Redis làm nguồn dữ liệu chính khi quyết định bán vé.
- Mọi thay đổi tồn kho phải ghi `ticket_inventory_events` để phục vụ audit.

## 7. Tiêu chí chấp nhận

- Khi 2 request cùng mua vé cuối cùng, chỉ 1 request thành công.
- Không có trường hợp `available_quantity < 0`.
- Order hết hạn làm số vé quay lại `available_quantity` đúng số lượng.
- Có event audit tương ứng với mỗi lần thay đổi tồn kho.
- Cache inventory có thể lệch ngắn hạn nhưng DB vẫn nhất quán.
