# TicketBox Local Run Guide

Hướng dẫn này tập trung vào việc chuẩn bị database, seed dữ liệu và chạy Web UI trên localhost để kiểm tra các màn Home, Events và Concert Detail.

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

Seed thực thi file:

```text
packages/database/prisma/seed.mjs
```

Dữ liệu seed hiện tại phục vụ Home, Events và Concert Detail:

- 6 concerts dựa trên mock data của `fe/src/app/data/mockData.ts`.
- 5 concerts `PUBLISHED`, 1 concert `DRAFT`.
- Venues, seat zones, gates, ticket types và inventory.
- Demo users, orders, payments, tickets, check-in devices và artist bio jobs.
- Ảnh catalog nằm trong `apps/web/src/img/`.

Nếu muốn xem database bằng Prisma Studio:

```powershell
npm run db:studio
```

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

API mặc định chạy tại:

```text
http://localhost:3000
```

Lưu ý URL phải có hai dấu slash sau `http`, tức là `http://localhost:3000`. `http:/localhost/3000` là sai cú pháp URL.

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

Web UI chạy tại:

```text
http://localhost:3001
```

Nếu port `3001` đang bận, Vite có thể tự động chuyển sang port tiếp theo, ví dụ:

```text
http://localhost:3002
```

Hãy mở đúng URL mà terminal `npm run dev:web` in ra.

Web mặc định gọi API tại:

```text
http://localhost:3000/v1
```

Nếu cần override API base URL:

```powershell
$env:VITE_API_BASE_URL="http://localhost:3000/v1"
npm run dev:web
```

## 10. Luồng kiểm tra UI

Sau khi API và Web đều đang chạy:

1. Mở URL web mà Vite in ra, thường là `http://localhost:3001` hoặc `http://localhost:3002`.
2. Xem Home lấy concert từ Catalog API.
3. Mở `/events` trên cùng port web đang chạy.
4. Search/filter danh sách Events.
5. Mở một concert detail từ card event.
6. Kiểm tra venue, description, ticket types và inventory.

## Lệnh build nhanh cho Web

```powershell
npm run build:web
```

## Troubleshooting

### `Environment variable not found: DATABASE_URL`

Kiểm tra `ticket-box-app/.env` đã có `DATABASE_URL`, sau đó chạy lại các script database từ workspace root.

### `Can't reach database server at localhost:5432`

Nếu đang dùng Docker Compose của repo, port đúng là `5433`, không phải `5432`.

Sửa `.env`:

```env
DATABASE_URL=postgresql://ticketbox:ticketbox@localhost:5433/ticketbox?schema=public
```

Sau đó chạy lại:

```powershell
npm run db:validate
npm run db:migrate
npm run db:seed
```

### Docker Compose báo lỗi pipe hoặc Docker engine

Nếu `docker compose ps` báo lỗi liên quan `dockerDesktopLinuxEngine`, hãy mở Docker Desktop trước, chờ engine start xong rồi chạy lại:

```powershell
docker compose up -d
docker compose ps
```

### Web không có dữ liệu

Kiểm tra API:

```text
http://localhost:3000/v1/concerts
```

Nếu API chưa chạy:

```powershell
npm run dev:api
```

### Port 3001 bị chiếm

```powershell
npm run dev -w @ticketbox/web -- --port 3002
```

Sau đó mở:

```text
http://localhost:3002
```
