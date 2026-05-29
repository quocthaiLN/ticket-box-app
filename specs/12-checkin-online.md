# Đặc tả: Online Check-in

## 1. Mô tả

Đặc tả quét QR khi có mạng, xác thực vé theo server và ghi log mọi lần quét.

Điểm bắt buộc: server phải kiểm tra **đúng concert và đúng cổng/khu vực**. Vé thuộc khu `SVIP`, `VIP`, `CAT1`, `CAT2`, `GA` chỉ được check-in tại cổng có mapping tương ứng trong `checkin_gate_zones`.

## 2. Actor / Thành phần tham gia

- Nhân sự soát vé
- Mobile App
- Check-in Module
- PostgreSQL
- `checkin_devices`
- `checkin_gates`
- `checkin_gate_zones`

## 3. Bảng dữ liệu liên quan

- `tickets`
- `seat_zones`
- `checkin_logs`
- `checkin_devices`
- `checkin_gates`
- `checkin_gate_zones`
- `concerts`
- `users`

## 4. Luồng chính

1. Checker đăng nhập mobile app và chọn concert/gate hoặc app lấy gate mặc định từ `checkin_devices.gate_id`.
2. App quét QR và gửi `qr_token`, `device_id`, `gate_id` lên server.
3. Server kiểm tra device tồn tại, `status = ACTIVE`, staff có quyền check-in.
4. Server kiểm tra `checkin_devices.concert_id` trùng concert đang check-in.
5. Server kiểm tra `checkin_devices.gate_id` hoặc `gate_id` request thuộc `checkin_gates` của concert và `is_active = TRUE`.
6. Server tìm ticket theo `qr_token` và verify `qr_signature` nếu có.
7. Server kiểm tra ticket đúng concert và `status = ISSUED`.
8. Server lấy `tickets.seat_zone_id` và kiểm tra có tồn tại trong `checkin_gate_zones` của `gate_id`.
9. Nếu đúng gate-zone, server cập nhật ticket thành `CHECKED_IN`, set `checked_in_at`, `checked_in_by` trong transaction.
10. Server ghi `checkin_logs` với `result = SUCCESS`, `gate_id`, `device_id`, `seat_zone_id`.
11. App hiển thị kết quả cho checker.

## 5. Kịch bản lỗi

- QR không tồn tại/sai signature: log `INVALID_TICKET`.
- Ticket đã check-in: log `ALREADY_CHECKED_IN`, không update ticket.
- Ticket sai concert: log `WRONG_CONCERT`.
- Ticket đúng concert nhưng sai cổng/khu: log `WRONG_GATE`, không update ticket.
- Device revoked/lost: từ chối request.
- Gate inactive hoặc gate không thuộc concert: từ chối request.
- Database lock conflict khi 2 cổng quét cùng ticket: một success, một already checked-in/conflict.

## 6. Ràng buộc nghiệp vụ và kỹ thuật

- Update ticket và ghi log phải cùng transaction hoặc có cơ chế đảm bảo không mất log.
- Mọi lần quét phải lưu log, kể cả thất bại.
- Check-in endpoint chỉ cho `CHECKIN_STAFF` hoặc `ADMIN`.
- Không cho check-in ticket `CANCELLED`/`REFUNDED`.
- Không cho check-in ticket có `seat_zone_id` không nằm trong danh sách zone của gate.
- `status = CHECKED_IN` thì `checked_in_at` bắt buộc khác null.

## 7. Tiêu chí chấp nhận

- Vé hợp lệ check-in thành công đúng một lần.
- Vé quét lại báo đã sử dụng.
- Vé sai concert hoặc giả bị từ chối.
- Vé đúng concert nhưng sai cổng/khu bị từ chối với `WRONG_GATE`.
- Log có đủ staff/device/gate/zone/time/result.
