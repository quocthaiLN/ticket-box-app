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

