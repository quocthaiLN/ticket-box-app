# Đặc tả: 09-Concert Catalog (Xem Thông Tin Concert)

## Mô tả
Tính năng này cho phép Khán giả truy cập, tìm kiếm và xem thông tin chi tiết về các sự kiện ca nhạc (Concert) sắp diễn ra trên hệ thống TicketBox. Mục tiêu tối thượng của tính năng là đảm bảo khả năng chịu tải vượt trội (High Availability) đối với lưu lượng truy cập đột biến (Burst Traffic) lên đến 80.000 người dùng đồng thời trong các phút đầu mở bán vé, duy trì trải nghiệm hiển thị trực quan và mượt mà mà không làm tăng tải trọng tính toán hay băng thông của cụm máy chủ Backend.

Hệ thống áp dụng kiến trúc tách biệt luồng dữ liệu (API Decoupling) ở tầng mạng mức cao:
1. **Metadata API (Tải tĩnh):** Được định tuyến và phân phối hoàn toàn thông qua mạng lưới **CDN (Content Delivery Network)** đặt tại vùng biên gần người dùng nhất. Trả về thông tin văn bản tĩnh và cấu trúc hình học sơ đồ phân khu dạng sơ đồ vector (SVG).
2. **Inventory API (Tải động):** Được định tuyến trực tiếp qua API Gateway dẫn thẳng vào **Inventory Service**, sử dụng bộ nhớ đệm phân tán **Redis Cluster** để trả về trạng thái kho vé động theo thời gian thực (Real-time).

## Luồng chính

### Các thành phần tham gia hệ thống
- **Client Browser:** Trình duyệt phía người dùng, chịu trách nhiệm render giao diện tương tác và thực hiện cơ chế Client-Side HTTP Cache dựa trên chỉ thị từ CDN.
- **CDN (Content Delivery Network):** Mạng lưới máy chủ biên phân tán toàn cầu (Edge Servers), đóng vai trò là "lớp khiên phòng ngự tầng đầu tiên", chịu trách nhiệm lưu trữ và phân phối trực tiếp dữ liệu tĩnh (Metadata và tệp sơ đồ SVG) để giảm thiểu tối đa requests chạm tới hệ thống gốc.
- **API Gateway:** Điểm tiếp nhận request tập trung đối với các tác vụ động, thực hiện phân luồng điều phối tác vụ.
- **Concert Service:** Dịch vụ backend chịu trách nhiệm quản lý, xử lý nghiệp vụ gốc và cung cấp nguồn dữ liệu tĩnh (Origin Server) khi CDN bị lỡ bộ đệm (Cache Miss).
- **Inventory Service:** Dịch vụ backend chịu trách nhiệm tính toán và phân phối số lượng vé tồn kho.
- **Redis Cluster:** Hệ thống lưu trữ bộ đệm phân tán phân tách theo phân vùng, lưu giữ trạng thái đếm số lượng vé nguyên tử.
- **Primary Database (PostgreSQL):** Cơ sở dữ liệu quan hệ lưu trữ bền vững, nguồn chân lý gốc của hệ thống.

### Thứ tự các bước xử lý
1. Khán giả truy cập vào trang chủ hoặc trang danh sách sự kiện của TicketBox, chọn một concert cụ thể để xem chi tiết.
2. Client Browser đồng thời kích hoạt 2 request bất đồng bộ (Asynchronous HTTP Requests) lên hệ thống:
   - **Request 1 (Luồng Metadata):** Gửi tới địa chỉ Edge URL của CDN: `https://cdn.ticketbox.vn/api/v1/concerts/{id}/metadata`.
   - **Request 2 (Luồng Inventory):** Gửi tới địa chỉ API Gateway gốc: `https://api.ticketbox.vn/api/v1/concerts/{id}/inventory`.
3. **Xử lý tại tầng mạng CDN (Luồng Metadata):**
   - CDN Edge Server tiếp nhận Request 1 và tra cứu trong bộ nhớ đệm tại máy chủ biên cục bộ.
   - **Trường hợp CDN Cache Hit:** CDN lập tức phản hồi ngay dữ liệu văn bản và chuỗi sơ đồ hình học SVG về cho Client Browser với độ trễ tối hạn (< 5ms) mà không gửi bất kỳ gói tin nào về máy chủ Backend.
   - **Trường hợp CDN Cache Miss:** CDN Edge Server đóng vai trò là một Proxy, thực hiện chuyển tiếp request về máy chủ gốc (Origin Server) là **Concert Service**.
4. **Xử lý tại Concert Service khi CDN Cache Miss:**
   - Concert Service tiếp nhận request từ CDN. Hệ thống kích hoạt cơ chế chống nghẽn mã nguồn (**SingleFlight Pattern**) tại tầng ứng dụng để đảm bảo nếu có nhiều Node CDN cùng Miss một lúc, chỉ duy nhất một request đầu tiên được phép xuống Primary Database (PostgreSQL) để đọc thông tin sự kiện; các request đồng thời khác phải xếp hàng chờ Promise.
   - Sau khi đọc thành công dữ liệu bền vững, Concert Service đính kèm các HTTP Headers chỉ thị nghiêm ngặt cho CDN: 
     `Cache-Control: public, max-age=31536000, s-maxage=86400, stale-while-revalidate=3600`
   - Concert Service trả kết quả về cho CDN. CDN ghi nhận, lưu cấu trúc này vào bộ đệm của Edge Server với thời hạn 1 ngày (`s-maxage=86400`) và phân phối lại cho Client. Trình duyệt người dùng dựa vào `max-age` để lưu cục bộ trong máy cá nhân.
5. **Xử lý tại Inventory Service (Luồng Inventory):**
   - Request 2 đi qua API Gateway gốc và truy cập thẳng vào RAM của cụm **Redis Cluster** thông qua kết nối Connection Pooling tốc độ cao.
   - Hệ thống thực hiện lệnh đọc nguyên tử các Key biểu diễn số vé của từng phân khu (ví dụ: `concert:{id}:zone:{zone_name}:slots`). Bỏ qua hoàn toàn việc truy vấn Database quan hệ.
6. **Đồng bộ giao diện tại Client:** Client Browser tiếp nhận cấu hình hình học từ Request 1 (do CDN phân phối) để dựng khung sơ đồ sân khấu trực quan trước, sau đó lấy các con số tồn kho từ Request 2 (do Redis phân phối) để thực hiện logic tô màu trạng thái phân khu (Xanh: Còn vé, Vàng: Sắp hết vé, Xám: Hết vé) theo thời gian thực.

## Kịch bản lỗi

### Trường hợp A: Kết nối giữa CDN và Máy chủ gốc (Origin Server) bị gián đoạn hoặc Máy chủ gốc bị sập
- **A1.** Khi xảy ra hiện tượng CDN Cache Miss, CDN Edge Server cố gắng thiết lập kết nối HTTP tới Concert Service nhưng nhận về mã lỗi phản hồi `5xx` hoặc gặp sự cố quá thời gian chờ (Gateway Timeout).
- **A2.** Kích hoạt cấu hình **Stale-While-Revalidate** và **Stale-If-Error** đã được thiết lập sẵn trên CDN.
- **A3.** Thay vì trả về trang lỗi sập nguồn cho Khán giả, CDN Edge Server chủ động thực hiện cơ chế hạ cấp tính năng (**Graceful Degradation**), trích xuất dữ liệu bộ đệm cũ đã hết hạn (Stale Cache/Snapshot tĩnh) đang lưu tại vùng biên để phục vụ ngay lập tức cho người dùng.
- **A4.** Khán giả vẫn tải được toàn bộ thông tin tĩnh của Concert và sơ đồ SVG từ dữ liệu cũ của CDN, đảm bảo trang web không bị sập trắng.
- **A5.** Đối với luồng Inventory (đi trực tiếp qua API Gateway gốc), nếu Redis/Database sập, Module **Circuit Breaker** (Opossum) tại Gateway sẽ chuyển sang trạng thái *Open*, ngắt mạch luồng đọc và trả về mã trạng thái hạ cấp. Giao diện Client tự động ẩn số lượng vé cụ thể đi và hiển thị chuỗi trạng thái thay thế: *"Đang cập nhật"*.

### Trường hợp B: Sơ đồ SVG của Concert quá nặng, không tải được do nghẽn băng thông mạng cục bộ của Client
- **B1.** Client Browser thực hiện tải mã nguồn SVG từ CDN nhưng gặp sự cố kết nối mạng phía người dùng chậm hoặc tệp tin bị lỗi cấu trúc (Corrupted Data) trong quá trình truyền tải.
- **B2.** Logic xử lý lỗi tại tầng Frontend (Catch Block) phát hiện tiến trình render sơ đồ tương tác dựa trên mã hình học SVG bị thất bại.
- **B3.** Hệ thống tự động kích hoạt giải pháp dự phòng giao diện (Fallback UI): Chuyển hướng nguồn dữ liệu hình ảnh (Image Source) từ mã nhúng SVG sang một liên kết hình ảnh tĩnh định dạng nén tối ưu (PNG/JPEG/WebP) của sơ đồ sân khấu đã được lưu giữ cố định trên hệ thống lưu trữ tĩnh (Object Storage/CDN Asset).
- **B4.** Khán giả không thể tương tác click chọn phân khu trực tiếp trên sơ đồ, nhưng vẫn có khái niệm trực quan về vị trí chỗ ngồi và thực hiện chọn phân khu vé thông qua một danh sách thả xuống (Dropdown Menu) thay thế để tiếp tục luồng mua vé.

## Ràng buộc
- **Tính nhất quán dữ liệu và Cơ chế giải phóng bộ đệm (Cache Invalidation):** Hệ thống chấp nhận tính nhất quán cuối cùng (Eventual Consistency). Trong kịch bản Ban tổ chức đột xuất thay đổi thông tin tĩnh (như đổi tên nghệ sĩ hoặc giờ diễn) trên trang quản trị, hệ thống phải kích hoạt một sự kiện Webhook hoặc gọi trực tiếp API của bên thứ ba để **thực hiện lệnh Purge Cache (Xóa bộ đệm theo URL cụ thể)** trên CDN một cách chủ động, đảm bảo dữ liệu mới được cập nhật lập tức cho người dùng tiếp theo.
- **Ràng buộc hiệu năng (Performance Constraints):** Tốc độ phản hồi của Inventory API tại cụm máy chủ gốc bắt buộc phải đạt mức tối hạn ($< 2\text{ms}$) dưới áp lực tải 80.000 người dùng. Đối với Metadata API, tỷ lệ đáp ứng bộ đệm tại vùng biên (**CDN Cache Hit Rate**) bắt buộc phải đạt tối thiểu **> 95%** trong suốt chiến dịch mở bán vé nhằm bảo vệ hoàn toàn máy chủ gốc.
- **Tính cô lập tài nguyên (Resource Isolation):** Toàn bộ băng thông mạng (Network Bandwidth) phục vụ việc tải tệp tin đồ họa SVG nặng ký được đẩy hoàn toàn sang hạ tầng của nhà cung cấp dịch vụ CDN, cô lập hoàn toàn và không cho phép chiếm dụng băng thông của đường truyền API mạng nội bộ tại máy chủ gốc.
- **An toàn bảo mật (Security):** Toàn bộ các yêu cầu truyền thông mạng tới Edge URL của CDN bắt buộc phải được mã hóa cưỡng bức thông qua giao thức bảo mật lớp truyền tải TLS v1.3 (HTTPS). Cấu hình CDN phải kích hoạt lớp màng lọc bảo vệ cơ bản chống tấn công từ chối dịch vụ (DDoS Protection) và chặn bot spam request ở tầng mạng trước khi request có cơ hội tiếp cận máy chủ Backend.

## Tiêu chí chấp nhận
- **Dưới điều kiện tải thông thường:** Trang chi tiết concert hiển thị đầy đủ thông tin nghệ sĩ, địa điểm, thời gian, sơ đồ phân khu SVG tương tác (lấy từ CDN) và số lượng vé còn lại chính xác của từng khu vực (lấy từ Redis).
- **Dưới điều kiện tải đột biến (80.000 người/5 phút):** Biểu đồ giám sát hệ thống cho thấy lưu lượng HTTP Request chạm tới máy chủ Backend Concert Service giảm thiểu rõ rệt (chỉ nhận các request lỡ bộ đệm ban đầu). Tỷ lệ sử dụng CPU và băng thông mạng mạng của máy chủ Backend duy trì ở mức an toàn (< 30%).
- **Kiểm tra tính năng hạ cấp (Fallback):** Khi giả lập ngắt kết nối vật lý từ CDN về máy chủ gốc (Origin Down), hệ thống CDN vẫn phải phản hồi về cho trình duyệt gói tin Metadata cũ kèm mã trạng thái HTTP 200 (hoặc 203) thành công thông qua cơ chế Stale Cache, giao diện người dùng hiển thị ổn định, không xuất hiện các mã lỗi hạ tầng hệ thống như 502/504.