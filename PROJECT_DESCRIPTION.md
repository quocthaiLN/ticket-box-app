# ĐỒ ÁN MÔN HỌC – TicketBox

## Bối cảnh

Các concert âm nhạc lớn tại Việt Nam — như Anh Trai Say Hi, Anh Trai Vượt Ngàn Chông Gai, Em Xinh Say Hi, Chị Đẹp Đạp Gió Rẽ Sóng — thu hút hàng chục nghìn khán giả. Khi ban tổ chức mở bán vé, website thường sập trong vài phút đầu do lượng truy cập đồng thời quá lớn; khán giả bị trừ tiền nhưng không nhận được vé; scalper dùng bot mua hết vé trong vài giây rồi bán lại với giá gấp nhiều lần.

Hiện tại nhiều sự kiện vẫn bán vé qua các kênh rời rạc: Zalo OA, Google Form, chuyển khoản thủ công — không đảm bảo tính công bằng và rất dễ xảy ra gian lận.

Công ty tổ chức sự kiện muốn xây dựng hệ thống TicketBox để số hóa toàn bộ quy trình bán vé, từ lúc mở bán đến khi khán giả vào cổng sự kiện.

---

# Người dùng

| Nhóm | Mô tả |
|---|---|
| Khán giả | Xem thông tin concert, mua vé, nhận e-ticket, check-in tại cổng |
| Ban tổ chức | Tạo và quản lý concert, cấu hình loại vé, theo dõi doanh thu và lượng bán |
| Nhân sự soát vé | Xác nhận vé tại cổng vào bằng mobile app |

---

# Yêu cầu hệ thống

## Xem và mua vé

Khán giả có thể xem danh sách các concert sắp diễn ra, bao gồm:

- Thông tin nghệ sĩ biểu diễn
- Địa điểm tổ chức
- Sơ đồ chỗ ngồi (sơ đồ SVG tương tác theo khu: GA, SVIP, VIP, CAT1, CAT2)
- Số vé còn lại theo thời gian thực cho từng loại

Khán giả chọn loại vé và số lượng, sau đó tiến hành thanh toán qua cổng thanh toán:

- VNPAY
- MoMo

Sau khi thanh toán thành công, khán giả nhận e-ticket dưới dạng mã QR dùng để vào cổng sự kiện.

Mỗi tài khoản chỉ được mua tối đa một số lượng vé nhất định cho mỗi loại vé, do ban tổ chức cấu hình khi tạo concert.

Ví dụ:

- SVIP tối đa 2 vé/tài khoản
- CAT1 tối đa 4 vé/tài khoản

Giới hạn này áp dụng trên toàn bộ các đơn hàng đã thanh toán thành công — khán giả không thể lách bằng cách tạo nhiều đơn hàng nhỏ.

---

## Thông báo

Sau khi mua vé thành công, khán giả nhận:

- Thông báo xác nhận qua app
- Email kèm e-ticket

Khi concert sắp diễn ra (trước 24 giờ), hệ thống gửi nhắc nhở tự động.

Hệ thống cần được thiết kế để dễ dàng bổ sung kênh thông báo mới trong tương lai:

- Zalo OA
- SMS
- ...

mà không cần thay đổi lớn.

---

## Quản trị

Ban tổ chức dùng trang web admin để:

- Tạo concert mới
- Cấu hình các loại vé:
  - Tên
  - Giá
  - Số lượng
  - Thời điểm mở bán
- Cập nhật thông tin
- Hủy concert

Trang admin chỉ dành cho nội bộ và cần kiểm soát truy cập chặt chẽ.

Ba nhóm người dùng có quyền hạn khác nhau:

| Nhóm | Quyền |
|---|---|
| Khán giả | Xem thông tin và mua vé |
| Ban tổ chức | Tạo, sửa, hủy concert và xem thống kê doanh thu |
| Nhân sự soát vé | Truy cập chức năng quét mã QR |

---

## Soát vé tại sự kiện

Nhân sự tại cổng vào dùng mobile app để quét mã QR trên e-ticket của khán giả.

Các địa điểm tổ chức concert lớn (sân vận động, nhà thi đấu) thường có vùng sóng không ổn định khi hàng chục nghìn người tập trung.

Ứng dụng phải cho phép:

- Ghi nhận soát vé tạm thời khi không có mạng
- Tự đồng bộ lại khi kết nối được phục hồi

---

## AI Artist Bio

Ban tổ chức có thể tải lên:

- File PDF hồ sơ nghệ sĩ
- Press kit của concert

Hệ thống tự động:

1. Xử lý file
2. Tách nội dung
3. Làm sạch văn bản
4. Gửi sang mô hình AI
5. Sinh bản giới thiệu ngắn gọn hiển thị trên trang chi tiết concert

---

## Đồng bộ danh sách khách mời VIP

Một số concert có khu vực Guest List dành cho khách mời của nhãn hàng tài trợ.

Hệ thống quản lý khách mời của nhãn hàng không có API — cách duy nhất là nhận file CSV mà nhãn hàng gửi vào ban đêm trước ngày diễn.

TicketBox cần định kỳ nhập danh sách này để nhân sự soát vé có thể xác nhận khách mời tại cổng VIP.

---

# Các vấn đề cần giải quyết

## Tranh chấp vé

Một số loại vé SVIP của concert Anh Trai Say Hi chỉ có 200 chỗ nhưng có thể có hàng chục nghìn khán giả cố mua cùng lúc ngay khi mở bán.

Hệ thống phải đảm bảo:

- Không có hai khán giả nào cùng nhận được vé cuối cùng

---

## Tải trọng đột biến

Khi concert Chị Đẹp Đạp Gió Rẽ Sóng mở bán, dự kiến khoảng:

- 80.000 người truy cập trong 5 phút đầu
- 70% dồn vào phút đầu tiên

Hệ thống cần có cơ chế:

- Bảo vệ backend API khỏi bị quá tải
- Ngăn chặn bot
- Chặn client spam request
- Đảm bảo tính công bằng giữa các khán giả thật

---

## Thanh toán không ổn định

Nếu cổng thanh toán (VNPAY/MoMo) gặp sự cố:

- Khán giả vẫn phải xem được thông tin concert
- Danh sách vé còn lại vẫn hoạt động bình thường

Luồng mua vé có phí cần xử lý:

- Thanh toán timeout
- Không gây trừ tiền hai lần

Các tính năng không liên quan đến thanh toán vẫn phải hoạt động bình thường khi cổng thanh toán gặp sự cố kéo dài.

---

## Soát vé offline

Nhân sự ở khu vực sóng yếu trong sân vận động vẫn phải soát vé được cho khán giả.

Yêu cầu:

- Dữ liệu không được mất khi kết nối trở lại
- Không cho phép một vé vào cổng hai lần

---

## Tích hợp một chiều

Không thể gọi API hệ thống quản lý khách mời của nhãn hàng — chỉ có thể đọc CSV được gửi theo lịch cố định.

Luồng nhập dữ liệu phải xử lý được:

- File lỗi
- Dữ liệu trùng
- Không làm gián đoạn hệ thống đang chạy

---

## Giới hạn vé per-user khó enforce dưới tải cao

Khi hàng chục nghìn người mua vé cùng lúc, cần đảm bảo:

- Giới hạn số vé mỗi tài khoản được áp dụng chính xác
- Không để một người mua vượt quá giới hạn dù gửi nhiều request đồng thời

Đây là bài toán tương tự tranh chấp chỗ ngồi nhưng ở phạm vi per-user thay vì toàn hệ thống.

---

## Trang chủ và trang chi tiết concert bị quá tải

Trang danh sách concert và trang chi tiết từng concert bị đọc với tần suất rất cao (hàng nghìn lần/giây trong giờ cao điểm) nhưng dữ liệu thay đổi không thường xuyên.

Nếu mỗi request đều truy vấn trực tiếp database, hệ thống sẽ không chịu được tải.

Cần có chiến lược cache hợp lý để:

- Giảm tải database
- Đảm bảo dữ liệu đủ cập nhật

Ví dụ:

- Số vé còn lại phải phản ánh gần đúng thực tế

---

# Các nội dung cần thực hiện

# Phần 1 — Blueprint

## 1. Tài liệu thiết kế hệ thống

Mô tả kiến trúc tổng thể của hệ thống, bao gồm:

- Các thành phần chính
- Cách chúng giao tiếp
- Lý do lựa chọn kiến trúc

Tài liệu cần trả lời được các câu hỏi:

- Hệ thống gồm những phần nào?
- Phần nào nói chuyện với nhau như thế nào?
- Khi một phần gặp sự cố thì phần còn lại bị ảnh hưởng ra sao?

---

## 2. C4 Diagram

Vẽ hai cấp độ đầu của C4 diagram.

### Level 1 – System Context

Thể hiện TicketBox trong bức tranh toàn cảnh:

- Ai dùng hệ thống
- Hệ thống ngoài nào được tích hợp

### Level 2 – Container

Phân rã hệ thống thành các container.

Ví dụ:

- Web app
- Mobile app
- Backend API
- Database
- Message broker

Cần chỉ rõ:

- Công nghệ đề xuất
- Cách các container giao tiếp với nhau

---

## 3. High-Level Architecture Diagram

Vẽ sơ đồ kiến trúc tổng quan thể hiện:

- Luồng dữ liệu
- Sự phụ thuộc giữa các thành phần

Đặc biệt ở:

- Cổng thanh toán
- AI model
- Hệ thống khách mời CSV
- Luồng soát vé offline

---

## 4. Thiết kế cơ sở dữ liệu

Xác định:

- Các loại dữ liệu chính
- Loại database phù hợp:
  - SQL
  - NoSQL
  - Hoặc kết hợp

Giải thích lý do lựa chọn dựa trên đặc điểm dữ liệu.

Thiết kế schema cho các entity quan trọng nhất.

---

## 5. Mô tả các luồng nghiệp vụ quan trọng

Mô tả chi tiết ít nhất hai luồng sau:

- Luồng mua vé
- Luồng soát vé khi mất mạng và đồng bộ lại
- Luồng nhập danh sách khách mời từ CSV

Với mỗi luồng:

- Trình bày các bước xử lý
- Các thành phần tham gia
- Cách hệ thống phản ứng khi có lỗi giữa chừng

---

## 6. Thiết kế kiểm soát truy cập

Thiết kế mô hình phân quyền cho hệ thống.

Xác định:

- Các nhóm người dùng
- Quyền hạn tương ứng
- Cách kiểm tra quyền tại:
  - API endpoint
  - Trang admin
  - Mobile app soát vé

Có thể tham khảo:

- RBAC (Role-Based Access Control)

Hoặc đề xuất mô hình khác nếu phù hợp.

---

## 7. Thiết kế các cơ chế bảo vệ hệ thống

Với mỗi vấn đề kỹ thuật dưới đây:

- Trình bày giải pháp
- Giải thích cách hoạt động
- Giải thích lý do phù hợp

---

### Kiểm soát tải đột biến

Làm thế nào để backend API không bị quá tải khi:

- 80.000 người cùng truy cập mua vé trong phút đầu mở bán?

Gợi ý:

- Rate Limiting
  - Fixed Window
  - Sliding Window
  - Token Bucket
  - Leaky Bucket

---

### Xử lý cổng thanh toán không ổn định

Làm thế nào để hệ thống phản ứng khi:

- VNPAY/MoMo liên tục lỗi

mà không kéo sập toàn bộ dịch vụ?

Gợi ý:

- Circuit Breaker
  - Closed
  - Open
  - Half-Open
- Graceful Degradation

---

### Chống trừ tiền hai lần

Làm thế nào để đảm bảo:

- Một giao dịch mua vé chỉ được thực hiện đúng một lần

dù:

- Khán giả bấm mua nhiều lần
- Mạng bị ngắt giữa chừng

Gợi ý:

- Idempotency Key
  - Cơ chế sinh key
  - Nơi lưu trữ
  - Cách kiểm tra trùng lặp
  - TTL

---

### Caching

Làm thế nào để:

- Trang danh sách concert
- Trang chi tiết concert

không làm quá tải database khi có hàng nghìn request/giây, trong khi vẫn phản ánh đúng số vé còn lại?

Gợi ý:

- Cache-aside với Redis

Xác định TTL phù hợp cho từng loại dữ liệu:

| Dữ liệu | TTL gợi ý |
|---|---|
| Thông tin concert ít thay đổi | Cache lâu |
| Số vé còn lại | TTL ngắn hoặc invalidate chủ động |

---

# Phần 2 — Cài đặt

Phần mềm hoàn chỉnh, có thể chạy được, cài đặt toàn bộ hệ thống đã mô tả trong Blueprint.

## Yêu cầu cài đặt

### Tính năng nghiệp vụ đầy đủ

Bao gồm toàn bộ chức năng:

- Xem concert
- Mua vé
- Thông báo
- Quản trị
- Soát vé
- AI Artist Bio
- Đồng bộ CSV khách mời

---

### Các cơ chế kỹ thuật

Toàn bộ giải pháp thiết kế trong:

- Blueprint mục 6
- Blueprint mục 7

phải được cài đặt thực sự trong code, không chỉ mô phỏng hoặc stub.

---

### Hướng dẫn khởi chạy

README rõ ràng, đủ để người chấm có thể:

1. Clone repository
2. Chạy được hệ thống

mà không cần hỏi thêm.

---

### Dữ liệu mẫu

Seed data hoặc script tạo dữ liệu ban đầu, bao gồm:

- Anh Trai Say Hi
- Anh Trai Vượt Ngàn Chông Gai
- Em Xinh Say Hi
- Chị Đẹp Đạp Gió Rẽ Sóng

với:

- Đầy đủ loại vé
- Giá vé
- Sơ đồ chỗ ngồi

để có thể thao tác ngay sau khi khởi chạy.

---

# Tham khảo: Template Blueprint

Template tham khảo theo cấu trúc của OpenSpec — framework spec-driven development.

Gồm ba lớp tài liệu:

- proposal
- design
- specs

---

## Cấu trúc thư mục

```txt
blueprint/
├── proposal.md
├── design.md
└── specs/
    ├── auth.md
    ├── payment.md
    ├── checkin.md
    └── ...
```

---

# proposal.md

```md
# TicketBox — Project Proposal

## Vấn đề
<!-- Mô tả vấn đề hiện tại mà hệ thống cần giải quyết.
     Tại sao các kênh bán vé hiện tại (Zalo OA, Google Form, chuyển khoản) không còn đủ?
     Hậu quả cụ thể: website sập, trừ tiền không ra vé, scalper bot vét hết vé. -->

## Mục tiêu
<!-- Hệ thống cần đạt được gì? Định lượng nếu có thể.
     Ví dụ: hỗ trợ 80.000 người truy cập trong 5 phút đầu mở bán mà không sập. -->

## Người dùng và nhu cầu
<!-- Ai dùng hệ thống? Họ cần làm gì? Điều gì quan trọng nhất với họ? -->

## Phạm vi
<!-- Những gì thuộc phạm vi đồ án này.
     Những gì KHÔNG thuộc phạm vi (ví dụ: tích hợp payment gateway thật, hạ tầng production). -->

## Rủi ro và ràng buộc
<!-- Các vấn đề kỹ thuật đã biết trước: tranh chấp vé, tải đột biến,
     cổng thanh toán không ổn định, soát vé offline, tích hợp một chiều CSV. -->
```

---

# design.md

```md
# TicketBox — Technical Design

## Kiến trúc tổng thể
<!-- Mô tả architectural style được chọn và lý do.
     Hệ thống gồm những thành phần nào? Chúng giao tiếp với nhau như thế nào? -->

## C4 Diagram

### Level 1 — System Context
<!-- Sơ đồ: TicketBox + actors + hệ thống ngoài (VNPAY, MoMo, AI model, CSV nhãn hàng) -->

### Level 2 — Container
<!-- Sơ đồ: web app, mobile app soát vé, backend API, database, message broker, ... -->

## High-Level Architecture Diagram
<!-- Sơ đồ luồng dữ liệu, đặc biệt tại các điểm tích hợp và luồng soát vé offline -->

## Thiết kế cơ sở dữ liệu
<!-- Loại database, lý do lựa chọn, schema các entity chính -->

## Thiết kế kiểm soát truy cập
<!-- Mô hình phân quyền, các nhóm người dùng, cách kiểm tra quyền tại từng điểm truy cập -->

## Thiết kế các cơ chế bảo vệ hệ thống

### Kiểm soát tải đột biến
<!-- Giải pháp, thuật toán, ngưỡng, hành vi khi vượt ngưỡng -->

### Xử lý cổng thanh toán không ổn định
<!-- Giải pháp, các trạng thái, ngưỡng kích hoạt, hành vi khi lỗi -->

### Chống trừ tiền hai lần
<!-- Cơ chế, nơi lưu trữ, TTL, luồng xử lý khi phát hiện trùng lặp -->

### Caching
<!-- Xác định các đối tượng cần cache (danh sách concert, chi tiết concert, số vé còn lại).
     Chiến lược: Cache-aside, Write-through hay Write-back?
     TTL cho từng loại. Cách invalidate khi dữ liệu thay đổi (đặc biệt: số vé sau mỗi giao dịch). -->

## Các quyết định kỹ thuật quan trọng (ADR)
<!-- Với mỗi quyết định lớn: lựa chọn gì, tại sao, đánh đổi gì.
     Ví dụ: SQL vs NoSQL, JWT vs Session, Kafka vs RabbitMQ, optimistic vs pessimistic locking, ... -->
```

---

# specs/[feature].md

```md
# Đặc tả: [Tên tính năng]

## Mô tả
<!-- Tính năng này làm gì? -->

## Luồng chính
<!-- Các bước xử lý theo thứ tự, các thành phần tham gia -->

## Kịch bản lỗi
<!-- Điều gì xảy ra khi: timeout, mất mạng, dữ liệu không hợp lệ, ... -->

## Ràng buộc
<!-- Giới hạn hiệu năng, bảo mật, tính nhất quán cần đảm bảo -->

## Tiêu chí chấp nhận
<!-- Làm thế nào để biết tính năng này hoạt động đúng? -->
```