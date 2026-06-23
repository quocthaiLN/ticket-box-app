# Setup Database Container

## STEP 0 — Start containers

Run from `ticket-box-app/`:

```bash
cd ticket-box-app/
docker compose up -d
```

This starts:
- **PostgreSQL 16** on `localhost:5432`
- **Redis 7** on `localhost:6379`

`DATABASE_URL` and `REDIS_URL` in `.env` are already set to point to these containers.

## Step 1 — Apply migrations

Run from `ticket-box-app/packages/database/`:

```bash
cd packages/database/
npx dotenv-cli -e ../../.env prisma migrate deploy --schema=./prisma/schema.prisma
```

## Step 2 — Seed data

```bash
node --env-file=../../.env prisma/seed.mjs
```

Seeds 4 concerts with venues, seat zones, ticket types, orders, checkin gates, and devices.


## Step 3 - Check database (Optional)

```bash
npx dotenv-cli -e ../../.env -- prisma studio --schema=./prisma/schema.prisma     
```

## Teardown

```bash
# Stop containers (keep data)
docker compose stop

# Stop and delete all data
docker compose down -v
```
Có bảng lưu số tiền admin + host
Bảng lưu lịch sử chuyển tiền admin -> host