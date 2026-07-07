# Hướng Dẫn Chạy Load Test (Đặt Vé GA)

---

## 1. Chuẩn Bị Môi Trường

### Bước 1: Seed Dữ Liệu
Đảm bảo đã chạy seed để tạo 1.000 load test users (`loadtest0001` -> `loadtest100000`) và concert/ticket type GA:
```bash
npm run db:seed
```

### Bước 2: Bật Whitelist Rate Limit
```env
ORDER_RATE_LIMIT_WHITELIST_ENABLED=true
ORDER_RATE_LIMIT_WHITELIST=127.0.0.1,::1,172.17.0.1
```
*(IP `172.17.0.1` là gateway mặc định của Docker để bypass khi chạy k6 container).*

### Bước 3: Khởi Động API Server
```bash
npm run dev:api
```

---

## 2. Dọn Dẹp Trước Khi Chạy Test

Để kết quả chính xác, hãy reset toàn bộ database và Redis cache về trạng thái ban đầu trước mỗi lần chạy test mới:

```bash
npx prisma migrate reset --schema=packages/database/prisma/schema.prisma --force
docker exec -i ticketbox-redis redis-cli flushall
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
