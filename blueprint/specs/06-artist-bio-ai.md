# Đặc tả: AI Artist Bio

## 1. Mô tả

Đặc tả xử lý PDF/Press Kit bất đồng bộ để sinh Artist Bio bằng AI. Kết quả lưu trong `artist_bio_jobs.generated_bio` và được publish vào `concerts.artist_bio`.

## 2. Actor / Thành phần tham gia

- Admin/Organizer
- Catalog Module
- AI Worker
- Object Storage
- AI Model API
- PostgreSQL

## 3. Bảng dữ liệu liên quan

- `artist_bio_jobs`
- `concerts`
- `audit_logs`

## 4. Luồng chính

1. Admin/Organizer upload PDF/Press Kit cho một concert.
2. Backend validate file type, file size và quyền organizer/admin.
3. Backend lưu file vào object storage, tạo `artist_bio_jobs` trạng thái `PENDING`.
4. Worker lấy job, chuyển sang `PROCESSING`, tải file và trích xuất text.
5. Worker làm sạch text, cắt/chuẩn hóa nội dung theo giới hạn token.
6. Worker gọi AI Model API với prompt chuẩn để sinh bio ngắn gọn.
7. Nếu thành công, worker cập nhật `artist_bio_jobs.generated_bio`, `status = DONE`, `completed_at`.
8. Worker hoặc Admin publish kết quả vào `concerts.artist_bio`; cache concert detail bị invalidate.
9. Nếu lỗi, worker cập nhật job `FAILED` và `error_message`.

## 5. Kịch bản lỗi

- File sai định dạng/quá lớn: reject trước khi tạo job.
- PDF không extract được text: job `FAILED`, admin có thể upload lại.
- AI API timeout/rate limit: retry theo queue policy; hết retry thì job `FAILED`.
- Bio sinh ra rỗng/không đạt policy: job `FAILED` hoặc yêu cầu admin chỉnh tay.

## 6. Ràng buộc nghiệp vụ và kỹ thuật

- `concerts.artist_bio` là nguồn hiển thị public trong MVP.
- AI xử lý bất đồng bộ, không chặn request tạo/cập nhật concert.
- File gốc lưu object storage, DB chỉ lưu URL/metadata.
- Worker lỗi không ảnh hưởng luồng mua vé/check-in.
- Publish hoặc chỉnh sửa bio phải ghi audit.

## 7. Tiêu chí chấp nhận

- Upload tạo job `PENDING`.
- Worker thành công tạo `generated_bio`.
- Publish cập nhật `concerts.artist_bio`.
- AI lỗi được ghi rõ, admin có thể retry hoặc nhập tay.
