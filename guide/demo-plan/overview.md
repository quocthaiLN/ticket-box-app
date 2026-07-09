# Tổng quan
- Chia video thành các clip demo nhỏ như đợt Refactor
- Kịch bản gồm 2 nhóm cân bằng:
    - Demo functional requirement: các happy path nghiệp vụ từ góc nhìn từng vai trò, gồm khán giả xem concert/đặt vé/thanh toán/nhận e-ticket, Ban tổ chức tạo và quản lý concert, Admin duyệt/audit/quản lý tài khoản, Checker soát vé, Guest List, AI Artist Bio và Notification.
    - Demo non-functional requirement: các luồng tải/lỗi/nhất quán dữ liệu, gồm 80k request xem thông tin concert, 80k user đặt vé, chống oversell, enforce giới hạn vé mỗi tài khoản, cổng thanh toán lỗi, soát vé offline và xử lý CSV khách mời lỗi/trùng.
- Cách trình bày trong từng clip:
    - Functional: ưu tiên thao tác UI và luồng end-to-end, chỉ nhắc kỹ thuật khi cần giải thích kết quả.
    - Non-functional: ưu tiên cách tạo tải/kích lỗi, hiện tượng quan sát được và cơ chế bảo vệ hệ thống.

# Danh sách 

### Demo functional requirement

#### 1. Xem concert, đặt vé, thanh toán và nhận e-ticket QR - Thái
- Các bước thực hiện:
    1. Đăng nhập bằng tài khoản khán giả.
    2. Mở danh sách concert public, tìm/lọc nếu cần và vào trang chi tiết một concert đang mở bán.
    3. Xem thông tin sự kiện, nghệ sĩ/artist bio, địa điểm, sơ đồ chỗ ngồi, hạng vé và số vé còn lại.
    4. Chọn hạng vé, số lượng và tạo đơn giữ vé.
    5. Thanh toán bằng `VNPAY`, sau đó kiểm tra vé đã phát hành trong "Vé của tôi".
    6. Tạo thêm một đơn khác và thanh toán bằng `MOMO` để chứng minh hệ thống hỗ trợ nhiều cổng sau đó ấn hủy thanh toán.
    7. Mở QR e-ticket của vé mới mua.

| Trường         | Giá trị               |
| -------------- | --------------------- |
| Ngân hàng      | `NCB`                 |
| Số thẻ         | `9704198526191432198` |
| Tên chủ thẻ    | `NGUYEN VAN A`        |
| Ngày phát hành | `07/15`               |
| OTP            | `123456`              |

#### 2. Ban tổ chức tạo hồ sơ, AI Bio, admin duyệt và auto-publish - Thuận
- Các bước thực hiện:
    1. Đăng nhập bằng tài khoản Ban tổ chức.
    2. Tạo hồ sơ concert mới với thông tin sự kiện, venue, thời gian diễn và thời điểm publish dự kiến.
    3. Cấu hình zone, ticket type, giá vé, số lượng vé, giới hạn vé mỗi tài khoản và số checker cần tạo.
    4. Upload cover image, sơ đồ hạng vé và PDF press kit.
    5. Mở preview để kiểm tra concert trước khi gửi hồ sơ.
    6. Admin mở hồ sơ, xem thông tin, ticket type, sơ đồ và phần artist bio AI sinh từ press kit.
    7. Admin duyệt hồ sơ, kiểm tra concert draft, zone, ticket type, gate và checker account được tạo.
    8. Chờ worker auto-publish để concert chuyển sang public/mở bán.

#### 3. Ban tổ chức quản lý concert và dashboard sau bán vé
- Các bước thực hiện:
    1. Đăng nhập Ban tổ chức và mở dashboard.
    2. Xem danh sách concert thuộc Ban tổ chức.
    3. Với concert draft, demo chỉnh thông tin hoặc cấu hình thêm zone/ticket type.
    4. Với concert đã bán vé, xem doanh thu, số vé bán, tồn kho từng hạng vé và danh sách order.
    5. Xem danh sách checker account theo concert.
    6. Nếu cần, gửi yêu cầu hủy concert để admin duyệt.

#### 4. Soát vé e-ticket bằng checker web/mobile, online
- Các bước thực hiện:
    1. Đăng nhập bằng tài khoản checker được tạo khi admin duyệt concert.
    2. Mở trang checker web hoặc mobile app, chọn gate/device và preload dữ liệu nếu dùng mobile.
    3. Quét QR e-ticket hợp lệ ở chế độ online, kiểm tra vé chuyển sang đã check-in.
    4. Quét lại cùng vé để demo chống dùng lại vé.
    5. Thử vé sai concert/sai cổng hoặc vé đã hủy để thấy hệ thống từ chối.

#### 5. Guest list VIP từ Google Drive CSV và check-in khách mời
- Các bước thực hiện:
    1. Trong trang quản lý concert, lưu link/ID folder Google Drive chứa CSV khách mời.
    2. Admin trigger import hoặc chờ scheduler nhập tự động.
    3. Mở job import để xem số dòng thành công/lỗi.
    4. Organizer/Admin xem danh sách khách mời đã nhập.
    5. Checker tìm guest tại cổng VIP và check-in khách mời.

#### 6. Notification, audit log, quản lý tài khoản và phân quyền
- Các bước thực hiện:
    1. Sau khi thanh toán thành công, mở admin notifications để thấy thông báo phát hành vé.
    2. Cho worker xử lý gửi notification/email; nếu có notification lỗi thì admin retry.
    3. Với concert sắp diễn, demo reminder trước 24 giờ nếu có dữ liệu phù hợp.
    4. Mở audit log và lọc các hành động vừa demo như duyệt hồ sơ, auto-publish, payment webhook, phát hành vé, check-in.
    5. Mở trang yêu cầu hủy concert để admin duyệt hoặc từ chối yêu cầu từ Ban tổ chức.
    6. Mở quản lý tài khoản để xem user theo role, đổi role/khóa tài khoản nếu cần.
    7. Demo phân quyền: audience không vào admin/organizer/checker, organizer không vào audit/users, checker chỉ vào soát vé, admin vào được khu quản trị.

### Demo non-function requirment


#### 80k request xem thông tin concert

#### 80k user đặt vé đảm bảo ko sập + Giới hạn vé per-user khó enforce dưới tải cao + Ko over sell

#### Cổng thanh toán lỗi

#### Soát vé Offline

#### Xử lý dữ liệu lỗi của file danh sách khách mời CSV 