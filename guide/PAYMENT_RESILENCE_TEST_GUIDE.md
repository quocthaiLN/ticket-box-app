# Hướng Dẫn Kiểm Thử Khả Năng Chịu Lỗi (Payment Resilience Test Guide)

Tài liệu này hướng dẫn cách chạy và giải thích cơ chế hoạt động của các mẫu chịu lỗi **Bulkhead** và **Circuit Breaker** được cài đặt cho hệ thống thanh toán (MoMo & VNPay) khi các cổng này gặp sự cố.

---

## 1. Chuẩn Bị Môi Trường
Trước khi chạy test, bạn cần khởi chạy các dịch vụ sau trên máy tính của mình:

1. **Khởi động Mock Payment Server** (Cổng thanh toán giả lập):
   ```bash
   npm run dev:payment
   ```
   *(Mock server chạy ở cổng `4100`)*

2. **Khởi động API Server & Worker**:
   Đảm bảo file `.env` chính đã có cấu hình tối ưu để test nhanh:
   ```env
   VNPAY_CB_RESET_TIMEOUT=5000     # 5 giây cooldown mạch
   MOMO_CB_RESET_TIMEOUT=5000      # 5 giây cooldown mạch
   VNPAY_CB_FAILURE_THRESHOLD=5    # 5 lỗi liên tiếp thì ngắt mạch
   MOMO_CB_FAILURE_THRESHOLD=5
   ```
   Sau đó chạy các server:
   ```bash
   npm run dev:api
   npm run dev:worker
   ```

3. **Sinh sẵn Token**:
   Hãy chắc chắn bạn đã sinh sẵn file token cho các load test users:
   ```bash
   node --env-file=.env tests/order/generate-tokens.mjs
   ```

---

## 2. Kiểm Thử Cơ Chế Bulkhead (MoMo Phản Hồi Chậm)

### Ý tưởng cốt lõi:
Hệ thống giới hạn tối đa **20 kết nối đồng thời** (`bulkheadLimit = 20`) cho mỗi cổng thanh toán. Khi MoMo bị nghẽn (delay phản hồi 5s), 20 slots này sẽ bị lấp đầy. Yêu cầu thứ 21 trở đi sẽ lập tức bị từ chối nhanh (fail-fast) với lỗi **503** thay vì bị treo và chiếm dụng luồng của API Server.

### Lệnh chạy test:
Bắn 35 kết nối đồng thời (vượt quá giới hạn 20 slots):
```bash
docker compose run --rm k6 run /tests/payment/bulkhead.ts
```

### Kết quả kì vọng:
* **20 requests đầu tiên**: Đi vào slot thành công và bị giữ lại (chờ phản hồi 5s).
* **15 requests tiếp theo**: Bị từ chối ngay lập tức (phản hồi `< 10ms`) trả về lỗi `503 Service Unavailable` và mã code `PAYMENT_PROVIDER_UNAVAILABLE`.

---

## 3. Kiểm Thử Cơ Chế Circuit Breaker (VNPay Bị Sập)

### Ý tưởng cốt lõi:
Theo dõi lỗi kết nối liên tiếp từ VNPay. Khi VNPay sập liên tục:
* Mạch chuyển sang **OPEN**: Chặn ngay mọi request từ cổng vào để bảo vệ tài nguyên hệ thống, trả về lỗi **503** mà không gọi sang VNPay nữa.
* Mạch chuyển sang **HALF-OPEN**: Sau 5s cooldown, cho phép 1 request đi qua để thăm dò. Nếu thành công, mạch đóng lại (**CLOSED**); nếu vẫn lỗi, mạch mở lại (**OPEN**).

### Lệnh chạy test:
Gửi tuần tự 15 requests thanh toán qua VNPay để kiểm tra sự chuyển dịch của mạch:
```bash
docker compose run --rm k6 run /tests/payment/circuit-breaker.ts
```

### Nhật ký hoạt động kì vọng (k6 sẽ in logs trạng thái từng giây):
* **Request 1 -> 5**: VNPay sập. Yêu cầu thất bại. Mạch ở trạng thái **CLOSED** để ghi nhận lỗi.
* **Request 6 -> 10**: Đạt ngưỡng 5 lỗi liên tiếp. Mạch ngắt chuyển sang **OPEN**. Các yêu cầu bị API Server từ chối ngay lập tức (lỗi 503).
* **Request 11**: Chạy sau 6s cooldown. Mạch chuyển sang **HALF-OPEN** -> gửi thăm dò thất bại vì VNPay vẫn hỏng -> mạch lập tức quay về **OPEN**.
* **Request 12**: VNPay hồi phục + cooldown 6s. Mạch chuyển sang **HALF-OPEN** -> gửi thăm dò thành công -> Circuit Breaker tự động khôi phục về trạng thái **CLOSED**.
