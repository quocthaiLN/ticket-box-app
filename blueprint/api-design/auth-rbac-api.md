# TicketBox — Auth & RBAC API Design

Tài liệu này thiết kế API cho xác thực, JWT stateless, Redis denylist và phân quyền theo role đơn của user. Quy ước chung nằm ở `blueprint/api-design/base-api.md`.

Nguồn nghiệp vụ chính:

- `blueprint/specs/08-auth-rbac.md`
- `blueprint/database-design.md`

---

## 1. Mục tiêu

- Cho phép user đăng ký/đăng nhập và nhận JWT chứa `user_id` cùng `role`.
- API Gateway xác thực JWT nhanh, backend module tiếp tục kiểm tra ownership.
- Admin quản lý role bằng cột `users.role`; MVP không dùng RBAC động nhiều bảng.
- Logout/ban token dùng Redis denylist để khắc phục giới hạn revoke của JWT stateless.
- Mọi thay đổi quyền hoặc trạng thái tài khoản phải ghi `audit_logs`.

---

## 2. Resource và mapping database

| Resource    | Bảng         | Vai trò                                                                 |
| ----------- | ------------ | ----------------------------------------------------------------------- |
| `user`      | `users`      | Tài khoản khán giả, organizer, checker, admin; chứa `role` và `status`. |
| `audit_log` | `audit_logs` | Audit thay đổi role, khóa/mở tài khoản, tạo user nội bộ.                |

Role hợp lệ: `AUDIENCE`, `ORGANIZER`, `CHECKER`, `ADMIN`.

---

## 3. Endpoint tổng hợp

| Method  | Endpoint                        | Auth          | Mục đích                                   |
| ------- | ------------------------------- | ------------- | ------------------------------------------ |
| `POST`  | `/auth/register`                | Public        | Đăng ký tài khoản khán giả.                |
| `POST`  | `/auth/login`                   | Public        | Đăng nhập, phát access/refresh token.      |
| `POST`  | `/auth/logout`                  | User          | Thu hồi token hiện tại qua Redis denylist. |
| `POST`  | `/auth/refresh`                 | Refresh token | Cấp access token mới.                      |
| `GET`   | `/auth/me`                      | User          | Lấy thông tin user hiện tại và role.       |
| `GET`   | `/auth/admin/users`                  | `ADMIN`       | Tra cứu user.                              |
| `POST`  | `/auth/admin/users`                  | `ADMIN`       | Tạo user nội bộ.                           |
| `PATCH` | `/auth/admin/users/{user_id}/status` | `ADMIN`       | Khóa/mở/disable user.                      |
| `PATCH` | `/auth/admin/users/{user_id}/role`   | `ADMIN`       | Gán role chính cho user.                   |

---

> **Sprint 6 — endpoint bổ sung/đổi** (chi tiết ở §4):
>
> - `POST /auth/otp/request` (Public) — gửi OTP trước khi register.
> - `PATCH /auth/me` (`requireAuth`) — user tự sửa `full_name`/`phone`.
> - `PATCH /auth/admin/users/role-by-email` (`ADMIN`) — đổi role theo email; khai báo **trước** `/auth/admin/users/{user_id}/role`.
> - `POST /auth/login` trả thêm `redirect_to`; `POST /auth/register` nhận thêm `full_name`.

## 4. API chi tiết

### 4.0. `POST /auth/otp/request`

Gửi OTP 6 chữ số tới email để chuẩn bị đăng ký.

```json
{
  "email": "audience@example.com"
}
```

Response `200`: `{ "data": { "email": "audience@example.com", "expires_in": 300 }, "meta": { "request_id": "req_01JX9Q6N4E" } }`.

- OTP lưu Redis với TTL ngắn (vd 5 phút); không trả mã OTP trong response.
- Rate limit theo IP + email để chống spam.

### 4.1. `POST /auth/register`

Tạo tài khoản khán giả. Yêu cầu OTP đã nhận ở `POST /auth/otp/request`.

```json
{
  "email": "audience@example.com",
  "password": "StrongPassword123!",
  "confirmPassword": "StrongPassword123!",
  "full_name": "Nguyen Van A",
  "otp": "123456"
}
```

Response `201`:

```json
{
  "data": {
    "id": "usr_01JX9Q8B",
    "email": "audience@example.com",
    "role": "AUDIENCE",
    "status": "ACTIVE"
  },
  "meta": {
    "request_id": "req_01JX9Q6N4E"
  }
}
```

Ràng buộc:

- `email` unique và đúng format.
- Password không lưu plaintext; backend chỉ lưu `password_hash`.
- Role mặc định là `AUDIENCE`.

### 4.2. `POST /auth/login`

Đăng nhập bằng email/password.

```json
{
  "email": "audience@example.com",
  "password": "StrongPassword123!"
}
```

Response `200`:

```json
{
  "data": {
    "access_token": "jwt-access-token",
    "expires_in": 900,
    "user": {
      "id": "usr_01JX9Q8B",
      "email": "audience@example.com",
      "full_name": "Nguyen Van A",
      "role": "AUDIENCE"
    },
    "redirect_to": "/"
  },
  "meta": {
    "request_id": "req_01JX9Q6N4E"
  }
}
```

Ràng buộc:

- Nếu password sai, trả `401 INVALID_CREDENTIALS` và không tiết lộ email có tồn tại hay không.
- `LOCKED` hoặc `DISABLED` không được đăng nhập.
- JWT chứa `sub`, `role`, `iat`, `exp`, `jti`.
- Refresh token lưu trong cookie.
- **MỚI:** response trả thêm `redirect_to` theo role để client điều hướng đúng workspace.

| `user.role` | `redirect_to` |
| --- | --- |
| `AUDIENCE` | `/` |
| `ADMIN` | `/admin` |
| `ORGANIZER` | `/organizer` |
| `CHECKER` | `/checker` |

### 4.3. `POST /auth/logout`

Thu hồi token hiện tại.

Response `204 No Content`.

Backend lưu `jti` vào Redis denylist với TTL bằng thời gian sống còn lại của token.

### 4.4. `GET /auth/me`

Response `200`:

```json
{
  "data": {
    "id": "usr_01JX9Q8B",
    "email": "audience@example.com",
    "full_name": "Nguyen Van A",
    "phone": "+84901234567",
    "status": "ACTIVE",
    "role": "AUDIENCE"
  },
  "meta": {
    "request_id": "req_01JX9Q6N4E"
  }
}
```

### 4.5. `PATCH /auth/me`

User tự cập nhật hồ sơ cá nhân (`requireAuth`, mọi role đã đăng nhập). Body optional: `full_name?` (min 1), `phone?` (min 8).

```json
{ "full_name": "Nguyen Van An", "phone": "+84901234789" }
```

Response `200` trả `id`, `full_name`, `phone`, `updated_at`. Không cho sửa `email`, `role`, `status` qua endpoint này.

### 4.6. `PATCH /auth/admin/users/role-by-email`

Đổi role của user theo email (tiện cấp quyền `ORGANIZER`/`CHECKER` mà không cần tra `user_id`). Khai báo **trước** `/auth/admin/users/{user_id}/role` để Express không bắt nhầm `role-by-email` thành `{user_id}`.

```json
{ "email": "btc@example.com", "role": "ORGANIZER" }
```

Response `200`:

```json
{
  "data": {
    "user_id": "usr_01JX9Q9C",
    "email": "btc@example.com",
    "role": "ORGANIZER",
    "updated_at": "2026-05-30T10:25:30Z"
  },
  "meta": { "request_id": "req_01JX9Q6N4E" }
}
```

- `role ∈ {AUDIENCE, ORGANIZER, CHECKER, ADMIN}`.
- Email không tồn tại → `404 USER_NOT_FOUND_BY_EMAIL`.
- Ghi audit log `UPDATE_USER_ROLE` (tái dùng pattern của `{user_id}/role`).

### 4.7. `PATCH /auth/admin/users/{user_id}/role`

Gán role chính của user.

```json
{
  "role": "CHECKER"
}
```

Response `200`:

```json
{
  "data": {
    "user_id": "usr_01JX9Q8B",
    "role": "CHECKER",
    "updated_at": "2026-05-30T10:15:30Z"
  },
  "meta": {
    "request_id": "req_01JX9Q6N4E"
  }
}
```

Side effects:

- Ghi audit log `UPDATE_USER_ROLE`.
- Có thể denylist token hiện tại nếu triển khai cần revoke ngay.

---

## 5. Error catalog

| HTTP  | Code                   | Khi nào xảy ra                     |
| ----- | ---------------------- | ---------------------------------- |
| `400` | `INVALID_EMAIL`        | Email sai format.                  |
| `400` | `WEAK_PASSWORD`        | Password không đạt policy.         |
| `401` | `INVALID_CREDENTIALS`  | Sai email/password.                |
| `401` | `TOKEN_EXPIRED`        | JWT hết hạn.                       |
| `401` | `TOKEN_REVOKED`        | JWT nằm trong Redis denylist.      |
| `403` | `FORBIDDEN`            | Không đủ role.                     |
| `409` | `EMAIL_ALREADY_EXISTS` | Email đã được dùng.                |
| `409` | `PHONE_ALREADY_EXISTS` | Phone đã được dùng.                |
| `422` | `INVALID_ROLE`         | Role không thuộc danh sách hợp lệ. |
| `404` | `USER_NOT_FOUND_BY_EMAIL` | Email không tồn tại (role-by-email). |
| `422` | `INVALID_OTP` | OTP sai hoặc hết hạn. |

---

## 6. Acceptance criteria

- AUDIENCE không truy cập được admin API.
- CHECKER không tạo/sửa concert được.
- ORGANIZER/Admin thao tác dữ liệu được backend kiểm tra ownership.
- Logout làm token hiện tại không dùng lại được.
- Thay đổi role/status user được ghi audit.
- Login mỗi role trả `redirect_to` đúng (`/`, `/admin`, `/organizer`, `/checker`).
- `PATCH /auth/admin/users/role-by-email {email, role:"ORGANIZER"}` → 200; user đó login lại → `redirect_to:"/organizer"`; email không tồn tại → 404 `USER_NOT_FOUND_BY_EMAIL`.
- `PATCH /auth/me` đổi `full_name`/`phone` → `GET /auth/me` phản ánh thay đổi; không sửa được role/status.
