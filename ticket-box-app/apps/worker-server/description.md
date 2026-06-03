# Worker Server

## Vai trò

`worker-server` là một ứng dụng Node.js độc lập (background service/worker daemon) chịu trách nhiệm tiêu thụ và xử lý các jobs bất đồng bộ từ các hàng đợi (queues) do BullMQ quản lý, đồng thời chạy các tác vụ định kỳ (scheduled cron tasks) như gửi thông báo nhắc lịch sự kiện.

Nó hoạt động tách biệt hoàn toàn với `api-server` nhằm giảm tải cho luồng xử lý HTTP chính, giúp hệ thống hoạt động ổn định và có khả năng scale worker độc lập khi tải xử lý job tăng cao.

## Hiện trạng Sprint 1

- `src/workers/`: Chứa các Worker xử lý logic nghiệp vụ cho từng queue:
  - `ai-bio.worker.ts`: Worker gọi AI tóm tắt artist bio (hiện tại là stub log job).
  - `expire-holds.worker.ts`: Worker xử lý thu hồi ghế khi hết thời gian giữ chỗ (hiện tại là stub log job).
  - `guest-import.worker.ts`: Worker xử lý đọc và parse file CSV khách mời (hiện tại là stub log job).
  - `notification.worker.ts`: Worker gửi email/push/in-app notification (hiện tại là stub log job).
- `src/schedulers/`: Chứa các bộ lập lịch tác vụ định kỳ:
  - `reminder.scheduler.ts`: Lập lịch gửi tin nhắn nhắc nhở trước concert N giờ (hiện tại dùng `setInterval` stub).
- `src/server.ts`: Điểm khởi chạy của worker server. Khởi tạo tất cả workers và schedulers, kết nối Redis thông qua `@ticketbox/queue`, cấu hình cơ chế graceful shutdown (`SIGTERM`, `SIGINT`) để kết thúc xử lý job hiện tại trước khi dừng tiến trình.

## Cách đọc folder này

1. Đọc `package.json` để biết các câu lệnh chạy (`dev`, `build`, `start`) và dependencies.
2. Đọc `src/server.ts` để hiểu vòng đời khởi chạy, cách cấu hình và cơ chế graceful shutdown của server.
3. Đọc qua các files trong `src/workers/` để xem logic xử lý của từng worker.
4. Đọc `src/schedulers/reminder.scheduler.ts` để xem cách lập lịch tác vụ gửi tin nhắc.

## Quy ước cần giữ

- Logic của worker cần được thiết kế idempotent (có thể chạy lại nhiều lần một job mà không gây lỗi hoặc sai lệch dữ liệu) vì BullMQ có thể retry job khi xảy ra lỗi mạng hoặc lỗi hệ thống.
- Thực hiện graceful shutdown đầy đủ để giải phóng kết nối Redis và đảm bảo các jobs đang chạy dở có thời gian hoàn thành hoặc được trả lại queue một cách an toàn.
- Đảm bảo cấu hình các biến môi trường đầy đủ (đặc biệt là `REDIS_URL` và thông tin kết nối DB) trước khi chạy worker server.

## Ghi chú học thêm

- BullMQ Guide on Workers: https://docs.bullmq.io/guide/workers
- BullMQ Graceful Shutdown: https://docs.bullmq.io/guide/going-to-production/graceful-shutdown
- Running Background Tasks in Node.js: https://nodejs.org/en/learn/asynchronous-work/dont-block-the-event-loop

## Cần cập nhật ở các sprint sau

- **Sprint 2**: Hoàn thiện logic thật cho `expire-holds.worker.ts` liên kết với DB để hủy order và hoàn trả số lượng ghế tồn kho.
- **Sprint 4**: Triển khai logic thật cho `ai-bio.worker.ts` (gọi AI API), `guest-import.worker.ts` (đọc file MinIO/Storage và parse CSV), và `notification.worker.ts` (gửi mail/push thật và ghi nhận trạng thái vào DB).
- **Sprint 4**: Chuyển đổi `reminder.scheduler.ts` từ `setInterval` sang BullMQ Repeatable Jobs hoặc một cron framework tin cậy hơn để có thể scale ngang nhiều worker-server mà không lo trùng lặp lịch chạy.
