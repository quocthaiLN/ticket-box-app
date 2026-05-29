ticket-box-app/
│
├── apps/
│   ├── api-server/                  # Tiến trình chính: HTTP server + API Gateway
│   │   ├── src/
│   │   │   ├── modules/             # Các bounded context (domain modules)
│   │   │   │   ├── catalog/         # Quản lý concert, nghệ sĩ, sơ đồ chỗ ngồi
│   │   │   │   │   ├── catalog.router.js
│   │   │   │   │   ├── catalog.service.js
│   │   │   │   │   ├── catalog.repository.js
│   │   │   │   │   ├── catalog.schema.js       # Zod schema: validate request
│   │   │   │   │   ├── catalog.types.js        # DTO, internal types
│   │   │   │   │   ├── catalog.cache.js        # Cache logic đặc thù của module
│   │   │   │   │   └── catalog.events.js       # Event definitions module phát ra
│   │   │   │   │
│   │   │   │   ├── ticketing/       # Đặt vé, giữ chỗ, per-user limit
│   │   │   │   │   ├── ticketing.router.js
│   │   │   │   │   ├── ticketing.service.js
│   │   │   │   │   ├── ticketing.repository.js
│   │   │   │   │   ├── ticketing.schema.js
│   │   │   │   │   ├── ticketing.types.js
│   │   │   │   │   ├── ticketing.lock.js       # Pessimistic locking logic
│   │   │   │   │   └── ticketing.events.js
│   │   │   │   │
│   │   │   │   ├── payment/         # Tích hợp VNPAY/MoMo, webhook, idempotency
│   │   │   │   │   ├── payment.router.js
│   │   │   │   │   ├── payment.service.js
│   │   │   │   │   ├── payment.repository.js
│   │   │   │   │   ├── payment.schema.js
│   │   │   │   │   ├── payment.types.js
│   │   │   │   │   ├── payment.idempotency.js  # Idempotency key logic
│   │   │   │   │   ├── payment.webhook.js      # Webhook handler
│   │   │   │   │   └── payment.events.js
│   │   │   │   │
│   │   │   │   ├── checkin/         # Quản lý soát vé, đồng bộ offline
│   │   │   │   │   ├── checkin.router.js
│   │   │   │   │   ├── checkin.service.js
│   │   │   │   │   ├── checkin.repository.js
│   │   │   │   │   ├── checkin.schema.js
│   │   │   │   │   ├── checkin.types.js
│   │   │   │   │   └── checkin.sync.js         # Offline sync logic
│   │   │   │   │
│   │   │   │   ├── auth/            # JWT, RBAC, Denylist
│   │   │   │   │   ├── auth.router.js
│   │   │   │   │   ├── auth.service.js
│   │   │   │   │   ├── auth.repository.js
│   │   │   │   │   ├── auth.schema.js
│   │   │   │   │   ├── auth.types.js
│   │   │   │   │   └── auth.denylist.js        # Redis denylist logic
│   │   │   │   │
│   │   │   │   └── notification/    # Gửi email, app push (consumer của events)
│   │   │   │       ├── notification.service.js
│   │   │   │       ├── notification.types.js
│   │   │   │       └── notification.templates/ # Email templates
│   │   │   │
│   │   │   ├── shared/              # Code dùng chung TRONG api-server
│   │   │   │   ├── middleware/
│   │   │   │   │   ├── rate-limit.middleware.js
│   │   │   │   │   ├── auth.middleware.js      # Verify JWT
│   │   │   │   │   ├── error.middleware.js     # Global error handler
│   │   │   │   │   └── request-id.middleware.js
│   │   │   │   ├── guards/
│   │   │   │   │   └── roles.guard.js          # RBAC enforcement
│   │   │   │   └── utils/
│   │   │   │       └── response.util.js        # Chuẩn hóa response shape
│   │   │   │
│   │   │   ├── app.js               # Khởi tạo Express app, mount routers
│   │   │   └── server.js            # Entry point: listen port
│   │   │
│   │   ├── package.json
│   │   └── jsconfig.json
│   │
│   └── worker-server/               # Tiến trình riêng: chạy background workers
│       ├── src/
│       │   ├── workers/
│       │   │   ├── ai-bio.worker.js         # Đọc queue, gọi OpenAI, ghi Artist Bio
│       │   │   ├── csv-sync.worker.js       # Import CSV khách mời VIP
│       │   │   └── email-notification.worker.js
│       │   └── server.js            # Entry point worker
│       ├── package.json
│       └── jsconfig.json
│
├── packages/                        # Shared packages dùng chung giữa 2 apps
│   ├── database/                    # Prisma schema + migrations + client
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── migrations/
│   │   └── src/
│   │       └── client.js            # Export Prisma client singleton
│   │
│   ├── queue/                       # BullMQ setup, queue definitions
│   │   └── src/
│   │       ├── queues.js            # Khai báo tên queue (booking, email, csv...)
│   │       └── connection.js        # Redis connection cho BullMQ
│   │
│   ├── redis/                       # Redis client dùng chung (cache, rate limit)
│   │   └── src/
│   │       └── client.js
│   │
│   ├── storage/                     # MinIO client wrapper
│   │   └── src/
│   │       └── client.js
│   │
│   └── types/                       # Shared TypeScript types/interfaces
│       └── src/
│           ├── events.types.js      # Event contract giữa modules
│           └── common.types.js
│
├── nginx/                           # Cấu hình API Gateway
│   ├── nginx.conf
│   └── conf.d/
│       ├── rate-limit.conf
│       └── upstream.conf
│
├── docker/
│   ├── Dockerfile.api
│   ├── Dockerfile.worker
│   └── docker-compose.yml           # Gom: api, worker, postgres, redis, minio
│
├── scripts/
│   ├── seed.js                      # Seed dữ liệu demo
│   └── migrate.js
│
├── package.json                     # Root workspace (pnpm/npm workspaces)
└── turbo.json                       # Turborepo build pipeline (tùy chọn)