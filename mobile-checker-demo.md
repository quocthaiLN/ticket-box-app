# Kịch bản Demo Mobile Checker 1 phút & Known Issues

Hệ thống bán vé TicketBox hỗ trợ soát vé online và offline sync cho cả vé thường và khách mời VIP. Dưới đây là kịch bản chuẩn bị sẵn để quay video demo trong vòng 1 phút, sử dụng bộ dữ liệu đã được seed sẵn bằng lệnh `npm run db:seed`.

---

## 1. Dữ liệu Demo Seed Sẵn

Sau khi chạy `npm run db:seed`, bạn sẽ có sẵn bộ dữ liệu:

- **Tài khoản Checker**:
  - Email: `checker@ticketbox.test`
  - Mật khẩu: `Password@123`
- **Thiết bị (Device Code)**: `CHECKER-anh-sang-man-dem`
- **Sự kiện (Concert)**: Ánh Sáng Màn Đêm
- **Cổng soát vé (Gate)**: Cổng VIP (`VIP_GATE`)
- **Vé thường (Ticket QR)**:
  - Vé hợp lệ 1: `qr-seed-anh-sang-man-dem-001` (Trạng thái: `ISSUED`)
  - Vé hợp lệ 2: `qr-seed-anh-sang-man-dem-002` (Trạng thái: `ISSUED`)
  - Vé bị hủy: `qr-seed-anh-sang-man-dem-cancelled` (Trạng thái: `CANCELLED`)
- **Khách mời VIP (Guest Pass)**:
  - Khách VIP 1: phone `+84911111111`, email `guest1@ticketbox.test` (Trạng thái: `INVITED`)
  - Khách VIP Đã Soát: phone `+84933333333`, email `guest3@ticketbox.test` (Trạng thái: `CHECKED_IN`)

---

## 2. Kịch bản Demo 1 phút (Từng bước)

| Thời gian | Bước | Hành động cụ thể | Màn hình liên quan | Kết quả mong đợi trên UI |
|---|---|---|---|---|
| **0:00 - 0:10** | **1. Đăng nhập** | Mở Mobile App, nhập email `checker@ticketbox.test`, mật khẩu `Password@123` và bấm **Đăng nhập**. | `LoginScreen.tsx` | Đăng nhập thành công, chuyển sang màn hình Setup. |
| **0:10 - 0:20** | **2. Preload** | Chọn Gate **Cổng VIP**, nhập Device Code `CHECKER-anh-sang-man-dem`, bấm **Lưu cấu hình** rồi bấm **Tải trước dữ liệu (Preload)**. | `SetupScreen.tsx` | Snapshot tải thành công. Danh sách vé và guest được lưu vào SQLite cục bộ của máy. |
| **0:20 - 0:35** | **3. Online Scan** | Ở chế độ **Online**, quét mã QR của Vé hợp lệ 1: `qr-seed-anh-sang-man-dem-001`. <br/><br/>Tiếp theo, quét Vé bị hủy: `qr-seed-anh-sang-man-dem-cancelled`. | `ScanScreen.tsx` | Vé 1: Báo **SUCCESS** màu xanh (Soát vé thành công). <br/><br/>Vé bị hủy: Báo **EXPIRED_OR_CANCELLED** màu đỏ (Từ chối). |
| **0:35 - 0:40** | **4. Ngắt mạng** | Giả lập mất mạng (Bật Airplane mode trên điện thoại/máy ảo, hoặc chuyển app sang chế độ **Offline** ở góc trên cùng). | `ScanScreen.tsx` | Nhãn trạng thái chuyển thành **Offline**. |
| **0:40 - 0:50** | **5. Scan Offline** | Quét Vé hợp lệ 2: `qr-seed-anh-sang-man-dem-002`. <br/><br/>Tiếp theo, tìm và soát Khách VIP 1: `guest1@ticketbox.test` (hoặc số điện thoại `+84911111111`). | `ScanScreen.tsx` | Cả hai lượt soát đều thành công và báo **SUCCESS** trên local SQLite. Bản ghi được lưu tạm vào hàng chờ đồng bộ. |
| **0:50 - 1:00** | **6. Sync lại** | Bật lại mạng (Tắt Airplane mode / chuyển chế độ **Online**). Vào màn hình **Đồng bộ (Queue)**, bấm nút **Đồng bộ ngay (Sync)**. | `QueueScreen.tsx` | 2 bản ghi offline được gửi lên server. Server xử lý thành công, cập nhật trạng thái trong database và chuyển trạng thái local thành **synced**. |

---

## 3. Known Issues — Mobile/Offline

Trong quá trình soát vé thực tế, hãy lưu ý các giới hạn thiết kế hiện tại của monorepo:

### 3.1. Secure Storage trên thiết bị
- **Cơ chế hiện tại**: Token JWT và thông tin thiết bị đang được lưu trữ bằng `AsyncStorage` (lưu dạng plain text).
- **Rủi ro**: Nếu thiết bị bị root hoặc bị tấn công phần mềm độc hại, token soát vé có thể bị đánh cắp. Để đưa lên production, cần chuyển sang dùng `expo-secure-store` để mã hoá thông tin nhạy cảm.

### 3.2. Background Sync
- **Cơ chế hiện tại**: Hàng chờ offline (`offline_queue` trong SQLite) chỉ được đồng bộ khi người dùng mở màn hình `QueueScreen` và chủ động bấm nút **Đồng bộ ngay**.
- **Hạn chế**: Khi có mạng trở lại, app không tự động chạy background task để sync ngầm. Điều này có thể dẫn đến việc chậm trễ cập nhật trạng thái vé lên server nếu checker quên không bấm nút sync.

### 3.3. Conflict UX
- **Cơ chế hiện tại**: Màn hình `QueueScreen` hiển thị số liệu tổng hợp (Đã sync, Chờ sync, Tổng scan) và kết quả thông báo pop-up chung.
- **Hạn chế**: Khi có bản ghi bị conflict (ví dụ: một vé bị soát trùng ở 2 cổng khác nhau khi offline), app không hiển thị chi tiết dòng nào bị lỗi để checker xử lý tại chỗ hoặc cho phép ghi đè (override). Checker chỉ thấy số lượng conflict tăng lên.

### 3.4. Real-device QA
- **Trạng thái kiểm thử**: Hệ thống mới chỉ có test tích hợp ở tầng backend (`tests/checkin`).
- **Hạn chế**: Chưa có test tự động cho camera quét QR thật, xử lý khi camera bị mờ, hoặc mất mạng vật lý đột ngột khi đang sync dở dang (idempotency khi mất kết nối TCP giữa chừng). QA trên thiết bị thật là bước bắt buộc trước khi phát hành phiên bản mobile checker.
