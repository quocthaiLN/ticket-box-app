# TicketBox — Auth API Design

Tài liệu này thiết kế API cho **Auth Module**: đăng ký (kèm OTP), đăng nhập JWT, refresh, logout, hồ sơ cá nhân và quản trị user (đổi role/status). Bản cập nhật theo đợt refactor role/route (sprint 6) bổ sung: `redirect_to` khi login, `PATCH /auth/me` cho user tự sửa hồ sơ, và `PATCH /auth/admin/users/role-by-email`.

Nguồn nghiệp vụ chính:

- `blueprint/specs/08-auth-rbac.md`
- `blueprint/api-design/base-api.md` (quy ước chung)
- `blueprint/api-design/rbac-route-map.md` (bản đồ route → role)
- `blueprint/database-design.md`

---

## 1. Mục tiêu

- Xác thực JWT stateless + Redis denylist cho token thu hồi (logout).
- Đăng ký yêu cầu OTP email để chống tạo tài khoản rác.
- Refresh token lưu trong cookie `httpOnly`, scope `path=/v1/auth`.
- Một role chính trên `users.role`: `AUDIENCE`, `ORGANIZER`, `CHECKER`, `ADMIN`.
- Sau login trả `redirect_to` để client điều hướng đúng workspace theo role.
- Mọi thay đổi role/status ghi `audit_logs`.

---

## 2. Base URL và chuẩn response

Mọi route auth nằm dưới tiền tố `/v1/auth`.

| Môi trường | Base URL |
| --- | --- |
| API Gateway | `https://api.ticketbox.vn/v1/auth` |
| Local | `http://localhost:3000/v1/auth` |

Response thành công dùng envelope `{ data, meta.request_id }`. Lỗi dùng RFC 7807 `application/problem+json` (xem `base-api.md` §1.7).

---

## 3. Resource và mapping database

| Resource | Bảng | Vai trò |
| --- | --- | --- |
| `user` | `users` | Tài khoản, `role`, `status`, `password_hash`, `full_name`, `phone`. |
| `audit_log` | `audit_logs` | Lưu vết đổi role/status. |
| OTP | Redis | Mã OTP đăng ký, TTL ngắn. |
| Token denylist | Redis | Access token bị thu hồi khi logout. |

Trường `users` phản ánh trong API: `id`, `email`, `full_name`, `phone`, `role`, `status` (`ACTIVE`/`LOCKED`/`DISABLED`), `created_at`. **Không bao giờ** trả `password_hash`.

---

## 4. RBAC

| Nhóm endpoint | Auth | Quyền |
| --- | --- | --- |
| OTP/register/login/refresh | Public | Không cần JWT. |
| logout / me / PATCH me | `requireAuth` | Mọi role đã đăng nhập (cross-cutting, không gắn `requireRole`). |
| admin users | `requireRole("ADMIN")` | Chỉ admin. |

---

## 5. Endpoint tổng hợp

### 5.1. Public

| Method | Endpoint | Mục đích |
| --- | --- | --- |
| `POST` | `/auth/otp/request` | Gửi OTP tới email đăng ký. |
| `POST` | `/auth/register` | Đăng ký tài khoản `AUDIENCE` (kèm OTP). |
| `POST` | `/auth/login` | Đăng nhập, trả access token + `redirect_to`. |
| `POST` | `/auth/refresh` | Cấp lại access token từ refresh cookie. |

### 5.2. Protected — `requireAuth`

| Method | Endpoint | Mục đích |
| --- | --- | --- |
| `POST` | `/auth/logout` | Đăng xuất, denylist access token. |
| `GET` | `/auth/me` | Hồ sơ user hiện tại. |
| `PATCH` | `/auth/me` | **MỚI** — user tự sửa `full_name`/`phone`. |

### 5.3. Admin — `requireRole("ADMIN")`

| Method | Endpoint | Mục đích |
| --- | --- | --- |
| `GET` | `/auth/admin/users` | List user (cursor pagination). |
| `PATCH` | `/auth/admin/users/role-by-email` | **MỚI** — đổi role theo email. |
| `PATCH` | `/auth/admin/users/:user_id/role` | Đổi role theo id. |
| `PATCH` | `/auth/admin/users/:user_id/status` | Đổi status. |

> **Thứ tự khai báo route quan trọng:** `role-by-email` phải đặt **trước** `:user_id/role` để Express không bắt nhầm `role-by-email` thành `:user_id`.

---

## 6. Public API chi tiết

### 6.1. `POST /auth/otp/request`

Gửi OTP 6 chữ số tới email để chuẩn bị đăng ký.

**Request**

```json
{
  "email": "audience@example.com"
}
```

**Response `200`**

```json
{
  "data": {
    "email": "audience@example.com",
    "expires_in": 300
  },
  "meta": {
    "request_id": "req_01JX9Q6N4E"
  }
}
```

**Ràng buộc**

- `email` hợp lệ, lowercase/trim.
- OTP lưu Redis với TTL ngắn (vd 5 phút); không trả mã OTP trong response.
- Rate limit theo IP + email để chống spam.

---

### 6.2. `POST /auth/register`

Đăng ký tài khoản `AUDIENCE`. Yêu cầu OTP đã nhận ở bước trên.

**Request**

```json
{
  "email": "audience@example.com",
  "password": "Str0ng@Pass",
  "confirmPassword": "Str0ng@Pass",
  "full_name": "Nguyen Van A",
  "otp": "123456"
}
```

**Response `201`**

```json
{
  "data": {
    "id": "usr_01JX9Q8B",
    "email": "audience@example.com",
    "full_name": "Nguyen Van A",
    "role": "AUDIENCE",
    "status": "ACTIVE",
    "created_at": "2026-05-30T10:15:30Z"
  },
  "meta": {
    "request_id": "req_01JX9Q6N4E"
  }
}
```

**Ràng buộc**

- `password` ≥ 8 ký tự, có chữ hoa, chữ thường, số và ký tự đặc biệt; `password === confirmPassword`.
- `otp` đúng 6 chữ số và khớp mã đã gửi cho email.
- `email` unique; trùng trả `409 EMAIL_ALREADY_EXISTS`.
- Role mặc định `AUDIENCE`, status `ACTIVE`.

---

### 6.3. `POST /auth/login`

Đăng nhập, phát access token (JWT) và set refresh token cookie.

**Request**

```json
{
  "email": "audience@example.com",
  "password": "Str0ng@Pass"
}
```

**Response `200`**

```json
{
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expires_in": 900,
    "user": {
      "id": "usr_01JX9Q8B",
      "email": "audience@example.com",
      "full_name": "Nguyen Van A",
      "role": "AUDIENCE",
      "status": "ACTIVE"
    },
    "redirect_to": "/"
  },
  "meta": {
    "request_id": "req_01JX9Q6N4E"
  }
}
```

**Set-Cookie**

```http
Set-Cookie: refresh_token=<token>; HttpOnly; Secure; SameSite=Strict; Path=/v1/auth; Max-Age=604800
```

**`redirect_to` theo role** — *MỚI*

| `user.role` | `redirect_to` |
| --- | --- |
| `AUDIENCE` | `/` |
| `ADMIN` | `/admin` |
| `ORGANIZER` | `/organizer` |
| `CHECKER` | `/checker` |
| (khác/không xác định) | `/` |

**Ràng buộc**

- Sai email hoặc password: `401 INVALID_CREDENTIALS`, **không** tiết lộ email có tồn tại hay không.
- `status = LOCKED` hoặc `DISABLED`: từ chối đăng nhập (`403`).
- Access token TTL ngắn (`expires_in` giây); refresh token sống 7 ngày trong cookie.

---

### 6.4. `POST /auth/refresh`

Cấp lại access token mới từ refresh cookie.

- Đọc cookie `refresh_token`; thiếu → `401 UNAUTHORIZED`.

**Response `200`**

```json
{
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expires_in": 900
  },
  "meta": {
    "request_id": "req_01JX9Q6N4E"
  }
}
```

---

## 7. Protected API chi tiết

### 7.1. `POST /auth/logout`

Thu hồi access token hiện tại (đưa vào Redis denylist) và xóa refresh cookie.

- Lấy token từ header `Authorization: Bearer <jwt>`.
- **Response `204 No Content`**, kèm `Set-Cookie` clear `refresh_token`.

---

### 7.2. `GET /auth/me`

Trả hồ sơ user hiện tại.

**Response `200`**

```json
{
  "data": {
    "id": "usr_01JX9Q8B",
    "email": "audience@example.com",
    "full_name": "Nguyen Van A",
    "phone": "+84901234789",
    "role": "AUDIENCE",
    "status": "ACTIVE",
    "created_at": "2026-05-30T10:15:30Z"
  },
  "meta": {
    "request_id": "req_01JX9Q6N4E"
  }
}
```

---

### 7.3. `PATCH /auth/me` — *MỚI*

User tự cập nhật hồ sơ cá nhân. Chỉ `requireAuth` (mọi role).

**Request** (các field optional, gửi field nào sửa field đó)

```json
{
  "full_name": "Nguyen Van An",
  "phone": "+84901234789"
}
```

**Response `200`**

```json
{
  "data": {
    "id": "usr_01JX9Q8B",
    "full_name": "Nguyen Van An",
    "phone": "+84901234789",
    "updated_at": "2026-05-30T10:20:30Z"
  },
  "meta": {
    "request_id": "req_01JX9Q6N4E"
  }
}
```

**Ràng buộc**

- `full_name`: optional, `min 1`.
- `phone`: optional, `min 8`.
- Không cho sửa `email`, `role`, `status` qua endpoint này.
- Schema: `updateMeSchema = { full_name?: string(min 1), phone?: string(min 8) }`.

---

## 8. Admin API chi tiết

### 8.1. `GET /auth/admin/users`

List user, cursor pagination.

**Query**

| Tên | Mặc định | Mô tả |
| --- | --- | --- |
| `limit` | `20` | Tối đa `100`. |
| `cursor` | — | Cursor trang tiếp theo (id user cuối). |

**Response `200`**

```json
{
  "data": [
    {
      "id": "usr_01JX9Q8B",
      "email": "audience@example.com",
      "full_name": "Nguyen Van A",
      "role": "AUDIENCE",
      "status": "ACTIVE",
      "created_at": "2026-05-30T10:15:30Z"
    }
  ],
  "pagination": {
    "next_cursor": null,
    "has_more": false,
    "limit": 20
  },
  "meta": {
    "request_id": "req_01JX9Q6N4E"
  }
}
```

---

### 8.2. `PATCH /auth/admin/users/role-by-email` — *MỚI*

Đổi role của user theo email (tiện cho admin cấp quyền `ORGANIZER`/`CHECKER` mà không cần tra `user_id`).

**Request**

```json
{
  "email": "btc@example.com",
  "role": "ORGANIZER"
}
```

**Response `200`**

```json
{
  "data": {
    "user_id": "usr_01JX9Q9C",
    "email": "btc@example.com",
    "role": "ORGANIZER",
    "updated_at": "2026-05-30T10:25:30Z"
  },
  "meta": {
    "request_id": "req_01JX9Q6N4E"
  }
}
```

**Ràng buộc**

- `role ∈ {AUDIENCE, ORGANIZER, CHECKER, ADMIN}`.
- Email không tồn tại → `404 USER_NOT_FOUND_BY_EMAIL`.
- Ghi `audit_logs` loại `UPDATE_USER_ROLE` (tái dùng pattern của `:user_id/role`).
- Route khai báo **trước** `:user_id/role`.
- Schema: `updateRoleByEmailSchema = { email: email, role: enum }`.

---

### 8.3. `PATCH /auth/admin/users/:user_id/role`

Đổi role theo id.

**Request**

```json
{ "role": "CHECKER" }
```

**Response `200`**

```json
{
  "data": {
    "user_id": "usr_01JX9Q8B",
    "role": "CHECKER",
    "updated_at": "2026-05-30T10:25:30Z"
  },
  "meta": { "request_id": "req_01JX9Q6N4E" }
}
```

- Role không hợp lệ → `422 INVALID_ROLE`.
- Ghi `audit_logs`.

---

### 8.4. `PATCH /auth/admin/users/:user_id/status`

Đổi status: `ACTIVE`, `LOCKED`, `DISABLED`.

**Request**

```json
{ "status": "LOCKED" }
```

**Response `200`**

```json
{
  "data": {
    "user_id": "usr_01JX9Q8B",
    "status": "LOCKED",
    "updated_at": "2026-05-30T10:25:30Z"
  },
  "meta": { "request_id": "req_01JX9Q6N4E" }
}
```

- Status ngoài enum → `422 VALIDATION_ERROR`.
- User `DISABLED` không đăng nhập được.
- Ghi `audit_logs`. Liên quan: khi concert kết thúc/hủy, checker account bị set `DISABLED` tự động (xem `organizer-admin-api.md`).

---

## 9. Error catalog

| HTTP | Code | Khi nào xảy ra |
| --- | --- | --- |
| `400` | `BAD_REQUEST` | Body/query sai định dạng. |
| `401` | `UNAUTHORIZED` | Thiếu/sai JWT hoặc thiếu refresh cookie. |
| `401` | `INVALID_CREDENTIALS` | Sai email/password (không lộ tài khoản tồn tại). |
| `403` | `FORBIDDEN` | Sai role, hoặc user `LOCKED`/`DISABLED`. |
| `404` | `USER_NOT_FOUND` | User id không tồn tại. |
| `404` | `USER_NOT_FOUND_BY_EMAIL` | Email không tồn tại (role-by-email). |
| `409` | `EMAIL_ALREADY_EXISTS` | Đăng ký trùng email. |
| `422` | `INVALID_ROLE` | Role ngoài enum. |
| `422` | `INVALID_OTP` | OTP sai/hết hạn. |
| `422` | `VALIDATION_ERROR` | Dữ liệu hợp lệ JSON nhưng sai nghiệp vụ. |
| `429` | `RATE_LIMITED` | Vượt rate limit OTP/login. |

---

## 10. Quy tắc triển khai

1. Không trả `password_hash` hoặc thông tin nhạy cảm trong bất kỳ response nào.
2. Login sai không tiết lộ email có tồn tại hay không.
3. Logout đưa access token vào Redis denylist tới khi hết hạn tự nhiên.
4. Đổi role/status luôn ghi `audit_logs` với actor là admin gọi API.
5. `redirect_to` chỉ là gợi ý điều hướng; backend vẫn enforce RBAC ở mỗi route.
6. `PATCH /auth/me` không được phép nâng quyền (đổi role/status).

---

## 11. Acceptance criteria

- Login mỗi role trả `redirect_to` đúng (`/`, `/admin`, `/organizer`, `/checker`).
- `PATCH /auth/admin/users/role-by-email {email, role:"ORGANIZER"}` → 200; user đó login lại → `redirect_to:"/organizer"`.
- Email không tồn tại khi role-by-email → 404 `USER_NOT_FOUND_BY_EMAIL`.
- `PATCH /auth/me` đổi `full_name`/`phone` → `GET /auth/me` phản ánh thay đổi; không sửa được role/status.
- `role-by-email` khai báo trước `:user_id/role`, không bị nhầm param.
- Đổi role/status đều tạo `audit_logs`.
