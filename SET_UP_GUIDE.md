# TicketBox Setup Guide

Tài liệu này hợp nhất hướng dẫn chạy web/backend và kiểm thử Mobile Checker. Các lệnh dưới đây chạy từ thư mục workspace npm:

```powershell
cd ticket-box-app
```

## 1. Cài đặt dependencies

```powershell
npm install
```

Nếu vừa đổi Prisma schema hoặc vừa clone repo mới, chạy thêm:

```powershell
npm run db:generate
```

## 2. Chuẩn bị `.env`

Copy file mẫu:

```powershell
Copy-Item .env.example .env
```

Khi dùng Docker Compose trong repo, PostgreSQL expose ra host port `5433`, nên `DATABASE_URL` local nên là:

```env
DATABASE_URL=postgresql://ticketbox:ticketbox@localhost:5433/ticketbox?schema=public
REDIS_URL=redis://localhost:6379
JWT_SECRET=ticketbox-local-access-secret
JWT_REFRESH_SECRET=ticketbox-local-refresh-secret
WEB_URL=http://localhost:3001
```

Các nhóm biến cần chú ý:

- `DATABASE_URL`: kết nối PostgreSQL.
- `REDIS_URL`: Redis cho cache, idempotency, OTP và BullMQ.
- `JWT_SECRET`, `JWT_REFRESH_SECRET`: auth token.
- `SMTP_*`: worker gửi email OTP/notification.
- `VNPAY_*`, `MOMO_*`: payment sandbox/mock.
- `AI_*`: AI Artist Bio.
- `SUPABASE_*`, `GOOGLE_SERVICE_ACCOUNT_JSON`: press kit và guest-list import.
- `QR_SIGNING_PRIVATE_KEY_B64`, `QR_SIGNING_PUBLIC_KEY_B64`: ký và verify QR.
- `VITE_API_BASE_URL`: API base URL cho web build nếu cần override.

## 3. Khởi động PostgreSQL và Redis

```powershell
docker compose up -d postgres redis
docker compose ps
```

Container mặc định:

- PostgreSQL: `localhost:5433`
- Redis: `localhost:6379`

## 4. Chuẩn bị database

```powershell
npm run db:validate
npm run db:generate
npm run db:migrate
npm run db:seed
```

Seed data tạo sẵn các tài khoản demo chính. Mật khẩu demo thông dụng trong seed hiện tại là `Password@123` nếu không có ghi chú riêng trong seed.

Có thể mở Prisma Studio:

```powershell
npm run db:studio
```

## 5. Chạy các service chính

Mở các terminal riêng tại `ticket-box-app/`.

API server:

```powershell
npm run dev:api
```

Web app:

```powershell
npm run dev:web
```

Worker server:

```powershell
npm run dev:worker
```

Payment mocks:

```powershell
npm run dev:payment
```

Mobile Checker:

```powershell
npm run dev:mobile -- --clear
```

URL local mặc định:

| Service | URL |
| --- | --- |
| API | `http://localhost:3000/v1` |
| Web | `http://localhost:3001` |
| Payment mocks | `http://localhost:4100` |
| PostgreSQL | `localhost:5433` |
| Redis | `localhost:6379` |

Smoke test nhanh:

```text
http://localhost:3000/v1/health
http://localhost:3000/v1/concerts
```

## 6. Build và test

Build toàn bộ workspace:

```powershell
npm run db:generate
npm run build
```

Test hiện tại sau cleanup:

```powershell
npm test -w @ticketbox/tests
```

Ghi chú chốt giai đoạn:

- `tests/checkin` là nhóm test đang xanh và nên giữ làm quality gate hiện tại.
- `tests/inventory` và `tests/checkout` là test cũ đã được xóa khỏi tree.
- Nhiệm vụ giai đoạn tiếp theo là viết lại checkout/inventory business tests theo flow mới: hold order -> create payment -> webhook -> issue ticket/release inventory.

## 7. Auth & RBAC smoke test

Các endpoint auth nằm dưới:

```text
http://localhost:3000/v1/auth
```

Một số endpoint chính:

| Method | Endpoint | Ghi chú |
| --- | --- | --- |
| `POST` | `/auth/otp/request` | Gửi OTP qua worker/email log |
| `POST` | `/auth/register` | Đăng ký audience bằng OTP |
| `POST` | `/auth/login` | Đăng nhập, trả access token và redirect theo role |
| `GET` | `/auth/me` | Lấy user hiện tại |
| `POST` | `/auth/logout` | Logout và denylist token |
| `PATCH` | `/auth/admin/users/role-by-email` | Admin đổi role theo email |

Ví dụ login admin:

```bash
curl -X POST http://localhost:3000/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@ticketbox.test","password":"Password@123"}'
```

## 8. Mobile Checker setup

### API Base URL

Trong màn hình login Mobile Checker, mở phần cấu hình API URL:

- Thiết bị thật cùng Wi-Fi: `http://<LAN-IP-cua-may-tinh>:3000/v1`
- Android emulator: `http://10.0.2.2:3000/v1`
- iOS simulator/web local: `http://localhost:3000/v1`

### Checker credentials và thông số demo

Tùy seed hiện tại, dùng checker account có sẵn hoặc checker account được tạo khi Admin approve organizer request.

Ví dụ thông số gate/concert seed thường dùng:

| Trường | Giá trị mẫu |
| --- | --- |
| Concert ID | `00000000-0000-0000-0000-000000000201` |
| Gate ID | `00000000-0000-0000-0000-000000000402` |
| Device ID | `DEV-01` |

Quy trình:

1. Login bằng tài khoản `CHECKER`.
2. Nhập API base URL nếu test trên thiết bị thật/emulator.
3. Nhập Concert ID, Gate ID, Device ID.
4. Chọn tải preload để đồng bộ ticket/guest list xuống SQLite local.
5. Bắt đầu soát vé.

## 9. QR và check-in

Payload QR dạng rút gọn:

```json
{
  "ticket_id": "...",
  "concert_id": "...",
  "ticket_type_id": "...",
  "seat_zone_id": "...",
  "gate_id": "...",
  "issued_at": "2026-...Z",
  "qr_token": "<hash>",
  "qr_signature": "<base64 Ed25519>"
}
```

Checker cần kiểm tra:

- Chữ ký Ed25519 hợp lệ.
- Vé thuộc đúng concert/gate/zone.
- Thiết bị checker active và gắn đúng concert/gate.
- Vé ở trạng thái `ISSUED`.
- Quét lại cùng vé phải idempotent hoặc báo đã check-in.
- Offline queue sync lại khi có mạng.

## 10. Troubleshooting

| Triệu chứng | Cách xử lý |
| --- | --- |
| `Can't reach database server` | Kiểm tra Docker, port `5433`, và `DATABASE_URL` |
| Redis không kết nối | Kiểm tra `docker compose ps` và `REDIS_URL=redis://localhost:6379` |
| Prisma type lỗi sau khi đổi schema | Chạy `npm run db:generate` |
| OTP/notification không chạy | Chạy `npm run dev:worker`; local email thường log ở console worker |
| Web không gọi được API | Kiểm tra `VITE_API_BASE_URL` hoặc API URL trong client |
| Mobile không gọi được API trên điện thoại thật | Dùng LAN IP của máy tính, không dùng `localhost` |
| Checkout tests cũ fail | Đây là trạng thái đã biết sau cleanup; cần viết lại theo flow payment mới |
