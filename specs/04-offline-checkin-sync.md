# Đặc tả: Offline Check-in Sync

## 1. Mô tả

Đặc tả cơ chế mobile app soát vé khi mất mạng, lưu local và đồng bộ lại server khi kết nối phục hồi.

## 2. Actor / Thành phần tham gia

- Nhân sự soát vé
- Mobile App
- SQLite Local DB
- Check-in Module
- PostgreSQL

## 3. Bảng dữ liệu liên quan

- `checkin_devices`
- `offline_checkin_batches`
- `offline_checkin_items`
- `tickets`
- `checkin_logs`

## 4. Luồng chính

1. Trước sự kiện, thiết bị đăng ký vào `checkin_devices` và được gắn với staff/concert.
2. Khi còn mạng, app tải danh sách vé hợp lệ/guest list cần thiết về SQLite.
3. Khi mất mạng, app verify QR token/signature cục bộ và kiểm tra trùng trong SQLite.
4. Mỗi lượt quét offline được ghi local với `qr_token`, `local_scanned_at`, `device_id`.
5. Khi có mạng, app tạo `offline_checkin_batches` trên server và gửi danh sách item.
6. Server xử lý từng `offline_checkin_items` trong transaction.
7. Nếu ticket chưa check-in, server cập nhật `tickets.status = CHECKED_IN`, ghi `checkin_logs`, item `ACCEPTED`.
8. Nếu ticket đã check-in, server ghi item `CONFLICT` và vẫn lưu log để audit.
9. Sau batch, cập nhật `item_count`, `conflict_count`, `status = DONE`, `checkin_devices.last_sync_at`.

## 5. Kịch bản lỗi

- Thiết bị bị `REVOKED` hoặc `LOST`: từ chối sync batch.
- Batch token trùng: trả kết quả batch cũ, không xử lý lại.
- QR giả/sai chữ ký: item `INVALID`, không update ticket.
- Một vé được quét offline ở 2 cổng: batch xử lý sau bị `CONFLICT`.
- Sync bị ngắt giữa chừng: client retry bằng cùng `batch_token` để đảm bảo idempotent.

## 6. Ràng buộc nghiệp vụ và kỹ thuật

- Offline item phải có `qr_token` hoặc `guest_id`.
- Mỗi batch phải có `batch_token` unique.
- Server là nguồn quyết định cuối cùng khi có conflict.
- Mọi lần quét, kể cả conflict/invalid, phải ghi log hoặc item để audit.
- Thiết bị phải được cấp quyền theo concert trước khi sync.

## 7. Tiêu chí chấp nhận

- Mất mạng vẫn quét được vé đã tải trước.
- Khi mạng trở lại, batch sync không mất dữ liệu.
- Một vé không thể vào cổng hai lần trên server.
- Conflict được ghi rõ lý do trong `offline_checkin_items`.
