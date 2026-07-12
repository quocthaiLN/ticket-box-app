# Báo Cáo Kết Quả: Sửa Lỗi và Kiểm Thử Luồng Quét QR Vé Thật (Online & Offline)

Tài liệu này báo cáo chi tiết các công việc đã thực hiện để dựng lại luồng soát vé từ vé mua thật, các lỗi hệ thống đã phát hiện và khắc phục, cùng kết quả kiểm thử E2E trên Mobile Checker.

---

## 1. Yêu Cầu & Phạm Vi Công Việc

1. **Sinh vé thật**: Thay đổi luồng từ việc quét mã QR seed sẵn sang sinh mã QR chứa payload thật được ký bằng Ed25519 từ private key của `api-server`.
2. **Kiểm thử E2E 7 Scenarios**:
   - **Scenario 1**: Quét online vé VIP-1 tại cổng VIP_GATE (Hợp lệ) -> Thành công.
   - **Scenario 2**: Quét trùng (Double-Scan) vé VIP-1 -> Bị chặn, báo `ALREADY_CHECKED_IN`.
   - **Scenario 3**: Quét vé CAT1 tại cổng VIP_GATE (Sai Cổng) -> Bị chặn, báo `WRONG_GATE`.
   - **Scenario 4**: Quét vé bị giả mạo / thay đổi chữ ký -> Bị chặn, báo `INVALID_TICKET` (`QR_SIGNATURE_INVALID`).
   - **Scenario 5**: Đồng bộ offline vé CAT1 tại cổng VIP_GATE (Sai Cổng) -> Ghi nhận lỗi `WRONG_GATE` (`GATE_ZONE_NOT_MAPPED`).
   - **Scenario 6**: Đồng bộ offline vé VIP-2 tại đúng cổng VIP_GATE -> Thành công.
   - **Scenario 7**: Đồng bộ offline vé VIP-2 bị giả mạo signature -> Bị chặn, ghi nhận lỗi `INVALID_TICKET` (`QR_SIGNATURE_INVALID`).

---

## 2. Các Lỗi Hệ Thống Phát Hiện & Giải Pháp Khắc Phục

### Lỗi 1: Lỗi định danh thiết bị check-in (Bug 3)
* **Hiện tượng**: API check-in online `/check-in/scan` và sync offline `/check-in/offline-sync` báo lỗi hoặc crash do `device_id` truyền từ Mobile Checker không phải định dạng UUID (ví dụ: `"CHECKER-anh-sang-man-dem"`).
* **Nguyên nhân**: Client gửi mã định danh thiết bị dạng text (`device_code`), trong khi database lưu bằng UUID.
* **Giải pháp**:
  - Cập nhật [checkin.repository.ts](file:///d:/bt_lap_trinh/thiet_ke_phan_mem/project_refactor_database/ticket-box-app/apps/api-server/src/modules/checkin/checkin.repository.ts) (`getActiveDeviceContext`) và [checkin.sync.ts](file:///d:/bt_lap_trinh/thiet_ke_phan_mem/project_refactor_database/ticket-box-app/apps/api-server/src/modules/checkin/checkin.sync.ts) (`getOrCreateBatch`) để khi `device_id` truyền lên không phải UUID, hệ thống tự động tìm thiết bị theo `deviceCode`.
  - Đồng thời, sử dụng UUID database thực tế của thiết bị (`device.id`) khi tạo `OfflineCheckinBatch` thay vì chuỗi text thô.

### Lỗi 2: Crash database khi ghi nhận log check-in lỗi (Bug 4)
* **Hiện tượng**: Khi check-in thất bại (như sai cổng, vé đã quét...), server crash với lỗi `Inconsistent column data: Error creating UUID`.
* **Nguyên nhân**: Hàm `createRejectedTicketLog` sử dụng trực tiếp chuỗi `input.device_id` thô dạng text từ client để ghi log vào cột UUID `device_id`.
* **Giải pháp**:
  - Cập nhật hàm `createRejectedTicketLog` để truyền `device.id` đã phân giải thành UUID thực tế.

### Lỗi 3: Typo lấy chữ ký QR khiến signature luôn trống
* **Hiện tượng**: Vé mua thật khi quét lên server luôn bị báo lỗi `QR_SIGNATURE_INVALID`.
* **Nguyên nhân**: Trong script `generate-real-tickets.ts`, chữ ký được trích xuất bằng thuộc tính `qrData.data.qrSignature` (camelCase) thay vì `qrData.data.qr_signature` (snake_case do API trả về), khiến trường chữ ký bị gán `undefined`.
* **Giải pháp**:
  - Sửa lại trường lấy dữ liệu thành `qrData.data.qr_signature` trong [generate-real-tickets.ts](file:///d:/bt_lap_trinh/thiet_ke_phan_mem/project_refactor_database/ticket-box-app/scripts/generate-real-tickets.ts).

### Lỗi 4: Lỗi xác thực chữ ký do trường metadata kiểm thử
* **Hiện tượng**: Sau khi bổ sung chữ ký, xác thực vẫn bị báo thất bại (`isSigValid: false`).
* **Nguyên nhân**: Script sinh vé thêm trường metadata `_test_name` vào payload để phục vụ nhận diện kịch bản test. Hàm `canonicalize` trong backend không lọc bỏ trường này trước khi xác thực, khiến chuỗi JSON dùng để hash xác thực bị lệch so với lúc ký nguyên bản.
* **Giải pháp**:
  - Cập nhật hàm `canonicalize` trong [ticket.qr.ts](file:///d:/bt_lap_trinh/thiet_ke_phan_mem/project_refactor_database/ticket-box-app/apps/api-server/src/modules/tickets/ticket.qr.ts) để chỉ giữ lại các trường chuẩn của `QrPayload` (`ticket_id`, `concert_id`, `ticket_type_id`, `seat_zone_id`, `gate_id`, `issued_at`, `qr_token`).

### Lỗi 5: API Response `/offline-sync` thiếu thông tin errorCode
* **Hiện tượng**: Scenario 7 báo thất bại vì script test không thấy trường `errorCode` trong kết quả trả về của API đồng bộ offline.
* **Nguyên nhân**: API sync offline chỉ lưu `errorCode` vào database mà không trả về trường này trong API response.
* **Giải pháp**:
  - Bổ sung cả hai trường `errorCode` và `error_code` vào kiểu dữ liệu `OfflineSyncResponse` trong [checkin.types.ts](file:///d:/bt_lap_trinh/thiet_ke_phan_mem/project_refactor_database/ticket-box-app/apps/api-server/src/modules/checkin/checkin.types.ts) và ánh xạ chúng trong [checkin.sync.ts](file:///d:/bt_lap_trinh/thiet_ke_phan_mem/project_refactor_database/ticket-box-app/apps/api-server/src/modules/checkin/checkin.sync.ts).

---

## 3. Kết Quả Kiểm Thử E2E (100% Pass)

Sau khi chạy lại bộ kịch bản kiểm thử, toàn bộ 7 kịch bản đều trả kết quả thành công:

```text
=== BẮT ĐẦU CHẠY KỊCH BẢN KIỂM THỬ ===
-> Đã tải 3 mã QR mẫu.
VIP-1 Ticket ID: 59d9e9b6-1c0d-4120-a213-76584c0281a0
VIP-2 Ticket ID: e84ef82f-0689-45ab-b367-c9dd08844682
CAT1 Ticket ID: d4ec6042-30b5-4018-857b-3e40a61755eb

2. Đăng nhập Checker...
-> Đăng nhập checker thành công!

--- SCENARIO 1: Quét online vé VIP-1 tại VIP_GATE (Hợp lệ) ---
HTTP Status: 200
Response Body: {"data":{"result":"SUCCESS","ticket_id":"59d9e9b6-1c0d-4120-a213-76584c0281a0","gate_id":"00000000-0000-0000-0000-000000000402","device_id":"CHECKER-anh-sang-man-dem","zone_id":"00000000-0000-0000-0000-000000000302","checked_in_at":"2026-07-10T08:10:52.266Z","log_id":"c1ec4873-0930-4fad-8282-e24743109503"},"meta":{"request_id":"req_8b8409af-dfce-4aa1-ab5e-b2f8cdfd46e6"}}
=> THÀNH CÔNG: Vé VIP-1 được check-in thành công!

--- SCENARIO 2: Quét trùng (Double-Scan) vé VIP-1 ---
HTTP Status: 200
Response Body: {"data":{"result":"ALREADY_CHECKED_IN","ticket_id":"59d9e9b6-1c0d-4120-a213-76584c0281a0","gate_id":"00000000-0000-0000-0000-000000000402","device_id":"CHECKER-anh-sang-man-dem","zone_id":"00000000-0000-0000-0000-000000000302","log_id":"72597828-1e82-4c7f-b89c-fb707bd2d9f3","reason":"TICKET_ALREADY_CHECKED_IN"},"meta":{"request_id":"req_5f3ebd20-7eb2-4534-98ed-116c2698afd2"}}
=> THÀNH CÔNG: Chặn thành công vé đã check-in trước đó!

--- SCENARIO 3: Quét vé CAT1 tại VIP_GATE (Sai Cổng) ---
HTTP Status: 200
Response Body: {"data":{"result":"WRONG_GATE","ticket_id":"d4ec6042-30b5-4018-857b-3e40a61755eb","gate_id":"00000000-0000-0000-0000-000000000402","device_id":"CHECKER-anh-sang-man-dem","zone_id":"00000000-0000-0000-0000-000000000303","log_id":"9ed9736e-860c-409f-bd81-780fa398fc5f","reason":"GATE_ZONE_NOT_MAPPED"},"meta":{"request_id":"req_8019348f-d3e3-4443-950c-ac0f28179a9a"}}
=> THÀNH CÔNG: Chặn thành công vé sai cổng!

--- SCENARIO 4: Quét vé bị giả mạo / sai chữ ký ---
HTTP Status: 200
Response Body: {"data":{"result":"INVALID_TICKET","gate_id":"00000000-0000-0000-0000-000000000402","device_id":"CHECKER-anh-sang-man-dem","log_id":"1a2c3764-dba7-4dc5-b4ec-09427807a03e","reason":"QR_SIGNATURE_INVALID"},"meta":{"request_id":"req_82d9126e-adf1-4a39-8170-c5a138d2e7d7"}}
=> THÀNH CÔNG: Chặn thành công vé bị giả mạo chữ ký!

--- SCENARIO 5: Đồng bộ offline vé CAT1 tại VIP_GATE (Sai Cổng) ---
Gửi offline-sync với ticket_id: d4ec6042-30b5-4018-857b-3e40a61755eb
HTTP Status: 200
Response Body: {"data":{"batch_id":"BATCH-6290ee87-d225-4985-9ffb-32bd2720c86a","status":"DONE","accepted_item_count":0,"conflict_item_count":1,"results":[{"client_item_id":"49e31dcf-180f-46bc-ab2e-f88b0f4443a9","status":"WRONG_GATE","message":"Ticket is not allowed through this gate.","ticket_id":"d4ec6042-30b5-4018-857b-3e40a61755eb","guest_id":null,"error_code":"GATE_ZONE_NOT_MAPPED","errorCode":"GATE_ZONE_NOT_MAPPED"}]},"meta":{"request_id":"req_612a483f-7923-4399-9f6f-d9d18077d13a"}}
=> THÀNH CÔNG: Hệ thống offline sync ghi nhận đúng lỗi WRONG_GATE của vé!

--- SCENARIO 6: Đồng bộ offline vé VIP-2 tại đúng cổng VIP_GATE ---
Gửi offline-sync với ticket_id: e84ef82f-0689-45ab-b367-c9dd08844682
HTTP Status: 200
Response Body: {"data":{"batch_id":"BATCH-9a7656a6-529f-4bfa-8a72-c5d4bcc41b4e","status":"DONE","accepted_item_count":1,"conflict_item_count":0,"results":[{"client_item_id":"7b6210aa-8b1e-4e0c-938c-62af2b9f1f74","status":"SUCCESS","message":"Ticket checked in from offline batch.","ticket_id":"e84ef82f-0689-45ab-b367-c9dd08844682","guest_id":null}]},"meta":{"request_id":"req_15a9f662-92e4-4272-a336-3d35761c0aac"}}
=> THÀNH CÔNG: Đồng bộ offline vé VIP-2 thành công!

--- SCENARIO 7: Đồng bộ offline vé VIP-2 giả mạo signature ---
HTTP Status: 200
Response Body: {"data":{"batch_id":"BATCH-795711a9-b4a2-48e0-b1a1-533a930c622b","status":"DONE","accepted_item_count":0,"conflict_item_count":1,"results":[{"client_item_id":"15749475-1559-4309-ae9e-d201d1dfa441","status":"INVALID_TICKET","message":"QR signature is invalid.","ticket_id":null,"guest_id":null,"error_code":"QR_SIGNATURE_INVALID","errorCode":"QR_SIGNATURE_INVALID"}]},"meta":{"request_id":"req_d1d83788-ea4a-4234-9507-88fd4d2a617f"}}
=> THÀNH CÔNG: Chặn thành công sync offline vé bị giả mạo chữ ký!

=== KẾT THÚC KỊCH BẢN KIỂM THỬ ===
```

---

## 4. Hướng Dẫn Chạy & Demo Chi Tiết

Tất cả các câu lệnh kiểm thử và chuẩn bị dữ liệu đều phải được chạy từ thư mục dự án `ticket-box-app`.

### Bước 1: Khởi động môi trường (nếu chưa chạy)
Đảm bảo các service backend sau đang hoạt động:
- **API Server** (Port 3000): `npm run dev:api`
- **Worker Server**: `npm run dev:worker`
- **Payment Mocks** (Port 4102): `npm run dev:payment:vnpay`

---

### Bước 2: Chạy kiểm thử tự động (Automated E2E Scenarios)
1. Mở terminal tại thư mục gốc của workspace (`project_refactor_database`) và di chuyển vào thư mục dự án:
   ```bash
   cd ticket-box-app
   ```
2. **Khởi tạo dữ liệu vé mua thật mới**:
   ```bash
   npx tsx scripts/generate-real-tickets.ts
   ```
   *Lệnh này thực hiện luồng mua vé thật tự động qua cổng thanh toán giả lập VNPAY cho 3 loại vé: VIP-1, VIP-2, CAT1. Mã QR (chứa payload và chữ ký Ed25519) sẽ được ghi ra file JSON tại `qr-samples/index.json` và dạng ảnh PNG tại `qr-samples/*.png`.*

3. **Chạy kịch bản kiểm thử E2E trực tiếp lên API**:
   ```bash
   npx tsx scripts/test-verification.ts
   ```
   *Lệnh này sẽ mô phỏng luồng request của checker từ Mobile gửi lên backend lần lượt cho cả 7 kịch bản (quét online hợp lệ/quét trùng/sai cổng/giả mạo chữ ký và đồng bộ offline).*

---

### Bước 3: Hướng dẫn Demo thực tế trên App Mobile Checker (`apps/mobile-checker`)

Để demo giao diện di động trực quan bằng ứng dụng React Native/Expo:

#### 1. Chạy ứng dụng di động:
1. Mở terminal mới, di chuyển vào thư mục app checker:
   ```bash
   cd ticket-box-app/apps/mobile-checker
   ```
2. Khởi động Expo:
   ```bash
   npm run start
   ```
   *(Sử dụng ứng dụng Expo Go trên điện thoại thực để quét mã QR từ terminal, hoặc chạy giả lập iOS/Android trên máy tính).*

#### 2. Kịch bản Demo Online (Quét trực tiếp):
1. **Đăng nhập**: Sử dụng tài khoản Checker: `checker@ticketbox.test` / `Password@123`.
2. **Cấu hình thiết bị**: Chọn Concert **"Ánh Sáng Màn Đêm"**, thiết bị **"CHECKER-anh-sang-man-dem"**, và cổng **"VIP_GATE"**. Nhấn "Xác nhận và tiếp tục".
3. **Mở camera quét QR**: Nhấn vào nút "Quét vé" trên ứng dụng.
4. **Thực hiện quét**:
   - Sử dụng camera điện thoại quét file ảnh **VIP-1** (được lưu tại `ticket-box-app/qr-samples/<TicketID-VIP-1>.png` hiển thị trên màn hình máy tính của bạn).
   - **Kết quả trên App**: Hiển thị thông báo **"Check-in thành công!"**.
   - **Quét lại lần 2 (Double-Scan)**: Quét lại cùng mã QR của VIP-1.
   - **Kết quả trên App**: Báo lỗi **"Vé đã soát!"** (`ALREADY_CHECKED_IN`).
   - **Quét vé sai cổng**: Quét mã QR của vé **CAT1** (`ticket-box-app/qr-samples/<TicketID-CAT1>.png`).
   - **Kết quả trên App**: Báo lỗi **"Vé đi sai cổng!"** (`WRONG_GATE`).

#### 3. Kịch bản Demo Offline (Lưu tạm và Đồng bộ sau):
1. **Chuyển sang chế độ Offline**:
   - Ngắt kết nối mạng trên điện thoại của bạn, hoặc tắt API Server để giả lập mất mạng.
2. **Mở camera quét QR**:
   - Quét mã QR của vé **VIP-2** (`ticket-box-app/qr-samples/<TicketID-VIP-2>.png`).
3. **Kết quả trên App**:
   - Hiện thông báo **"Check-in offline thành công!"**. Ứng dụng tự động lưu trữ thông tin quét vào cơ sở dữ liệu SQLite nội bộ và đưa vào hàng chờ đồng bộ.
4. **Kiểm tra hàng chờ**:
   - Chuyển sang tab **"Lịch sử"** hoặc **"Đồng bộ"** trên app, bạn sẽ thấy vé VIP-2 hiển thị ở trạng thái **"Chờ đồng bộ"**.
5. **Đồng bộ về Backend**:
   - Bật lại kết nối mạng (hoặc bật lại API Server).
   - Nhấn nút **"Đồng bộ ngay"** trên ứng dụng.
   - **Kết quả**: Vé VIP-2 sẽ được gửi lên server qua API `/check-in/offline-sync`. Trạng thái chuyển thành **"Thành công"**, và trên backend dữ liệu vé VIP-2 đã được cập nhật là `CHECKED_IN` chính xác.
