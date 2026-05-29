# Đặc tả: Audit Logging

## 1. Mô tả

Đặc tả ghi log các thao tác quan trọng để truy vết lỗi, bảo mật và đối soát nghiệp vụ.

## 2. Actor / Thành phần tham gia

- Admin
- Organizer
- Checker
- Backend Modules
- PostgreSQL

## 3. Bảng dữ liệu liên quan

- `audit_logs`
- `ticket_inventory_events`
- `payment_webhook_events`
- `checkin_logs`
- `guest_import_errors`

## 4. Luồng chính

1. Backend xác định actor từ JWT hoặc system worker.
2. Khi thao tác quan trọng xảy ra, backend ghi `audit_logs` với action, entity type/id, before/after data nếu có.
3. Admin tạo/sửa/hủy concert, cấu hình vé, thay đổi role đều phải audit.
4. Inventory thay đổi ghi `ticket_inventory_events` để audit số lượng.
5. Payment webhook ghi `payment_webhook_events` để audit provider.
6. Check-in ghi `checkin_logs` cho mọi lượt quét.
7. Import CSV lỗi từng dòng ghi `guest_import_errors`.

## 5. Kịch bản lỗi

- Không xác định actor: ghi actor null và metadata system/job id.
- Audit write fail: không được làm crash luồng lõi nếu action không thuộc nhóm bắt buộc; log lỗi hệ thống.
- Dữ liệu nhạy cảm: không ghi password/token thô vào before/after data.
- Log quá lớn: chỉ ghi field thay đổi hoặc metadata cần thiết.

## 6. Ràng buộc nghiệp vụ và kỹ thuật

- Audit log phải immutable ở tầng ứng dụng.
- Không lưu secret/password/plain token.
- Log phải có thời điểm `created_at`.
- Các thao tác admin/security phải ưu tiên ghi audit.
- Index theo actor và entity để truy vấn nhanh.

## 7. Tiêu chí chấp nhận

- Có thể truy vết ai đã đổi cấu hình vé/concert.
- Có thể đối soát thay đổi tồn kho.
- Có thể xem lịch sử webhook payment.
- Có thể tra lịch sử check-in và import CSV lỗi.
