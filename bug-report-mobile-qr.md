# Báo cáo Lỗi & Khắc phục: Quét QR & Đồng bộ Check-in Mobile Checker

Tài liệu này tổng hợp các lỗi phát hiện trong luồng quét QR (Online & Offline) từ vé mua thật và giải pháp khắc phục chi tiết trong repo `ticket-box-app`.

---

## 1. Lỗi Định Danh Thiết Bị Quét Vé (Bug 3)
* **Hiện tượng**: Khi Mobile App gửi yêu cầu check-in online hoặc đồng bộ offline với `device_id` dạng text/code (ví dụ `"CHECKER-anh-sang-man-dem"`), backend crash hoặc trả về HTTP 400/500 do prisma không tìm thấy thiết bị theo UUID hoặc cố gắng parse chuỗi code thành UUID.
* **Nguyên nhân**: Trường `device_id` lưu trong database là UUID, trong khi client gửi lên code của thiết bị (`device_code`). Backend thiếu cơ chế tự động phân giải `device_code` làm fallback khi `device_id` không phải UUID hợp lệ.
* **Giải pháp khắc phục**:
  - Cập nhật [checkin.repository.ts](file:///d:/bt_lap_trinh/thiet_ke_phan_mem/project_refactor_database/ticket-box-app/apps/api-server/src/modules/checkin/checkin.repository.ts) (`getActiveDeviceContext`) và [checkin.sync.ts](file:///d:/bt_lap_trinh/thiet_ke_phan_mem/project_refactor_database/ticket-box-app/apps/api-server/src/modules/checkin/checkin.sync.ts) (`getOrCreateBatch`) để kiểm tra định dạng `device_id` truyền từ client.
  - Nếu `device_id` không phải là UUID hợp lệ, backend sẽ tự động truy vấn tìm thiết bị theo trường `device_code`.
  - Phân giải ra database UUID thực tế của thiết bị (`device.id`) và sử dụng ID này để tạo/lưu offline batch nhằm tránh lỗi khóa ngoại (Foreign Key) trên database.

---

## 2. Crash Khi Tạo Log Check-in Thất Bại (Bug 4)
* **Hiện tượng**: Backend crash với lỗi `PrismaClientKnownRequestError: Inconsistent column data: Error creating UUID` khi ghi nhận lịch sử check-in bị từ chối (ví dụ: vé không hợp lệ, sai cổng...).
* **Nguyên nhân**: Hàm `createRejectedTicketLog` trong `checkin.repository.ts` sử dụng giá trị `input.device_id` trực tiếp từ client. Khi client truyền `device_code` (chuỗi text thông thường) thay vì UUID, database không thể lưu chuỗi này vào cột UUID `device_id`.
* **Giải pháp khắc phục**:
  - Cập nhật hàm `createRejectedTicketLog` và các lệnh gọi transaction check-in để truyền `device.id` (UUID thực tế đã phân giải) thay vì `input.device_id` thô dạng text từ client.

---

## 3. Lỗi Trích Xuất Chữ Ký QR (Typo in Script)
* **Hiện tượng**: Vé quét online báo lỗi `QR_SIGNATURE_INVALID` mặc dù được sinh từ luồng mua vé thật.
* **Nguyên nhân**: Trong script `generate-real-tickets.ts`, có một lỗi typo khi lấy chữ ký từ response API của server: đọc từ `qrData.data.qrSignature` (camelCase) thay vì `qrData.data.qr_signature` (snake_case do API trả về). Điều này khiến trường `qr_signature` trong file QR mẫu và `index.json` bị gán là `undefined`, làm backend từ chối vì không có chữ ký.
* **Giải pháp khắc phục**:
  - Sửa lại `qrData.data.qrSignature` thành `qrData.data.qr_signature` trong [generate-real-tickets.ts](file:///d:/bt_lap_trinh/thiet_ke_phan_mem/project_refactor_database/ticket-box-app/scripts/generate-real-tickets.ts) và tái sinh toàn bộ QR code mẫu.

---

## 4. Lỗi Xác Thực Chữ Ký Khi Có Trường Metadata
* **Hiện tượng**: Kể cả khi có chữ ký hợp lệ, chữ ký vẫn bị báo sai (`isSigValid: false`) trên backend.
* **Nguyên nhân**: Để phục vụ test và lọc vé dễ dàng, script sinh vé chèn thêm trường `_test_name` vào payload trước khi tạo chuỗi QR string. Hàm `canonicalize` trong `ticket.qr.ts` chỉ xóa `qr_signature` và `qrSignature`, giữ lại `_test_name`. Vì `_test_name` không có trong payload lúc backend ký nguyên bản, chuỗi hash canonical của hai bên bị lệch nhau.
* **Giải pháp khắc phục**:
  - Cập nhật hàm `canonicalize` trong [ticket.qr.ts](file:///d:/bt_lap_trinh/thiet_ke_phan_mem/project_refactor_database/ticket-box-app/apps/api-server/src/modules/tickets/ticket.qr.ts) để lọc và chỉ ký/xác thực các trường hợp lệ của `QrPayload` (`ticket_id`, `concert_id`, `ticket_type_id`, `seat_zone_id`, `gate_id`, `issued_at`, `qr_token`).

---

## 5. Lỗi Đồng Bộ Sync Offline Thiếu errorCode trong API Response
* **Hiện tượng**: Scenario 7 kiểm thử đồng bộ offline vé giả mạo chữ ký báo thất bại mặc dù backend trả về lỗi đúng.
* **Nguyên nhân**: Script test `test-verification.ts` kiểm tra trường `resultItem.errorCode === "QR_SIGNATURE_INVALID"`. Nhưng backend API response của offline sync không trả về trường này trong danh sách kết quả, chỉ lưu vào DB.
* **Giải pháp khắc phục**:
  - Cập nhật kiểu dữ liệu `OfflineSyncResponse` và logic sync trong [checkin.sync.ts](file:///d:/bt_lap_trinh/thiet_ke_phan_mem/project_refactor_database/ticket-box-app/apps/api-server/src/modules/checkin/checkin.sync.ts) để trả về cả hai trường `error_code` và `errorCode` trong mảng kết quả đồng bộ offline.

---

## Kết quả
Sau khi áp dụng đầy đủ các bản sửa lỗi trên, toàn bộ 7 Scenarios kiểm thử check-in (Online & Offline, quét trùng, sai cổng, giả mạo chữ ký) đều đạt trạng thái **THÀNH CÔNG** (100% Pass).
