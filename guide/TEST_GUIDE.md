# HƯỚNG DẪN TEST CHÍNH

---

## 1. Chuẩn bị chung

### Bước 1: Seed dữ liệu
Từ thư mục dự án, chạy:

```bash
npm run db:seed
node --env-file=.env tests/order/generate-tokens.mjs
```

Lệnh này sẽ tạo:
- 80.000 load test users để dùng cho test đặt vé
- dữ liệu concert và ticket type mẫu
- file token JWT để bỏ qua bước đăng nhập và giảm độ trễ không cần thiết trong load test

### Bước 2: Bật whitelist rate limit trong file .env
Để tránh bị rate limit chặn khi chạy k6 trong container Docker, bật whitelist như sau:

```env
ORDER_RATE_LIMIT_WHITELIST_ENABLED=true
ORDER_RATE_LIMIT_WHITELIST=127.0.0.1,::1,172.17.0.1
```

> IP `172.17.0.1` là gateway mặc định của Docker, giúp các request từ container k6 được bypass whitelist.

### Bước 3: Khởi động các service cần thiết
Khởi động API server và worker:

```bash
npm run dev:api
npm run dev:worker
```

Đối với payment mock (dùng cho resilience test):

```bash
npm run dev:payment:momo
npm run dev:payment:vnpay
```

MoMo mock chạy ở cổng `4101` theo `MOMO_MOCK_PORT`; VNPay mock chạy ở cổng `4102` theo `VNPAY_MOCK_PORT` trong `.env`.

---

## 2. Load test đặt vé

### Mục tiêu
Kiểm tra khả năng chịu tải khi nhiều request cùng lúc tới API đặt vé, đồng thời phát hiện các vấn đề về throughput, latency, rate limiting và lỗi hệ thống.

### Bước 1: Dọn dẹp trước khi chạy test
Để kết quả chính xác, nên reset database và Redis về trạng thái ban đầu trước khi chạy test:

```bash
npx prisma migrate reset --schema=packages/database/prisma/schema.prisma --force
docker exec -i ticketbox-redis redis-cli flushall
npm run db:seed
node --env-file=.env tests/order/generate-tokens.mjs
```

### Bước 2: Chạy load test bằng k6
Chạy lệnh sau:

```bash
docker compose run --rm k6 run /tests/order/order.ts
```

### Bước 3: Sau khi kết thúc test
Tắt whitelist để quay về cấu hình bình thường:

```env
ORDER_RATE_LIMIT_WHITELIST_ENABLED=false
ORDER_RATE_LIMIT_WHITELIST=127.0.0.1,::1
```

### Kỳ vọng khi chạy
- Không có request bị rate limited
- Không có request bị invalid
- Không có lỗi hệ thống
- Phần lớn request hoàn thành dưới ngưỡng latency mục tiêu

---

## 3. Load test phân tán qua mạng Tailscale

Đối với trường hợp muốn kiểm thử tải thực tế trên nhiều máy client khác nhau, bạn có thể phân phối traffic qua mạng Tailscale.

### Bước 1: Cấu hình trên máy server
1. Lấy IP Tailscale của máy server, ví dụ `100.115.10.100`.
2. Lấy IP Tailscale của các máy client, ví dụ `100.115.10.11`, `100.115.10.12`, `100.115.10.13`.
3. Cập nhật whitelist trong file `.env` chính:

```env
ORDER_RATE_LIMIT_WHITELIST_ENABLED=true
ORDER_RATE_LIMIT_WHITELIST=127.0.0.1,::1,100.115.10.11,100.115.10.12,100.115.10.13
```

4. Khởi động API server và worker như bình thường.

### Bước 2: Chuẩn bị trên các máy client
Mỗi máy client chỉ cần folder test tương ứng cùng file `docker-compose.yml` và file token đã được chia sẵn.

> Lưu ý: Bạn lấy các file token đã sinh trên máy server, ví dụ `tokens_client_1.json`, `tokens_client_2.json`, `tokens_client_3.json`, rồi đổi tên thành `tokens.json` khi đặt vào thư mục `tests/order/` của từng client.

### Bước 3: Cấu hình biến môi trường trên từng máy client
- Cấu hình chung:

```env
BASE_URL=http://100.115.10.100:3000/v1
```

- Máy client 1:

```env
USER_START=1
USER_COUNT=30000
VUS=1000
TOTAL_REQUESTS=30000
```

- Máy client 2:

```env
USER_START=1
USER_COUNT=30000
VUS=1000
TOTAL_REQUESTS=30000
```

- Máy client 3:

```env
USER_START=1
USER_COUNT=20000
VUS=1000
TOTAL_REQUESTS=20000
```

### Bước 4: Đồng loạt chạy test
Trên cả 3 máy client, chạy cùng lúc:

```bash
docker compose run --rm k6 run /tests/order/order.ts
```

Lúc này tải sẽ được phân bổ thực tế giữa nhiều máy client qua Tailscale.

---

## 4. Resilience test payment

### Mục tiêu
Kiểm thử các cơ chế chịu lỗi cho hệ thống thanh toán khi các cổng thanh toán bên thứ ba gặp sự cố, bao gồm:
- Bulkhead: giới hạn số kết nối đồng thời
- Circuit Breaker: ngắt mạch khi lỗi liên tiếp xảy ra

### Bước 1: Chuẩn bị môi trường
1. Khởi động mock payment server:

```bash
npm run dev:payment:momo
npm run dev:payment:vnpay
```

2. Khởi động API server và worker:

```bash
npm run dev:api
npm run dev:worker
```

3. Đảm bảo đã sinh sẵn token:

```bash
node --env-file=.env tests/order/generate-tokens.mjs
```

4. Nếu cần cấu hình tham số tối ưu cho test, có thể dùng các biến môi trường sau:

```env
VNPAY_CB_RESET_TIMEOUT=5000
MOMO_CB_RESET_TIMEOUT=5000
VNPAY_CB_FAILURE_THRESHOLD=5
MOMO_CB_FAILURE_THRESHOLD=5
```

---

## 5. Kiểm thử Bulkhead - MoMo phản hồi chậm

### Ý tưởng cốt lõi
Hệ thống giới hạn tối đa số kết nối đồng thời đến mỗi cổng thanh toán. Khi MoMo bị nghẽn và phản hồi chậm, các slot sẽ bị lấp đầy. Những request tiếp theo sẽ bị từ chối nhanh (fail-fast) thay vì chiếm luồng xử lý lâu.

### Cách chạy test

```bash
docker compose run --rm k6 run /tests/payment/bulkhead.ts
```

### Kỳ vọng kết quả
- Khoảng 20 request đầu tiên đi vào slot thành công và bị giữ lại do chờ phản hồi chậm
- Các request tiếp theo bị từ chối nhanh bằng lỗi `503 Service Unavailable`
- Mã lỗi trả về là `PAYMENT_PROVIDER_UNAVAILABLE`
- Không làm treo hoặc cạn kiệt tài nguyên API Server

---

## 6. Kiểm thử Circuit Breaker - MoMo bị lỗi

### Ý tưởng cốt lõi
Theo dõi số lỗi liên tiếp từ MoMo. Endpoint tạo checkout MoMo gọi qua mạng nên đi qua circuit breaker; còn VNPay chỉ tạo URL có chữ ký tại API và không gọi QueryDR trong luồng này. Khi MoMo lỗi nhiều lần, circuit breaker chuyển sang `OPEN`. Sau cooldown, hệ thống thử `HALF_OPEN` để kiểm tra phục hồi.

### Cách chạy test

```bash
docker compose run --rm k6 run /tests/payment/circuit-breaker.ts
```

### Kỳ vọng kết quả
- Request 1 -> 4: MoMo bị lỗi, mạch vẫn ở trạng thái `CLOSED`
- Request 5: Đạt ngưỡng lỗi và mạch chuyển sang `OPEN`
- Request 6 -> 10: Mạch đang `OPEN`, các request bị chặn ngay lập tức bằng lỗi `503`
- Request 11: Sau cooldown, mạch chuyển sang `HALF_OPEN`, thử request thăm dò nhưng vẫn thất bại, rồi quay lại `OPEN`
- Request 12: Khi MoMo khôi phục và cooldown đủ, mạch chuyển sang `HALF_OPEN`, request thành công và circuit breaker quay về `CLOSED`

---

## 7. Tóm tắt nhanh

- Dùng load test để đánh giá khả năng chịu tải của API đặt vé
- Dùng resilience test để kiểm tra khả năng xử lý lỗi của payment gateway
- Bulkhead giúp ngăn quá tải và chặn request khi slot đầy
- Circuit Breaker giúp tự động cắt đường đi khi gateway liên tục lỗi
- Các kịch bản này nên chạy sau khi đã reset database và seed dữ liệu lại để đảm bảo tính nhất quán của kết quả
