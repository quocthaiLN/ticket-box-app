# Đặc tả: Audit Logging

## 1. Mô tả

Đặc tả ghi log các thao tác quan trọng để truy vết lỗi, bảo mật và đối soát nghiệp vụ.

Trong MVP, audit nghiệp vụ tập trung ở `audit_logs`; check-in, guest import và payment webhook cũng có dữ liệu truy vết trong bảng nghiệp vụ tương ứng.

## 2. Actor / Thành phần tham gia

- Admin
- Organizer
- Checker
- Backend Modules
- PostgreSQL

## 3. Bảng dữ liệu liên quan

- `audit_logs`
- `checkin_logs`
- `guest_import_errors`
- `payments`
- `notifications`

## 4. Luồng chính

1. Backend xác định actor từ JWT hoặc system worker.
2. Khi thao tác quan trọng xảy ra, backend ghi `audit_logs` với action, entity type/id và metadata cần thiết.
3. Admin tạo/sửa/hủy concert, cấu hình vé, thay đổi role đều phải audit.
4. Inventory admin adjustment hoặc thao tác nghiệp vụ quan trọng ghi `audit_logs`; MVP không có bảng `ticket_inventory_events` riêng.
5. Payment webhook lưu raw payload cuối trong `payments.webhook_payload`, `webhook_received_at`, `webhook_signature_valid`.
6. Check-in ghi `checkin_logs` cho lượt scan online/sync offline quan trọng.
7. Import CSV lỗi từng dòng ghi `guest_import_errors`.

## 5. Kịch bản lỗi

- Không xác định actor: ghi actor null và metadata system/job id.
- Audit write fail: không được làm crash luồng lõi nếu action không thuộc nhóm bắt buộc; log lỗi hệ thống.
- Dữ liệu nhạy cảm: không ghi password/token thô vào metadata.
- Log quá lớn: chỉ ghi field thay đổi hoặc metadata cần thiết.

## 6. Ràng buộc nghiệp vụ và kỹ thuật

- Audit log phải immutable ở tầng ứng dụng.
- Không lưu secret/password/plain token.
- Log phải có thời điểm `created_at`.
- Các thao tác admin/security phải ưu tiên ghi audit.
- Index theo actor và entity để truy vấn nhanh.

## 7. Tiêu chí chấp nhận

- Có thể truy vết ai đã đổi cấu hình vé/concert.
- Có thể đối soát thao tác tồn kho quan trọng qua `audit_logs`.
- Có thể xem raw webhook cuối và trạng thái verify trong `payments`.
- Có thể tra lịch sử check-in và import CSV lỗi.