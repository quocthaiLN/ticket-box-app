# Load test xem thông tin concert

Mục tiêu: 80.000 request public, chưa đăng nhập, gọi xem chi tiết concert qua `GET /v1/concerts/:concert_id`.

## 1 máy

### Bước 1: Bật whitelist rate limit trong file `.env`

```env
ORDER_RATE_LIMIT_WHITELIST_ENABLED=true
ORDER_RATE_LIMIT_WHITELIST=127.0.0.1,::1,172.17.0.1
```

Whitelist này áp dụng cho cả order load test và catalog public read trong môi trường test.

### Bước 2: Dọn dữ liệu trước khi chạy test

```bash
npx prisma migrate reset --schema=packages/database/prisma/schema.prisma --force
docker exec -i ticketbox-redis redis-cli flushall
npm run db:seed
npm run db:studio
```

Catalog test không cần `tokens.json` vì request chưa đăng nhập.

### Bước 3: Cấu hình `tests/.env`

```env
BASE_URL=http://host.docker.internal:3000/v1
CATALOG_TOTAL_REQUESTS=80000
CATALOG_VUS=1000
CATALOG_MAX_DURATION=10m
CATALOG_REQUEST_TIMEOUT=10s
CATALOG_CONCERT_ID=00000000-0000-0000-0000-000000000202
```

### Bước 4: Chạy load test

```bash
docker compose run --rm k6 run /tests/catalog/catalog.ts
```

### Bước 5: Tắt whitelist

```env
ORDER_RATE_LIMIT_WHITELIST_ENABLED=false
ORDER_RATE_LIMIT_WHITELIST=127.0.0.1,::1
```

## 4 máy qua Tailscale

Mô hình: 1 server chạy API/DB/Redis/worker, 3 client chạy k6. Tổng request là 80.000, chia thành 30.000 + 30.000 + 20.000.

### Bước 1: Dọn dữ liệu trên server

```bash
npx prisma migrate reset --schema=packages/database/prisma/schema.prisma --force
docker exec -i ticketbox-redis redis-cli flushall
npm run db:seed
```

### Bước 2: Cấu hình server

1. Lấy IP Tailscale của máy server, ví dụ `100.115.10.100`.
2. Lấy IP Tailscale của các máy client, ví dụ `100.115.10.11`, `100.115.10.12`, `100.115.10.13`.
3. Cập nhật whitelist trong file `.env` chính:

```env
ORDER_RATE_LIMIT_WHITELIST_ENABLED=true
ORDER_RATE_LIMIT_WHITELIST=127.0.0.1,::1,100.115.10.11,100.115.10.12,100.115.10.13
```

4. Chạy API server và worker.

### Bước 3: Chuẩn bị 3 máy client

Mỗi máy cần folder `tests/`, `docker-compose.yml` và file `tests/.env`.

Không cần chép `tokens.json` cho catalog test.

### Bước 4: Cấu hình từng client

Cấu hình chung:

```env
BASE_URL=http://100.115.10.100:3000/v1
CATALOG_VUS=1000
CATALOG_MAX_DURATION=10m
CATALOG_REQUEST_TIMEOUT=10s
CATALOG_CONCERT_ID=00000000-0000-0000-0000-000000000202
```

Máy client 1:

```env
CATALOG_TOTAL_REQUESTS=30000
```

Máy client 2:

```env
CATALOG_TOTAL_REQUESTS=30000
```

Máy client 3:

```env
CATALOG_TOTAL_REQUESTS=20000
```

### Bước 5: Chạy cùng lúc trên 3 client

```bash
docker compose run --rm k6 run /tests/catalog/catalog.ts
```

### Bước 6: Tắt whitelist

```env
ORDER_RATE_LIMIT_WHITELIST_ENABLED=false
ORDER_RATE_LIMIT_WHITELIST=127.0.0.1,::1,100.115.10.11,100.115.10.12,100.115.10.13
```
