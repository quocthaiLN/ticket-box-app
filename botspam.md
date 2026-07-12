# Tài liệu Kiểm thử Phòng chống Bot/Spam (Bot/Spam Protection Testing)

Hệ thống Ticket Box được trang bị các cơ chế phòng chống bot và spam request để đảm bảo tính ổn định của hệ thống trước lượng tải lớn đột biến. Tài liệu này mô tả chi tiết cách thức triển khai và các kịch bản kiểm thử trong hai file kịch bản k6: [botspam.ts](file:///c:/Users/quoct/Repositories/ThietKePhanMem/FINAL_PROJECT/ticket-box-app/tests/catalog/botspam.ts) (kiểm thử catalog API) và [botspam.ts](file:///c:/Users/quoct/Repositories/ThietKePhanMem/FINAL_PROJECT/ticket-box-app/tests/order/botspam.ts) (kiểm thử order API).

---

## 1. Kiểm thử Catalog API: [botspam.ts (catalog)](file:///c:/Users/quoct/Repositories/ThietKePhanMem/FINAL_PROJECT/ticket-box-app/tests/catalog/botspam.ts)

### Mục tiêu kiểm thử
Xác minh cơ chế **Rate Limiting theo địa chỉ IP** hoạt động chính xác khi có lượng request lớn, liên tục truy cập vào các API đọc thông tin Concert (Public Catalog API) từ cùng một địa chỉ IP.

### Cách thức triển khai kịch bản
- **Executor**: Sử dụng mô hình `shared-iterations` chạy đồng thời với **250 Virtual Users (VUs)** thực hiện tổng cộng **250 iterations**.
- **Luồng thực thi trong 1 iteration**:
  Mỗi VU sẽ gọi tuần tự 5 endpoints của Concert (sử dụng ID concert lấy từ biến môi trường `BOTSPAM_CATALOG_CONCERT_ID` hoặc mặc định là `00000000-0000-0000-0000-000000000202`):
  1. `GET /v1/concerts/:concert_id` (Thông tin Concert)
  2. `GET /v1/concerts/:concert_id/metadata` (Metadata Concert)
  3. `GET /v1/concerts/:concert_id/seat-map` (Sơ đồ ghế)
  4. `GET /v1/concerts/:concert_id/ticket-types` (Các loại vé)
  5. `GET /v1/concerts/:concert_id/inventory` (Số lượng vé còn lại)
- **Tổng số request gửi đi**: $250 \text{ iterations} \times 5 \text{ requests} = 1.250 \text{ requests}$.
- **Setup Phase**: Thực hiện kiểm tra trạng thái sức khỏe của API qua `GET /v1/health` trước khi chạy tải. Nếu thất bại, kịch bản sẽ dừng ngay lập tức.

### Các trường hợp kiểm thử & Ngưỡng đánh giá (Thresholds)
Kịch bản kiểm thử giả định giới hạn rate limit là **200 requests/IP** trong khung thời gian quy định:
- **catalog_success_requests**: Kỳ vọng có đúng **200 request** thành công đầu tiên (HTTP 200).
- **catalog_rate_limited_requests**: Kỳ vọng có đúng **1.050 request** tiếp theo bị từ chối bằng cơ chế rate limit (HTTP 429 và trả về JSON payload chứa `code: "RATE_LIMITED"`).
- **catalog_unexpected_responses**: Kỳ vọng **0 request** trả về các mã lỗi hoặc mã trạng thái bất thường khác ngoài HTTP 200 và HTTP 429 (có mã "RATE_LIMITED").

---

## 2. Kiểm thử Order API (Đặt vé): [botspam.ts (order)](file:///c:/Users/quoct/Repositories/ThietKePhanMem/FINAL_PROJECT/ticket-box-app/tests/order/botspam.ts)

### Mục tiêu kiểm thử
Xác minh sự phối hợp nhịp nhàng giữa hai tầng phòng thủ khi bot/spam cố gắng thực hiện đặt vé hàng loạt:
1. **Admission Control (Order Capacity Limit)**: Giới hạn số lượng request đặt hàng được phép đi vào hàng đợi xử lý đồng thời để tránh làm quá tải Database và Service.
2. **IP-based Rate Limiting**: Giới hạn số lượng request tối đa gửi từ một IP trong một khung thời gian.

### Cách thức triển khai kịch bản
- **Executor**: Sử dụng mô hình `shared-iterations` chạy đồng thời với **250 Virtual Users (VUs)** thực hiện tổng cộng **500 iterations**.
- **Luồng thực thi trong 1 iteration**:
  - Mỗi iteration sẽ lấy ra một JWT token tương ứng từ file `../generate-tokens/tokens.json` (bắt đầu từ vị trí được cấu hình qua `BOTSPAM_TOKEN_START`).
  - Thực hiện gửi yêu cầu đặt vé (`POST /v1/orders`) với Concert ID (`BOTSPAM_ORDER_CONCERT_ID`) và Ticket Type ID (`BOTSPAM_ORDER_TICKET_TYPE_ID`).
  - Request được ký thực thực với Header `Authorization: Bearer <token>` và có kèm `Idempotency-Key` dạng `k6-botspam-order-<RUN_ID>-<iteration>` để chống trùng lặp request.
- **Tổng số request gửi đi**: **500 requests**.
- **Setup Phase**:
  - Kiểm tra sức khỏe hệ thống qua `GET /v1/health`.
  - Cắt và trích xuất đúng 500 token hợp lệ từ tệp tokens.json để phục vụ giả lập các client đăng nhập khác nhau gửi yêu cầu từ cùng một máy (cùng IP).

### Các trường hợp kiểm thử & Ngưỡng đánh giá (Thresholds)
Kịch bản kiểm thử thiết lập cấu hình chặn tải cụ thể với tổng 500 requests từ một IP:
- **orders_processed**: Kỳ vọng có đúng **50 request** đầu tiên được đưa vào hệ thống xử lý đơn hàng thành công (trả về HTTP 201 Created hoặc HTTP 409 Conflict với code `"TICKET_SOLD_OUT"`).
- **orders_capacity_limited**: Kỳ vọng có đúng **250 request** tiếp theo bị hệ thống Admission Control chặn lại tại cửa ngõ nhằm bảo vệ tài nguyên đặt vé (trả về HTTP 429 Too Many Requests kèm JSON payload chứa code `"ORDER_CAPACITY_REACHED"`).
- **orders_rate_limited**: Kỳ vọng có đúng **200 request** còn lại bị chặn bởi tầng IP Rate Limit thông thường của API gateway trước khi kịp chạm đến logic đặt hàng (trả về HTTP 429 Too Many Requests kèm JSON payload chứa code `"RATE_LIMITED"`).
- **orders_unexpected**: Kỳ vọng **0 request** trả về các lỗi không xác định khác ngoài các trường hợp trên.
