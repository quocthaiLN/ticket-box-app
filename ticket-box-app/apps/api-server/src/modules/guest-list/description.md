# Guest List Module

## Role

Manages guest search and basic online guest check-in for checker workflows. CSV import remains scaffolded for Sprint 4.

## Current Notes

- `GET /v1/check-in/guests/search` can filter guests by gate allowed zones.
- `POST /v1/check-in/guests/scans` locks the guest row, validates concert and gate-zone mapping, prevents duplicate check-in, and writes `checkin_logs`.
- Guest status values come from Prisma enum `INVITED`, `CHECKED_IN`, `CANCELLED`.

## Rules To Keep

- Guests with null `seat_zone_id` are not allowed through by default.
- Duplicate guest check-in returns `ALREADY_CHECKED_IN` and does not update the row.
- Wrong gate returns `WRONG_GATE` and does not update the row.

