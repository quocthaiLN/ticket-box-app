# Đặc tả: Guest Check-in

## 1. Mô tả

Đặc tả check-in khách mời VIP từ `guest_list`, bao gồm online và offline sync.

Khách mời cũng phải tuân thủ kiểm tra khu/cổng: guest thuộc `seat_zone_id` nào thì chỉ được check-in ở cổng được mapping với khu đó trong `checkin_gate_zones`.

## 2. Actor / Thành phần tham gia

- Nhân sự soát vé
- Mobile App
- Check-in Module
- PostgreSQL
- SQLite Local DB nếu offline

## 3. Bảng dữ liệu liên quan

- `guest_list`
- `seat_zones`
- `checkin_gates`
- `checkin_gate_zones`
- `checkin_devices`
- `checkin_logs`
- `offline_checkin_batches`
- `offline_checkin_items`

## 4. Luồng chính

1. Staff chọn cổng VIP/guest trên app hoặc app lấy `gate_id` từ thiết bị.
2. App tìm guest theo phone/name/QR guest nếu có.
3. Server hoặc local DB kiểm tra guest thuộc đúng `concert_id`.
4. Server hoặc local DB lấy `guest_list.seat_zone_id`.
5. Kiểm tra `guest_list.seat_zone_id` nằm trong `checkin_gate_zones` của `gate_id`.
6. Nếu hợp lệ và `status = INVITED`, cập nhật `guest_list.status = CHECKED_IN`, set `checked_in_at`, `checked_in_by`.
7. Ghi `checkin_logs` với `guest_id`, `gate_id`, `seat_zone_id`, `result = SUCCESS`.
8. Nếu offline, ghi item local và sync lên `offline_checkin_items` khi có mạng.

## 5. Kịch bản lỗi

- Guest không tồn tại: log `INVALID_TICKET` hoặc mã lỗi nghiệp vụ `GUEST_NOT_FOUND` trong `reason`.
- Guest đã check-in: log `ALREADY_CHECKED_IN`.
- Guest bị cancel: từ chối.
- Guest đúng concert nhưng sai cổng/khu: log hoặc item `WRONG_GATE`.
- Offline sync phát hiện guest đã được check-in trước đó: item `CONFLICT`.

## 6. Ràng buộc nghiệp vụ và kỹ thuật

- `guest_list(concert_id, phone)` unique để deduplicate khách mời.
- Guest có `seat_zone_id` thì phải check đúng gate-zone.
- Nếu `seat_zone_id` null, chỉ admin/organizer được cấu hình cổng fallback; mặc định không cho offline check-in để tránh lọt sai khu.
- Mọi lần check-in guest phải có log.
- Offline guest sync phải idempotent theo `batch_token` và guest id/phone.

## 7. Tiêu chí chấp nhận

- Guest hợp lệ vào đúng khu/cổng được check-in thành công.
- Guest sai khu/cổng bị từ chối `WRONG_GATE`.
- Guest trùng số điện thoại không tạo bản ghi mới khi import.
- Guest đã check-in không thể check-in lần hai.
- Offline guest check-in sync lại không mất dữ liệu và ghi rõ conflict.
