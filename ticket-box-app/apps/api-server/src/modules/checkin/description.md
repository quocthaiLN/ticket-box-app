# Check-in Module

## Role

Handles checker preload, online ticket scan, gate-zone validation, and offline batch scaffolding.

## Current Notes

- `GET /v1/check-in/preload` returns device, gate, concert, allowed zones, valid issued tickets, and invited guests.
- `POST /v1/check-in/scan` resolves QR payload/token, validates device/gate, uses row-level ticket locking through `@ticketbox/database`, writes `checkin_logs`, and returns scan result status.
- Sprint 6 keeps `checkin_devices` as the runtime assignment table for scan/preload/offline validation, but removes public admin device routes.
- Admin check-in API now only exposes `GET /v1/admin/check-in/gates`; gate creation comes from organizer-request approval, while device provisioning is internal/seeded until a new explicit route is designed.
- Offline full item conflict processing remains Sprint 4 scope; batch create is idempotent by `batch_token`.

## Rules To Keep

- Never update tickets on `WRONG_GATE`, invalid QR, or duplicate scan.
- Every online ticket scan outcome should write a check-in log when a concert context is known.
- Zone validation must use `checkin_gate_zones` and same-concert constraints.
- Removed Sprint 6 routes must stay unmounted so they return 404: `/check-in/scans`, `/check-in/bootstrap`, `/check-in/devices/:id/preload`, `/check-in/gates/:id/preload`, admin gate writes, admin device routes, and admin gate-zone mapping routes.

