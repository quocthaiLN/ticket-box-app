# Load test đặt vé

## 1 máy

### Bước 1: Bật whitelist rate limit trong file .env

```env
ORDER_RATE_LIMIT_WHITELIST_ENABLED=true
ORDER_RATE_LIMIT_WHITELIST=127.0.0.1,::1,172.17.0.1
```

### Bước 2: Dọn dẹp trước khi chạy test

```bash
npx prisma migrate reset --schema=packages/database/prisma/schema.prisma --force
docker exec -i ticketbox-redis redis-cli flushall
npm run db:seed
npm run generate:tokens -w @ticketbox/tests
```

### Bước 3: Chạy load test

```bash
docker compose run --rm k6 run /tests/order/order.ts
```

### Bước 4: Đọc số lượng vé sau load test

```bash
docker exec -i ticketbox-postgres psql -U ticketbox -d ticketbox -c "select c.title as concert, tt.name as ticket_type, tt.total_quantity as ve_dang_ban, tt.held_quantity as ve_dang_giu, tt.sold_quantity as ve_da_ban, (tt.total_quantity - tt.held_quantity - tt.sold_quantity) as ve_con_lai from ticket_types tt join concerts c on c.id = tt.concert_id order by c.title, tt.name;"
```

```bash
docker exec -i ticketbox-postgres psql -U ticketbox -d ticketbox -c "select sum(total_quantity) as tong_ve_dang_ban, sum(held_quantity) as tong_ve_dang_giu, sum(sold_quantity) as tong_ve_da_ban, sum(total_quantity - held_quantity - sold_quantity) as tong_ve_con_lai from ticket_types;"
```

Ghi chú: load test order chỉ tạo lệnh giữ vé qua `POST /orders`, nên số vé bị tác động trực tiếp là `held_quantity`. `sold_quantity` chỉ tăng sau khi đơn được thanh toán thành công.

### Bước 5: Tắt whitelist

```env
ORDER_RATE_LIMIT_WHITELIST_ENABLED=false
ORDER_RATE_LIMIT_WHITELIST=127.0.0.1,::1
```

# 4 máy qua Tailscale

### Bước 1: Dọn dữ liệu trên server

```bash
npx prisma migrate reset --schema=packages/database/prisma/schema.prisma --force
docker exec -i ticketbox-redis redis-cli flushall
npm run db:seed
npm run generate:tokens -w @ticketbox/tests
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
Mỗi máy cần folder test, `docker-compose.yml` và file token riêng.

Đổi `tokens_client_1.json`, `tokens_client_2.json`, `tokens_client_3.json` thành `tokens.json` rồi chép vào `tests/generate-tokens/` trên từng máy.

### Bước 4: Cấu hình từng client

Cấu hình chung:

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

### Bước 5: Chạy cùng lúc trên 3 client

```bash
docker compose run --rm k6 run /tests/order/order.ts
```

### Bước 6: Đọc số lượng vé trên server sau load test

```bash
docker exec -i ticketbox-postgres psql -U ticketbox -d ticketbox -c "select c.title as concert, tt.name as ticket_type, tt.total_quantity as ve_dang_ban, tt.held_quantity as ve_dang_giu, tt.sold_quantity as ve_da_ban, (tt.total_quantity - tt.held_quantity - tt.sold_quantity) as ve_con_lai from ticket_types tt join concerts c on c.id = tt.concert_id order by c.title, tt.name;"
```

```bash
docker exec -i ticketbox-postgres psql -U ticketbox -d ticketbox -c "select sum(total_quantity) as tong_ve_dang_ban, sum(held_quantity) as tong_ve_dang_giu, sum(sold_quantity) as tong_ve_da_ban, sum(total_quantity - held_quantity - sold_quantity) as tong_ve_con_lai from ticket_types;"
```

Ghi chú: chạy lệnh này trên server, nơi container `ticketbox-postgres` đang chạy. Với riêng bài order load test, `held_quantity` là số vé đang được giữ; `sold_quantity` chỉ tăng sau thanh toán.

### Bước 7: Tắt whitelist

```env
ORDER_RATE_LIMIT_WHITELIST_ENABLED=false
ORDER_RATE_LIMIT_WHITELIST=127.0.0.1,::1,100.115.10.11,100.115.10.12,100.115.10.13
```
