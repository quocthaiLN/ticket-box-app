# Test chịu lỗi đặt vé

## Bước 1: Dọn dữ liệu

```bash
npx prisma migrate reset --schema=packages/database/prisma/schema.prisma --force
docker exec -i ticketbox-redis redis-cli flushall
npm run db:seed
node --env-file=.env tests/order/generate-tokens.mjs
```

## Bước 2: Dùng `.env` cho test

```env
MOMO_MOCK_PORT=4101
VNPAY_MOCK_PORT=4102
MOMO_ENDPOINT=http://localhost:4101/momo/v2/gateway/api/create
MOMO_QUERY_ENDPOINT=http://localhost:4101/momo/v2/gateway/api/query
VNPAY_MOCK_PREPARE_URL=http://localhost:4102/vnpay/prepare
VNPAY_URL=http://localhost:4102/vnpay/vpcpay.html
VNPAY_QUERYDR_URL=http://localhost:4102/vnpay/merchant_webapi/api/transaction
VNPAY_CB_FAILURE_THRESHOLD=2
MOMO_CB_FAILURE_THRESHOLD=2
VNPAY_CB_RESET_TIMEOUT=5000
MOMO_CB_RESET_TIMEOUT=5000
```

Nếu chạy k6 Circuit Breaker, đặt thêm `PAYMENT_CIRCUIT_FAILURE_THRESHOLD=2` trong file env test.

## Bước 3: Chạy API gateway, worker và frontend

## Bước 4: Chạy payment mock

Mở hai terminal:

```powershell
npm run dev:payment:momo
npm run dev:payment:vnpay
```

Chỉ cần chạy mock của cổng muốn giả lập lỗi.

### MoMo mock, VNPay sandbox

Chạy `npm run dev:payment:momo`, để trống `VNPAY_MOCK_PREPARE_URL` và dùng URL sandbox VNPay trong `.env`.

## Bước 5: Chọn trạng thái cổng thanh toán

```powershell
$momoBase = "http://localhost:4101"
$vnpayBase = "http://localhost:4102"
```

### Cả hai hoạt động

```powershell
Invoke-RestMethod -Method Post -Uri "$momoBase/__control/reset"
Invoke-RestMethod -Method Post -Uri "$vnpayBase/__control/reset"
```

### MoMo chết, VNPay sống

```powershell
Invoke-RestMethod -Method Post -Uri "$momoBase/__control/momo" -ContentType "application/json" -Body '{"mode":"fail","latencyMs":0,"failRate":0}'
Invoke-RestMethod -Method Post -Uri "$vnpayBase/__control/vnpay" -ContentType "application/json" -Body '{"mode":"ok","latencyMs":0,"failRate":0}'
```

Chọn MoMo và thử 2 lần để mở circuit. Sau đó chọn `Chuyển sang VNPay`.

### VNPay chết, MoMo sống

```powershell
Invoke-RestMethod -Method Post -Uri "$momoBase/__control/momo" -ContentType "application/json" -Body '{"mode":"ok","latencyMs":0,"failRate":0}'
Invoke-RestMethod -Method Post -Uri "$vnpayBase/__control/vnpay" -ContentType "application/json" -Body '{"mode":"fail","latencyMs":0,"failRate":0}'
```

Chọn VNPay và thử 2 lần để mở circuit. Sau đó chọn `Chuyển sang MoMo`.

### Cả hai đều chết

```powershell
Invoke-RestMethod -Method Post -Uri "$momoBase/__control/momo" -ContentType "application/json" -Body '{"mode":"fail","latencyMs":0,"failRate":0}'
Invoke-RestMethod -Method Post -Uri "$vnpayBase/__control/vnpay" -ContentType "application/json" -Body '{"mode":"fail","latencyMs":0,"failRate":0}'
```

Thử mỗi cổng 2 lần. Web phải giữ order, còn đếm thời gian và cho thử lại.

### MoMo sống, VNPay chậm 5 giây

```powershell
Invoke-RestMethod -Method Post -Uri "$momoBase/__control/momo" -ContentType "application/json" -Body '{"mode":"ok","latencyMs":0,"failRate":0}'
Invoke-RestMethod -Method Post -Uri "$vnpayBase/__control/vnpay" -ContentType "application/json" -Body '{"mode":"ok","latencyMs":5000,"failRate":0}'
```

### VNPay sống, MoMo chậm 5 giây

```powershell
Invoke-RestMethod -Method Post -Uri "$momoBase/__control/momo" -ContentType "application/json" -Body '{"mode":"ok","latencyMs":5000,"failRate":0}'
Invoke-RestMethod -Method Post -Uri "$vnpayBase/__control/vnpay" -ContentType "application/json" -Body '{"mode":"ok","latencyMs":0,"failRate":0}'
```
