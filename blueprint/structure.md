# TicketBox - Project Structure

Tài liệu này mô tả cấu trúc mục tiêu của `ticket-box-app/` theo kiến trúc **Event-Driven Modular Monolith**. Đây là blueprint để triển khai dần, không có nghĩa là mọi thư mục đã tồn tại trong repo hiện tại.

Hiện trạng gần nhất: repo mới có `ticket-box-app/packages/database` với Prisma schema, migrations, seed và một số helper TypeScript. Các app `api-server`, `worker-server`, web/mobile và các shared package còn lại sẽ được tạo theo cấu trúc dưới đây khi bắt đầu triển khai ứng dụng.

## 1. Nguyên tắc tổ chức

1. **TypeScript mặc định** cho backend/package mới. Không dùng `.js` cho source app mới, trừ script runtime đặc biệt như Prisma seed `.mjs`.
2. **Module theo use case/API design**, bám các file trong `blueprint/api-design/`: Auth/RBAC, Catalog, Inventory, Order Checkout, E-ticket, Check-in, Guest List, Artist Bio, Notification.
3. **Modular monolith, không microservice hóa sớm**. Các module nằm chung `api-server`, giao tiếp nội bộ bằng service/event contract rõ ràng.
4. **PostgreSQL là source of truth** thông qua `@ticketbox/database`; Redis/BullMQ/MinIO chỉ là package hạ tầng phụ trợ.
5. **Worker tách process, không tách domain**. Worker xử lý AI, CSV, notification, expire hold bằng cùng shared packages và event contracts.
6. **Không tạo abstraction chung khi chưa cần**. Mỗi module có router/service/repository/schema/types; chỉ đưa vào `shared/` khi dùng bởi nhiều module.

## 2. Cấu trúc mục tiêu

```text
ticket-box-app/
|
├── apps/
│   ├── web/                                  # Web khán giả + Admin Dashboard
│   │   ├── src/
│   │   │   ├── app/                          # Routes/pages nếu dùng Next.js App Router
│   │   │   ├── features/                     # UI theo domain: catalog, checkout, admin...
│   │   │   ├── components/                   # Component dùng chung
│   │   │   ├── lib/                          # API client, auth client, formatters
│   │   │   └── styles/
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── mobile-checkin/                       # React Native/Expo app cho nhân sự soát vé
│   │   ├── src/
│   │   │   ├── screens/
│   │   │   ├── features/
│   │   │   │   ├── bootstrap/                # Tải device/gate/concert config
│   │   │   │   ├── preload/                  # Tải valid tickets/guests
│   │   │   │   ├── scanner/                  # QR scan online/offline
│   │   │   │   └── sync/                     # Offline batch sync
│   │   │   ├── local-db/                     # SQLite schema + repository
│   │   │   └── lib/
│   │   ├── app.json
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── api-server/                           # Express API server: modular monolith
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── auth/                     # JWT, users.role, Redis denylist
│   │   │   │   │   ├── auth.router.ts
│   │   │   │   │   ├── auth.service.ts
│   │   │   │   │   ├── auth.repository.ts
│   │   │   │   │   ├── auth.schema.ts
│   │   │   │   │   └── auth.types.ts
│   │   │   │   │
│   │   │   │   ├── catalog/                  # Concert, venue, seat zones, public metadata
│   │   │   │   │   ├── catalog.router.ts
│   │   │   │   │   ├── catalog.service.ts
│   │   │   │   │   ├── catalog.repository.ts
│   │   │   │   │   ├── catalog.cache.ts
│   │   │   │   │   ├── catalog.schema.ts
│   │   │   │   │   └── catalog.types.ts
│   │   │   │   │
│   │   │   │   ├── inventory/                # Hold/release/payment-confirmed/admin-adjust
│   │   │   │   │   ├── inventory.service.ts
│   │   │   │   │   ├── inventory.repository.ts
│   │   │   │   │   ├── inventory.lock.ts     # SELECT ... FOR UPDATE helpers
│   │   │   │   │   ├── inventory.schema.ts
│   │   │   │   │   └── inventory.types.ts
│   │   │   │   │
│   │   │   │   ├── orders/                   # Checkout, order status, ownership
│   │   │   │   │   ├── orders.router.ts
│   │   │   │   │   ├── orders.service.ts
│   │   │   │   │   ├── orders.repository.ts
│   │   │   │   │   ├── orders.schema.ts
│   │   │   │   │   └── orders.types.ts
│   │   │   │   │
│   │   │   │   ├── payments/                 # VNPAY/MoMo sandbox, webhook, idempotency
│   │   │   │   │   ├── payments.router.ts
│   │   │   │   │   ├── payments.service.ts
│   │   │   │   │   ├── payments.repository.ts
│   │   │   │   │   ├── payments.webhook.ts
│   │   │   │   │   ├── payments.idempotency.ts
│   │   │   │   │   └── payments.types.ts
│   │   │   │   │
│   │   │   │   ├── tickets/                  # E-ticket QR issuing/viewing
│   │   │   │   │   ├── tickets.router.ts
│   │   │   │   │   ├── tickets.service.ts
│   │   │   │   │   ├── tickets.repository.ts
│   │   │   │   │   ├── qr.service.ts
│   │   │   │   │   └── tickets.types.ts
│   │   │   │   │
│   │   │   │   ├── checkin/                  # Online scan, guest scan, offline batch sync
│   │   │   │   │   ├── checkin.router.ts
│   │   │   │   │   ├── checkin.service.ts
│   │   │   │   │   ├── checkin.repository.ts
│   │   │   │   │   ├── checkin.sync.ts
│   │   │   │   │   ├── checkin.schema.ts
│   │   │   │   │   └── checkin.types.ts
│   │   │   │   │
│   │   │   │   ├── guest-list/               # CSV import jobs, guest CRUD/search
│   │   │   │   │   ├── guest-list.router.ts
│   │   │   │   │   ├── guest-list.service.ts
│   │   │   │   │   ├── guest-list.repository.ts
│   │   │   │   │   ├── guest-list.schema.ts
│   │   │   │   │   └── guest-list.types.ts
│   │   │   │   │
│   │   │   │   ├── artist-bio/               # AI bio jobs + concerts.artist_bio
│   │   │   │   │   ├── artist-bio.router.ts
│   │   │   │   │   ├── artist-bio.service.ts
│   │   │   │   │   ├── artist-bio.repository.ts
│   │   │   │   │   ├── artist-bio.schema.ts
│   │   │   │   │   └── artist-bio.types.ts
│   │   │   │   │
│   │   │   │   ├── notifications/            # notifications table + enqueue endpoint
│   │   │   │   │   ├── notifications.router.ts
│   │   │   │   │   ├── notifications.service.ts
│   │   │   │   │   ├── notifications.repository.ts
│   │   │   │   │   ├── notifications.schema.ts
│   │   │   │   │   └── notifications.types.ts
│   │   │   │   │
│   │   │   │   └── audit/                    # audit_logs helper/query APIs nếu cần
│   │   │   │       ├── audit.service.ts
│   │   │   │       ├── audit.repository.ts
│   │   │   │       └── audit.types.ts
│   │   │   │
│   │   │   ├── shared/
│   │   │   │   ├── middleware/
│   │   │   │   │   ├── auth.middleware.ts
│   │   │   │   │   ├── error.middleware.ts
│   │   │   │   │   ├── rate-limit.middleware.ts
│   │   │   │   │   └── request-id.middleware.ts
│   │   │   │   ├── guards/
│   │   │   │   │   ├── role.guard.ts         # AUDIENCE/ORGANIZER/CHECKER/ADMIN
│   │   │   │   │   └── ownership.guard.ts
│   │   │   │   ├── http/
│   │   │   │   │   ├── problem-details.ts
│   │   │   │   │   └── response.ts
│   │   │   │   └── utils/
│   │   │   │
│   │   │   ├── app.ts                        # Express app, mount routers
│   │   │   └── server.ts                     # Listen port
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── worker-server/                         # Background workers chạy riêng process
│       ├── src/
│       │   ├── workers/
│       │   │   ├── expire-holds.worker.ts     # Release order HELD hết hold_expires_at
│       │   │   ├── ai-bio.worker.ts           # Gọi AI, cập nhật generated_bio/concerts.artist_bio
│       │   │   ├── guest-import.worker.ts     # Import CSV khách mời VIP
│       │   │   └── notification.worker.ts     # Gửi notifications + retry
│       │   ├── schedulers/
│       │   │   └── reminder.scheduler.ts      # Nhắc lịch trước concert
│       │   └── server.ts
│       ├── package.json
│       └── tsconfig.json
│
├── packages/
│   ├── database/                              # Đã bắt đầu triển khai
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   ├── seed.mjs
│   │   │   └── migrations/
│   │   ├── src/
│   │   │   ├── client.ts                      # Prisma client singleton
│   │   │   ├── ticketing.ts                   # Helper transaction/lock hiện có
│   │   │   ├── checkin.ts                     # Helper check-in hiện có
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── redis/                                 # Redis client chung
│   │   └── src/
│   │       ├── client.ts
│   │       ├── cache.ts
│   │       ├── rate-limit.ts
│   │       └── idempotency.ts
│   │
│   ├── queue/                                 # BullMQ connection + queue names
│   │   └── src/
│   │       ├── connection.ts
│   │       ├── queues.ts
│   │       └── jobs.ts
│   │
│   ├── storage/                               # MinIO/S3 wrapper
│   │   └── src/
│   │       ├── client.ts
│   │       └── buckets.ts
│   │
│   └── types/                                 # Shared DTO/event contracts
│       └── src/
│           ├── api.types.ts
│           ├── events.types.ts
│           ├── auth.types.ts
│           └── common.types.ts
│
├── nginx/
│   ├── nginx.conf
│   └── conf.d/
│       ├── rate-limit.conf
│       └── upstream.conf
│
├── docker/
│   ├── Dockerfile.api
│   ├── Dockerfile.worker
│   └── docker-compose.yml                     # api, worker, postgres, redis, minio, nginx
│
├── scripts/
│   ├── seed.ts                                # Orchestrate seed nếu cần
│   └── migrate.ts
│
├── package.json                               # Root workspace
├── package-lock.json                          # Nếu dùng npm workspaces
└── turbo.json                                 # Tùy chọn, chỉ thêm nếu dùng Turborepo
```

## 3. Mapping module với tài liệu API/spec

| Module / Package | API design | Specs chính | Bảng dữ liệu chính |
| --- | --- | --- | --- |
| `auth` | `auth-rbac-api.md` | `08-auth-rbac.md` | `users`, `audit_logs` |
| `catalog` | `catalog-api.md` | `09-concert-catalog.md`, `14-caching.md` | `venues`, `concerts`, `seat_zones`, `ticket_types` |
| `inventory` | `inventory-api.md` | `01-ticket-inventory.md`, `02-per-user-ticket-limit.md` | `ticket_types`, `user_ticket_type_counters`, `orders`, `order_items` |
| `orders` | `order-checkout-api.md` | `10-order-checkout.md` | `orders`, `order_items` |
| `payments` | `order-checkout-api.md` | `03-payment-idempotency.md` | `payments`, `orders` |
| `tickets` | `e-ticket-api.md` | `11-e-ticket-qr.md` | `tickets`, `notifications` |
| `checkin` | `check-in-api.md` | `04-offline-checkin-sync.md`, `12-checkin-online.md`, `13-guest-checkin.md` | `checkin_devices`, `checkin_gates`, `checkin_gate_zones`, `checkin_logs`, `offline_checkin_batches`, `offline_checkin_items` |
| `guest-list` | `guest-list-api.md` | `05-guest-list-import.md`, `13-guest-checkin.md` | `guest_import_jobs`, `guest_list`, `guest_import_errors` |
| `artist-bio` | `artist-bio-api.md` | `06-artist-bio-ai.md` | `artist_bio_jobs`, `concerts.artist_bio` |
| `notifications` | `notification-api.md` | `07-notification.md` | `notifications` |
| `audit` | tùy chọn nội bộ | `16-audit-logging.md` | `audit_logs` |

## 4. Quy ước đặt file trong module

| File | Vai trò |
| --- | --- |
| `*.router.ts` | Khai báo Express routes, middleware, guard, response shape. |
| `*.schema.ts` | Zod/request validation, query parsing. |
| `*.service.ts` | Nghiệp vụ chính, transaction boundary, gọi repository/package khác. |
| `*.repository.ts` | Query Prisma/raw SQL, không chứa HTTP concern. |
| `*.types.ts` | DTO, internal input/output types của module. |
| `*.events.ts` | Event module phát ra hoặc consume nếu có. |
| `*.cache.ts` | Cache-aside/invalidation riêng module, chỉ tạo khi module cần cache. |

## 5. Ranh giới trách nhiệm quan trọng

- `api-server` nhận HTTP, validate, authorize, gọi service và trả response.
- `worker-server` xử lý job dài hoặc retry được; không trả response cho người dùng.
- `packages/database` chỉ export Prisma client và helper transaction/lock dùng chung; không biết HTTP.
- `packages/redis` chứa Redis primitives cho cache, rate limit, denylist, idempotency.
- `packages/queue` chứa queue name, connection và job payload types.
- `packages/storage` chứa thao tác MinIO/S3; module chỉ truyền object key/URL.
- `packages/types` chứa event contract và shared DTO thật sự dùng bởi nhiều app/package.

## 6. Những thứ không nên thêm trong MVP

- Không thêm `roles/user_roles/permissions` package/module riêng; RBAC dùng `users.role`.
- Không thêm module `artist` riêng; Artist Bio gắn với `concerts.artist_name` và `concerts.artist_bio`.
- Không thêm notification template/DLQ table/module riêng; MVP dùng bảng `notifications`.
- Không thêm module riêng cho `device_status`; trạng thái thiết bị nằm trong `checkin_devices.status`.
- Không tạo microservice độc lập cho từng module; tách package/process chỉ khi có lý do hạ tầng rõ ràng.

## 7. Lưu ý
- Các thành phần chính trong design.md và cách tổ chức package/module trong structure.md không mâu thuẫn với nhau
- 4 module trong design.md ở mức kiến trúc logic cấp cao
  - Catalog
  - Ticketing & Order
  - Payment
  - Checkin
- Còn structure.md là tổ chức code triển khai specs/api
  - inventory, orders, tickets thực chất vẫn nằm trong phạm vi lớn của Ticketing & Order Module.
  - guest-list nằm gần Check-in và worker CSV, vì phục vụ guest VIP/check-in.
  - artist-bio là phần API/admin để tạo job, còn xử lý nặng nằm ở AI Worker.
  - notifications là module phụ trợ nhận event, còn gửi thật chạy qua Notification Worker.
- Tương tự với Background Workers
