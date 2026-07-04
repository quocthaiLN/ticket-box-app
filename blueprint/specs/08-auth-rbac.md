# Đặc tả: Authentication & RBAC

## 1. Mô tả

Đặc tả đăng nhập, xác thực JWT và phân quyền theo một role chính trên `users.role`: `AUDIENCE`, `ORGANIZER`, `CHECKER`, `ADMIN`. Mỗi route gắn **đúng một role**: `ADMIN` dùng `/admin/*`, `ORGANIZER` dùng `/organizer/*`, `CHECKER` dùng `/check-in/*`, `AUDIENCE` dùng `/orders*` và `/me/tickets*`; ngoại lệ cross-cutting `logout`/`me` chỉ cần đã đăng nhập.

## 2. Actor / Thành phần tham gia

- Khán giả
- Ban tổ chức
- Nhân sự soát vé
- Admin
- API Gateway
- Backend Module

## 3. Bảng dữ liệu liên quan

- `users`
- `audit_logs`

## 4. Luồng chính

1. User đăng ký (kèm OTP email) hoặc được admin tạo tài khoản.
2. Backend lưu `password_hash`, email/phone unique và `users.role`.
3. User đăng nhập bằng email/password, backend kiểm tra `users.status = ACTIVE`.
4. Backend phát JWT chứa `user_id` và `role`; response login kèm `redirect_to` theo role (`/`, `/admin`, `/organizer`, `/checker`).
5. API Gateway kiểm tra JWT signature, expiration và route permission.
6. Backend module kiểm tra quyền chi tiết và ownership dữ liệu.
7. Admin đổi `users.role` (theo `user_id` hoặc theo email) hoặc `users.status`, mọi thay đổi ghi `audit_logs`.
8. Mobile check-in chỉ cho role `CHECKER` truy cập.
9. User tự cập nhật hồ sơ cá nhân (`full_name`/`phone`) qua `PATCH /auth/me`; không tự đổi role/status.
10. `ORGANIZER` làm việc trong workspace `/organizer/*`: nộp hồ sơ xin tổ chức concert; khi `ADMIN` duyệt, hệ thống tự tạo concert `DRAFT` + seat zones + ticket types + gates + tài khoản `CHECKER`.
11. Khi concert chuyển `CANCELLED`/`COMPLETED`, các tài khoản `CHECKER` gắn concert tự chuyển `status = DISABLED`.

## 5. Kịch bản lỗi

- Sai password: trả 401, không tiết lộ tài khoản có tồn tại hay không.
- User LOCKED/DISABLED: từ chối đăng nhập.
- JWT hết hạn/sai chữ ký: trả 401.
- Không đủ role: trả 403.
- User có role đúng nhưng truy cập dữ liệu không sở hữu: trả 403.

## 6. Ràng buộc nghiệp vụ và kỹ thuật

- Role hợp lệ: `AUDIENCE`, `ORGANIZER`, `CHECKER`, `ADMIN`.
- Không hard-code quyền chỉ ở frontend; backend phải enforce.
- Mỗi route gắn đúng một role: `/admin/*` chỉ `ADMIN`, `/organizer/*` chỉ `ORGANIZER`, `/orders*` và `/me/tickets*` chỉ `AUDIENCE`.
- Check-in endpoint (`/check-in/*`) chỉ cho `CHECKER`; admin chỉ còn xem danh sách cổng.
- `ORGANIZER` không thao tác `/admin/*`; quản lý concert của mình qua `/organizer/*` và nộp hồ sơ để admin duyệt.
- Thay đổi quyền phải ghi audit.

## 7. Tiêu chí chấp nhận

- AUDIENCE không truy cập được admin API.
- CHECKER không tạo/sửa concert được.
- ORGANIZER thao tác concert của mình qua `/organizer/*`; ADMIN duyệt hồ sơ và quản trị; mọi thao tác được audit.
- Mobile app từ chối tài khoản không có quyền check-in.
- Login trả `redirect_to` đúng theo role; admin đổi role theo email hoạt động.
- Concert bị hủy/kết thúc thì checker của concert tự `DISABLED`.
