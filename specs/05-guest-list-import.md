# Đặc tả: Guest List Import từ CSV

## 1. Mô tả

Đặc tả import danh sách khách mời VIP từ file CSV/Google Sheet export, xử lý lỗi từng dòng và chống trùng theo concert + phone.

## 2. Actor / Thành phần tham gia

- Ban tổ chức
- CSV Sync Worker
- Guest List Module
- PostgreSQL
- Object Storage

## 3. Bảng dữ liệu liên quan

- `guest_import_jobs`
- `guest_import_errors`
- `guest_list`
- `concerts`
- `seat_zones`

## 4. Luồng chính

1. Admin upload file CSV hoặc worker lấy file từ nguồn đã cấu hình.
2. Backend lưu file vào object storage và tạo `guest_import_jobs` trạng thái `PENDING`.
3. Worker chuyển job sang `PROCESSING` và đọc từng dòng CSV.
4. Worker validate các trường bắt buộc: `full_name`, `phone`, `concert_id`, `zone` nếu có.
5. Dòng lỗi được ghi vào `guest_import_errors`, không làm fail toàn bộ job.
6. Dòng hợp lệ được normalize phone và map zone sang `seat_zone_id`.
7. Worker upsert vào `guest_list` theo unique `(concert_id, phone)`.
8. Sau khi xử lý xong, cập nhật `total_rows`, `success_rows`, `error_rows`, trạng thái `DONE` hoặc `PARTIAL`.

## 5. Kịch bản lỗi

- File sai định dạng: job `FAILED`, ghi `error_message`.
- Dòng thiếu phone/name: ghi lỗi dòng, bỏ qua dòng đó.
- Phone trùng trong cùng concert: update bản ghi mới nhất, không tạo duplicate.
- Zone không tồn tại: ghi lỗi dòng.
- Worker crash giữa chừng: job giữ trạng thái `PROCESSING`; retry dựa trên job id và upsert idempotent.

## 6. Ràng buộc nghiệp vụ và kỹ thuật

- `guest_list(concert_id, phone)` phải unique.
- Không rollback toàn bộ file chỉ vì một dòng lỗi.
- Không gọi API hệ thống nhãn hàng; chỉ xử lý CSV/một chiều.
- Mọi lỗi dòng phải có `row_number` và `raw_data` nếu có thể.
- Guest import không được ảnh hưởng luồng mua vé.

## 7. Tiêu chí chấp nhận

- Import file có dòng lỗi vẫn lưu các dòng hợp lệ.
- Import lại cùng phone không tạo bản ghi trùng.
- Admin xem được số dòng thành công/lỗi.
- Nhân sự soát vé có thể tra cứu guest sau import.
