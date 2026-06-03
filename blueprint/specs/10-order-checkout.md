# Đặc tả: Order Checkout

## 1. Mô tả

Đặc tả tạo đơn hàng giữ vé, tạo order items, thanh toán và xử lý hết hạn hold.

## 2. Actor / Thành phần tham gia

- Khán giả
- Ticketing Module
- Payment Module
- VNPAY / MoMo Provider
- PostgreSQL
- Redis Idempotency Store
- Order Expiry Worker

## 3. Bảng dữ liệu liên quan

- `orders`
- `order_items`
- `ticket_types`
- `payments`
- `user_ticket_type_counters`
- `tickets`

## 4. Luồng chính

1. Khán giả chọn ticket type và quantity rồi gửi checkout request kèm idempotency key.
2. Backend kiểm tra user đã đăng nhập và request hợp lệ.
3. Backend chạy transaction ticket inventory + per-user limit.
4. Backend tạo `orders` trạng thái `HELD`, `hold_expires_at = now() + TTL`.
5. Backend tạo `order_items` theo từng ticket type.
6. Payment Module tạo payment URL và `payments` trạng thái `PENDING`.
7. Client được redirect sang provider thanh toán.
8. Payment success chuyển `payments.status = SUCCEEDED`, `orders.status = CONFIRMED`, chuyển held sang sold và phát hành ticket.
9. Payment fail/cancel hoặc order timeout release hold và chuyển order sang `CANCELLED` hoặc `EXPIRED` theo nguyên nhân.

## 4.1. Luồng ReturnUrl vs IPN/Webhook

VNPAY và MoMo đều có hai loại callback:

| Loại | Trigger | Xử lý |
| --- | --- | --- |
| **ReturnUrl** | Browser redirect sau khi user xong trên trang provider | **Frontend only** — hiển thị màn hình "đang xử lý", bắt đầu poll `GET /orders/{order_id}` |
| **IPN / Webhook** | Server-to-server từ provider, độc lập browser | **Backend** — verify signature, cập nhật payment/order, phát hành ticket |

ReturnUrl không được dùng để cập nhật order status. Backend chỉ tin vào IPN/Webhook đã verify signature.

## 4.2. Luồng payment retry

Khi payment có trạng thái `FAILED` (provider từ chối), user có thể thử lại mà không cần tạo order mới:

1. User gửi `POST /orders/{order_id}/payments` với provider mới hoặc cùng provider.
2. Backend kiểm tra order vẫn `HELD` và chưa hết hạn.
3. Backend tạo `payments` mới trạng thái `PENDING` cho cùng order; giữ nguyên hold inventory.
4. Backend trả checkout URL mới.
5. Một order có thể có nhiều payment attempts; chỉ một `SUCCEEDED` là hợp lệ.

Ràng buộc: không cho retry nếu order `CONFIRMED`, `CANCELLED`, hoặc `EXPIRED`.

## 5. Kịch bản lỗi

- Idempotency key trùng: trả response cũ hoặc trạng thái đang xử lý từ Redis.
- Order hết hạn trước webhook success: không phát hành vé nếu hold đã release; cần đối soát/refund thủ công tùy provider.
- User đóng trình duyệt: order tự hết hạn theo worker.
- Payment provider fail: giữ order đến TTL hoặc fail-fast tùy circuit breaker.

## 6. Ràng buộc nghiệp vụ và kỹ thuật

- Order `HELD` phải có `hold_expires_at`.
- Order amount phải bằng tổng `order_items.line_total`.
- Không tạo payment nếu hold vé thất bại.
- Không phát hành ticket khi payment chưa `SUCCEEDED` hoặc order chưa `CONFIRMED`.
- Order status MVP chỉ gồm `HELD`, `CONFIRMED`, `CANCELLED`, `EXPIRED`.
- Payment status là nguồn chính cho trạng thái thanh toán.

## 7. Tiêu chí chấp nhận

- Checkout hợp lệ tạo order held và payment URL.
- Order hết hạn release vé và quota user.
- Payment success chuyển order `CONFIRMED` và phát hành ticket.
- Checkout retry không tạo đơn trùng.
- ReturnUrl không cập nhật order status; backend chỉ tin IPN/Webhook đã verify.
- Payment retry tạo payment attempt mới mà không ảnh hưởng hold inventory.
