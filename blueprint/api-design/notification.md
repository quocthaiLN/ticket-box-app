### Notification

## 2. Quy ước Dữ liệu & Ánh xạ Mô hình Hệ thống

* **Thời gian:** Định dạng ISO 8601 mở rộng có múi giờ, mặc định UTC: `YYYY-MM-DDTHH:mm:ssZ`.
* **Mã định danh (ID):** Sử dụng chuỗi định danh có tiền tố (Opaque Prefix String) để che giấu kiến trúc dữ liệu vật lý UUID của PostgreSQL:
* `ntm_` - Bản ghi thuộc bảng `notification_templates`.
* `nlg_` - Bản ghi thuộc bảng `notification_logs`.
* `ndl_` - Bản ghi thuộc bảng `notification_dead_letters`.



---

## 3. Chi tiết Giao diện Lập trình Ứng dụng (API Specifications)

### 3.1. Tạo mới Mẫu Thông báo Hệ thống (Notification Template)

* **Endpoint:** `POST /v1/notifications/templates`
* **Tên miền áp dụng:** `https://api.ticketbox.vn/v1`
* **Phân quyền:** Yêu cầu mã xác thực Token JWT hợp lệ với vai trò Quản trị viên (`ADMIN`) hoặc Ban tổ chức (`ORGANIZER`).
* **Header bắt buộc:** * `Authorization: Bearer <jwt_token>`
* `Content-Type: application/json`



#### Request Body:

```json
{
  "code": "TICKET_PURCHASED_CONFIRMATION",
  "channel": "EMAIL",
  "subject": "Xác nhận đặt vé thành công — {concert_name}",
  "body": "<p>Chào {full_name}, đơn hàng của bạn đã thanh toán thành công. Mã vé điện tử của bạn là: {ticket_id}.</p>",
  "is_active": true
}

```

#### Xử lý Logic tại Tầng Backend:

1. Xác thực quyền hạn của Actor qua Token JWT. Nếu hợp lệ, tiến hành kiểm tra tính hợp pháp của trường dữ liệu enum `channel` (`APP`, `EMAIL`, `SMS`, `ZALO_OA`).
2. Thực hiện truy vấn kiểm tra ràng buộc duy nhất (`UNIQUE`) dựa trên cặp khóa hợp nhất `(code, channel)`. Nếu đã tồn tại mẫu trùng mã trong hệ thống, lập tức từ chối và phản hồi mã lỗi nghiệp vụ.
3. Chèn bản ghi dữ liệu mới vào bảng `notification_templates` trong PostgreSQL. Trường dữ liệu `id` vật lý (UUID) tự động khởi tạo qua hàm hệ thống `gen_random_uuid()`.

#### Response `201 Created`:

```json
{
  "data": {
    "id": "ntm_01JX9Q2M5P7KZ3R4N8Y6TEMPLATE",
    "code": "TICKET_PURCHASED_CONFIRMATION",
    "channel": "EMAIL",
    "subject": "Xác nhận đặt vé thành công — {concert_name}",
    "body": "<p>Chào {full_name}, đơn hàng của bạn đã thanh toán thành công. Mã vé điện tử của bạn là: {ticket_id}.</p>",
    "is_active": true,
    "created_at": "2026-05-30T15:45:00Z",
    "updated_at": "2026-05-30T15:45:00Z"
  },
  "meta": {
    "request_id": "req_01JX9Q6N4E001"
  }
}

```

---

### 3.2. Tra cứu Nhật ký Gửi Thông báo (Audit & Logs Analytics)

* **Endpoint:** `GET /v1/notifications/logs`
* **Tên miền áp dụng:** `https://api.ticketbox.vn/v1`
* **Phân quyền:** Chỉ cho phép tài khoản thuộc nhóm quyền `ADMIN` hoặc `ORGANIZER` truy cập để thực hiện đối soát kỹ thuật.
* **Cơ chế Phân trang:** Sử dụng phương thức Phân trang dựa trên con trỏ (Cursor-based Pagination) để tối ưu hiệu năng truy vấn SQL trên bảng dữ liệu log có dung lượng bản ghi cực lớn.

#### Query Parameters:

| Tham số | Kiểu dữ liệu | Bắt buộc | Mặc định | Mô tả |
| --- | --- | --- | --- | --- |
| `channel` | VARCHAR | Không | Không | Lọc lịch sử theo kênh gửi (`EMAIL`, `SMS`, `ZALO_OA`, `APP`). |
| `status` | VARCHAR | Không | Không | Lọc trạng thái (`PENDING`, `SENT`, `FAILED`, `RETRYING`). |
| `concert_id` | VARCHAR | Không | Không | Lọc toàn bộ danh sách log liên quan đến một Concert cụ thể. |
| `limit` | INTEGER | Không | `20` | Số lượng bản ghi giới hạn tối đa trả về trên một trang (Max: 100). |
| `cursor` | VARCHAR | Không | Không | Chuỗi mã hóa vô định trỏ đến vị trí dòng tiếp theo trong DB. |

#### Response `200 OK`:

```json
{
  "data": [
    {
      "id": "nlg_01JX9Q2M5P7KZ3R4N8Y6LOG0001",
      "template_id": "ntm_01JX9Q2M5P7KZ3R4N8Y6TEMPLATE",
      "user_id": "usr_01JX9Q2M5P7KZ3R4N8Y6USER001",
      "concert_id": "crt_01JX9Q2M5P7KZ3R4N8Y6",
      "ticket_id": "tck_01JX9Q2M5P7KZ3R4N9B1",
      "channel": "EMAIL",
      "destination": "khangia@gmail.com",
      "status": "SENT",
      "provider_message_id": "msg_sg_94810238491",
      "error_message": null,
      "retry_count": 1,
      "scheduled_at": null,
      "sent_at": "2026-05-30T10:16:05Z",
      "created_at": "2026-05-30T10:15:32Z"
    }
  ],
  "pagination": {
    "next_cursor": "eyJpZCI6Im5sZ18wMUpYOSJ9",
    "has_more": true,
    "limit": 1
  },
  "meta": {
    "request_id": "req_01JX9Q6N4E002"
  }
}

```

---

### 3.3. Tái xử lý Thông báo Thất bại Nghiêm trọng trong Dead Letter Queue (DLQ Replay)

* **Endpoint:** `POST /v1/notifications/dead-letters/{id}/replay`
* **Tên miền áp dụng:** `https://api.ticketbox.vn/v1`
* **Phân quyền:** Giới hạn đặc quyền tối cao cho nhóm kỹ thuật thuộc vai trò Hệ thống `ADMIN`.
* **Cơ chế Bảo vệ:** Endpoint yêu cầu cơ chế lặp lại xử lý có tính an toàn (Idempotent Receiver) nhằm loại bỏ rủi ro điều hành viên click chuột hai lần liên tục làm phát sinh hai luồng gửi trùng lặp.

#### Path Parameters:

| Tham số | Kiểu dữ liệu | Ý nghĩa trong Database |
| --- | --- | --- |
| `id` | VARCHAR (Opaque) | Ánh xạ trực tiếp sang trường khóa chính `id` của bảng `notification_dead_letters`. |

#### Xử lý Logic tại Tầng Backend:

1. Hệ thống tìm kiếm bản ghi DLQ trong cơ sở dữ liệu. Nếu không tìm thấy hoặc trường dữ liệu `resolved_at` đã được điền mốc thời gian (Tác vụ đã xử lý xong trước đó), hệ thống lập tức từ chối và trả về mã thành công giả lập hoặc thông báo lỗi trạng thái nghiệp vụ.
2. Trích xuất thuộc tính cấu hình dữ liệu thô `payload` dạng đối tượng `JSONB` từ dòng dữ liệu đích.
3. Đẩy ngược dữ liệu Payload này vào hàng đợi an toàn của BullMQ (`NotificationQueue`) để yêu cầu các tiến trình Worker kích hoạt lại vòng đời xử lý và phân phối thông báo từ đầu.
4. Chạy câu lệnh cập nhật cơ sở dữ liệu để ghi nhận mốc thời gian thực thi: `UPDATE notification_dead_letters SET resolved_at = now() WHERE id = {id}`.

#### Response `200 OK`:

```json
{
  "data": {
    "dead_letter_id": "ndl_01JX9Q2M5P7KZ3R4N8Y6DLQ0001",
    "status": "REPLAYED",
    "resolved_at": "2026-05-30T16:00:00Z",
    "message": "Dữ liệu payload của thông báo lỗi đã được nạp lại thành công vào hệ thống hàng đợi tác vụ BullMQ."
  },
  "meta": {
    "request_id": "req_01JX9Q6N4E003"
  }
}

```

---

## 4. Đặc tả Ma trận Quản lý Lỗi Chuẩn hóa (RFC 7807)

Mọi phản hồi lỗi hệ thống phát sinh từ mô-đun này đều được cấu hình Header quy chuẩn bắt buộc `Content-Type: application/problem+json`.

### 4.1. Lỗi Xung đột Cấu hình Mẫu thông báo (Trùng lặp Cặp khóa Nghiệp vụ)

Hệ thống từ chối xử lý khi ban tổ chức cố tình tạo hai Template có chung mã định danh nghiệp vụ trên cùng một kênh phân phối kỹ thuật.

#### Response `409 Conflict`:

```json
{
  "type": "https://api.ticketbox.vn/errors/template-conflict",
  "title": "Mẫu thông báo đã tồn tại",
  "status": 409,
  "code": "TEMPLATE_CONFLICT",
  "detail": "Hệ thống ghi nhận mã cấu hình TICKET_PURCHASED_CONFIRMATION dành cho kênh phân phối EMAIL đã được khởi tạo trước đó. Vui lòng cập nhật mẫu cũ hoặc thay đổi thông tin.",
  "instance": "/v1/notifications/templates",
  "request_id": "req_01JX9Q6N4E004",
  "errors": [
    {
      "field": "code",
      "message": "Cặp giá trị kết hợp giữa (code, channel) vi phạm điều kiện ràng buộc UNIQUE của cơ sở dữ liệu."
    }
  ]
}

```

### 4.2. Lỗi Yêu cầu Tái xử lý Job DLQ đã được giải quyết xong trước đó

Phát sinh khi quản trị viên thực hiện gọi lệnh Replay một bản ghi lỗi trong hàng đợi chết mà bản ghi này đã được xử lý thành công bởi một kỹ sư khác.

#### Response `409 Conflict`:

```json
{
  "type": "https://api.ticketbox.vn/errors/dlq-already-resolved",
  "title": "Tác vụ lỗi trong DLQ đã được giải quyết",
  "status": 409,
  "code": "DLQ_ALREADY_RESOLVED",
  "detail": "Bản ghi thông báo lỗi này đã được kích hoạt chạy lại và xử lý thành công vào thời điểm ghi nhận trong cơ sở dữ liệu. Bạn không thể thực hiện phát lại đơn hàng liên tục.",
  "instance": "/v1/notifications/dead-letters/ndl_01JX9Q2M5P7KZ3R4N8Y6DLQ0001/replay",
  "request_id": "req_01JX9Q6N4E005"
}

```

---

## 5. Ma trận Phân quyền Truy cập Hệ thống (RBAC Matrix)

Mô-đun thông báo chứa thông tin nhạy cảm về luồng giao dịch tài chính (Mã vé điện tử, địa chỉ email cá nhân) và cấu hình lõi hệ thống, do đó tuyệt đối đóng kín đối với các truy cập công khai không định danh (`GUEST`) hoặc vai trò Khán giả thông thường (`AUDIENCE`).

| Phương thức & Đường dẫn Endpoint | Vai trò `GUEST` | Vai trò `AUDIENCE` | Vai trò `ORGANIZER` | Vai trò `ADMIN` | Ghi chú Ràng buộc An toàn |
| --- | --- | --- | --- | --- | --- |
| `POST /v1/notifications/templates` | Từ chối (`411`) | Từ chối (`403`) | **Cho phép (Allow)** | **Cho phép (Allow)** | Yêu cầu kiểm tra chữ ký khóa Bearer Token JWT. |
| `GET /v1/notifications/logs` | Từ chối (`411`) | Từ chối (`403`) | **Cho phép (Allow)** | **Cho phép (Allow)** | Hỗ trợ phân trang Cursor phục vụ đối soát dữ liệu. |
| `POST /v1/notifications/dead-letters/{id}/replay` | Từ chối (`411`) | Từ chối (`403`) | Từ chối (`403`) | **Cho phép (Allow)** | Đặc quyền tối cao dành riêng cho kỹ sư vận hành lõi. |

---

