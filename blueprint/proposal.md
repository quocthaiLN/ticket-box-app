# TicketBox — Project Proposal

## Vấn đề

<!-- Mô tả vấn đề hiện tại mà hệ thống cần giải quyết.
     Tại sao các kênh bán vé hiện tại (Zalo OA, Google Form, chuyển khoản) không còn đủ?
     Hậu quả cụ thể: website sập, trừ tiền không ra vé, scalper bot vét hết vé. -->

| Vấn đề | Nguyên nhân | Hậu quả |
| --- | --- | --- |
| **Hệ thống sập khi mở bán vé** | Lượng truy cập đồng thời quá lớn và tải trọng đột biến (ví dụ: 80.000 người trong 5 phút đầu, dồn 70% vào phút đầu tiên). | Website không hoạt động. Khán giả không mua được vé. |
| **Tranh chấp vé và trừ tiền lỗi** | Khán giả cố mua cùng lúc một lượng vé giới hạn ngay khi mở bán. Cổng thanh toán (VNPAY/MoMo) không ổn định hoặc gặp sự cố. | Khán giả bị trừ tiền nhưng không nhận được vé. Hệ thống có thể gây trừ tiền hai lần hoặc cấp vé cuối cùng cho hai khán giả khác nhau. |
| **Đầu cơ vé (Scalping)** | Các scalper sử dụng bot để mua hết vé trong vài giây. | Khán giả thật không thể tiếp cận vé. Vé bị bán lại với giá gấp nhiều lần. |
| **Quy trình bán vé thiếu đồng bộ** | Hiện tại vé được bán qua các kênh rời rạc như Zalo OA, Google Form, và chuyển khoản thủ công. | Không đảm bảo tính công bằng và rất dễ xảy ra gian lận. |
| **Lách giới hạn vé mỗi tài khoản** | Khán giả gửi nhiều request đồng thời dưới mức tải cao để cố gắng vượt rào cản hệ thống. | Một người có thể mua vượt quá giới hạn cấu hình (ví dụ: hơn 2 vé SVIP/tài khoản), phá vỡ tính công bằng. |
| **Quá tải Database ở các trang xem thông tin** | Trang chủ và trang chi tiết concert bị đọc với tần suất rất cao (hàng nghìn lần/giây) nhưng hệ thống lại truy vấn trực tiếp vào cơ sở dữ liệu. | Cơ sở dữ liệu bị quá tải, kéo theo việc sập toàn bộ hệ thống. |
| **Khó khăn khi soát vé tại sự kiện** | Các địa điểm tổ chức đông người (sân vận động, nhà thi đấu) thường có vùng sóng mạng yếu, không ổn định hoặc mất kết nối. | Nhân sự không thể quét mã QR xác nhận. Rủi ro mất dữ liệu hoặc để lọt một vé vào cổng hai lần khi offline. |
| **Rủi ro khi đồng bộ danh sách khách mời (VIP)** | Hệ thống của nhãn hàng tài trợ không có API, việc đồng bộ hoàn toàn phụ thuộc vào việc đọc file CSV được gửi thủ công. | File import có thể chứa dữ liệu lỗi hoặc trùng lặp, có nguy cơ làm gián đoạn hệ thống đang vận hành. |

---

## Mục tiêu

<!-- Hệ thống cần đạt được gì? Định lượng nếu có thể.
     Ví dụ: hỗ trợ 80.000 người truy cập trong 5 phút đầu mở bán mà không sập. -->

| Mục tiêu | Mô tả / Yêu cầu cụ thể |
| --- | --- |
| **Số hóa toàn diện** | Số hóa toàn bộ quy trình bán vé sự kiện, từ giai đoạn mở bán ban đầu cho đến khi khán giả check-in vào cổng. |
| **Đảm bảo hiệu suất dưới tải đột biến** | Hệ thống phải chịu được lượng truy cập khổng lồ (dự kiến 80.000 người trong 5 phút đầu) mà không bị sập. Cần có cơ chế bảo vệ backend API, ngăn chặn bot và chặn các client spam request. |
| **Giải quyết triệt để tranh chấp vé** | Đảm bảo tuyệt đối không có hai khán giả nào cùng nhận được chiếc vé cuối cùng. Enforce (áp dụng) chính xác giới hạn số lượng vé tối đa cho mỗi tài khoản, không để người dùng lách luật bằng cách gửi nhiều request đồng thời. |
| **Tối ưu hóa Database (Caching)** | Áp dụng chiến lược cache hợp lý để trang danh sách và trang chi tiết concert chịu được hàng nghìn request/giây mà không làm quá tải database. Đồng thời, số vé còn lại hiển thị phải phản ánh gần đúng với thực tế. |
| **Xử lý thanh toán an toàn, linh hoạt** | Không để xảy ra tình trạng khán giả bị trừ tiền hai lần dù mạng bị ngắt giữa chừng hay bấm mua nhiều lần. Các tính năng xem thông tin và danh sách vé vẫn phải hoạt động bình thường kể cả khi cổng thanh toán (VNPAY/MoMo) gặp sự cố. |
| **Hỗ trợ soát vé ngoại tuyến (Offline)** | Ứng dụng mobile phải cho phép nhân sự soát vé tạm thời khi mất mạng và tự động đồng bộ lại khi kết nối phục hồi. Tuyệt đối không cho phép một vé được dùng để vào cổng hai lần. |
| **Tự động hóa bằng AI** | Hệ thống tự động trích xuất, làm sạch văn bản từ file PDF/Press kit và gửi sang mô hình AI để sinh bản giới thiệu nghệ sĩ (Artist Bio) ngắn gọn. |
| **Đồng bộ dữ liệu khách mời an toàn** | Có khả năng định kỳ đọc và nhập danh sách khách mời (Guest List) từ file CSV. Quá trình này phải tự động xử lý được các file lỗi hoặc dữ liệu trùng lặp mà không làm gián đoạn hệ thống đang chạy. |

--- 

## Người dùng và nhu cầu

<!-- Ai dùng hệ thống? Họ cần làm gì? Điều gì quan trọng nhất với họ? -->

| Người dùng          | Hoạt động                                                                                                                                                                                                                                                                                                                                                                                                                                        | Điều quan trọng nhất đối với họ                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Khán giả**        | • Xem danh sách concert, thông tin nghệ sĩ, địa điểm và sơ đồ chỗ ngồi SVG tương tác theo từng khu.<br><br>• Chọn loại vé, số lượng và thực hiện thanh toán qua VNPAY hoặc MoMo.<br><br>• Nhận thông báo xác nhận kèm e-ticket qua ứng dụng hoặc email; nhận nhắc nhở trước sự kiện 24 giờ.<br><br>• Thực hiện check-in tại cổng sự kiện bằng mã QR.                                                                                             | • **Tính công bằng và ổn định:** Hệ thống không bị sập khi mở bán, có cơ chế chống bot và scalper đầu cơ vé.<br><br>• **Giao dịch an toàn:** Không gặp lỗi bị trừ tiền nhưng không nhận được vé, hoặc bị trừ tiền hai lần khi mạng lỗi.<br><br>• **Thông tin chính xác:** Số lượng vé còn lại hiển thị đúng theo thời gian thực.                                                                                                                                                             |
| **Ban tổ chức**     | • Sử dụng trang web admin để tạo, cập nhật thông tin hoặc hủy concert.<br><br>• Cấu hình chi tiết các loại vé (tên, giá, số lượng, thời điểm mở bán, giới hạn số vé tối đa trên mỗi tài khoản).<br><br>• Theo dõi, thống kê doanh thu và lượng vé bán ra.<br><br>• Tải lên hồ sơ nghệ sĩ/press kit để hệ thống tự động xử lý và dùng AI sinh bản giới thiệu.<br><br>• Định kỳ nhập danh sách khách mời VIP từ file CSV do nhãn hàng tài trợ gửi. | • **An toàn hệ thống và bảo mật:** Trang admin được kiểm soát truy cập chặt chẽ, phân quyền đúng vai trò. Hệ thống tự bảo vệ tốt trước tải đột biến.<br><br>• **Tính chính xác của dữ liệu:** Giới hạn vé trên mỗi tài khoản phải được thực thi chính xác tuyệt đối, không cho phép lách luật.<br><br>• **Khả năng chống chịu lỗi (Fault tolerance):** Các sự cố từ cổng thanh toán hoặc việc đồng bộ file CSV bị lỗi không được làm ảnh hưởng hay gián đoạn đến toàn bộ hệ thống đang chạy. |
| **Nhân sự soát vé** | • Sử dụng mobile app tại cổng vào để quét mã QR trên e-ticket của khán giả nhằm xác nhận lượt vào cổng.<br><br>• Xác nhận và kiểm soát nhóm khách mời tại cổng VIP dựa trên dữ liệu danh sách khách mời đã đồng bộ.                                                                                                                                                                                                                              | • **Khả năng hoạt động ngoại tuyến (Offline):** Ứng dụng phải quét và ghi nhận soát vé tạm thời mượt mà ngay cả khi mất kết nối hoặc sóng yếu tại các sân vận động, nhà thi đấu đông người.<br><br>• **Nhất quán dữ liệu:** Tự động đồng bộ lại chính xác khi có mạng và tuyệt đối không để xảy ra tình trạng một vé được gian lận vào cổng hai lần.                                                                                                                                         |

---

## Phạm vi

<!-- Những gì thuộc phạm vi đồ án này.
     Những gì KHÔNG thuộc phạm vi (ví dụ: tích hợp payment gateway thật, hạ tầng production). -->

| Thuộc phạm vi (In Scope) | Không thuộc phạm vi (Out of Scope) |
| --- | --- |
| **Tài liệu thiết kế (Blueprint):** Viết tài liệu kiến trúc tổng thể, C4 Diagram (Level 1, Level 2), High-Level Architecture Diagram, thiết kế cơ sở dữ liệu và phân quyền truy cập. | **Hạ tầng triển khai:** Triển khai hệ thống trên hạ tầng production thực tế. |
| **Thiết kế giải pháp kỹ thuật:** Lên phương án xử lý tải đột biến (Rate Limiting), xử lý sự cố cổng thanh toán (Circuit Breaker), chống trừ tiền hai lần (Idempotency Key) và chiến lược Caching. | **Tích hợp thanh toán thật:** Tích hợp môi trường thật (live) của các cổng thanh toán như VNPAY hay MoMo (chỉ dừng ở mức mô phỏng/sandbox). |
| **Cài đặt phần mềm:** Xây dựng hệ thống hoàn chỉnh, chạy được với đầy đủ các tính năng: xem và mua vé, thông báo, quản trị admin, soát vé (hỗ trợ offline), sinh AI Artist Bio và đồng bộ CSV khách mời. | **Tích hợp API đối tác ngoại:** Gọi API trực tiếp đến hệ thống quản lý khách mời của nhãn hàng tài trợ (bắt buộc phải dùng phương thức đọc file CSV). |
| **Hướng dẫn và Dữ liệu:** Cung cấp file README hướng dẫn khởi chạy chi tiết và script tạo dữ liệu mẫu (Seed data) cho ít nhất 4 concert cùng sơ đồ chỗ ngồi. |  |

---

## Rủi ro và ràng buộc

<!-- Các vấn đề kỹ thuật đã biết trước: tranh chấp vé, tải đột biến,
     cổng thanh toán không ổn định, soát vé offline, tích hợp một chiều CSV. -->

| Loại | Mô tả chi tiết | Hướng giảm thiểu (Mitigation) |
| --- | --- | --- |
| **Rủi ro kỹ thuật** | **Tải trọng đột biến (Burst Traffic):** Rủi ro sập hệ thống (đặc biệt là Database) khi 80.000 người dùng dội request mua vé và xem thông tin cùng lúc. | Thiết kế hệ thống tách biệt Read/Write. Tối đa hóa việc dùng Caching (Redis) và Rate Limiting tại API Gateway. |
| **Rủi ro kỹ thuật** | **Tranh chấp dữ liệu (Race Condition):** Rủi ro cấp 1 vé cho 2 người, hoặc một người dùng spam request để mua lố số lượng cho phép. | Sử dụng Message Broker (Hàng đợi) để xử lý tuần tự kết hợp cơ chế Locking tại Database. |
| **Rủi ro phụ thuộc** | **Đối tác thứ 3 không ổn định:** Cổng thanh toán (VNPAY/MoMo) hoặc dịch vụ gửi Email bị nghẽn/timeout kéo theo hệ thống bị treo. | Áp dụng Circuit Breaker, Idempotency Key (chống trừ tiền 2 lần) và Queue/Retry pattern cho thông báo. |
| **Rủi ro vận hành** | **Xung đột dữ liệu ngoại tuyến (Offline Check-in):** Đồng bộ dữ liệu quét mã QR từ Local DB của điện thoại lên Server khi có mạng trở lại có thể xảy ra độ trễ hoặc trùng lặp. | Thiết kế thuật toán đồng bộ Idempotent, ưu tiên tính hợp lệ của Local DB trong thời gian mất kết nối. |
| **Ràng buộc tích hợp** | **Tích hợp một chiều CSV:** Dữ liệu đầu vào từ nhãn hàng có thể sai định dạng, thiếu trường hoặc chứa mã độc. | Viết Background Worker chạy ngầm, áp dụng strict validation, tự động loại bỏ dòng lỗi mà không làm gián đoạn toàn bộ batch. |
| **Ràng buộc hệ thống** | Đồ án mô phỏng môi trường thực tế nhưng không yêu cầu tích hợp cổng thanh toán live (chỉ dùng sandbox). | Thiết kế module thanh toán theo chuẩn Interface/Adapter để dễ mường tượng việc thay thế cổng thanh toán thật sau này. |
