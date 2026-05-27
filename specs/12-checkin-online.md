# Đặc tả: Online Check-in

## 1. Mô tả

Đặc tả quét QR khi có mạng, xác thực vé theo server và ghi log mọi lần quét.

## 2. Actor / Thành phần tham gia

- Nhân sự soát vé
- Mobile App
- Check-in Module
- PostgreSQL

## 3. Bảng dữ liệu liên quan

- `tickets`
- `checkin_logs`
- `checkin_devices`
- `concerts`
- `users`

## 4. Luồng chính

1. Checker đăng nhập mobile app và chọn concert/gate.
2. App quét QR và gửi `qr_token`, `device_id`, `gate_code` lên server.
3. Server kiểm tra device active và staff có quyền check-in.
4. Server tìm ticket theo `qr_token` và verify `qr_signature` nếu có.
5. Server kiểm tra ticket đúng concert và status `ISSUED`.
6. Server cập nhật ticket thành `CHECKED_IN`, set `checked_in_at`, `checked_in_by` trong transaction.
7. Server ghi `checkin_logs` result `SUCCESS`.
8. App hiển thị kết quả cho checker.

## 5. Kịch bản lỗi

- QR không tồn tại/sai signature: log `INVALID_TICKET`.
- Ticket đã check-in: log `ALREADY_CHECKED_IN`, không update ticket.
- Ticket sai concert: log `WRONG_CONCERT`.
- Device revoked/lost: từ chối request.
- Database lock conflict khi 2 cổng quét cùng ticket: một success, một already checked-in/conflict.

## 6. Ràng buộc nghiệp vụ và kỹ thuật

- Update ticket và ghi log phải cùng transaction hoặc có cơ chế đảm bảo không mất log.
- Mọi lần quét phải lưu log, kể cả thất bại.
- Check-in endpoint chỉ cho CHECKIN_STAFF/ADMIN.
- Không cho check-in ticket CANCELLED/REFUNDED.
- `status = CHECKED_IN` thì `checked_in_at` bắt buộc khác null.

## 7. Tiêu chí chấp nhận

- Vé hợp lệ check-in thành công đúng một lần.
- Vé quét lại báo đã sử dụng.
- Vé sai concert hoặc giả bị từ chối.
- Log có đủ staff/device/gate/time/result.
