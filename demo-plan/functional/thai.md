#### 1. Khán giả đăng ký OTP, đăng nhập và điều hướng mua vé - Thái
- Các bước thực hiện:
    1. Khi chưa đăng nhập, mở chi tiết concert và bấm "Mua vé" để thấy popup yêu cầu đăng nhập.
    2. Chọn đăng ký tài khoản khán giả, nhập thông tin và xác minh OTP 6 số qua email.
    3. Gửi lại OTP để demo cooldown nếu cần.
    4. Đăng nhập bằng tài khoản khán giả, kiểm tra redirect quay lại concert đang xem.
    5. Trên navbar, kiểm tra tên user, link "Vé của tôi" và thao tác đăng xuất.

#### 2. Khán giả khám phá catalog concert public
- Các bước thực hiện:
    1. Mở trang chủ và chỉ ra concert nổi bật, danh sách sự kiện sắp diễn ra.
    2. Dùng ô tìm kiếm trên navbar để nhảy sang trang "Khám phá" với từ khóa.
    3. Trên trang "Khám phá", tìm theo tên sự kiện/nghệ sĩ và lọc theo thành phố.
    4. Mở một concert vừa được auto-publish để chứng minh concert public xuất hiện cho khán giả.
    5. Demo trạng thái không có kết quả nếu có dữ liệu phù hợp.

#### 3. Khán giả xem chi tiết concert, artist bio và sơ đồ ghế
- Các bước thực hiện:
    1. Vào trang chi tiết một concert đang mở bán.
    2. Xem cover, tên nghệ sĩ, thời gian, địa điểm, giá vé và số vé còn lại.
    3. Chuyển tab "Thông tin", xem giới thiệu, quy định sự kiện, hướng dẫn tham dự và FAQ.
    4. Chuyển tab "Nghệ sĩ" để xem lineup và artist bio.
    5. Chuyển tab "Sơ đồ ghế", phóng to seat map và xem legend theo từng zone.
    6. Nếu concert không có ảnh sơ đồ, demo fallback grid zone nếu có dữ liệu.

#### 4. Khán giả chọn vé, quota cá nhân và giữ vé
- Các bước thực hiện:
    1. Từ chi tiết concert bấm "Mua vé" để vào trang chọn vé.
    2. Chọn zone trên sơ đồ/legend để highlight hạng vé tương ứng.
    3. Tăng/giảm số lượng vé, xem tổng tiền và danh sách vé đã chọn.
    4. Demo giới hạn `max_per_user`: UI hiển thị đã giữ, đã mua và số vé còn chọn thêm.
    5. Demo hạng vé hết vé hoặc chưa tới giờ mở bán bị khóa.
    6. Để bộ đếm hết hạn nếu cần để thấy phiên chọn vé hết hạn.
    7. Bấm "Tiếp tục thanh toán" để chuyển sang checkout.

#### 5. Khán giả checkout, thanh toán VNPAY/MoMo và xử lý retry
- Các bước thực hiện:
    1. Xem lại thông tin sự kiện, chi tiết vé, phí dịch vụ và tổng tiền.
    2. Chọn cổng `VNPAY` hoặc `MOMO`.
    3. Bấm "Giữ vé và tiếp tục" để tạo order trạng thái `HELD` với thời hạn giữ vé.
    4. Kiểm tra trạng thái đơn hàng, trạng thái thanh toán và mã đơn trên checkout.
    5. Gửi yêu cầu thanh toán, mở cổng thanh toán và hoàn tất bằng `VNPAY`.
    6. Quay về trang kết quả thanh toán, kiểm tra đơn thành công và link sang "Vé của tôi".
    7. Tạo thêm một đơn bằng `MOMO`, hủy/thất bại giao dịch rồi quay lại thử thanh toán lại.
    8. Nếu giả lập gateway lỗi, demo đổi sang cổng còn lại hoặc retry khi vé vẫn đang được giữ.
    9. Nếu có nhiều đơn đang giữ, chọn thanh toán đơn tiếp theo trên checkout/payment result.

| Trường         | Giá trị               |
| -------------- | --------------------- |
| Ngân hàng      | `NCB`                 |
| Số thẻ         | `9704198526191432198` |
| Tên chủ thẻ    | `NGUYEN VAN A`        |
| Ngày phát hành | `07/15`               |
| OTP            | `123456`              |

#### 6. Khán giả quản lý e-ticket và QR trong "Vé của tôi"
- Các bước thực hiện:
    1. Mở "Vé của tôi" sau khi thanh toán thành công.
    2. Xem thống kê tổng vé, vé chờ sử dụng và vé đã check-in.
    3. Lọc vé theo trạng thái: `ISSUED`, `CHECKED_IN`, `CANCELLED`, `REFUNDED`.
    4. Mở modal QR của vé mới mua, kiểm tra QR được render từ payload đã ký.
    5. Sau clip checker quét vé, quay lại xem trạng thái chuyển sang `CHECKED_IN`.
    6. Mở QR của vé đã check-in để thấy thông báo vé đã được sử dụng.