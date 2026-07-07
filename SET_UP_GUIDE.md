# TicketBox Setup Guide

Hướng dẫn này dùng cho demo local. Chạy các lệnh từ thư mục workspace npm:

```powershell
cd ticket-box-app
```

## 1. Cài đặt dependencies và chuẩn bị `.env`

Cài dependencies:

```powershell
npm install
```

Tạo file `.env` từ mẫu:

```powershell
Copy-Item .env.example .env
```

Các biến local tối thiểu nên có:

```env
DATABASE_URL=postgresql://ticketbox:ticketbox@localhost:5433/ticketbox?schema=public
REDIS_URL=redis://localhost:6379

JWT_SECRET=ticketbox-local-access-secret
JWT_REFRESH_SECRET=ticketbox-local-refresh-secret
WEB_URL=http://localhost:3001
VITE_API_BASE_URL=http://localhost:3000/v1

VNPAY_TMN_CODE=6B4JGUGA
VNPAY_HASH_SECRET=ZYXDWY1U6T5R82OJA1M6HWMGEF80X6DE
VNPAY_URL=https://sandbox.vnpayment.vn/paymentv2/vpcpay.html
VNPAY_RETURN_URL=http://localhost:3000/v1/payment/return
VNPAY_BULKHEAD_LIMIT=20

MOMO_PARTNER_CODE=MOMO3T4E20260622_TEST
MOMO_ACCESS_KEY=kJcENpbQI5zldviB
MOMO_SECRET_KEY=c7sYgQIPu9gXMTlLVAGZrLZCXjl0YKh0
MOMO_ENDPOINT=https://test-payment.momo.vn/v2/gateway/api/create
MOMO_REDIRECT_URL=http://localhost:3000/v1/payment/return/momo
MOMO_BULKHEAD_LIMIT=20
```

Lưu ý: queue/worker dùng `REDIS_URL`. Nếu `.env` chỉ có `UPSTASH_REDIS_URL`, hãy thêm `REDIS_URL=redis://localhost:6379` khi chạy local.

Nếu vừa clone repo hoặc vừa đổi Prisma schema:

```powershell
npm run db:generate
```

Nếu Windows báo lỗi `EPERM ... query_engine-windows.dll.node`, hãy dừng API, worker, Prisma Studio, test watcher hoặc process Node đang dùng Prisma rồi chạy lại `npm run db:generate`.

## 2. Khởi động PostgreSQL và Redis

```powershell
docker compose up -d postgres redis
docker compose ps
```

Port local:

| Service | URL |
| --- | --- |
| PostgreSQL | `localhost:5433` |
| Redis | `localhost:6379` |

## 3. Chuẩn bị database

Validate schema, generate Prisma client, migrate, reset/clean database, và seed:

```powershell
npm run db:validate
npm run db:generate
npm run db:migrate
npx prisma migrate reset --schema=packages/database/prisma/schema.prisma --force
npm run db:seed
```

Tài khoản demo sau khi seed:

| Vai trò | Email | Mật khẩu |
| --- | --- | --- |
| Admin | `admin@gmail.com` | `Password@123` |
| Audience | `audience@gmail.com` | `Password@123` |
| Organizer/BTC | `organizer@gmail.com` | `Password@123` |
| Organizer/BTC 2 | `organizer2@gmail.com` | `Password@123` |

Có thể mở Prisma Studio để xem dữ liệu:

```powershell
npm run db:studio
```

Trước khi demo auto-publish bằng `organizer2@gmail.com`, nên đảm bảo account này đang sạch: không có concert, không có hồ sơ pending/approved, không có checker account. Xem mục cuối guide để cleanup.

## 4. Chạy các service chính

Mở mỗi service trong một terminal riêng tại `ticket-box-app/`.

API Server:

```powershell
npm run dev:api
```

Web App:

```powershell
npm run dev:web
```

Worker Server:

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

URL local:

| Service | URL |
| --- | --- |
| API | `http://localhost:3000/v1` |
| Web | `http://localhost:3001` |
| Payment mocks | `http://localhost:4100` |

Smoke test nhanh:

```text
http://localhost:3000/v1/health
http://localhost:3000/v1/concerts
```

## 5. Luồng demo cơ bản

1. Đăng nhập web bằng `organizer2@gmail.com` / `Password@123`.
2. Vào dashboard BTC, tạo một hồ sơ concert mới.
3. Điền `planned_publish_at` cách thời điểm hiện tại khoảng 5 phút để test auto-publish. `starts_at` phải sau `planned_publish_at`.
4. Thêm ticket type hợp lệ, sale time hợp lệ, gate/checker count hợp lệ rồi gửi hồ sơ qua admin.
5. Đăng xuất organizer2.
6. Đăng nhập bằng `admin@gmail.com` / `Password@123`.
7. Vào Admin -> Hồ sơ Ban Tổ Chức, duyệt hồ sơ organizer2 vừa gửi.
8. Sau khi accept, mở overview concert bản `DRAFT` để kiểm tra zone, ticket type, gate và checker account đã được tạo.
9. Đợi khoảng 5 đến 6 phút. Worker auto-publish chạy mỗi 60 giây, concert sẽ chuyển từ `DRAFT` sang `PUBLISHED`.
10. Đăng xuất admin.
11. Đăng nhập bằng `audience@gmail.com` / `Password@123`.
12. Vào concert vừa publish, chọn 1 vé và thanh toán bằng VNPay.
13. Ở cổng VNPay sandbox, chọn phương thức thanh toán bằng ngân hàng và nhập:

| Trường | Giá trị |
| --- | --- |
| Ngân hàng | `NCB` |
| Số thẻ | `9704198526191432198` |
| Tên chủ thẻ | `NGUYEN VAN A` |
| Ngày phát hành | `07/15` |
| OTP | `123456` |

14. Sau khi VNPay redirect về hệ thống, vào mục vé của audience để kiểm tra vé đã mua.
15. Đăng nhập lại `organizer2@gmail.com` để thấy doanh thu và số vé bán tăng trên dashboard BTC.

Ghi chú demo:

- Worker Server phải đang chạy thì auto-publish mới xảy ra.
- API Server phải đang chạy để VNPay redirect về `http://localhost:3000/v1/payment/return`.
- Nếu concert chưa publish sau 5 phút, chờ thêm 1 tick worker hoặc kiểm tra log terminal worker.
- Checker account chỉ hiển thị mật khẩu một lần ngay sau khi admin accept. Dashboard BTC chỉ hiển thị email, tên, user id và concert tương ứng.

## 6. Xem audit log bằng `curl` trên terminal

Đăng nhập admin và lấy access token bằng PowerShell:

```powershell
$loginJson = curl.exe -s -X POST "http://localhost:3000/v1/auth/login" `
  -H "Content-Type: application/json" `
  -d "{\"email\":\"admin@gmail.com\",\"password\":\"Password@123\"}"

$token = ($loginJson | ConvertFrom-Json).data.access_token
```

Xem 20 audit log mới nhất:

```powershell
curl.exe -s "http://localhost:3000/v1/admin/audit-logs?limit=20" `
  -H "Authorization: Bearer $token"
```

Lọc audit auto-publish:

```powershell
curl.exe -s "http://localhost:3000/v1/admin/audit-logs?action=CONCERT_AUTO_PUBLISHED&limit=20" `
  -H "Authorization: Bearer $token"
```

Lọc audit payment/ticket sau khi audience thanh toán:

```powershell
curl.exe -s "http://localhost:3000/v1/admin/audit-logs?entity_type=payment&limit=20" `
  -H "Authorization: Bearer $token"

curl.exe -s "http://localhost:3000/v1/admin/audit-logs?entity_type=ticket&limit=20" `
  -H "Authorization: Bearer $token"
```

Các query filter đang hỗ trợ:

| Query | Ý nghĩa |
| --- | --- |
| `actor_user_id` | Lọc theo user thực hiện hành động |
| `action` | Lọc theo action, ví dụ `APPROVE_ORGANIZER_REQUEST`, `CONCERT_AUTO_PUBLISHED`, `PAYMENT_WEBHOOK_SUCCEEDED`, `TICKET_ISSUED` |
| `entity_type` | Lọc theo loại entity, ví dụ `concert`, `payment`, `ticket`, `notification` |
| `entity_id` | Lọc theo id entity |
| `from`, `to` | Lọc theo thời gian ISO |
| `limit` | Số bản ghi, từ 1 đến 100 |
| `cursor` | Cursor phân trang từ response trước |

Nếu audit log chưa có bản ghi mong muốn, hãy thực hiện lại đúng hành động demo, sau đó query lại. Audit hiện không ghi mọi thao tác UI, nhưng các luồng duyệt hồ sơ, auto-publish, payment webhook, issue ticket, notification retry đã có trace.

## Cleanup trước khi push hoặc trước buổi demo mới

Trước khi push hoặc bàn giao cho teammate, hãy làm sạch dữ liệu demo tự tạo để account `organizer2@gmail.com` dễ quan sát trong lần test tiếp theo.

Mục tiêu trạng thái sạch:

- `organizer2@gmail.com` không có concert.
- `organizer2@gmail.com` không có organizer request cũ.
- Không còn checker account sinh từ concert demo của organizer2.
- Không còn user checker tự động dạng `checker-...@ticketbox.local` gắn với concert demo organizer2.

Có thể kiểm tra nhanh:

```powershell
docker exec ticketbox-postgres psql -U ticketbox -d ticketbox -c "select count(*) as organizer2_concerts from concerts where organizer_id = '00000000-0000-0000-0000-000000000007';"

docker exec ticketbox-postgres psql -U ticketbox -d ticketbox -c "select count(*) as organizer2_requests from organizer_requests where organizer_id = '00000000-0000-0000-0000-000000000007';"
```

Cách sạch nhất nếu không cần giữ dữ liệu local:

```powershell
docker compose down -v
docker compose up -d postgres redis
npm run db:migrate
npm run db:seed
```

Nếu cần cleanup thủ công, mở Prisma Studio hoặc chạy SQL trong PostgreSQL theo thứ tự phụ thuộc: xóa payment/ticket/order liên quan concert organizer2, xóa checker account, xóa organizer request, xóa concert, cuối cùng xóa checker user tự động. Không xóa các account seed chính: `admin@gmail.com`, `audience@gmail.com`, `organizer@gmail.com`, `organizer2@gmail.com`.
