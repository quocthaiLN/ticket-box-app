# Worker Server

## Role

Runs BullMQ workers and lightweight local schedulers for background jobs.

## Current Notes

- `expire-holds` scans orders in `HELD` status past `hold_expires_at`.
- Release logic is delegated to shared helpers in `@ticketbox/database`.
- Scheduler env:
  - `EXPIRE_HOLDS_INTERVAL_MS`, default `60000`
  - `EXPIRE_HOLDS_BATCH_SIZE`, default `50`
  - `EXPIRE_HOLDS_DRY_RUN=true` to scan/log without release

## Rules To Keep

- Worker must handle each order error independently.
- Logs should include scanned, released, skipped, and failed counts.
- Do not duplicate release inventory logic inside worker handlers.

