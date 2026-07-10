#### 15. Admin dashboard và ranh giới quyền quản trị
- Các bước thực hiện:
    1. Đăng nhập bằng tài khoản `ADMIN` và mở `/admin`.
    2. Xem sidebar riêng của Admin: Tổng quan, Hồ sơ BTC, Yêu cầu hủy, Account, Audit log.
    3. Xem dashboard tổng quan: hồ sơ chờ duyệt, sự kiện đang chạy, yêu cầu hủy, tổng account.
    4. Mở nhanh hồ sơ BTC chờ duyệt và sự kiện gần đây từ dashboard.
    5. Demo tài khoản không phải admin vào `/admin` bị chặn bởi màn hình "Chỉ dành cho admin".

#### 16. Admin duyệt hoặc từ chối hồ sơ Ban tổ chức
- Các bước thực hiện:
    1. Mở "Hồ sơ BTC" và lọc theo `PENDING`, `APPROVED`, `REJECTED`.
    2. Mở chi tiết một hồ sơ `PENDING`.
    3. Kiểm tra thông tin organizer, venue, thời gian diễn, ticket type, zone, seat map và press kit.
    4. Xem trạng thái/bản nháp artist bio AI sinh từ press kit.
    5. Nếu từ chối, nhập ghi chú review và kiểm tra hồ sơ chuyển sang `REJECTED`.
    6. Nếu duyệt, kiểm tra hệ thống tạo concert `DRAFT`, zone, ticket type, gate và checker account.
    7. Lưu lại email/mật khẩu checker vì mật khẩu chỉ hiển thị một lần sau khi duyệt.
    8. Mở trang concert admin vừa được tạo từ hồ sơ đã duyệt.

#### 17. Admin quản lý concert sau khi duyệt
- Các bước thực hiện:
    1. Từ dashboard hoặc hồ sơ đã duyệt, mở trang chi tiết concert của Admin.
    2. Tab "Thông tin concert": kiểm tra venue, thời gian, zone, ticket type, giá, giới hạn vé và trạng thái vé.
    3. Bấm "Xem trước" để mở preview trang audience trước khi public.
    4. Với concert `DRAFT`, demo nút `Publish` nếu cần publish thủ công.
    5. Với concert `PUBLISHED`, demo nút `Hủy concert` nếu cần hủy trực tiếp từ Admin.
    6. Nếu dùng auto-publish, chờ worker chuyển concert sang public/mở bán rồi kiểm tra lại ở trang khán giả.
    7. Tab "Bio": xem phần giới thiệu concert, bio nghệ sĩ và ảnh tách từ press kit.

#### 18. Admin quản lý Guest List của concert
- Các bước thực hiện:
    1. Trong trang chi tiết concert Admin, mở tab "Khách mời".
    2. Dán link/ID folder Google Drive khách mời và lưu vào concert.
    3. Nhắc share folder cho service account hiển thị trên UI.
    4. Bấm "Nhập ngay" để trigger import khách mời.
    5. Làm mới lịch sử job, xem tổng dòng, dòng thành công, dòng lỗi và trạng thái job.
    6. Mở lỗi từng dòng nếu job `PARTIAL`/`FAILED`.
    7. Xem danh sách khách mời và trạng thái `INVITED`, `CHECKED_IN`, `CANCELLED`.

#### 19. Admin duyệt yêu cầu hủy concert từ Ban tổ chức
- Các bước thực hiện:
    1. Mở "Yêu cầu hủy" và lọc theo `PENDING`, `APPROVED`, `REJECTED`.
    2. Mở chi tiết yêu cầu để xem concert, organizer và lý do xin hủy.
    3. Nếu từ chối, nhập ghi chú review và kiểm tra yêu cầu chuyển sang `REJECTED`.
    4. Nếu duyệt, kiểm tra concert chuyển sang `CANCELLED`.
    5. Kiểm tra checker account gắn với concert không còn dùng để check-in concert đã hủy.

#### 20. Admin quản lý account và phân quyền
- Các bước thực hiện:
    1. Mở "Account" để xem danh sách user, email, role, trạng thái và ngày tạo.
    2. Làm mới danh sách account.
    3. Nâng một tài khoản `AUDIENCE` lên `ORGANIZER`.
    4. Kiểm tra role mới hiển thị trên bảng và user được điều hướng sang workspace Ban tổ chức khi đăng nhập lại.
    5. Xóa một account không phải tài khoản admin đang đăng nhập.
    6. Demo phân quyền: audience không vào admin/organizer/checker, organizer không vào admin/audit/users, checker chỉ vào soát vé, admin vào được khu quản trị.

#### 21. Admin audit log và notification vận hành
- Các bước thực hiện:
    1. Mở "Audit log" sau các thao tác duyệt hồ sơ, publish, hủy concert, đổi role.
    2. Lọc audit theo action như `APPROVE_ORGANIZER_REQUEST`, `REJECT_ORGANIZER_REQUEST`, `CONCERT_PUBLISHED`, `CONCERT_AUTO_PUBLISHED`, `APPROVE_CONCERT_DELETION`, `UPDATE_USER_ROLE`.
    3. Lọc theo entity type, entity id hoặc khoảng thời gian.
    4. Mở rộng một log để xem metadata, actor, IP và user agent.
    5. Bấm "Tải thêm" nếu có nhiều log.
    6. Sau thanh toán/check-in, kiểm tra notification phát hành vé/reminder bằng API hoặc DB nếu không có màn hình web riêng.
    7. Với notification lỗi, demo endpoint retry admin nếu có dữ liệu `FAILED`.