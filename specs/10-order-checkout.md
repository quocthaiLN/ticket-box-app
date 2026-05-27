# Đặc tả: Order Checkout

## 1. Mô tả

Đặc tả tạo đơn hàng giữ vé, tạo order items, thanh toán và xử lý hết hạn hold.

## 2. Actor / Thành phần tham gia

- Khán giả
- Ticketing Module
- Payment Module
- PostgreSQL
- Order Expiry Worker

## 3. Bảng dữ liệu liên quan

- `orders`
- `order_items`
- `ticket_types`
- `payments`
- `idempotency_keys`
- `user_ticket_type_counters`

## 4. Luồng chính

1. Khán giả chọn ticket type và quantity rồi gửi checkout request kèm idempotency key.
2. Backend kiểm tra user đã đăng nhập và request hợp lệ.
3. Backend chạy transaction ticket inventory + per-user limit.
4. Backend tạo `orders` trạng thái `HELD`, `hold_expires_at = now() + TTL`.
5. Backend tạo `order_items` theo từng ticket type.
6. Payment Module tạo payment URL và `payments` trạng thái `PENDING`.
7. Client được redirect sang provider thanh toán.
8. Payment success chuyển order sang `PAID`; payment fail/timeout/hết hạn chuyển order sang `FAILED/EXPIRED` và release hold.

## 5. Kịch bản lỗi

- Idempotency key trùng: trả response cũ hoặc trạng thái đang xử lý.
- Order hết hạn trước webhook success: xử lý theo chính sách đối soát; không phát hành vé nếu hold đã release.
- User đóng trình duyệt: order tự hết hạn theo worker.
- Payment provider fail: giữ order đến TTL hoặc fail-fast tùy circuit breaker.

## 6. Ràng buộc nghiệp vụ và kỹ thuật

- Order `HELD` phải có `hold_expires_at`.
- Order amount phải bằng tổng `order_items.line_total`.
- Không tạo payment nếu hold vé thất bại.
- Không phát hành ticket khi order chưa `PAID`.
- Mọi trạng thái order phải chuyển theo state machine rõ ràng.

## 7. Tiêu chí chấp nhận

- Checkout hợp lệ tạo order held và payment URL.
- Order hết hạn release vé và quota user.
- Payment success chuyển order PAID và phát hành ticket.
- Checkout retry không tạo đơn trùng.
