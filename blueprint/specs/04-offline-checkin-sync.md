# Đặc tả: Offline Check-in Sync

## 1. Mô tả

Đặc tả cơ chế mobile app soát vé khi mất mạng, lưu local và đồng bộ lại server khi kết nối phục hồi.

Điểm bổ sung bắt buộc: **vé hoặc khách mời thuộc khu vực nào thì chỉ được check-in ở cổng được phép cho khu vực đó**. Ví dụ vé `SVIP` chỉ được qua cổng có mapping với zone `SVIP`; vé `CAT2` quét ở cổng `SVIP` phải bị từ chối với kết quả `WRONG_GATE`.

## 2. Actor / Thành phần tham gia

- Nhân sự soát vé
- Mobile App
- SQLite Local DB
- Check-in Module
- PostgreSQL
- `checkin_gates`
- `checkin_gate_zones`
- `checkin_devices`

## 3. Bảng dữ liệu liên quan

- `checkin_devices`
- `checkin_gates`
- `checkin_gate_zones`
- `offline_checkin_batches`
- `offline_checkin_items`
- `tickets`
- `seat_zones`
- `guest_list`
- `checkin_logs`

## 4. Luồng chính

1. Trước sự kiện, luồng admin duyệt hồ sơ organizer tạo các cổng check-in trong `checkin_gates` theo `gate_count`, ví dụ `GATE-1`, `GATE-2`.
2. Hệ thống/internal tooling cấu hình mapping trong `checkin_gate_zones`: cổng nào được nhận vé/guest của khu nào. Public admin API gate-zone write đã bỏ ở Sprint 6.
3. Thiết bị được provisioning vào `checkin_devices` bằng seed/internal tooling và gắn với `staff_id`, `concert_id`, `gate_id`. Public admin device API đã bỏ ở Sprint 6.
4. Khi còn mạng, app tải dữ liệu preload theo `device_id`/`gate_id`, gồm:
   - `concert_id`
   - `gate_id`
   - `allowed_seat_zone_ids`
   - danh sách vé hợp lệ hoặc QR token hash cần thiết
   - danh sách guest VIP hợp lệ nếu cổng có quyền xử lý guest
5. Khi mất mạng, app quét QR và verify `qr_signature` cục bộ.
6. App resolve QR ra `ticket_id`, `concert_id`, `seat_zone_id`, `status` từ local SQLite.
7. App kiểm tra `ticket.concert_id == current_concert_id`.
8. App kiểm tra `ticket.seat_zone_id IN allowed_seat_zone_ids`.
9. Nếu đúng khu và ticket chưa được quét trong local set, app cho qua cổng và ghi local item.
10. Nếu sai khu/cổng, app không cho qua, ghi local item với kết quả `WRONG_GATE`.
11. Khi có mạng, app tạo `offline_checkin_batches` trên server kèm `device_id`, `gate_id`, `batch_token`.
12. App gửi từng `offline_checkin_items`, gồm `qr_token`, `ticket_id` nếu có, `seat_zone_id`, `gate_id`, `local_scanned_at`, `sync_result` local.
13. Server xử lý từng item trong transaction:
    - verify device tồn tại và khớp `staff_id`, `concert_id`, `gate_id`;
    - verify gate thuộc concert;
    - verify ticket/guest thuộc concert;
    - verify `seat_zone_id` của ticket/guest nằm trong `checkin_gate_zones` của `gate_id`;
    - nếu hợp lệ và chưa check-in: cập nhật `tickets.status = CHECKED_IN` hoặc `guest_list.status = CHECKED_IN`;
    - ghi `checkin_logs`.
14. Sau batch, server cập nhật `item_count`, `conflict_count`, `status = DONE`, và heartbeat thiết bị như `checkin_devices.last_seen_at`.

## 5. Kịch bản lỗi

- Thiết bị không tồn tại hoặc không khớp staff/concert/gate: từ chối sync batch.
- Batch token trùng: trả kết quả batch cũ, không xử lý lại.
- QR giả/sai chữ ký: item `INVALID`, không update ticket.
- Vé đúng concert nhưng sai cổng/khu: item `WRONG_GATE`, không update ticket.
- Một vé được quét offline ở 2 cổng: batch xử lý sau bị `CONFLICT` nếu vé đã `CHECKED_IN`.
- Gate không active hoặc không thuộc concert của thiết bị: từ chối batch.
- Sync bị ngắt giữa chừng: client retry bằng cùng `batch_token` để đảm bảo idempotent.

## 6. Ràng buộc nghiệp vụ và kỹ thuật

- Offline item phải có `qr_token` hoặc `guest_id`.
- Mỗi batch phải có `batch_token` unique.
- `offline_checkin_batches.gate_id` phải là cổng đang vận hành của thiết bị.
- `offline_checkin_items.seat_zone_id` phải là khu của ticket/guest đã resolve từ local preload.
- App chỉ được cho qua nếu `seat_zone_id` nằm trong `allowed_seat_zone_ids` của gate hiện tại.
- Server là nguồn quyết định cuối cùng khi có conflict.
- Mọi lần quét, kể cả `WRONG_GATE`, `CONFLICT`, `INVALID`, phải ghi log hoặc item để audit.
- Thiết bị phải được cấp quyền theo concert và gate trước khi sync.
- `checkin_devices` vẫn là bảng runtime bắt buộc cho preload/scan/offline sync; phần bị bỏ ở Sprint 6 là route quản trị device công khai, không phải model/bảng.

## 7. Tiêu chí chấp nhận

- Mất mạng vẫn quét được vé đã tải trước.
- Vé đúng khu/cổng được cho qua ở offline mode.
- Vé sai khu/cổng bị từ chối với kết quả `WRONG_GATE`.
- Khi mạng trở lại, batch sync không mất dữ liệu.
- Một vé không thể vào cổng hai lần trên server.
- Conflict và wrong-gate được ghi rõ lý do trong `offline_checkin_items` và `checkin_logs`.
