#### 22. Soát vé e-ticket bằng checker web/mobile, online
- Các bước thực hiện:
    1. Đăng nhập bằng tài khoản checker được tạo khi admin duyệt concert.
    2. Mở mobile app, chọn gate/device và preload dữ liệu nếu dùng mobile (tui có kêu ông tạo API fetch data của cổng về checker)
    3. Quét QR e-ticket hợp lệ ở chế độ online, kiểm tra vé chuyển sang đã check-in.
    4. Quét lại cùng vé để demo chống dùng lại vé.
    5. Thử vé sai concert/sai cổng hoặc vé đã hủy để thấy hệ thống từ chối.
    6. Thử QR rác không được bán ra từ Ticket-Box


#### 23. Soát vé e-ticket bằng checker web/mobile, offline
- Các bước thực hiện:
    1. Đăng nhập bằng tài khoản checker được tạo khi admin duyệt concert.
    2. Mở mobile app, chọn gate/device và preload dữ liệu nếu dùng mobile (tui có kêu ông tạo API fetch data của cổng về checker)
    3. Tắt Wifi và quét QR nhiều e-ticket hợp lệ ở chế độ offline, kiểm tra vé chuyển sang đã check-in.
    4. Quét lại cùng vé để demo chống dùng lại vé.
    5. Thử vé sai concert/sai cổng hoặc vé đã hủy để thấy hệ thống từ chối.
    6. Thử QR rác không được bán ra từ Ticket-Box.
    7. Sync lại với server và kiểm tra vé.