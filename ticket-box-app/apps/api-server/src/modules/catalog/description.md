# Catalog Module

## Role

Owns public concert catalog reads and the remaining admin catalog operations.

## Current Notes

- Public routes under `/concerts*` stay unauthenticated for audience browsing.
- Sprint 6 A4 changed admin catalog routes to single-role `ADMIN`.
- Mounted admin catalog routes are limited to:
  - `GET /admin/concerts`
  - `PATCH /admin/concerts/:concert_id`
  - `POST /admin/concerts/:concert_id/publish`
  - `POST /admin/concerts/:concert_id/cancel`
- Removed admin catalog creation/config routes must remain unmounted so they return 404:
  - `GET/POST /admin/venues`
  - `PATCH /admin/venues/:venue_id`
  - `POST /admin/concerts`
  - `POST /admin/concerts/:concert_id/seat-zones`
  - `PATCH /admin/seat-zones/:seat_zone_id`
  - `POST /admin/concerts/:concert_id/ticket-types`
  - `PATCH /admin/ticket-types/:ticket_type_id`

## Rules To Keep

- Keep catalog service/repository methods for create venue/concert/zone/ticket-type available for Organizer and Organizer-Admin flows to reuse later.
- Do not re-expose removed admin routes from this router; Organizer-owned flows belong under `/organizer/*` and approval materialization belongs under Organizer-Admin.
- When changing catalog admin routes, check `blueprint/api-design/rbac-route-map.md` first.
