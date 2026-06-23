# Database Package

## Role

Shared Prisma client and database-domain helpers for transaction-heavy logic.

## Current Notes

- `src/checkin.ts` owns ticket check-in helper with row-level ticket lock and check-in log writes.
- `src/ticketing.ts` owns ticket inventory reservation, ticket issuing helper, and expire-held-order helper for worker use.
- Prisma schema contains catalog, inventory, checkout, payment, ticket, check-in, guest, notification, and audit tables.
- Sprint 6 organizer foundation is in place:
  - `ApprovalStatus` maps to `approval_status`.
  - `OrganizerRequest` maps to `organizer_requests`.
  - `ConcertDeletionRequest` maps to `concert_deletion_requests`.
  - `ConcertCheckerAccount` maps to `concert_checker_accounts`.
  - `Concert.plannedPublishAt` maps to `concerts.planned_publish_at`.
- Migration `20260623000000_sprint6_organizer_foundation` creates the organizer approval tables, checker-account link table, indexes, FKs, constraints, and updated-at triggers.

## Rules To Keep

- Ticket/guest mutations that affect check-in state must run in transactions.
- Inventory release helpers must be idempotent when order is no longer `HELD`.
- PostgreSQL is the source of truth; Redis is cache/idempotency support only.
- Organizer module queries must filter by `organizer_id`; do not trust client-supplied `concert_id` or `ticket_type_id` alone.
- Organizer-admin approve must be all-or-nothing in a DB transaction: request, concert, seat zones, ticket types, gates, checker users, and checker links.
