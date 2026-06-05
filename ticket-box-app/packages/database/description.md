# Database Package

## Vai trò

`database` là package chứa Prisma schema, migrations, seed data và các helper truy cập PostgreSQL. Đây là source of truth của TicketBox; Redis/MinIO/queue chỉ là hạ tầng phụ trợ.

## Hiện trạng Sprint 1

- Prisma schema nằm ở `prisma/schema.prisma`.
- Migrations nằm ở `prisma/migrations/`.
- Seed script nằm ở `prisma/seed.mjs`.
- Prisma client singleton nằm ở `src/client.ts`.
- Helper nghiệp vụ hiện có: `src/ticketing.ts` và `src/checkin.ts`.
- Export tập trung ở `src/index.ts`.

## Cách đọc folder này

1. Đọc `package.json` để biết script Prisma/build.
2. Đọc `prisma/schema.prisma` để hiểu model, enum, relation và constraint.
3. Đọc migrations theo thứ tự thời gian trong `prisma/migrations/`.
4. Đọc `prisma/seed.mjs` để biết dữ liệu demo được tạo thế nào.
5. Đọc `src/client.ts` để hiểu cách tạo Prisma client.
6. Đọc `src/index.ts` để xem package đang export gì.
7. Đọc các helper trong `src/` khi module nghiệp vụ bắt đầu dùng.

## Quy ước cần giữ

- Không để package này biết HTTP request/response.
- Transaction và locking quan trọng nên được giữ gần database helper hoặc service nghiệp vụ rõ ràng.
- Sau khi sửa schema cần chạy validate/generate/build.
- Migration phải phản ánh đúng thay đổi schema, không sửa tay migration cũ nếu đã được chia sẻ cho team.
- Seed data nên phục vụ demo, không chứa logic nghiệp vụ phức tạp.

## Ghi chú học thêm

- Prisma ORM overview: https://www.prisma.io/docs/orm
- Prisma schema: https://www.prisma.io/docs/orm/prisma-schema
- Prisma migrate: https://www.prisma.io/docs/orm/prisma-migrate
- Prisma Client: https://www.prisma.io/docs/orm/prisma-client
- PostgreSQL transactions: https://www.postgresql.org/docs/current/tutorial-transactions.html

## Cần cập nhật ở các sprint sau

- Khi thêm/sửa model, ghi lý do nghiệp vụ và migration liên quan.
- Khi thêm helper transaction/lock, mô tả caller nào được dùng.
- Khi seed data thay đổi, ghi tài khoản demo và dữ liệu concert chính.
