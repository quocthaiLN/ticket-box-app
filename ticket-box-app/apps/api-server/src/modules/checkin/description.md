# Check-in Module

## Role

Handles checker preload, online ticket scan, gate/device administration, gate-zone mappings, and offline batch scaffolding.

## Current Notes

- `GET /v1/check-in/preload` returns device, gate, concert, allowed zones, valid issued tickets, and invited guests.
- `POST /v1/check-in/scans` resolves QR payload/token, validates device/gate, uses row-level ticket locking through `@ticketbox/database`, writes `checkin_logs`, and returns scan result status.
- Admin routes manage gates, devices, and gate-zone mappings. Gate delete and device delete are soft state changes (`is_active=false`, `REVOKED`) to avoid breaking historical logs.
- Offline full item conflict processing remains Sprint 4 scope; batch create is idempotent by `batch_token`.

## Rules To Keep

- Never update tickets on `WRONG_GATE`, invalid QR, or duplicate scan.
- Every online ticket scan outcome should write a check-in log when a concert context is known.
- Zone validation must use `checkin_gate_zones` and same-concert constraints.

