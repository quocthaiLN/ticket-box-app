# Hướng dẫn test TicketBox trên Postman

Tài liệu này hướng dẫn bạn test **luồng khán giả** (Audience Flow) từ đăng nhập đến lấy QR vé,
dựa trên collection `TicketBox-Audience-Flow.postman_collection.json`.

> Luồng: **Đăng nhập → chọn concert/ticket type → tạo order (HELD) → tạo payment VNPAY →
> giả lập webhook VNPAY thành công → poll order CONFIRMED → lấy QR vé.**

---

## 1. Chuẩn bị trước khi test

### 1.1. Chạy backend + dịch vụ phụ trợ
Collection gọi vào API ở `http://localhost:3000/v1`, nên cần API server, Postgres, Redis đang chạy.

```powershell
# Bật Postgres + Redis (và các service trong docker-compose)
cd ticket-box-app
docker compose up -d

# Seed dữ liệu (tạo tài khoản audience, concert PUBLISH, ticket type)
npm run db:seed

# Chạy API server
npm run dev
```

Tài khoản seed mặc định:
- Email: `audience@ticketbox.test`
- Mật khẩu: `Password@123`

### 1.2. Kiểm tra biến môi trường VNPAY
Bước "giả lập webhook" tính chữ ký HMAC-SHA512 giống server. Để chữ ký hợp lệ, biến
collection `vnp_hash_secret` **phải trùng** với `VNPAY_HASH_SECRET` trong file `.env`
(repo hiện tại đang là `vnpay_hash_secret`).

> Nếu webhook bị từ chối (RspCode khác `00`), 99% là do hai giá trị này không khớp.

---

## 2. Import collection vào Postman

1. Mở Postman → **Import**.
2. Kéo thả file `postman/TicketBox-Audience-Flow.postman_collection.json` (hoặc chọn **Upload Files**).
3. Sau khi import, bạn sẽ thấy collection **"TicketBox - Audience Flow (Login -> QR)"**
   với 11 request đánh số `0.` → `10.`.

### Biến của collection
Mở collection → tab **Variables**. Các biến quan trọng:

| Biến | Ý nghĩa | Cần sửa? |
|------|---------|----------|
| `base_url` | `http://localhost:3000/v1` | Đổi nếu PORT khác |
| `audience_email` / `audience_password` | Tài khoản đăng nhập | Mặc định là tài khoản seed |
| `vnp_hash_secret` | Khóa ký VNPAY | Phải trùng `.env` |
| `access_token`, `concert_id`, `order_id`, ... | Tự động được set qua các bước | Để trống, đừng sửa tay |

> **Quan trọng:** các biến như `access_token`, `order_id`, `payment_id`, `ticket_id`... được
> các script `test` của từng request **tự động gán** rồi truyền sang bước sau. Vì vậy phải
> chạy **đúng thứ tự** từ trên xuống.

---

## 3. Cách nhanh nhất: Run Collection

Thay vì bấm từng request, bạn có thể chạy cả luồng một lần:

1. Bấm chuột phải vào collection → **Run collection** (hoặc nút **Run**).
2. Giữ nguyên thứ tự 0 → 10.
3. Bấm **Run TicketBox - Audience Flow**.
4. Xem cột kết quả: tất cả test nên **PASS** (xanh).

Nếu muốn hiểu từng bước, làm theo phần 4 dưới đây (chạy thủ công).

---

## 4. Chạy thủ công từng bước

Bấm vào từng request theo thứ tự, nhấn **Send**, rồi kiểm tra tab **Test Results** và **Console**
(View → Show Postman Console để xem các `console.log`).

### Bước 0 — Health check
- **GET** `{{base_url}}/health`
- **Mục đích:** xác nhận API đang chạy.
- **Kỳ vọng:** `200 OK`, test *"API is up"* PASS.
- Nếu lỗi kết nối → API server chưa chạy hoặc sai `base_url`/PORT.

### Bước 1 — Register audience (tùy chọn)
- **POST** `{{base_url}}/auth/register`
- **Body:** email, password, confirmPassword, full_name (lấy từ biến).
- **Mục đích:** tạo tài khoản nếu chưa có.
- **Kỳ vọng:** `201` (tạo mới) **hoặc** `409` (email đã tồn tại do seed) **hoặc** `422`. Cả ba đều OK.
- Có thể bỏ qua nếu đã seed tài khoản.

### Bước 2 — Login
- **POST** `{{base_url}}/auth/login`
- **Body:** `email`, `password`.
- **Mục đích:** lấy token đăng nhập.
- **Tự động set biến:** `access_token`, `user_id`.
- **Kỳ vọng:** `200`, có `access_token`.
- Nếu `401` → sai mật khẩu, hoặc chưa seed/đăng ký tài khoản.

### Bước 3 — List published concerts
- **GET** `{{base_url}}/concerts`
- **Mục đích:** lấy danh sách concert đã PUBLISH.
- **Tự động set biến:** `concert_id` = concert đầu tiên trong danh sách.
- **Kỳ vọng:** `200`, có ít nhất 1 concert.
- Nếu danh sách rỗng → cần seed concert hoặc PUBLISH một concert.

### Bước 4 — List ticket types for concert
- **GET** `{{base_url}}/concerts/{{concert_id}}/ticket-types`
- **Mục đích:** lấy loại vé của concert.
- **Tự động set biến:** `ticket_type_id` = loại vé đầu tiên.
- **Kỳ vọng:** `200`, có ít nhất 1 ticket type.

### Bước 5 — Create order (HELD)
- **POST** `{{base_url}}/orders`
- **Headers:** `Authorization: Bearer {{access_token}}`, `Idempotency-Key: {{$guid}}` (tự sinh).
- **Body:** `concert_id` + `items` (ticket_type_id, quantity = 1).
- **Mục đích:** tạo đơn giữ vé.
- **Tự động set biến:** `order_id`, `total_amount`.
- **Kỳ vọng:** `201`, `status === "HELD"`.

### Bước 6 — Create payment (VNPAY)
- **POST** `{{base_url}}/orders/{{order_id}}/payments`
- **Headers:** `Authorization`, `Idempotency-Key`.
- **Body:** `{ "payment_provider": "VNPAY" }`.
- **Mục đích:** tạo giao dịch thanh toán, nhận `checkout_url`.
- **Tự động set biến:** `payment_id`.
- **Kỳ vọng:** `201`, `status === "PENDING"`.
- Xem `checkout_url` trong Console (đây là link cổng VNPAY thật, nhưng ta sẽ giả lập webhook ở bước 7).

### Bước 7 — Simulate VNPAY webhook (success)
- **POST** `{{base_url}}/payments/webhooks/vnpay`
- **Đặc biệt:** request này có **Pre-request Script** tự tính:
  - `vnp_Amount` = `total_amount × 100` (đơn vị VNPAY).
  - `vnp_TransactionNo` = timestamp hiện tại.
  - `vnp_SecureHash` = HMAC-SHA512 của chuỗi field đã sort, ký bằng `vnp_hash_secret`.
- **Mục đích:** giả lập VNPAY báo thanh toán thành công (`vnp_ResponseCode = "00"`).
- **Kỳ vọng:** `200`, response `RspCode === "00"` (Confirm Success).
- Nếu `RspCode` khác `00` → kiểm tra lại `vnp_hash_secret` có khớp `.env` không (xem mục 1.2).

### Bước 8 — Poll order (expect CONFIRMED + tickets)
- **GET** `{{base_url}}/orders/{{order_id}}`
- **Headers:** `Authorization`.
- **Mục đích:** xác nhận đơn đã chuyển sang CONFIRMED và vé đã được phát hành.
- **Tự động set biến:** `ticket_id` = vé đầu tiên.
- **Kỳ vọng:** `200`, `status === "CONFIRMED"`, mảng `tickets` có phần tử.
- Nếu vẫn `HELD` → webhook bước 7 chưa được xử lý xong; thử Send lại sau 1-2 giây
  (xử lý có thể bất đồng bộ qua queue).

### Bước 9 — List my tickets
- **GET** `{{base_url}}/me/tickets`
- **Headers:** `Authorization`.
- **Mục đích:** xem toàn bộ vé của user.
- **Kỳ vọng:** `200`, danh sách có vé.

### Bước 10 — Get ticket QR
- **GET** `{{base_url}}/me/tickets/{{ticket_id}}/qr`
- **Headers:** `Authorization`.
- **Mục đích:** lấy payload QR của vé.
- **Kỳ vọng:** `200`, có dữ liệu QR (xem trong Console qua `console.log('QR =', ...)`).

---

## 5. Xử lý lỗi thường gặp

| Triệu chứng | Nguyên nhân khả năng | Cách xử lý |
|-------------|----------------------|------------|
| Bước 0 lỗi kết nối | API chưa chạy / sai PORT | `npm run dev`, kiểm tra `base_url` |
| Bước 2 trả `401` | Sai tài khoản / chưa seed | Chạy bước 1 hoặc `npm run db:seed` |
| Bước 3 danh sách rỗng | Chưa có concert PUBLISH | Seed lại DB |
| Bước 7 `RspCode != 00` | `vnp_hash_secret` ≠ `.env` | Đồng bộ hai giá trị |
| Bước 8 vẫn `HELD` | Webhook xử lý async chưa xong | Send lại sau vài giây |
| `401` ở các bước cần token | `access_token` rỗng | Chạy lại bước 2 Login trước |

---

## 6. Mẹo

- Luôn mở **Postman Console** (`Ctrl + Alt + C`) để xem các `console.log` (concert_id, order_id, checkout_url, QR...).
- Mỗi lần test lại từ đầu, không cần xóa biến — các bước sẽ tự ghi đè giá trị mới.
- Muốn test nhiều vé: sửa `quantity` trong body bước 5.
- Nếu chạy ở môi trường khác (staging), chỉ cần đổi `base_url` và `vnp_hash_secret`.
