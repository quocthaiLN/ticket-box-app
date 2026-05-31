# Đặc tả: Notification

## 1. Mô tả

Đặc tả gửi thông báo bất đồng bộ qua app/email/SMS/Zalo OA sau các sự kiện như thanh toán thành công, phát hành vé hoặc nhắc lịch trước concert.

## 2. Actor / Thành phần tham gia

- Notification Worker
- Ticketing Module
- Payment Module
- Message Broker
- Provider Email/App/SMS/Zalo
- PostgreSQL

## 3. Bảng dữ liệu liên quan

- `notifications`
- `tickets`
- `orders`
- `concerts`
- `users`

## 4. Luồng chính

1. Khi order thanh toán thành công, Ticketing Module publish event `TicketPurchasedSuccess`.
2. Notification Worker consume event và xác định channel cần gửi.
3. Worker render nội dung từ payload/template trong code/config.
4. Worker tạo `notifications` trạng thái `PENDING`.
5. Worker gọi provider tương ứng: app push, email, SMS hoặc Zalo OA.
6. Nếu gửi thành công, cập nhật `notifications.status = SENT`, `sent_at`, tăng `attempts`.
7. Cron job trước concert 24 giờ tạo notification reminder cho user có ticket hợp lệ.
8. Nếu gửi thất bại, worker tăng `attempts`, chuyển `RETRYING` hoặc `FAILED` sau số lần retry tối đa.

## 5. Kịch bản lỗi

- Provider timeout/5xx: retry exponential backoff.
- Provider trả lỗi validation destination: chuyển `FAILED` và ghi `error_message`.
- Thiếu template/config render: ghi `FAILED`, không gửi nội dung trống.
- Trùng event message broker: consumer phải idempotent theo business key, ví dụ ticket + channel + type.
- User không có email/thiết bị app: bỏ channel không khả dụng và ghi log.

## 6. Ràng buộc nghiệp vụ và kỹ thuật

- Gửi notification không được làm rollback order/payment/ticket.
- Mỗi lần gửi hoặc lịch gửi phải có bản ghi `notifications`.
- Retry phải có giới hạn và ghi `attempts`, `next_attempt_at`, `error_message`.
- Dữ liệu cá nhân trong log phải hạn chế vừa đủ để debug.

## 7. Tiêu chí chấp nhận

- Thanh toán thành công vẫn phát hành vé dù email/push lỗi.
- Notification thành công có `status = SENT` và `sent_at`.
- Notification lỗi có `status = FAILED` hoặc `RETRYING` và lý do lỗi.
- Event trùng không gửi nhiều notification ngoài ý muốn.
