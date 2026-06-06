# TicketBox

TicketBox là hệ thống bán vé concert/sự kiện theo hướng **Event-Driven Modular Monolith**. Đến Sprint 3, repo đã có nền tảng workspace, database schema/seed, Catalog API đọc/ghi cơ bản, worker foundation, Redis/Queue/Storage packages và web audience/admin cho luồng Catalog.

## Trạng Thái Đến Sprint 3

Đã có:

- `apps/api-server`: Express API server, response envelope, request-id/error middleware, Auth scaffold, Catalog API, Check-in/Guest-list scaffold.
- `apps/web`: React + Vite frontend cho audience và admin Catalog.
- `apps/worker-server`: BullMQ worker foundation.
- `packages/database`: Prisma schema, migration, seed data 4 concert.
- `packages/redis`: Redis client/cache/idempotency primitives.
- `packages/queue`: BullMQ queue names/job contracts.
- `packages/storage`: MinIO/CDN-style storage URL wrapper.

Lưu ý hiện tại:

- `npm run build:api` vẫn fail vì các module Inventory/Orders/Payments/Tickets làm vượt sprint đang import alias cũ `@ticket-box/*`.
- API dev server vẫn chạy được cho các route đang mount trong Sprint 3: health, auth scaffold, catalog, check-in, guest-list.
- Các file `description.md` bị xoá là thay đổi chủ ý của owner, không cần phục hồi.

## Yêu Cầu Môi Trường

- Node.js 22.x
- npm 10.x
- Docker Desktop
- PowerShell trên Windows, hoặc shell tương đương trên Linux/macOS

## Cấu Trúc Repo

```text
.
├── blueprint/                 # Tài liệu thiết kế, API design, structure
├── TEAMWORK.md                # Sprint plan và phân công
├── WORKFLOW.md                # Handoff/trạng thái hiện tại
├── REASON.md                  # Ghi nhận lỗi, nguyên nhân, cách khắc phục
└── ticket-box-app/            # npm workspace chính
    ├── apps/
    │   ├── api-server/
    │   ├── web/
    │   └── worker-server/
    └── packages/
        ├── database/
        ├── queue/
        ├── redis/
        └── storage/
```

Các lệnh npm bên dưới chạy từ thư mục workspace:

```powershell
cd ticket-box-app
```

## Cài Đặt Lần Đầu

1. Cài dependencies:

```powershell
npm install
```

2. Tạo biến môi trường cho terminal hiện tại:

```powershell
$env:DATABASE_URL="postgresql://ticketbox:ticketbox@localhost:5432/ticketbox?schema=public"
$env:REDIS_URL="redis://localhost:6379"
```

1. Chạy PostgreSQL và Redis:

```powershell
docker compose up -d
```

4. Generate Prisma Client:

```powershell
npm run db:generate
```

5. Apply migration:

```powershell
npx prisma migrate deploy --schema=packages/database/prisma/schema.prisma
```

6. Seed dữ liệu demo:

```powershell
npm run db:seed
```

Seed tạo 4 concert:

- Anh Trai Say Hi
- Anh Trai Vượt Ngàn Chông Gai
- Em Xinh Say Hi
- Chị Đẹp Đạp Gió Rẽ Sóng

Tài khoản demo trong seed:

| Role | Email |
| --- | --- |
| Audience | `audience@ticketbox.test` |
| Organizer | `organizer@ticketbox.test` |
| Checker | `checker@ticketbox.test` |
| Admin | `admin@ticketbox.test` |

Auth API hiện vẫn là scaffold, nên password seed chỉ là placeholder hash, chưa dùng để login thật.

## Build Các Package Nền

Do API server đang import workspace packages qua `dist`, hãy build các package nền trước khi chạy API/worker:

```powershell
npm run build:storage
npm run build -w @ticketbox/database
npm run build:redis
npm run build:queue
```

Kiểm tra database schema:

```powershell
npm run db:validate
```

## Chạy Dự Án Local

Mở 3 terminal riêng, đều ở thư mục `ticket-box-app/`.

Terminal 1: API server

```powershell
$env:DATABASE_URL="postgresql://ticketbox:ticketbox@localhost:5432/ticketbox?schema=public"
$env:REDIS_URL="redis://localhost:6379"
npm run dev:api
```

API URL:

- `http://localhost:3000/health`
- `http://localhost:3000/v1/health`
- `http://localhost:3000/v1/concerts`

Terminal 2: Worker server

```powershell
$env:REDIS_URL="redis://localhost:6379"
npm run dev:worker
```

Terminal 3: Web frontend

```powershell
npm run dev:web
```

Mở Chrome:

```text
http://localhost:3001
```

Web mặc định gọi API tại:

```text
http://localhost:3000/v1
```

Nếu muốn đổi API base URL cho frontend:

```powershell
$env:VITE_API_BASE_URL="http://localhost:3000/v1"
npm run dev:web
```

## Luồng Demo Đến Sprint 3

Audience:

1. Mở `http://localhost:3001`.
2. Xem danh sách concert public từ Catalog API.
3. Dùng filter tìm kiếm/thành phố.
4. Mở chi tiết concert.
5. Xem metadata, seat zones, ticket types và inventory snapshot.
6. Chọn ticket type/quantity.
7. Bấm giữ vé để xem order `HELD` placeholder trên frontend.

Admin:

1. Mở `http://localhost:3001/admin/catalog`.
2. Xem danh sách venue/concert.
3. Tạo venue mới.
4. Tạo concert draft.
5. Chọn concert, tạo seat zone.
6. Tạo ticket type.
7. Publish concert khi đủ zone và ticket type.

Admin auth hiện là stub: `requireAuth` gán role `ADMIN` để demo Catalog admin API trước khi Auth Sprint 2 hoàn thiện.

## API Catalog Chính

Public:

```text
GET /v1/concerts
GET /v1/concerts/:concert_id
GET /v1/concerts/:concert_id/metadata
GET /v1/concerts/:concert_id/seat-map
GET /v1/concerts/:concert_id/ticket-types
GET /v1/concerts/:concert_id/inventory
```

Admin:

```text
GET   /v1/admin/venues
POST  /v1/admin/venues
PATCH /v1/admin/venues/:venue_id
GET   /v1/admin/concerts
POST  /v1/admin/concerts
PATCH /v1/admin/concerts/:concert_id
POST  /v1/admin/concerts/:concert_id/publish
POST  /v1/admin/concerts/:concert_id/cancel
POST  /v1/admin/concerts/:concert_id/seat-zones
PATCH /v1/admin/seat-zones/:seat_zone_id
POST  /v1/admin/concerts/:concert_id/ticket-types
PATCH /v1/admin/ticket-types/:ticket_type_id
```

## Verification Khuyến Nghị

Các lệnh đang dùng được cho phạm vi Sprint 3:

```powershell
npm run build:web
npm run build:storage
npm run build:redis
npm run build:queue
npm run build:worker
npm run build -w @ticketbox/database
npm run db:validate
```

Smoke check API mounted modules:

```powershell
npm exec -w @ticketbox/api-server -- tsx -e "import { createApp } from './src/app.ts'; const app = createApp(); console.log(typeof app.listen === 'function' ? 'api-createApp-ok' : 'api-createApp-failed');"
```

Không dùng `npm run build` toàn workspace làm tiêu chí xanh ở thời điểm này, vì nó kéo theo `build:api` và các module vượt sprint của Thái đang còn mismatch alias.

## Troubleshooting

### `Environment variable not found: DATABASE_URL`

Set biến môi trường trong terminal trước khi chạy Prisma/API:

```powershell
$env:DATABASE_URL="postgresql://ticketbox:ticketbox@localhost:5432/ticketbox?schema=public"
```

### Web mở được nhưng không có dữ liệu

Kiểm tra API đã chạy chưa:

```text
http://localhost:3000/v1/health
```

Nếu API chưa chạy, mở terminal API và chạy:

```powershell
npm run dev:api
```

### `npm run build:api` fail với `@ticket-box/redis` hoặc `@ticket-box/config`

Đây là blocker đã biết ở các module Inventory/Orders/Payments/Tickets làm vượt sprint. Catalog/Web Sprint 3 không phụ thuộc trực tiếp vào các module đó để demo.

### Port 3001 đã bị chiếm

Chạy web bằng port khác:

```powershell
npm run dev -w @ticketbox/web -- --port 3002
```

Sau đó mở:

```text
http://localhost:3002
```

## Tài Liệu Liên Quan

- `TEAMWORK.md`: phân công sprint và Definition of Done.
- `blueprint/structure.md`: cấu trúc module sau refactor controller layer.
- `blueprint/api-design/catalog-api.md`: contract Catalog API.
