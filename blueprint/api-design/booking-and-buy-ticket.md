# Booking & Buy Ticket

## 2. Quy ước Dữ liệu Hệ thống

* **Thời gian:** Định dạng ISO 8601 có múi giờ, ưu tiên sử dụng UTC: `YYYY-MM-DDTHH:mm:ssZ`.
* **Tiền tệ:** Thể hiện bằng một đối tượng phức hợp (Compound Object) gồm giá trị số nguyên (`amount`) và mã tiền tệ chuẩn ISO 4217 (`currency`: `VND`).
* **Mã định danh (ID):** Sử dụng chuỗi định danh có tiền tố (Opaque Prefix String) để bảo mật kiến trúc vật lý cơ sở dữ liệu (Ví dụ: `ord_01JX9Q2M5P` ánh xạ sang định dạng UUID trong PostgreSQL).

---

## 3. Đặc tả Chi tiết các Giao diện Lập trình (API Specifications)

### 3.1. Tiến hành Đặt vé & Giữ chỗ Tạm thời (Hold Ticket)

* **Endpoint:** `POST /v1/tickets/hold`
* **Tên miền áp dụng:** `https://api.ticketbox.vn/v1`
* **Phân quyền:** Yêu cầu Token xác thực hợp lệ với vai trò khán giả (`AUDIENCE`).
* **Header bắt buộc:**
* `Authorization: Bearer <jwt_token>`
* `Idempotency-Key: <uuid_v4>`

#### Request Body:

```json
{
  "concert_id": "crt_01JX9Q2M5P7KZ3R4N8Y6",
  "items": [
    {
      "ticket_type_id": "tty_01JX9Q2M5P7KZ3R4N9A1",
      "quantity": 2
    }
  ]
}
```

#### Response `201 Created`:

```json
{
  "data": {
    "order_id": "ord_01JX9Q2M5P7KZ3R4N8Y6",
    "concert_id": "crt_01JX9Q2M5P7KZ3R4N8Y6",
    "status": "HELD",
    "total_amount": 9000000.00,
    "currency": "VND",
    "hold_expires_at": "2026-05-30T10:25:30Z",
    "checkout_url": "https://sandbox.vnpayment.vn/payment/vnpay.html?token=vnp_01JXC",
    "items": [
      {
        "ticket_type_id": "tty_01JX9Q2M5P7KZ3R4N9A1",
        "quantity": 2,
        "unit_price": 4500000.00,
        "line_total": 9000000.00
      }
    ]
  },
  "meta": {
    "request_id": "req_01JX9Q6N4E"
  }
}

```

---

### 3.2. Webhook Tiếp nhận Kết quả Thanh toán từ Đối tác (Instant Payment Notification)

* **Endpoint:** `POST /v1/payments/webhooks/{provider}`
* **Tham số Đường dẫn (Path Parameter):** `provider` chấp nhận một trong hai giá trị cấu hình đóng: `vnpay` hoặc `momo`.
* **Tên miền áp dụng:** `https://api.ticketbox.vn/v1`
* **Phân quyền:** Công khai (Public Endpoint) — Tuy nhiên hệ thống thực hiện giải mã, kiểm tra chữ ký điện tử mật mã bảo mật (Checksum/Signature Validation) sử dụng khoá bí mật `Secret Key` được chia sẻ riêng giữa TicketBox và đối tác thanh toán để xác thực nguồn gốc gói tin dữ liệu gửi đến.

#### Request Body (Cấu trúc chuẩn hóa dữ liệu thô nhận từ VNPAY):

```json
{
  "vnp_Amount": "900000000",
  "vnp_BankCode": "NCB",
  "vnp_BankTranNo": "VNP14829301",
  "vnp_CardType": "ATM",
  "vnp_OrderInfo": "Thanh toan don hang ord_01JX9Q2M5P7KZ3R4N8Y6",
  "vnp_PayDate": "20260530101830",
  "vnp_ResponseCode": "00",
  "vnp_TmnCode": "TBOX01",
  "vnp_TransactionNo": "7482910",
  "vnp_TxnRef": "ord_01JX9Q2M5P7KZ3R4N8Y6",
  "vnp_SecureHash": "a5b6c7d8e9f0123456789abcdef0123456789abcdef0123456789abcdef01234"
}

```

#### Response `200 OK` (Cấu trúc phản hồi bắt buộc theo chuẩn kỹ thuật của VNPAY):

```json
{
  "RspCode": "00",
  "Message": "Confirm Success"
}

```

---

### 3.3. Lấy Trạng thái Chi tiết Đơn hàng & Vé Điện tử (Polling Endpoint)

* **Endpoint:** `GET /v1/orders/{id}`
* **Tên miền áp dụng:** `https://api.ticketbox.vn/v1`
* **Phân quyền:** Yêu cầu Token xác thực hợp lệ với vai trò khán giả (`AUDIENCE`). Tài khoản thực hiện truy vấn phải chính là chủ sở hữu đơn hàng (đối chiếu `user_id` trong mã JWT gốc và trường dữ liệu sở hữu đơn hàng trong bảng `orders`).
* **Cơ chế Cache:** Không lưu bộ nhớ đệm tại tầng biên mạng (`Cache-Control: no-store`) nhằm mục đích phản ánh chính xác trạng thái xử lý tức thời của hệ thống.

#### Path Parameters:

| Tham số | Kiểu dữ liệu | Ý nghĩa hệ thống |
| --- | --- | --- |
| `id` | VARCHAR (Opaque) | Mã định danh duy nhất của đơn hàng cần tra cứu trạng thái nghiệp vụ. |

#### Response `200 OK` (Trường hợp đơn hàng đã hoàn tất thanh toán thành công hoàn toàn):

```json
{
  "data": {
    "order_id": "ord_01JX9Q2M5P7KZ3R4N8Y6",
    "status": "PAID",
    "total_amount": 9000000.00,
    "currency": "VND",
    "created_at": "2026-05-30T10:15:30Z",
    "updated_at": "2026-05-30T10:18:35Z",
    "tickets": [
      {
        "ticket_id": "tck_01JX9Q2M5P7KZ3R4N9B1",
        "ticket_type_name": "SVIP Early Bird",
        "seat_zone_code": "SVIP",
        "qr_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0Y2siOiJ0Y2tfMDEifQ",
        "status": "ISSUED"
      },
      {
        "ticket_id": "tck_01JX9Q2M5P7KZ3R4N9B2",
        "ticket_type_name": "SVIP Early Bird",
        "seat_zone_code": "SVIP",
        "qr_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0Y2siOiJ0Y2tfMDIifQ",
        "status": "ISSUED"
      }
    ]
  },
  "meta": {
    "request_id": "req_01JX9Q6N4G"
  }
}

```

---

## 4. Ma trận Quản lý Lỗi Chuẩn hóa (RFC 7807) & Kịch bản Nghiệp vụ Rẽ nhánh

Hệ thống thiết lập chuẩn hóa toàn bộ các phản hồi lỗi về định dạng Header quy chuẩn `Content-Type: application/problem+json`. Dưới đây là đặc tả chi tiết cấu trúc dữ liệu lỗi áp dụng riêng cho luồng Đặt vé phục vụ kịch bản rẽ nhánh nghiệp vụ (Alternative Scenarios).

### 4.1. Trường hợp A: Tài khoản mua vượt quá giới hạn tối đa (Per-user limit exceeded)

Phát sinh tại bước kiểm tra điều kiện ràng buộc trong Database Transaction khi phát hiện số lượng vé yêu cầu cộng dồn với lịch sử sở hữu vượt quá quy định cấu hình của ban tổ chức sự kiện.

#### Response `422 Unprocessable Entity`:

```json
{
  "type": "https://api.ticketbox.vn/errors/guest-limit-exceeded",
  "title": "Vượt giới hạn mua vé tối đa trên một tài khoản",
  "status": 422,
  "code": "GUEST_LIMIT_EXCEEDED",
  "detail": "Loại vé SVIP quy định giới hạn tối đa 2 vé cho mỗi tài khoản người dùng. Hệ thống ghi nhận bạn đã sở hữu hoặc đang thực hiện giữ 1 vé thuộc loại này trước đó.",
  "instance": "/v1/tickets/hold",
  "request_id": "req_01JX9Q6N4H",
  "errors": [
    {
      "field": "quantity",
      "message": "Số lượng vé yêu cầu (2) kết hợp số lượng vé hiện tại (1) vượt giới hạn cho phép (2)."
    }
  ]
}

```

### 4.2. Trường hợp B: Hết vé tại thời điểm bấm đặt (Tranh chấp dữ liệu kho vé dưới tải cao)

Hệ thống xử lý kịch bản hàng vạn người dùng cùng tranh giành một số lượng nhỏ vé khan hiếm, kiểm tra trường dữ liệu tồn kho khả dụng `available_quantity` không đủ đáp ứng.

#### Response `409 Conflict`:

```json
{
  "type": "https://api.ticketbox.vn/errors/insufficient-inventory",
  "title": "Số lượng vé tồn kho không đủ",
  "status": 409,
  "code": "SOLD_OUT",
  "detail": "Khu vực vé bạn lựa chọn đã được đặt hết toàn bộ tại hệ thống bộ đệm đếm nguyên tử. Vui lòng quay lại danh mục sự kiện và lựa chọn hạng vé khác.",
  "instance": "/v1/tickets/hold",
  "request_id": "req_01JX9Q6N4I"
}

```

### 4.3. Trường hợp C: Cổng thanh toán đối tác gặp sự cố sập nguồn (Circuit Breaker kích hoạt)

Trường hợp Module kết nối ghi nhận tỷ lệ lỗi kết nối mạng internet ra bên ngoài vượt ngưỡng an toàn, máy trạng thái của Circuit Breaker tự động chuyển dịch sang pha `Open` và thực hiện chặn đứng cuộc gọi.

#### Response `503 Service Unavailable`:

```json
{
  "type": "https://api.ticketbox.vn/errors/payment-gateway-failure",
  "title": "Cổng thanh toán trực tuyến đang bận",
  "status": 503,
  "code": "PAYMENT_GATEWAY_ERROR",
  "detail": "Hệ thống ghi nhận kết nối mạng đến đối tác VNPAY đang gián đoạn để bảo trì. TicketBox đã chủ động hoàn trả lại số lượng ghế tạm giữ của bạn vào kho vé tổng để đảm bảo quyền lợi. Vui lòng thử lại sau ít phút hoặc lựa chọn phương thức thanh toán khác.",
  "instance": "/v1/tickets/hold",
  "request_id": "req_01JX9Q6N4J"
}

```

### 4.4. Trường hợp D: Gửi request đặt vé lặp lại liên tục khi request trước chưa xử lý xong

Hệ thống đánh chặn request trùng lặp tại tầng Middleware Idempotency khi tra cứu khóa trên bộ nhớ đệm Redis thấy trạng thái của giao dịch hiện tại đang nằm ở pha `PROCESSING`.

#### Response `409 Conflict`:

```json
{
  "type": "https://api.ticketbox.vn/errors/idempotency-in-progress",
  "title": "Yêu cầu giao dịch đang được xử lý",
  "status": 409,
  "code": "IDEMPOTENCY_IN_PROGRESS",
  "detail": "Hệ thống đang tiến hành giữ chỗ và thiết lập liên kết ngân hàng cho yêu cầu trước đó của bạn. Vui lòng không nhấn nút đặt vé liên tục để tránh xung đột tài khoản.",
  "instance": "/v1/tickets/hold",
  "request_id": "req_01JX9Q6N4K"
}

```

---

## 5. Ma trận Phân quyền Truy cập (RBAC Matrix)

Dưới đây là bảng phân rã quyền hạn chi tiết áp dụng riêng đối với nhóm API đặt vé và xử lý thanh toán để đảm bảo tính cô lập và bảo mật hệ thống.

| Phương thức & Endpoint | Vai trò `GUEST` (Chưa đăng nhập) | Vai trò `AUDIENCE` (Khán giả) | Đối tác Cổng thanh toán | Ghi chú bảo mật hệ thống |
| --- | --- | --- | --- | --- |
| `POST /v1/tickets/hold` | Từ chối (`410` / `401`) | **Cho phép (Allow)** | Từ chối (`403`) | Bắt buộc truyền mã xác thực Bearer Token JWT và Idempotency-Key. |
| `POST /v1/payments/webhooks/{provider}` | **Cho phép (Allow)** | Từ chối (`403`) | **Cho phép (Allow)** | Endpoint mở công khai nhưng bắt buộc kiểm tra chữ ký Checksum mật mã. |
| `GET /v1/orders/{id}` | Từ chối (`401`) | **Cho phép (Allow)** | Từ chối (`403`) | Tầng logic Backend kiểm tra quyền sở hữu chéo (Resource Ownership Check). |
