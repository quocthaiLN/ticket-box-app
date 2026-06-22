# Queue Package

## Vai trò

`queue` là package định nghĩa các hàng đợi (queues) và cấu trúc payload của job (jobs data contract) trong hệ thống TicketBox.

Đóng vai trò là cầu nối chia sẻ data contract và queue name thống nhất giữa `api-server` (nơi đẩy jobs vào queue - producer) và `worker-server` (nơi lấy jobs ra xử lý - consumer).

## Hiện trạng Sprint 1

- `src/connection.ts`: Lấy Redis connection từ `@ticketbox/redis` để dùng cho BullMQ. Quăng lỗi nếu Redis chưa được cấu hình (REDIS_URL chưa set).
- `src/jobs.ts`: Định nghĩa TypeScript types cho payload của từng loại job:
  - `ExpireHoldsJobData`: hết hạn giữ ghế (`expire-holds`).
  - `NotificationJobData`: gửi notification qua EMAIL/PUSH/IN_APP (`notifications`).
  - `AiBioJobData`: dùng AI tóm tắt artist bio (`ai-bio`).
  - `GuestImportJobData`: import danh sách khách mời từ file CSV (`guest-import`).
- `src/queues.ts`: Định nghĩa hằng số tên hàng đợi (`QUEUE_NAMES`) và cung cấp các hàm factory để lấy BullMQ `Queue` instance (`getExpireHoldsQueue`, `getNotificationsQueue`, `getAiBioQueue`, `getGuestImportQueue`). Các queue instance này được tạo lazy và chia sẻ chung Redis connection.
- `src/index.ts`: Export tập trung các queue client factory, names, và types.

## Cách đọc folder này

1. Đọc `package.json` để biết dependencies (sử dụng `@ticketbox/redis` và `bullmq`).
2. Đọc `src/connection.ts` để hiểu cách mỗi queue/worker tạo kết nối Redis riêng từ package `@ticketbox/redis`.
3. Đọc `src/jobs.ts` để nắm được các loại jobs có trong hệ thống và cấu trúc dữ liệu payload đi kèm của chúng.
4. Đọc `src/queues.ts` để hiểu các hàm factory khởi tạo các queue instances.
5. Đọc `src/index.ts` để xem các exports cung cấp cho các package/app khác.

## Quy ước cần giữ

- Phải đảm bảo tính đồng nhất của `QUEUE_NAMES` và cấu trúc job payload (`jobs.ts`) giữa producer và consumer. Thay đổi payload là một breaking change, đòi hỏi phải migrate hoặc xử lý các pending jobs trong queue.
- Khi thêm một queue mới, cần định nghĩa tên queue trong `QUEUE_NAMES`, định nghĩa job data type tương ứng trong `jobs.ts`, và tạo một factory function tương ứng trong `queues.ts`.
- Mỗi Queue/Worker được cấp một kết nối Redis riêng qua `createRedisConnection()` (tạo connection mới từ `@ticketbox/redis`) — theo khuyến nghị của BullMQ cho worker.

## Ghi chú học thêm

- BullMQ Documentation: https://docs.bullmq.io/
- Redis-based Queue Pattern: https://redis.io/solutions/queues/
- Message Queue Patterns (Producer-Consumer): https://microservices.io/patterns/data/messaging.html

## Cần cập nhật ở các sprint sau

- Cập nhật chi tiết về cấu hình retry, backoff, rate limit cho từng queue khi đi vào triển khai chi tiết ở các sprint sau.
- Cập nhật hướng dẫn về queue migration khi có sự thay đổi cấu trúc dữ liệu payload lớn.
