# API Server

## Vai trò

`api-server` là backend HTTP chính của TicketBox. App này chạy Express theo hướng modular monolith: mỗi nghiệp vụ nằm trong một module riêng, nhưng cùng deploy trong một process để đồ án dễ chạy local và dễ demo.

## Hiện trạng Sprint 1

- Entry point: `src/server.ts`.
- Express app và route mount: `src/app.ts`.
- API version hiện tại dùng prefix `/v1`.
- Health check có ở `/health` và `/v1/health`.
- Catalog module đã có router/service/repository/schema/types dạng scaffold.
- Auth middleware và role guard đang là stub để admin routes có chỗ gắn quyền, chưa phải auth thật.

## Cách đọc folder này

1. Đọc `package.json` để biết lệnh chạy và dependency.
2. Đọc `src/server.ts` để xem server listen port nào.
3. Đọc `src/app.ts` để xem middleware và router được mount ra sao.
4. Đọc `src/shared/http/response.ts` và `src/shared/http/problem-details.ts` để hiểu response thành công/lỗi.
5. Đọc `src/shared/middleware/` và `src/shared/guards/` để hiểu request-id, error handling, auth/role guard stub.
6. Đọc module nghiệp vụ trong `src/modules/`, hiện tại ưu tiên `catalog/`.

## Quy ước cần giữ

- Route public/admin đều mount dưới `/v1`.
- Response thành công dùng envelope `{ data, meta }`.
- Lỗi dùng `application/problem+json` theo RFC 7807.
- Module nên có `*.router.ts`, `*.service.ts`, `*.repository.ts`, `*.schema.ts`, `*.types.ts`.
- Router chỉ xử lý HTTP concern; nghiệp vụ nằm ở service; query DB nằm ở repository.

## Ghi chú học thêm

- Express Getting Started: https://expressjs.com/en/starter/hello-world/
- Express routing: https://expressjs.com/en/guide/routing.html
- Express middleware: https://expressjs.com/en/guide/using-middleware.html
- Express error handling: https://expressjs.com/en/guide/error-handling.html
- RFC 7807 Problem Details: https://datatracker.ietf.org/doc/html/rfc7807
- TypeScript Handbook: https://www.typescriptlang.org/docs/handbook/intro.html

## Cần cập nhật ở các sprint sau

- Khi Auth thật được implement, cập nhật phần middleware/guard.
- Khi Catalog đọc DB/cache thật, cập nhật luồng router -> service -> repository.
- Khi thêm module mới, bổ sung thứ tự đọc và route chính của module đó.
