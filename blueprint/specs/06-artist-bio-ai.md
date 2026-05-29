# Đặc tả: AI Artist Bio

## 1. Mô tả

Đặc tả luồng upload PDF/Press Kit, xử lý bất đồng bộ bằng worker và lưu bio nghệ sĩ để hiển thị trong trang concert.

## 2. Actor / Thành phần tham gia

- Ban tổ chức
- Catalog/Admin Module
- AI Worker
- AI Model API
- Object Storage
- PostgreSQL

## 3. Bảng dữ liệu liên quan

- `artist_bio_jobs`
- `artist_bios`
- `concerts`
- `audit_logs`

## 4. Luồng chính

1. Admin upload PDF/Press Kit cho một concert.
2. Backend validate file type, file size và quyền organizer/admin.
3. Backend lưu file vào object storage, tạo `artist_bio_jobs` trạng thái `PENDING`.
4. Worker lấy job, chuyển sang `PROCESSING`, tải file và trích xuất text.
5. Worker làm sạch text, cắt/chuẩn hóa nội dung theo giới hạn token.
6. Worker gọi AI Model API với prompt chuẩn để sinh bio ngắn gọn.
7. Nếu thành công, worker tạo bản ghi `artist_bios`, đặt bio cũ inactive và bio mới active.
8. Worker cập nhật job `DONE`, `completed_at`; cache concert detail bị invalidate.
9. Nếu lỗi, worker cập nhật job `FAILED` và `error_message`.

## 5. Kịch bản lỗi

- File không phải PDF hoặc vượt kích thước: reject trước khi tạo job.
- PDF không đọc được text: job `FAILED`, concert vẫn hiển thị bio cũ/placeholder.
- AI API timeout/rate limit: retry có backoff; quá số lần retry thì job `FAILED`.
- Admin upload file mới khi job cũ đang chạy: tạo job mới; bio active chỉ đổi khi job mới thành công.
- Bio AI không đạt chất lượng: admin có thể tạo/sửa bio thủ công nếu backend hỗ trợ.

## 6. Ràng buộc nghiệp vụ và kỹ thuật

- Mỗi concert chỉ có một `artist_bios.is_active = TRUE`.
- AI xử lý bất đồng bộ, không chặn request tạo/cập nhật concert.
- File gốc lưu object storage, DB chỉ lưu URL/metadata.
- Job phải có trạng thái rõ ràng: PENDING, PROCESSING, DONE, FAILED.
- Không để lỗi AI làm gián đoạn mua vé hoặc xem concert.

## 7. Tiêu chí chấp nhận

- Upload hợp lệ tạo job `PENDING`.
- Worker thành công tạo bio active hiển thị ở chi tiết concert.
- Worker fail không làm mất bio cũ.
- Admin xem được trạng thái và lỗi job.
