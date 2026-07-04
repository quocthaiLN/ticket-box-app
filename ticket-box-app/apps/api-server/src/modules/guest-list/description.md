# Guest List Module

## Vai trò
Nhập khách mời VIP từ CSV trên Google Drive (tự động lúc 0h giờ VN) và tra cứu / check-in guest tại cổng VIP.

## Luồng
- BTC bỏ file CSV vào thư mục Drive riêng của concert (`Concert.guestDriveFolderId`); folder id được gán cho concert qua API update concert (xem mục API).
- Scheduler `nightly-guest-import` (worker-server) chạy 0h `Asia/Ho_Chi_Minh` → quét Drive → tạo `GuestImportJob` → worker tải file, validate, upsert.
- Khử trùng theo `(concertId, email)`; gán toàn bộ guest vào zone VIP của concert; file giữ lại trên Drive cho audit.

## API
- `POST /organizer/concerts/:concert_id` (ORGANIZER, concert `DRAFT`) hoặc `PATCH /admin/concerts/:concert_id` (ADMIN) — gán `guest_drive_folder_id` (full URL Drive hoặc ID thuần) cho concert.
- `POST /admin/concerts/:concert_id/guest-import-jobs` (ADMIN) — chạy nhập thủ công 1 concert (enqueue job quét Drive).
- `GET /admin/guest-import-jobs/:job_id` (ADMIN) — trạng thái job.
- `GET /admin/guest-import-jobs/:job_id/errors` (ADMIN) — lỗi từng dòng (phân trang cursor).
- `GET /admin/concerts/:concert_id/guests` (ORGANIZER/ADMIN), `GET /check-in/guests/search` (CHECKER) — tra cứu theo email/phone/tên.
- `POST /check-in/guests/scans` (CHECKER) — check-in guest tại cổng.

## Quy tắc giữ
- Guest có `seat_zone_id` null không được qua cổng mặc định.
- Check-in trùng → `ALREADY_CHECKED_IN`; sai cổng → `WRONG_GATE` (không cập nhật row).
- Dòng CSV thiếu `email` → ghi lỗi `EMAIL_REQUIRED`, bỏ qua dòng đó (không fail cả file).
