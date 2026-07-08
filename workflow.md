# Workflow kiểm thử tải luồng đặt vé

## 1. Yêu cầu đang thực hiện

Mục tiêu cuối cùng là kiểm thử luồng đặt `n` vé với tải lớn, hướng tới 80.000 request tạo order bằng k6 chạy trong Docker.

Giai đoạn hiện tại được giới hạn ở 1.000 request để kiểm tra tính đúng và xác định nút thắt trước khi tăng tải. Thiết kế test gồm:

- Seed 1.000 user role `AUDIENCE`.
- Đăng nhập 1.000 user để lấy 1.000 access token thật.
- Mỗi request dùng một user/token và một `Idempotency-Key` riêng.
- Các request cùng đặt một loại vé để mô phỏng contention trong flash sale.
- Bypass rate limit chỉ khi whitelist được bật và IP nguồn nằm trong danh sách cho phép.
- Whitelist mặc định tắt và không tin `X-Forwarded-For` do client tự gửi.

Test k6 nằm tại `tests/order/order.ts`. Mặc định test dùng:

- `TOTAL_REQUESTS=1000`
- `USER_COUNT=1000`
- `VUS=100`
- `QUANTITY=1`
- Concert `00000000-0000-0000-0000-000000000202`
- Ticket type GA `00000000-0000-0000-0000-000000000510`

## 2. Các phần đã cài đặt

### 2.1. Dữ liệu load test

`packages/database/prisma/seed.mjs` đã được bổ sung 1.000 user:

- Email: `loadtest0001@ticketbox.test` đến `loadtest1000@ticketbox.test`.
- Mật khẩu chung: `Password@123`.
- Role: `AUDIENCE`.
- Seed idempotent bằng `createMany(..., skipDuplicates: true)` và `updateMany`.

Lệnh `npm run db:seed` đã chạy thành công trên database cấu hình trong `.env`.

### 2.2. K6 test

`tests/order/order.ts` thực hiện:

1. Health check API.
2. Đăng nhập các user seed theo batch để tạo access token.
3. Phân phối một token cho mỗi iteration.
4. Gửi đúng số request `POST /v1/orders` được cấu hình.
5. Kiểm tra response HTTP 201 và `data.order_id`.
6. Đếm riêng số order thành công, bị từ chối và response bất thường.
7. Cho phép chọn nhóm user chưa dùng qua `USER_START` để tránh vướng `max_per_user` giữa các lần benchmark.

### 2.3. Whitelist cho load test

Cấu hình đã được thêm vào `config/env.ts` và `.env.example`:

```env
ORDER_RATE_LIMIT_WHITELIST_ENABLED=false
ORDER_RATE_LIMIT_WHITELIST=127.0.0.1,::1
```

`apps/api-server/src/shared/middleware/rate-limit.middleware.ts` chỉ bypass order rate limit khi:

- `ORDER_RATE_LIMIT_WHITELIST_ENABLED=true`.
- `req.socket.remoteAddress` khớp một IP trong whitelist.

Không dùng `X-Forwarded-For` để quyết định whitelist vì header này có thể bị client giả mạo nếu proxy không ghi đè an toàn.

Sau các lần benchmark, boolean trong `.env` đã được trả về `false`.

### 2.4. Structured error logging

`apps/api-server/src/shared/middleware/error.middleware.ts` đã ghi log JSON cho lỗi ngoài `ApiError`, gồm:

- `request_id`
- HTTP method và path
- Error name/message/code/meta
- Stack trace

HTTP response vẫn chỉ trả lỗi tổng quát, không làm lộ chi tiết Prisma/PostgreSQL cho client.

## 3. Vấn đề đã phát hiện

### 3.1. Serialization failure khi đặt cùng một loại vé

Implementation cũ trong `apps/api-server/src/modules/orders/repository/hold.ts`:

- Chạy transaction ở isolation level `Serializable`.
- Đọc `ticket_types` bằng `SELECT ... FOR UPDATE`.
- Nhiều request cùng khóa một row ticket type.
- Retry tối đa ba lần.

Kết quả benchmark cũ:

- 50 request/50 VU: 9 thành công, 41 HTTP 500.
- 100 request/100 VU: 9 thành công, 91 HTTP 500.
- PostgreSQL error: `40001 could not serialize access due to concurrent update`.
- Prisma error: `P2010` với PostgreSQL code `40001`.

### 3.2. Prisma transaction max-wait

Sau khi bỏ `Serializable`, lỗi `40001` biến mất nhưng lần thử đầu còn gặp:

```text
P2028: Unable to start a transaction in the given time
```

Nguyên nhân là Prisma mặc định chỉ chờ một khoảng ngắn để lấy transaction/connection từ pool khi nhiều request chạy đồng thời.

### 3.3. Latency còn cao

Sau khi xử lý lỗi transaction, 100% request đã thành công nhưng p95 vẫn cao:

- 50 VU: p95 khoảng 5,88 giây.
- 100 VU: p95 khoảng 7,6 giây.
- Threshold hiện tại của k6: p95 dưới 2 giây.

Nguyên nhân còn lại là transaction vẫn thực hiện nhiều round-trip tuần tự tới Neon và các request cùng cập nhật một hot row inventory.

## 4. Hướng giải quyết đã áp dụng

### 4.1. Conditional atomic update

Luồng reservation trong `hold.ts` đã được chuyển sang:

- Đọc metadata ticket type mà không giữ row lock dài.
- Cập nhật quota user bằng conditional atomic update.
- Tạo order và order item trong cùng transaction.
- Giữ inventory bằng conditional update ở cuối transaction:

```sql
UPDATE ticket_types
SET held_quantity = held_quantity + $quantity
WHERE id = $ticket_type_id
  AND concert_id = $concert_id
  AND status = 'ON_SALE'
  AND sale_start_at <= $now
  AND sale_end_at >= $now
  AND total_quantity - held_quantity - sold_quantity >= $quantity
RETURNING total_quantity - held_quantity - sold_quantity;
```

PostgreSQL đánh giá lại điều kiện trên row mới nhất sau khi chờ concurrent update, nên không oversell và không cần isolation `Serializable`.

### 4.2. Read Committed và timeout rõ ràng

Transaction hiện dùng:

```ts
{
  isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
  maxWait: 10_000,
  timeout: 15_000,
}
```

`maxWait` xử lý queueing hợp lệ tại connection pool thay vì trả `P2028` quá sớm. `timeout` vẫn giới hạn thời gian tối đa của transaction.

## 5. Trạng thái hiện tại

Kết quả sau thay đổi:

| Benchmark | Trước tối ưu | Hiện tại |
|---|---:|---:|
| 50 request / 50 VU | 9 thành công, 41 lỗi | 50 thành công, 0 lỗi |
| 100 request / 100 VU | 9 thành công, 91 lỗi | 100 thành công, 0 lỗi |
| PostgreSQL `40001` | Có | Không còn |
| HTTP 500 tại 100 VU | 91% | 0% |

Các bước xác minh đã đạt:

- `npm run build:api`
- `k6 inspect tests/order/order.ts` qua Docker
- `git diff --check`
- Benchmark thực tế 50 và 100 request trên Neon

API benchmark tạm đã được dừng và các file log chẩn đoán tạm đã được xóa.

Database hiện có 1.000 user load test và các order `HELD` đã được tạo bởi các lần benchmark. Worker cần chạy để expire các hold cũ hoặc dữ liệu benchmark cần được dọn trước khi đo một vòng hoàn toàn mới.

## 6. Việc nên làm tiếp theo

Ưu tiên tiếp theo là giảm latency, chưa tăng ngay lên 80.000 request.

1. Giảm số round-trip trong transaction reservation.
2. Gom insert order, order items, cập nhật quota và inventory bằng SQL CTE hoặc PostgreSQL function.
3. Đo riêng thời gian chờ connection, thời gian transaction và thời gian chờ hot-row lock.
4. Chạy lại theo các mốc 50, 100, 250 và 1.000 request với nhóm user mới.
5. Xác nhận inventory không âm, không oversell, counter user khớp order `HELD`.
6. Sau khi p95 ổn định mới tăng dần tới 80.000 request.
7. Nếu tải flash sale vẫn vượt khả năng transaction đồng bộ, xem xét admission control/waiting room trước API order.

Không nên chỉ tăng connection pool hoặc timeout để che latency. Hot row và số round-trip phải được xử lý trước.

