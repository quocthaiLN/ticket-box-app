# Đặc tả: Guest VIP Check-in

## 1. Mô tả

Đặc tả xác nhận khách mời VIP từ guest list, bao gồm tra cứu theo tên/số điện thoại và chống check-in trùng.

## 2. Actor / Thành phần tham gia

- Nhân sự soát vé
- Mobile App
- Check-in Module
- Guest List Module

## 3. Bảng dữ liệu liên quan

- `guest_list`
- `checkin_logs`
- `offline_checkin_items`
- `checkin_devices`

## 4. Luồng chính

1. Checker mở tab Guest VIP trong mobile app.
2. App tra cứu guest theo phone hoặc full name trong dữ liệu local/server.
3. Checker chọn đúng guest và xác nhận check-in.
4. Server kiểm tra guest tồn tại, đúng concert, status `INVITED`.
5. Server cập nhật `guest_list.status = CHECKED_IN`, set `checked_in_at`, `checked_in_by`.
6. Server ghi log hoặc metadata check-in guest.
7. Nếu offline, app ghi local và sync qua `offline_checkin_items.guest_id` khi có mạng.

## 5. Kịch bản lỗi

- Guest không tồn tại: báo không tìm thấy.
- Guest đã checked-in: báo đã vào cổng, không update lại.
- Phone trùng do dữ liệu lỗi: DB unique `(concert_id, phone)` phải ngăn từ import.
- Offline sync guest đã checked-in trước đó: item `CONFLICT`.
- Device không được cấp quyền concert: từ chối check-in.

## 6. Ràng buộc nghiệp vụ và kỹ thuật

- `guest_list(concert_id, phone)` unique.
- Guest checked-in thì `checked_in_at` bắt buộc khác null.
- Guest check-in phải gắn staff nếu có mạng.
- Offline sync phải idempotent theo batch item.
- Không trộn guest list với paid ticket để tránh ảnh hưởng order/payment.

## 7. Tiêu chí chấp nhận

- Guest hợp lệ được check-in.
- Guest đã check-in không thể vào lần hai.
- Guest import mới được mobile tra cứu sau sync.
- Conflict offline được ghi rõ.
