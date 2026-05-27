# Đặc tả: Notification

## 1. Mô tả

Đặc tả gửi thông báo xác nhận mua vé, email/app push kèm e-ticket và nhắc nhở trước concert 24 giờ.

## 2. Actor / Thành phần tham gia

- Notification Worker
- Message Broker
- Email/App/SMS/Zalo Provider
- Khán giả
- PostgreSQL

## 3. Bảng dữ liệu liên quan

- `notification_templates`
- `notification_logs`
- `notification_dead_letters`
- `tickets`
- `concerts`
- `users`

## 4. Luồng chính

1. Khi order thanh toán thành công, Ticketing Module publish event `TicketPurchasedSuccess`.
2. Notification Worker consume event và chọn template theo channel.
3. Worker render nội dung từ template với dữ liệu user, concert, ticket.
4. Worker tạo `notification_logs` trạng thái `PENDING`.
5. Worker gọi provider tương ứng: app push, email, SMS hoặc Zalo OA.
6. Nếu gửi thành công, cập nhật `notification_logs.status = SENT`, `sent_at`, `provider_message_id`.
7. Cron job trước concert 24 giờ tạo notification reminder cho user có ticket hợp lệ.
8. Nếu gửi thất bại, worker tăng `retry_count`, chuyển `RETRYING` hoặc đẩy vào `notification_dead_letters` sau số lần retry tối đa.

## 5. Kịch bản lỗi

- Provider timeout/5xx: retry exponential backoff.
- Provider trả lỗi validation destination: chuyển FAILED hoặc DLQ tùy chính sách.
- Template inactive/thiếu template: log lỗi, không gửi nội dung trống.
- Trùng event message broker: consumer phải idempotent theo ticket + channel + template nếu cần.
- User không có email/thiết bị app: bỏ channel không khả dụng và ghi log.

## 6. Ràng buộc nghiệp vụ và kỹ thuật

- Không gửi notification đồng bộ trong request payment success.
- Mỗi lần gửi phải có log trạng thái.
- DLQ giữ payload lỗi để xử lý lại thủ công.
- Channel mở rộng không được yêu cầu sửa luồng order/payment.
- Reminder chỉ gửi cho ticket còn hiệu lực.

## 7. Tiêu chí chấp nhận

- Payment success tạo notification xác nhận.
- Email/app push lỗi không rollback order/ticket.
- Retry và DLQ hoạt động khi provider lỗi.
- Reminder trước 24 giờ được tạo đúng nhóm user có vé.
