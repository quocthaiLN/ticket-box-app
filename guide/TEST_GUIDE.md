# Hướng Dẫn Chạy Load Test (Đặt Vé GA)

---

## 1. Chuẩn Bị Môi Trường

### Bước 1: Seed Dữ Liệu - Nếu đã chạy SET_UP_GUIDE.md rồi thì thôi nhé
Đảm bảo đã chạy seed để tạo 1.000 load test users (`loadtest0001` -> `loadtest100000`) và concert/ticket type GA:
```bash
npm run db:seed
```

### Bước 2: Bật Whitelist Rate Limit trong .env của app chính (.env ở ticket-box-app/.env)
```env
ORDER_RATE_LIMIT_WHITELIST_ENABLED=true
ORDER_RATE_LIMIT_WHITELIST=127.0.0.1,::1,172.17.0.1
```
*(IP `172.17.0.1` là gateway mặc định của Docker để bypass khi chạy k6 container).*

### Bước 3: Khởi Động API Server
Khởi chạy dịch vụ API đơn lẻ trên máy host:
```bash
npm run dev:api
```

---

## 2. Dọn Dẹp Trước Khi Chạy Test

Để kết quả chính xác, hãy reset toàn bộ database và Redis cache về trạng thái ban đầu, sau đó sinh sẵn (pre-generate) JWT token cho load test:

```bash
# 1. Reset PostgreSQL (xóa sạch dữ liệu và migrate lại từ đầu)
npx prisma migrate reset --schema=packages/database/prisma/schema.prisma --force

# 2. Reset Redis Cache
docker exec -i ticketbox-redis redis-cli flushall

# 3. Tạo lại dữ liệu mẫu và các tài khoản load test
npm run db:seed

# 4. Sinh sẵn JWT token cho toàn bộ các load test users (giúp bỏ qua bước đăng nhập Bcrypt khi chạy test)
node --env-file=.env tests/order/generate-tokens.mjs
```

---

## 3. Chạy Load Test Bằng k6 (Docker Compose)

```bash
docker compose run --rm k6 run /tests/order/order.ts
```

---

## 4. Sau Khi Kết Thúc Test

```env
ORDER_RATE_LIMIT_WHITELIST_ENABLED=false
ORDER_RATE_LIMIT_WHITELIST=127.0.0.1,::1
```

---

## 5. Kiểm Thử Tải Phân Tán Qua Mạng Tailscale (3 Máy Client - 1 Máy Server)

Để kiểm thử tải hàng nghìn kết nối song song thực tế mà không bị nghẽn card mạng/cổng TCP của một máy đơn lẻ, bạn có thể phân chia tải cho 3 máy khác trong mạng Tailscale chạy k6 bắn vào máy của bạn (Server).

### Bước 1: Cấu hình trên máy của bạn (Server)
1. **Lấy IP Tailscale của máy bạn**: Ví dụ là `100.115.10.100`.
2. **Lấy IP Tailscale của 3 máy Client**: Ví dụ `100.115.10.11`, `100.115.10.12`, `100.115.10.13`.
3. **Cấu hình whitelist trong file `.env` chính** của bạn (`ticket-box-app/.env`):
   ```env
   ORDER_RATE_LIMIT_WHITELIST_ENABLED=true
   ORDER_RATE_LIMIT_WHITELIST=127.0.0.1,::1,100.115.10.11,100.115.10.12,100.115.10.13
   ```
4. **Khởi động API Server & Worker**: Chạy như bình thường trên máy bạn.

### Bước 2: Cấu hình trên 3 máy Client (Chạy k6)
Mỗi máy Client sẽ clone dự án hoặc chỉ cần folder `tests/` cùng file `docker-compose.yml`. 

> [!IMPORTANT]
> **Cách phân phối Token**: Bạn lấy các file phân mảnh tương ứng đã sinh ở Bước 2 trên máy Server, gửi cho từng máy Client và **đổi tên thành `tokens.json`** khi đặt vào thư mục `tests/order/tokens.json` của họ:
> * Máy Client 1: Lấy file `tokens_client_1.json` -> Đổi tên thành `tokens.json`.
> * Máy Client 2: Lấy file `tokens_client_2.json` -> Đổi tên thành `tokens.json`.
> * Máy Client 3: Lấy file `tokens_client_3.json` -> Đổi tên thành `tokens.json`.

Tiến hành sửa file `tests/.env` trên từng máy như sau:

* **Cấu hình chung cho cả 3 máy**:
  * Trỏ `BASE_URL` về IP Tailscale của máy Server:
    ```env
    BASE_URL=http://100.115.10.100:3000/v1
    ```

* **Cấu hình dải User (Do file token đã được chia nhỏ độc lập nên tất cả đều bắt đầu từ 1)**:
  * **Máy Client 1** (Chạy 30.000 requests, dùng 1.000 VUs):
    ```env
    USER_START=1
    USER_COUNT=30000
    VUS=1000
    TOTAL_REQUESTS=30000
    ```
  * **Máy Client 2** (Chạy 30.000 requests, dùng 1.000 VUs):
    ```env
    USER_START=1
    USER_COUNT=30000
    VUS=1000
    TOTAL_REQUESTS=30000
    ```
  * **Máy Client 3** (Chạy 20.000 requests, dùng 1.000 VUs):
    ```env
    USER_START=1
    USER_COUNT=20000
    VUS=1000
    TOTAL_REQUESTS=20000
    ```

### Bước 3: Đồng loạt kích hoạt test
Trên cả 3 máy Client, đồng thời chạy câu lệnh:
```bash
docker compose run --rm k6 run /tests/order/order.ts
```
Lúc này, tải trọng 1.000 VUs sẽ được chia đều ra 3 máy gửi tới máy chủ của bạn qua VPN Tailscale một cách mượt mà và thực tế!

