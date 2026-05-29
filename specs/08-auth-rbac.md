# Đặc tả: Authentication & RBAC

## 1. Mô tả

Đặc tả đăng nhập, xác thực JWT và phân quyền theo vai trò CUSTOMER, ORGANIZER, CHECKIN_STAFF, ADMIN.

## 2. Actor / Thành phần tham gia

- Khán giả
- Ban tổ chức
- Nhân sự soát vé
- Admin
- API Gateway
- Backend Module

## 3. Bảng dữ liệu liên quan

- `users`
- `roles`
- `user_roles`
- `audit_logs`

## 4. Luồng chính

1. User đăng ký hoặc được admin tạo tài khoản.
2. Backend lưu `password_hash`, email/phone unique.
3. User đăng nhập bằng email/password, backend kiểm tra `users.status = ACTIVE`.
4. Backend phát JWT chứa `user_id` và role codes.
5. API Gateway kiểm tra JWT signature, expiration và route permission.
6. Backend module kiểm tra quyền chi tiết và ownership dữ liệu.
7. Admin gán/bỏ role qua `user_roles`, mọi thay đổi ghi `audit_logs`.
8. Mobile check-in chỉ cho role `CHECKIN_STAFF` hoặc `ADMIN` truy cập.

## 5. Kịch bản lỗi

- Sai password: trả 401, không tiết lộ tài khoản có tồn tại hay không.
- User LOCKED/DISABLED: từ chối đăng nhập.
- JWT hết hạn/sai chữ ký: trả 401.
- Không đủ role: trả 403.
- User có role đúng nhưng truy cập dữ liệu không sở hữu: trả 403.

## 6. Ràng buộc nghiệp vụ và kỹ thuật

- Role hợp lệ: CUSTOMER, ORGANIZER, CHECKIN_STAFF, ADMIN.
- Không hard-code quyền chỉ ở frontend; backend phải enforce.
- Admin endpoint bắt buộc có role ORGANIZER hoặc ADMIN tùy hành động.
- Check-in endpoint bắt buộc có role CHECKIN_STAFF hoặc ADMIN.
- Thay đổi quyền phải ghi audit.

## 7. Tiêu chí chấp nhận

- Customer không truy cập được admin API.
- Checker không tạo/sửa concert được.
- Organizer/Admin thao tác concert được audit.
- Mobile app từ chối tài khoản không có quyền check-in.
