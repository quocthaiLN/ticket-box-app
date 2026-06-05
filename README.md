# ticket-box-app
TicketBox là nền tảng bán vé sự kiện/concert, tập trung vào kiểm soát đồng thời, thanh toán idempotent và đồng bộ check-in offline.

## Workspace Sprint 1

Mã nguồn nằm trong `ticket-box-app/` dưới dạng npm workspace:

- `apps/api-server`: Express modular monolith. API routes được mount dưới `/v1`; `/health` và `/v1/health` dùng để smoke check.
- `apps/web`: Skeleton React + Vite + React Router cho trang khán giả và admin.
- `packages/database`: Prisma schema, migrations, seed và các database helper.
- `packages/storage`: Contract wrapper MinIO/CDN cho bucket name, object key, upload URL và download URL.

## Quy ước module và route

- Backend modules nằm trong `apps/api-server/src/modules/<module>/`.
- File trong module theo quy ước `*.router.ts`, `*.service.ts`, `*.repository.ts`, `*.schema.ts`, `*.types.ts` và có thể có `*.cache.ts`.
- Public Catalog endpoints được mount theo dạng `/v1/concerts...`.
- Admin Catalog endpoints được mount theo dạng `/v1/admin/...` và sẽ dùng auth/role guard khi Auth được implement.
- Response dùng envelope trong `blueprint/api-design/base-api.md`: `{ data, meta }`; collection response có thêm pagination.
- Source dùng TypeScript và ESM. JSON field trong API DTO giữ dạng `snake_case`.

## Lệnh chạy local

Cài dependencies của workspace từ thư mục `ticket-box-app/`:

```bash
npm install
```

Chạy hoặc build skeleton hiện tại của Sprint 1:

```bash
npm run dev:api
npm run dev:web
npm run build:api
npm run build:storage
npm run db:validate
```

Web app mặc định dùng `VITE_API_BASE_URL=http://localhost:3000/v1`.
