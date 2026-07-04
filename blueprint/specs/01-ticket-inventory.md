# Đặc tả: Ticket Inventory / Chống oversell

## 1. Mô tả

Đặc tả cơ chế quản lý tồn kho vé theo từng `ticket_type`, đảm bảo không bán quá số lượng vé được cấu hình kể cả khi nhiều người đặt cùng lúc.

Trong MVP, PostgreSQL không lưu cột `available_quantity`. Số vé còn lại là giá trị tính toán:

```text
available_quantity = total_quantity - held_quantity - sold_quantity
```

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
- `user_ticket_type_counters`
- `audit_logs` nếu cần audit nghiệp vụ/admin

## 4. Luồng chính

1. Khán giả gửi request giữ vé với `concert_id`, `ticket_type_id`, `quantity`.
2. Backend mở database transaction.
3. Backend khóa dòng `ticket_types` bằng `SELECT ... FOR UPDATE` theo `ticket_type_id`.
4. Backend kiểm tra loại vé đang mở bán, thời gian hiện tại nằm trong `sale_start_at` và `sale_end_at`.
5. Backend tính `available_quantity = total_quantity - held_quantity - sold_quantity` và kiểm tra đủ vé.
6. Backend khóa hoặc tạo `user_ticket_type_counters` để kiểm tra `max_per_user`.
7. Nếu hợp lệ, tăng `ticket_types.held_quantity` và tăng `user_ticket_type_counters.held_quantity`.
8. Backend tạo `orders` trạng thái `HELD`, `hold_expires_at = now() + TTL` và `order_items` tương ứng.
9. Transaction commit; Redis inventory cache được cập nhật/invalidate sau commit.
10. Worker định kỳ quét order hết `hold_expires_at`, chuyển order sang `EXPIRED`, giảm `held_quantity` và hoàn quota user.

## 5. Kịch bản lỗi

- Không đủ vé: rollback transaction, trả lỗi `TICKET_SOLD_OUT`, không tạo order.
- Loại vé chưa mở bán hoặc đã hết hạn bán: rollback, trả lỗi `TICKET_TYPE_NOT_ON_SALE`.
- Database lock timeout/deadlock: rollback, trả lỗi retryable, không thay đổi tồn kho.
- Redis lỗi sau commit: không rollback DB; đánh dấu cache stale và lần đọc sau lấy lại từ PostgreSQL/worker snapshot.
- Worker release trùng: dùng trạng thái order để đảm bảo chỉ release một lần.

## 6. Ràng buộc nghiệp vụ và kỹ thuật

- `ticket_types.total_quantity >= held_quantity + sold_quantity` luôn đúng.
- `available_quantity` là computed field, không phải cột DB.
- `held_quantity` và `sold_quantity` không được âm.
- Mọi thao tác hold/release/payment-confirmed/refund phải nằm trong transaction.
- Không được dựa vào Redis làm source of truth khi quyết định bán vé.
- Audit tồn kho MVP dùng `audit_logs` cho thao tác admin/nghiệp vụ quan trọng; không có bảng `ticket_inventory_events` riêng.

## 7. Tiêu chí chấp nhận

- Khi 2 request cùng mua vé cuối cùng, chỉ 1 request thành công.
- Không có trường hợp computed `available_quantity < 0`.
- Order hết hạn làm số vé quay lại đúng số lượng.
- Cache inventory có thể lệch ngắn hạn nhưng DB vẫn nhất quán.
- Không còn phụ thuộc bảng `ticket_inventory_events` trong MVP.