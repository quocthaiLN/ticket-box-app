# Demo: Thanh toán không ổn định (Bulkhead + Circuit Breaker)

## Cấu hình chung (tests/.env + ticket-box-app/.env)

```env
# --- Dùng cho cả Phần 1 và Phần 2 ---

# API server circuit breaker
MOMO_CB_FAILURE_THRESHOLD=5
MOMO_CB_RESET_TIMEOUT=10000
VNPAY_CB_FAILURE_THRESHOLD=5
VNPAY_CB_RESET_TIMEOUT=10000

# Payment mock ports
MOMO_MOCK_PORT=4101
VNPAY_MOCK_PORT=4102
MOMO_ENDPOINT=http://localhost:4101/momo/v2/gateway/api/create
MOMO_QUERY_ENDPOINT=http://localhost:4101/momo/v2/gateway/api/query
VNPAY_MOCK_PREPARE_URL=http://localhost:4102/vnpay/prepare
VNPAY_URL=http://localhost:4102/vnpay/vpcpay.html
VNPAY_QUERYDR_URL=http://localhost:4102/vnpay/merchant_webapi/api/transaction
```

---

## Dọn dữ liệu (chạy trước mỗi lần demo)

```bash
npx prisma migrate reset --schema=packages/database/prisma/schema.prisma --force
docker exec -i ticketbox-redis redis-cli flushall
npm run db:seed
npm run generate:tokens -w @ticketbox/tests
```

---

## Khởi động services

```powershell
# Terminal 1: API server
npm run dev:api

# Terminal 2: MoMo mock
npm run dev:payment:momo

# Terminal 3: VNPay mock
npm run dev:payment:vnpay
```

---

## Shortcut PowerShell

```powershell
$momoBase  = "http://localhost:4101"
$vnpayBase = "http://localhost:4102"

# Reset cả hai về bình thường
function Reset-Gateways {
  Invoke-RestMethod -Method Post -Uri "$momoBase/__control/reset"
  Invoke-RestMethod -Method Post -Uri "$vnpayBase/__control/reset"
}

# Đặt trạng thái
function Set-Gateway($base, $provider, $mode, $latencyMs = 0) {
  Invoke-RestMethod -Method Post -Uri "$base/__control/$provider" `
    -ContentType "application/json" `
    -Body (ConvertTo-Json @{ mode = $mode; latencyMs = $latencyMs; failRate = 0 })
}
```

---

## PHẦN 1 — Demo tay: cổng lỗi, user vẫn hoạt động được

### Trường hợp 1: MoMo lỗi, VNPay mock sống

```powershell
Set-Gateway $momoBase  "momo"  "fail"
Set-Gateway $vnpayBase "vnpay" "ok"
```

**Kịch bản thao tác:**
1. Trên UI chọn MoMo → thử 5 lần → mỗi lần nhận lỗi 503
2. Sau lần thứ 5: CB MoMo OPEN → kiểm tra tại `GET /v1/payments/health`
3. Chuyển sang VNPay → thanh toán thành công
4. **Điểm demo**: user không bị kẹt dù 1 cổng hoàn toàn chết

> **Kiểm tra CB state**: `curl http://localhost:3000/v1/payments/health`

---

### Trường hợp 2: Cả hai cổng đều lỗi → vé vẫn được giữ → rồi phục hồi

```powershell
Set-Gateway $momoBase  "momo"  "fail"
Set-Gateway $vnpayBase "vnpay" "fail"
```

**Kịch bản thao tác:**
1. Đặt order → order ở trạng thái **HELD** (vé đã giữ) ✅
2. Thử MoMo 5 lần → CB MoMo OPEN
3. Thử VNPay 5 lần → CB VNPay OPEN
4. UI hiển thị "cổng thanh toán tạm thời không khả dụng, vé vẫn đang giữ"
5. Chạy lệnh phục hồi VNPay mock:
   ```powershell
   Set-Gateway $vnpayBase "vnpay" "ok"
   ```
6. Chờ 10 giây (RESET_TIMEOUT=10s) → CB VNPay tự chuyển HALF_OPEN
7. Thử thanh toán VNPay → probe thành công → CB CLOSED → hoàn tất

**Điểm demo**: order không bị mất, vé không bị release dù cả hai cổng sập; khi cổng sống lại thì thanh toán bình thường.

---

## PHẦN 2 — K6: Demo Bulkhead và Circuit Breaker tự động

### 2a. Circuit Breaker (tuần tự, 22 iterations)

**Config `tests/.env`:**
```env
PAYMENT_CIRCUIT_FAILURE_THRESHOLD=5
PAYMENT_CIRCUIT_TOTAL_ITERATIONS=22
PAYMENT_CIRCUIT_COOLDOWN_SECONDS=11
MOMO_CB_FAILURE_THRESHOLD=5
MOMO_CB_RESET_TIMEOUT=10000
```

**Timeline 22 iterations** (`failureThreshold=5`, mỗi bước ~1–2s trừ cooldown):

| Iteration | Hành vi | CB State |
|---|---|---|
| 1–4 | Lỗi MoMo, failureCount tăng | CLOSED |
| 5 | Lỗi đạt ngưỡng → **CB MỞ** | **OPEN** ❗ |
| 6–10 | Bị chặn ngay (<5ms, không chạm MoMo) | OPEN |
| 11 | Chờ 11s → probe → MoMo vẫn lỗi → **OPEN lại** | OPEN |
| 12 | Reset MoMo → chờ 11s → probe thành công → **CLOSED** | **CLOSED** ✅ |
| 13–22 | Hoạt động bình thường (201) | CLOSED |

**Chạy:**
```bash
# Chạy trong container k6 hoặc local
docker compose run --rm k6 run --env-file=tests/.env tests/payment/circuit-breaker.ts
docker compose run --rm k6 run /tests/payment/circuit-breaker.ts
```

**Log quan sát trên terminal:**
```
[i=1] Request Status: 503 | Circuit Breaker State: CLOSED
[i=5] Request Status: 503 | Circuit Breaker State: OPEN   ← CB MỞ
[i=6] Request Status: 503 | Circuit Breaker State: OPEN   ← chặn ngay
[i=11] Waiting 11s... → probe fail → OPEN lại
[i=12] Reset MoMo → Waiting 11s... → probe ok → CLOSED    ← CB ĐÓNG ✅
[i=13] Request Status: 201 | Circuit Breaker State: CLOSED
```

---

### 2b. Bulkhead (35 VUs đồng thời, bulkhead limit=20)

**Config `tests/.env`:**
```env
PAYMENT_BULKHEAD_LIMIT=20
PAYMENT_BULKHEAD_VUS=35
PAYMENT_BULKHEAD_LATENCY_MS=5000
PAYMENT_BULKHEAD_TIMEOUT_MS=10000
```

**Cơ chế:**
- 35 VU gửi request thanh toán MoMo **đồng thời**
- MoMo mock phản hồi thành công nhưng **chậm 5s** để chiếm đầy slot
- Bulkhead limit=20 → **20 request đầu** lọt vào (chờ 5s → 201)
- **15 request còn lại** bị từ chối ngay (<200ms → 503 PAYMENT_PROVIDER_UNAVAILABLE)

**Chạy:**
```bash
k6 run --env-file=tests/.env tests/payment/bulkhead.ts
```

**Metric quan sát:**
```
payment_bulkhead_accepted: 20  ← vào được slot, thành công
payment_bulkhead_rejected: 15  ← bị từ chối nhanh
```

**Điểm demo**: Khi cổng chậm, hệ thống không để request chồng chất vô hạn. 15 user bị từ chối ngay thay vì tất cả 35 bị treo chờ → tài nguyên server được bảo vệ.
