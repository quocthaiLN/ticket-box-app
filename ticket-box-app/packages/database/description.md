# Database Package

## Role

Shared Prisma client and database-domain helpers for transaction-heavy logic.

## Current Notes

- `src/checkin.ts` owns ticket check-in helper with row-level ticket lock and check-in log writes.
- `src/ticketing.ts` owns ticket inventory reservation, ticket issuing helper, and expire-held-order helper for worker use.
- Prisma schema already contains check-in gates, devices, mappings, logs, guests, tickets, and offline batch tables.

## Rules To Keep

- Ticket/guest mutations that affect check-in state must run in transactions.
- Inventory release helpers must be idempotent when order is no longer `HELD`.
- PostgreSQL is the source of truth; Redis is cache/idempotency support only.

