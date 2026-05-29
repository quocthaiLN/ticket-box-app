# Đặc tả: E-ticket QR

## 1. Mô tả

Đặc tả phát hành e-ticket QR sau khi thanh toán thành công và dữ liệu cần có trong QR để check-in online/offline.

QR phải đủ dữ liệu để mobile app xác thực cục bộ khi offline, bao gồm concert và khu vực vé để kiểm tra đúng cổng/khu.

## 2. Actor / Thành phần tham gia

- Khán giả
- Ticketing Module
- Payment Module
- Notification Module
- Mobile Check-in App
- PostgreSQL

## 3. Bảng dữ liệu liên quan

- `tickets`
- `ticket_types`
- `seat_zones`
- `orders`
- `payments`
- `notification_logs`

## 4. Luồng chính

1. Payment webhook hợp lệ cập nhật `payments.status = SUCCEEDED`.
2. Order chuyển sang `PAID`.
3. Ticketing Module phát hành mỗi vé thành một bản ghi `tickets`.
4. Mỗi ticket có `qr_token` unique và `qr_signature`.
5. QR payload hoặc dữ liệu resolve cục bộ phải chứa tối thiểu:
   - `ticket_id`
   - `concert_id`
   - `ticket_type_id`
   - `seat_zone_id`
   - `issued_at`
   - `qr_token`
6. Notification Module gửi email/app notification chứa e-ticket.
7. Mobile app khi offline dùng QR payload/signature và preload data để kiểm tra đúng concert, đúng gate-zone và chống quét trùng local.

## 5. Kịch bản lỗi

- Order chưa `PAID`: không phát hành ticket.
- QR token trùng: database unique constraint chặn.
- Không gửi được email: ticket vẫn nằm trong tài khoản, notification retry/DLQ xử lý sau.
- QR bị chỉnh sửa: verify signature thất bại, check-in trả `INVALID_TICKET`.

## 6. Ràng buộc nghiệp vụ và kỹ thuật

- `qr_token` phải unique.
- `qr_signature` phải được tạo từ payload đã chuẩn hóa.
- Payload phải bao gồm `seat_zone_id` hoặc app phải resolve được `seat_zone_id` từ local preload.
- Không lưu dữ liệu nhạy cảm không cần thiết trong QR.
- Ticket `CANCELLED`/`REFUNDED` không được check-in.

## 7. Tiêu chí chấp nhận

- Payment success tạo đúng số lượng ticket.
- Mỗi ticket có QR riêng.
- QR verify được khi offline.
- QR chứa hoặc resolve được `seat_zone_id` để chặn sai cổng/khu.
- QR bị sửa hoặc dùng lại bị từ chối.
