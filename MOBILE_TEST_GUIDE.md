# Hướng dẫn Kiểm thử Ứng dụng Di động (Mobile Checker)

Tài liệu này cung cấp hướng dẫn chi tiết từng bước để kiểm thử ứng dụng di động **Mobile Checker** từ bước đăng nhập, cấu hình kết nối, nhập dữ liệu mẫu để mở khóa giao diện soát vé cho đến thực thi kiểm thử offline.

---

## 1. Môi trường & Khởi chạy hệ thống

Trước khi kiểm thử trên điện thoại, đảm bảo toàn bộ hệ thống backend đã được bật:
```bash
# 1. Khởi động DB & Redis
docker compose up -d

# 2. Khởi chạy API Server
npm run dev:api

# 3. Khởi chạy ứng dụng Expo Mobile (Xóa cache cho lần chạy mới)
npm run dev:mobile -- --clear
```

---

## 2. Các tài khoản & Tham số cấu hình kiểm thử mẫu

### A. Tài khoản đăng nhập (Checker Credentials)
Sử dụng tài khoản nhân viên soát vé (CHECKER) đã được nạp sẵn trong cơ sở dữ liệu:
* **Email**: `checker-secret-1@ticketbox.test`
* **Mật khẩu**: `Checker123@`

### B. Tham số thiết lập cổng kiểm thử (Mock IDs)
Sau khi đăng nhập thành công, nhập các ID sau tại màn hình **Thiết lập cổng** để mở khóa giao diện soát vé:
* **Concert ID (Grey D Concert)**: `00000000-0000-0000-0000-000000000201`
* **Gate ID (Cổng VIP)**: `00000000-0000-0000-0000-000000000402`
* **Device ID (Thiết bị soát vé)**: `DEV-01`

---

## 3. Quy trình thực hiện chi tiết

### Bước 1: Mở rộng Cấu hình API URL & Đăng nhập
1. Mở ứng dụng **Mobile Checker** trên điện thoại thật (qua Expo Go) hoặc máy ảo.
2. Tại màn hình đăng nhập, nhấn vào biểu tượng bánh răng **`⚙️` ở góc trên bên phải** để mở rộng ô nhập API.
3. Cấu hình **API Base URL**:
   * **Nếu kiểm thử trên điện thoại thật**: Cấu hình địa chỉ IP máy tính của bạn (đảm bảo điện thoại và máy tính cùng kết nối một Wi-Fi):
     ```text
     http://192.168.1.13:3000/v1
     ```
   * **Nếu kiểm thử trên máy ảo Android (Emulator)**: Sử dụng cổng loopback mặc định:
     ```text
     http://10.0.2.2:3000/v1
     ```
   * **Nếu kiểm thử trên máy ảo iOS (Simulator) hoặc bản web giả lập**:
     ```text
     http://localhost:3000/v1
     ```
4. Nhập Email và Mật khẩu của tài khoản Checker mẫu (bạn có thể bấm biểu tượng con mắt `👁️` để kiểm tra mật khẩu trước khi nhấn **Sign in**).

---

### Bước 2: Thiết lập Cổng & Bắt đầu soát vé
1. Sau khi nhấn **Sign in**, ứng dụng sẽ đưa bạn vào màn hình **Thiết lập cổng** (nút tab ở dưới cùng bị ẩn để bắt buộc bạn thiết lập thông số kỹ thuật trước).
2. Hãy điền đầy đủ 3 thông số kiểm thử mẫu (Mock IDs) đã nêu ở Mục 2:
   * **Concert ID**: `00000000-0000-0000-0000-000000000201`
   * **Gate ID**: `00000000-0000-0000-0000-000000000402`
   * **Device ID**: `DEV-01`
3. Nhấp nút **Tải dữ liệu Preload** để tải toàn bộ danh sách vé và khách mời sự kiện về cơ sở dữ liệu SQLite nội bộ trên điện thoại.
4. Nhấp nút màu tím nổi bật **`⚡ Bắt đầu soát vé`** ở dưới cùng. Lúc này ứng dụng sẽ chính thức mở khóa và chuyển tiếp bạn sang giao diện kiểm soát vé chính.

---

### Bước 3: Kiểm tra Giao diện soát vé chính (Scan UI)
Khi bạn đã ở màn hình **Quét vé** chính, giao diện Premium Dark-mode tối màu sẽ xuất hiện:
* **Khối thống kê**: Hiển thị 3 ô số lượng **Thành công** (xanh), **Sai cổng** (vàng), **Lỗi / Trùng** (đỏ) được đồng bộ dữ liệu thời gian thực từ SQLite local.
* **Dashed box ở giữa**: Hiển thị icon camera `📷` và thông báo *"Sẵn sàng quét vé"*. Khi quét/nhập mã kết quả sẽ hiển thị ngay tại đây.
* **Thanh điều hướng 3 tab bên dưới**: Bạn có thể chuyển đổi giữa các tab **Quét vé** (Scan), **Lịch sử** (History), và **Đồng bộ** (Sync) để kiểm tra UI.

---

### Bước 4: Kiểm thử soát vé thủ công (Vé / Khách mời VIP)

Để giả lập hoạt động quét mã QR trên điện thoại thật/máy ảo mà không cần camera:
1. Tại tab **Quét vé**, nhấn vào nút **` Nhập thủ công (Vé / Khách)`** để mở bảng nhập mã.

#### A. Kiểm thử soát vé (Tab Vé)
* Hãy dán chuỗi JSON của vé VIP Grey D hợp lệ sau vào ô text và nhấn **Soát Vé**:
  ```json
  {"ticket_id": "00000000-0000-0000-0000-000000000631", "concert_id": "00000000-0000-0000-0000-000000000201"}
  ```
* **Kết quả mong đợi**: Hộp nét đứt chớp xanh hiển thị **SUCCESS** (Soát vé thành công!). Số lượng vé thành công trên ô stats tăng lên `1`.
* **Kiểm thử soát trùng**: Tiếp tục bấm Nhập thủ công và dán lại chính mã trên rồi nhấn soát vé.
  * **Kết quả mong đợi**: Hộp chớp vàng hiển thị cảnh báo trùng vé **ALREADY_CHECKED_IN** (Vé đã soát!). Số lượng lỗi trên ô stats tăng lên.

#### B. Kiểm thử khách mời VIP (Tab Khách)
* Chuyển sang Tab **Khách (Guest)**, nhập số điện thoại hoặc mã Guest ID của khách mời VIP và nhấn **Check-in**.
* **Kết quả mong đợi**: Hệ thống đối chiếu SQLite và báo kết quả tương ứng (SUCCESS nếu hợp lệ, WRONG_GATE nếu sai cổng).
