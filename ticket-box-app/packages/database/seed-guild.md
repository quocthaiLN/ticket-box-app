# Seed Guide

All commands run from:

```
cd project/ticket-box-app/packages/database
```

## STEP 0 

Make sure `DATABASE_URL` is available. It lives in `./ticket-box-app/.env`:

## Step 1 — Apply migrations (first time only) -> CREATE TABLES

Creates all tables. Skip if tables already exist.

```bash
npx dotenv-cli -e ../../.env prisma migrate deploy --schema=./prisma/schema.prisma
```

## Step 2 — Run seed -> INSERT DATA TO TABLES

```bash
node --env-file=../../.env prisma/seed.mjs
```

Seeds 4 concerts with full data:

| Concert | Venue | Date |
|---|---|---|
| Anh Trai Say Hi | Mỹ Đình | 2026-07-25 |
| Anh Trai Vượt Ngàn Chông Gai | Phú Thọ | 2026-08-08 |
| Em Xinh Say Hi | SECC Hall A | 2026-09-12 |
| Chị Đẹp Đạp Gió Rẽ Sóng | Quân khu 7 | 2026-10-03 |

Each concert gets: 4 users, 4 venues, 5 seat zones (SVIP/VIP/CAT1/CAT2/GA), 5 checkin gates, 5 ticket types, 1 confirmed order + ticket (VIP zone), 1 checkin device, 1 guest import job, 2 guests, 1 artist bio job.

## Re-run safely

The seed uses `upsert` on all rows — safe to re-run on existing data without duplicates.