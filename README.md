# TicketBox Local Run Guide

Các lệnh bên dưới chạy từ thư mục workspace npm:

```powershell
cd ticket-box-app
```

## 1. Cài dependencies

```powershell
npm install
```

## 2. Kiểm tra `.env`

File `.env` nằm tại `ticket-box-app/.env`.

Nếu dùng PostgreSQL local trên port `5432`, có thể giữ cấu hình:

```env
DATABASE_URL=postgresql://ticketbox:ticketbox@localhost:5432/ticketbox?schema=public
UPSTASH_REDIS_URL=redis://localhost:6379
JWT_SECRET=ticketbox-local-access-secret
JWT_REFRESH_SECRET=ticketbox-local-refresh-secret
```

Nếu dùng database container từ `docker-compose.yml` của repo, PostgreSQL đang được expose ra `localhost:5433`, nên cần dùng:

```env
DATABASE_URL=postgresql://ticketbox:ticketbox@localhost:5433/ticketbox?schema=public
UPSTASH_REDIS_URL=redis://localhost:6379
JWT_SECRET=ticketbox-local-access-secret
JWT_REFRESH_SECRET=ticketbox-local-refresh-secret
```

## 3. Start database và Redis

```powershell
docker compose up -d
```

Container trong repo:

- PostgreSQL: container port `5432`, host port `5433`
- Redis: `localhost:6379`

Kiểm tra container:

```powershell
docker compose ps
```

## 4. Validate, generate và build Prisma package

```powershell
npm run db:validate
npm run db:generate
npm run build:database
```

Các lệnh trên dùng để:

- Validate Prisma schema.
- Generate Prisma Client.
- Build TypeScript của `@ticketbox/database`.

## 5. Apply migration

```powershell
npm run db:migrate
```

Lệnh này apply các migration hiện có vào database được trỏ bởi `DATABASE_URL`.

## 6. Seed database

```powershell
npm run db:seed
```

Seed thực thi file: `packages/database/prisma/seed.mjs`

Dữ liệu seed hiện tại đáp ứng Sprint 6 mới nhất.

Xem database bằng Prisma Studio để có thể đổi role nhanh chóng: `http://localhost:5555`

```powershell
npm run db:studio
```

> Mở terminal khác để tiếp tục các lệnh dưới

## 7. Build các package nền cho API

API server import một số workspace package từ output `dist`, nên hãy build các package nền trước khi chạy API:

```powershell
npm run build:storage
npm run build:redis
npm run build:queue
npm run build:database
```

## 8. Chạy API server

Mở terminal 1 tại `ticket-box-app/`:

```powershell
npm run dev:api
```

API mặc định chạy tại: `http://localhost:3000`

Catalog endpoints cần kiểm tra nhanh:

```text
http://localhost:3000/v1/health
http://localhost:3000/v1/concerts
```

Nếu mở `http://localhost:3000` mà thấy lỗi hoặc không có nội dung HTML thì vẫn có thể bình thường, vì API server không phải web page. Hãy dùng `/v1/health` hoặc `/v1/concerts` để smoke test.

## 9. Chạy Web UI

Mở terminal 2 tại `ticket-box-app/`:

```powershell
npm run dev:web
```

Web UI chạy tại: `http://localhost:3001`

Nếu port `3001` đang bận, có thể là `http://localhost:3002`

## 10. Chạy Notification Worker

Worker xử lý job nền (gửi email OTP, notification SENT/FAILED). **Auth OTP và notification sẽ không hoạt động nếu worker không chạy.**

Mở terminal 3 tại `ticket-box-app/`:

```powershell
npm run build:redis
npm run build:queue
npm run dev:worker
```

Worker đọc job từ Redis (BullMQ). Khi đăng ký tài khoản, OTP được đẩy vào queue → worker gửi email (ở môi trường local, email được log ra console của worker — copy mã OTP từ đó).

## 11. Auth & RBAC — luồng và endpoint (Sprint 6)

Tất cả endpoint auth nằm dưới `http://localhost:3000/v1/auth`.

| Method | Endpoint | Role | Ghi chú |
| --- | --- | --- | --- |
| `POST` | `/auth/otp/request` | Public | Gửi OTP 6 số tới email (xem console worker). |
| `POST` | `/auth/register` | Public | Cần `otp` hợp lệ; tạo user `AUDIENCE`. |
| `POST` | `/auth/login` | Public | Trả `access_token` + `redirect_to` theo role. |
| `GET` | `/auth/me` | User | Thông tin user hiện tại. |
| `PATCH` | `/auth/me` | User | Tự sửa `full_name` / `phone`. |
| `POST` | `/auth/logout` | User | Thu hồi token (Redis denylist). |
| `PATCH` | `/auth/admin/users/role-by-email` | ADMIN | Đổi role theo email (cấp `ORGANIZER`/`CHECKER`). |
| `PATCH` | `/auth/admin/users/:user_id/role` | ADMIN | Đổi role theo id. |
| `PATCH` | `/auth/admin/users/:user_id/status` | ADMIN | Khóa/mở/disable user. |

**`redirect_to` trả về khi login** (client dùng để điều hướng workspace):

| role | redirect_to |
| --- | --- |
| `AUDIENCE` | `/` |
| `ADMIN` | `/admin` |
| `ORGANIZER` | `/organizer` |
| `CHECKER` | `/checker` |

### Tài khoản demo (seed)

Seed tạo sẵn 4 tài khoản chính, **tất cả dùng chung mật khẩu `Password@123`** (bcrypt hash thật 12 rounds — login được ngay sau `npm run db:seed`):

| Email | Role | redirect_to |
| --- | --- | --- |
| `audience@ticketbox.test` | `AUDIENCE` | `/` |
| `organizer@ticketbox.test` | `ORGANIZER` | `/organizer` |
| `checker@ticketbox.test` | `CHECKER` | `/checker` |
| `admin@ticketbox.test` | `ADMIN` | `/admin` |

Ví dụ login admin (đổi role cho user khác qua `role-by-email` sau khi có token ADMIN):

```bash
curl -X POST http://localhost:3000/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@ticketbox.test","password":"Password@123"}'
# → 200 { access_token, redirect_to: "/admin", user, expires_in }
```

> Mật khẩu demo là hằng `DEMO_PASSWORD` trong `packages/database/prisma/seed.mjs`; đổi rồi chạy lại `npm run db:seed`. Ngoài ra vẫn có thể đăng ký user `AUDIENCE` thật qua OTP: `POST /auth/otp/request` → lấy OTP ở console worker → `POST /auth/register`.

Checker account do Admin **approve hồ sơ** sinh ra (mục 13) dùng bcrypt hash thật nên **login được ngay** bằng password trả về một lần ở response approve.

## 12. Redis dùng để làm gì

`UPSTASH_REDIS_URL` (local: `redis://localhost:6379`) phục vụ:

- **OTP store**: mã OTP đăng ký (TTL ~5 phút) + cooldown chống spam resend.
- **JWT denylist**: `jti` của token bị logout/thu hồi (TTL = thời gian sống còn lại của token).
- **Catalog cache**: cache đọc concert/metadata/inventory; tự invalidate khi sửa concert.
- **Queue (BullMQ)**: hàng đợi email/notification cho worker.

Kiểm tra Redis sống: `docker compose ps` (service redis) hoặc `redis-cli ping` → `PONG`.

## 13. Luồng Organizer → Admin duyệt (smoke test A5 + A6)

1. **ORGANIZER** nộp hồ sơ: `POST /v1/organizer/requests` (cần token ORGANIZER) → trạng thái `PENDING`.
2. **ADMIN** xem: `GET /v1/admin/organizer-requests?status=PENDING`.
3. **ADMIN** duyệt: `POST /v1/admin/organizer-requests/:request_id/approve` → tạo trong **một transaction**: Concert `DRAFT` + seat zones + ticket types + `gate_count` cổng + `checker_count` tài khoản `CHECKER`. **Response trả password checker đúng một lần** — bàn giao ngay.
4. Checker đăng nhập bằng email/password vừa nhận → `redirect_to: /checker`, check-in được.
5. **ORGANIZER** xin xóa: `POST /v1/organizer/concerts/:concert_id/deletion-requests`.
6. **ADMIN** duyệt xóa: `POST /v1/admin/concert-deletion-requests/:request_id/approve` → concert `CANCELLED`, checker của concert tự chuyển `DISABLED` (không login được nữa).
7. Xem checker theo concert: `GET /v1/admin/concerts/:concert_id/checker-accounts` (không lộ password).

Duyệt lại hồ sơ/yêu cầu đã xử lý → `409 ORGANIZER_REQUEST_NOT_PENDING` / `409 DELETION_REQUEST_NOT_PENDING`.

## 14. Troubleshooting

| Triệu chứng | Nguyên nhân & cách xử lý |
| --- | --- |
| Build api đỏ: `Property 'organizerRequest' does not exist on type 'PrismaClient'` / `has no exported member 'ApprovalStatus'` | Prisma Client **chưa generate** sau khi đổi schema. Chạy `npm run db:generate` (hoặc `npm run prisma:generate -w @ticketbox/database`) **trước** khi build. |
| `pnpm: command not found` | Repo dùng **npm workspaces**, không phải pnpm. Dùng `npm run build`, `npm run dev:api`, … |
| Tài khoản seed login `401 INVALID_CREDENTIALS` | Chưa chạy lại `npm run db:seed` sau khi cập nhật seed. Mật khẩu demo là `Password@123` (mục 11) — re-seed rồi thử lại. |
| `PATCH /auth/admin/users/role-by-email` trả `404 USER_NOT_FOUND_BY_EMAIL` | Email không tồn tại trong DB. Kiểm tra chính tả / đã seed chưa. |
| Đăng ký không nhận được OTP | Worker chưa chạy (mục 10). OTP được log ở console worker, không trả trong response. |
| `Can't reach database server` | Container Postgres chưa chạy (`docker compose up -d`) hoặc `DATABASE_URL` sai port (5432 vs 5433 — xem mục 2). |
| Login OK nhưng `redirect_to` sai workspace | Role user chưa đúng — dùng `role-by-email` để cấp `ORGANIZER`/`CHECKER`. |

