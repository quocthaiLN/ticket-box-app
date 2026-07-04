# TicketBox

TicketBox is a concert ticketing system built for high-demand ticket sales, safe checkout, QR e-tickets, online/offline check-in, organizer workflows, guest-list import, notifications, and AI-assisted artist biography generation.

The project follows the blueprint in `blueprint/` and is implemented as an event-driven modular monolith in `ticket-box-app/`. The web application has been deployed to Vercel.

## Problem

Concert ticket sales often fail under burst traffic: the site becomes unavailable, users are charged without receiving tickets, bots buy large portions of the inventory, and check-in staff struggle when venue connectivity is weak.

TicketBox addresses these risks with:

- Inventory hold/release flows to prevent overselling.
- Per-user ticket limits.
- Idempotent checkout and payment webhook handling.
- Redis caching for public catalog reads and inventory snapshots.
- Rate limiting for public reads, checkout, and webhooks.
- QR e-ticket issuance after successful payment.
- Online and offline check-in with conflict detection.
- Background workers for hold expiration, notifications, guest import, and AI artist bio generation.

## User Roles

| Role | Main capabilities |
| --- | --- |
| Audience | Browse concerts, select tickets, checkout, pay, view e-tickets and QR codes |
| Organizer | Submit concert requests, configure ticket types/zones, manage concerts, upload press kits, configure guest-list folders |
| Checker | Scan ticket/guest QR codes, preload data, work offline, sync queued scans later |
| Admin | Approve organizer requests, manage users, review deletion requests, inspect guest imports and notifications |

## Architecture

The implementation is a TypeScript workspace with several apps and shared packages:

```text
ticket-box-app/
├── apps/
│   ├── api-server/       # Express modular monolith API
│   ├── web/              # React/Vite web app
│   ├── worker-server/    # BullMQ background workers and schedulers
│   ├── payment-mocks/    # VNPAY/MoMo sandbox simulators
│   └── mobile-checker/   # Expo mobile checker app
├── packages/
│   ├── database/         # Prisma schema, migrations, seed and shared DB helpers
│   ├── redis/            # Redis client, cache, OTP and idempotency helpers
│   ├── queue/            # BullMQ queues and job contracts
│   └── storage/          # Google Drive / Supabase storage helpers
├── tests/                # Vitest integration tests
└── docker-compose.yml    # Local Postgres and Redis
```

Blueprint documents live at the repository root in `blueprint/`, including system design, database design, API design and feature specs.

## Core Modules

| Module | Status in codebase |
| --- | --- |
| Auth & RBAC | JWT auth, refresh/logout, role guards, admin account operations |
| Catalog | Public concert listing/detail, metadata, seat map, ticket types, inventory cache |
| Orders & Inventory | Checkout, held orders, per-user counters, cancel/expire flows |
| Payments | VNPAY/MoMo adapters, return handlers, idempotent webhooks, circuit breaker and bulkhead patterns |
| Tickets | Ticket issuance, user ticket list/detail, signed QR payloads |
| Check-in | Online scan, guest scan, gate/zone validation, offline batch sync |
| Guest List | CSV/Drive import jobs, guest search, guest check-in |
| Artist Bio AI | Worker-based press-kit extraction and AI bio generation |
| Notifications | Notification records, queue worker, admin list/detail/retry, reminder scheduler |
| Audit Logging | Schema and partial logging exist; a centralized audit module/API is still pending |

## Tech Stack

- TypeScript
- Node.js and Express
- React, Vite and React Router
- Expo / React Native for the checker app
- PostgreSQL with Prisma
- Redis and BullMQ
- VNPAY/MoMo payment mock services
- Google Drive / Supabase storage integrations
- Vitest integration tests
- Vercel deployment for the web app

## Prerequisites

- Node.js 22+ recommended
- npm 10+
- Docker Desktop for local Postgres/Redis
- A `.env` file in `ticket-box-app/`

## Environment

Create `ticket-box-app/.env` with values for local development. Do not commit production secrets.

Minimum local variables:

```env
DATABASE_URL=postgresql://ticketbox:ticketbox@localhost:5433/ticketbox?schema=public
UPSTASH_REDIS_URL=redis://localhost:6379
JWT_SECRET=replace-me
JWT_REFRESH_SECRET=replace-me
WEB_URL=http://localhost:3001
API_URL=http://localhost:3000

VNPAY_RETURN_URL=http://localhost:3000/v1/payment/return
MOMO_REDIRECT_URL=http://localhost:3000/v1/payment/return/momo
```

Additional variables are needed for payment provider mocks, email, AI provider access, Google Drive and Supabase depending on which flows you run.

## Local Setup

From the repository root:

```bash
cd ticket-box-app
npm install
```

Start local infrastructure:

```bash
docker compose up -d postgres redis
```

Prepare the database:

```bash
npm run db:generate
npm run db:migrate
npm run db:seed
```

Run the main services:

```bash
npm run dev:api
npm run dev:web
npm run dev:worker
npm run dev:payment
```

Run the mobile checker app:

```bash
npm run dev:mobile
```

Default local URLs:

| Service | URL |
| --- | --- |
| API | `http://localhost:3000/v1` |
| Web | `http://localhost:3001` |
| Payment mocks | `http://localhost:4100` |
| Postgres | `localhost:5433` |
| Redis | `localhost:6379` |

## Build

Generate Prisma Client before building if the schema changed:

```bash
npm run db:generate
npm run build
```

Verified on 2026-07-04:

- `npm run db:validate`: passed.
- `npm run db:generate`: passed.
- `npm run build`: passed after dependencies were synchronized.
- Web build completed with a warning that the main JS chunk is larger than 500 kB.

## Tests

Run integration tests:

```bash
npm test -w @ticketbox/tests
```

The tests require Postgres on `localhost:5433` and Redis on `localhost:6379`.

Current verification result on 2026-07-04:

- Docker Postgres/Redis were running and database migrations/seed completed successfully.
- `npm test -w @ticketbox/tests`: passed after test cleanup, 1 file / 7 tests.
- The legacy `tests/inventory` folder was removed because it targeted a module path that no longer exists.
- The legacy `tests/checkout` folder was removed because it targeted an older checkout flow. The current implementation creates a HELD order first and creates the payment attempt in a separate payment step, while the old tests still expected `createOrder` to return `payment_id` and `checkout_url`.
- Rewrite checkout tests around the current flow: hold order -> create payment -> webhook success/failure -> ticket issuance or inventory release.

## Deployment

The web app is deployed on Vercel. For Vercel builds, point the project root to:

```text
ticket-box-app/apps/web
```

Use the web build command:

```bash
npm run build
```

For full-stack deployment, the API server, worker server, Redis, PostgreSQL, payment mocks or payment provider integrations, storage credentials and background workers must be provisioned separately.

## Important Known Gaps

- Notification delivery is still partially mocked/log-based for email, push and SMS providers.
- Audit logging exists in the schema and in selected flows, but a centralized audit module and admin query API are still missing.
- Anti-bot protection currently relies mostly on Redis fixed-window rate limiting; captcha, waiting room and bot scoring are not implemented yet.
- Test coverage is concentrated on ticketing/check-in flows and needs to be expanded to auth, catalog, notification, guest import, AI bio, frontend and mobile.
- The existing test suite needs environment setup and stale import fixes before it can be used as a reliable CI gate.
- CI/CD, observability, queue dashboards, structured logs and operational alerts are not yet complete.

## Documentation

Key project documents:

- `blueprint/proposal.md` - problem, goals, users, scope and risks.
- `blueprint/structure.md` - target modular monolith structure.
- `blueprint/database-design.md` - database design.
- `blueprint/design.md` - architecture design.
- `blueprint/specs/` - feature specs.
- `blueprint/api-design/` - API contracts.
- `PROCESS.md` - current progress assessment and recommended next tasks.
