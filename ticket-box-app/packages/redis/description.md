# Redis Package

## Vai trò

`redis` là package cung cấp Redis client singleton và các helper phục vụ cache-aside, idempotency check (chống trùng lặp request), và token denylist (phục vụ logout/revoke JWT).

Các module nghiệp vụ trong app không nên tự khởi tạo Redis client riêng biệt; thay vào đó, nên đi qua package này để đảm bảo sử dụng chung kết nối (connection pool) và các cơ chế fallback an toàn (graceful degradation) khi Redis không khả dụng (REDIS_URL không được cấu hình).

## Hiện trạng Sprint 1

- `src/client.ts`: Khởi tạo Redis client singleton với `ioredis`. Có fallback graceful: nếu `REDIS_URL` không cấu hình, log warning và không crash app, các helper trả về `null` hoặc no-op. Có export helper close connection phục vụ graceful shutdown.
- `src/cache.ts`: Chứa các helper cho cache-aside pattern: `cacheGet`, `cacheSet`, `cacheDel`, và wrapper tiện ích `cacheAside`.
- `src/idempotency.ts`: Chứa các helper cho idempotency record (`getIdempotencyResponse`, `setIdempotencyResponse`) và token denylist (`addToDenylist`, `isTokenRevoked`).
- `src/index.ts`: Export tập trung các API và type của package.

## Cách đọc folder này

1. Đọc `package.json` để biết cấu hình compile và dependencies (`ioredis`).
2. Đọc `src/client.ts` để hiểu cách khởi tạo client singleton và cấu hình fallback an toàn khi thiếu biến môi trường.
3. Đọc `src/cache.ts` để nắm được các hàm get/set/delete cache dùng chung.
4. Đọc `src/idempotency.ts` để hiểu cấu trúc record idempotency, cách lưu response và cơ chế revoke JWT token qua denylist.
5. Đọc `src/index.ts` để biết package export gì cho các ứng dụng khác dùng.

## Quy ước cần giữ

- Không tự khởi tạo `ioredis` instance mới ở bên ngoài package này. Luôn sử dụng `getRedisClient()`.
- Các helper cần phải thiết kế an toàn: nếu Redis lỗi hoặc không được bật, hệ thống vẫn phải hoạt động bình thường (ví dụ: quay về DB hoặc no-op chứ không crash).
- Mọi cache key và denylist key nên có prefix rõ ràng (ví dụ: `idempotency:`, `denylist:`) để tránh xung đột key (key namespace pollution).
- Không truyền trực tiếp thông tin nhạy cảm của Redis (như password, URL) vào code, chỉ dùng qua `process.env.REDIS_URL`.

## Ghi chú học thêm

- ioredis GitHub & API: https://github.com/redis/ioredis
- Redis Caching Patterns (Cache-Aside): https://redis.io/developer/caching
- Idempotency Keys in API Design: https://stripe.com/docs/api/idempotent_requests
- JWT Revocation with Redis: https://redis.io/glossary/jwt-revocation/

## Cần cập nhật ở các sprint sau

- Cập nhật thêm key prefix convention cho các module cụ thể ở Sprint 2+ (ví dụ: cache catalog, cache user session).
- Tích hợp thêm các Redis feature nâng cao ở các sprint sau nếu cần (như Redis Locks - Redlock cho concurrency seat booking).
