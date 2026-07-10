# Tổng quan
- Chia video thành các clip demo nhỏ như đợt Refactor
- Kịch bản gồm 2 nhóm cân bằng:
    - Demo functional requirement: các happy path nghiệp vụ từ góc nhìn từng vai trò, gồm khán giả đăng ký OTP/xem-tìm-lọc concert/chọn và giữ vé/thanh toán/nhận e-ticket, Ban tổ chức tạo và quản lý concert, Admin duyệt/audit/quản lý tài khoản, Checker soát vé, Guest List, AI Artist Bio và Notification.
    - Demo non-functional requirement: các luồng tải/lỗi/nhất quán dữ liệu, gồm 80k request xem thông tin concert, 80k user đặt vé, chống oversell, enforce giới hạn vé mỗi tài khoản, cổng thanh toán lỗi, soát vé offline và xử lý CSV khách mời lỗi/trùng.
- Cách trình bày trong từng clip:
    - Functional: ưu tiên thao tác UI và luồng end-to-end, chỉ nhắc kỹ thuật khi cần giải thích kết quả.
    - Non-functional: ưu tiên cách tạo tải/kích lỗi, hiện tượng quan sát được và cơ chế bảo vệ hệ thống.

# Danh sách 

### Demo functional requirement
Note: Khi demo phần functional requirment này không cần chạy mock payment
#### THÁI
#### 1. Khán giả đăng ký OTP, đăng nhập và điều hướng mua vé - Thái
#### 2. Khán giả khám phá catalog concert public
#### 3. Khán giả xem chi tiết concert, artist bio và sơ đồ ghế
#### 4. Khán giả chọn vé, quota cá nhân và giữ vé
#### 5. Khán giả checkout, thanh toán VNPAY/MoMo và xử lý retry
#### 6. Khán giả quản lý e-ticket và QR trong "Vé của tôi"
---
#### THUẬN
#### 7. Ban tổ chức vào workspace và xem tổng quan
#### 8. Ban tổ chức nộp hồ sơ concert mới
#### 9. Ban tổ chức cấu hình zone và ticket type trong hồ sơ
#### 10. Ban tổ chức theo dõi trạng thái hồ sơ và kiểm tra AI Artist Bio
#### 11. Ban tổ chức quản lý concert `DRAFT` sau khi được duyệt
#### 12. Ban tổ chức theo dõi bán vé, tồn kho và checker account
#### 13. Ban tổ chức quản lý Guest List của concert
#### 14. Ban tổ chức gửi yêu cầu hủy concert
---
#### THANH
#### 15. Admin dashboard và ranh giới quyền quản trị
#### 16. Admin duyệt hoặc từ chối hồ sơ Ban tổ chức
#### 17. Admin quản lý concert sau khi duyệt
#### 18. Admin quản lý Guest List của concert
#### 19. Admin duyệt yêu cầu hủy concert từ Ban tổ chức
#### 20. Admin quản lý account và phân quyền
#### 21. Admin audit log và notification vận hành

---
#### QUANG
#### 22. Soát vé e-ticket bằng checker web/mobile, online

---

### Demo non-function requirment

#### 80k request xem thông tin concert
- catalog.md
- demo tránh botspam
- demo ko tránh botspam

#### 80k user đặt vé đảm bảo ko sập + Giới hạn vé per-user khó enforce dưới tải cao + Ko over sell
- order.md
- demo tránh botspam
- demo ko tránh botspam

#### Cổng thanh toán lỗi
- payment.md

#### Soát vé Offline
- checkin.md

#### Xử lý dữ liệu lỗi của file danh sách khách mời CSV
- guest-list.md