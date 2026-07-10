#### 7. Ban tổ chức vào workspace và xem tổng quan
- Các bước thực hiện:
    1. Đăng nhập bằng tài khoản `ORGANIZER` và mở `/organizer`.
    2. Xem sidebar riêng của Ban tổ chức: Tổng quan, Hồ sơ, Sự kiện.
    3. Demo tài khoản không phải Ban tổ chức vào `/organizer` bị chặn bởi màn hình "Chỉ dành cho ban tổ chức".
    4. Xem các chỉ số tổng quan: tổng doanh thu, vé đã bán, sự kiện published và hồ sơ đang chờ.
    5. Xem biểu đồ doanh thu theo tháng và danh sách concert có doanh thu nổi bật.
    6. Mở nhanh hồ sơ đang chờ admin duyệt và danh sách sự kiện của tôi từ dashboard.

#### 8. Ban tổ chức nộp hồ sơ concert mới
- Các bước thực hiện:
    1. Vào "Hồ sơ" và bấm "Nộp hồ sơ mới".
    2. Nhập thông tin concert: tên sự kiện, nghệ sĩ/lineup, venue, thời gian bắt đầu/kết thúc và thời điểm publish dự kiến.
    3. Nhập số cổng check-in và số tài khoản checker cần tạo.
    4. Upload PDF press kit để hệ thống tự sinh giới thiệu concert, artist bio và tách ảnh.
    5. Upload ảnh sơ đồ chỗ ngồi, xem preview ảnh ngay trên form.
    6. Kiểm tra các validation bắt buộc trước khi chuyển sang cấu hình zone/vé.

#### 9. Ban tổ chức cấu hình zone và ticket type trong hồ sơ
- Các bước thực hiện:
    1. Thêm zone ghế với mã zone, tên zone và sức chứa.
    2. Thêm loại vé gắn với zone tương ứng.
    3. Nhập giá vé, tổng số vé, giới hạn vé mỗi tài khoản và thời gian mở/đóng bán.
    4. Thử thêm nhiều loại vé cho nhiều zone để thấy cấu trúc bán vé của concert.
    5. Demo validation: hồ sơ phải có ít nhất một zone, một loại vé và thời gian bán hợp lệ.
    6. Bấm "Nộp hồ sơ" và kiểm tra hồ sơ chuyển sang trạng thái `PENDING`.

#### 10. Ban tổ chức theo dõi trạng thái hồ sơ và kiểm tra AI Artist Bio
- Các bước thực hiện:
    1. Mở "Hồ sơ của tôi" và lọc theo `PENDING`, `APPROVED`, `REJECTED`.
    2. Mở chi tiết hồ sơ để xem lại venue, thời gian, zone, ticket type, press kit, số gate và số checker.
    3. Với hồ sơ `APPROVED`, kiểm tra thông báo concert đã được tạo và chuyển sang mục "Sự kiện của tôi".
    4. Mở preview concert để kiểm tra giới thiệu concert, artist bio và ảnh được tách/sinh từ press kit.
    5. Nếu AI job chưa xong, refresh lại sau khi worker xử lý.
    6. Với hồ sơ `REJECTED`, xem ghi chú review của admin để biết lý do cần chỉnh.

#### 11. Ban tổ chức quản lý concert `DRAFT` sau khi được duyệt
- Các bước thực hiện:
    1. Vào "Sự kiện" và tìm concert theo tên sự kiện, nghệ sĩ, venue hoặc trạng thái.
    2. Mở concert `DRAFT` vừa được admin duyệt.
    3. Chỉnh thông tin cơ bản: tên concert, mô tả, thể loại, venue, thời gian và ảnh cover fallback nếu cần.
    4. Cập nhật hoặc gỡ ảnh sơ đồ chỗ ngồi.
    5. Thêm zone và ticket type mới khi concert còn `DRAFT`.
    6. Bấm "Xem trước" để kiểm tra trang audience trước khi public.
    7. Mở một concert `PUBLISHED` để thấy thông tin/zone/vé đã khóa, chỉ còn chỉnh được khu khách mời.

#### 12. Ban tổ chức theo dõi bán vé, tồn kho và checker account
- Các bước thực hiện:
    1. Trên dashboard, xem doanh thu xác nhận và số vé đã bán của các concert thuộc Ban tổ chức.
    2. Mở danh sách sự kiện để xem trạng thái `DRAFT`, `PUBLISHED`, `CANCELLED`, `COMPLETED`.
    3. Xem từng concert card: số vé đã bán/tổng vé, doanh thu, số loại vé và thanh tiến độ.
    4. Xem tồn kho từng hạng vé: tổng vé, đã bán, còn lại và trạng thái bán.
    5. Mở khu "Tài khoản checker theo concert", lọc theo concert và xem email/status của từng checker.
    6. Copy User ID checker khi cần đối chiếu hoặc bàn giao tài khoản soát vé.

#### 13. Ban tổ chức quản lý Guest List của concert
- Các bước thực hiện:
    1. Mở tab/khu "Khách mời" trong concert.
    2. Dán link hoặc folder ID Google Drive chứa file khách mời.
    3. Nhắc share folder quyền Viewer cho service account hiển thị trên UI.
    4. Lưu folder trước mốc khóa 0h ngày diễn đối với concert đã `PUBLISHED`.
    5. Bấm tải danh sách khách mời để xem họ tên, email, mã khách mời và trạng thái.
    6. Kiểm tra trạng thái khách mời: `INVITED`, `CHECKED_IN`, `CANCELLED`.

#### 14. Ban tổ chức gửi yêu cầu hủy concert
- Các bước thực hiện:
    1. Trong "Sự kiện của tôi", chọn concert cần hủy.
    2. Bấm nút "Yêu cầu hủy" và nhập lý do gửi admin.
    3. Kiểm tra yêu cầu hủy được gửi thành công.
    4. Chờ Admin duyệt/từ chối ở phần Admin.
    5. Sau khi admin duyệt, quay lại kiểm tra concert chuyển sang `CANCELLED`.