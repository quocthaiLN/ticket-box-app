# Đặc tả: E-ticket QR

## 1. Mô tả

Đặc tả phát hành vé điện tử sau thanh toán thành công, sinh QR token/signature và kiểm tra vé.

## 2. Actor / Thành phần tham gia

- Khán giả
- Ticketing Module
- Notification Module
- Check-in Module
- Mobile App

## 3. Bảng dữ liệu liên quan

- `tickets`
- `orders`
- `order_items`
- `ticket_types`
- `seat_zones`
- `checkin_logs`

## 4. Luồng chính

1. Payment success event được Ticketing Module xử lý.
2. Backend tạo đúng số lượng `tickets` theo từng `order_items.quantity`.
3. Mỗi ticket có `qr_token` unique và `qr_signature` để chống giả mạo.
4. Ticket gắn `user_id`, `concert_id`, `ticket_type_id`, `seat_zone_id`.
5. Ticket trạng thái ban đầu `ISSUED`.
6. Notification Module gửi email/app push chứa QR hoặc link xem vé.
7. Check-in Module verify QR token/signature khi quét.

## 5. Kịch bản lỗi

- Sinh QR trùng token: retry token mới, không commit nếu vẫn lỗi.
- Payment event trùng: kiểm tra order/tickets đã phát hành, không tạo thêm vé.
- Ticket bị refund/cancelled: QR không còn hợp lệ.
- QR signature sai: trả invalid ticket và ghi log.

## 6. Ràng buộc nghiệp vụ và kỹ thuật

- `tickets.qr_token` phải unique.
- Ticket chỉ phát hành cho order đã PAID.
- QR token không chứa dữ liệu nhạy cảm dạng plain text nếu không cần.
- Signature phải verify được offline nếu specs offline yêu cầu.
- Một ticket chỉ check-in thành công một lần.

## 7. Tiêu chí chấp nhận

- Payment success phát hành đúng số lượng vé.
- Mỗi vé có QR riêng.
- QR giả không qua verify.
- Ticket cancelled/refunded không check-in được.
