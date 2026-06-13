# API Server

## Role

Express modular monolith mounted under `/v1`. Modules keep route, schema, service, repository, and types in their own folders.

## Current Notes

- Check-in routes use the shared response envelope from `shared/http/response.ts`.
- Auth middleware is still a Sprint scaffold; role guard is wired but JWT verification is not complete.
- Check-in and guest scan endpoints must keep gate-zone validation on the server side.

## Conventions

- JSON fields stay `snake_case`.
- Domain scan outcomes are returned in `data.result` for checker UX.
- Admin/checker routes must keep `requireAuth` and `requireRole` guards.

