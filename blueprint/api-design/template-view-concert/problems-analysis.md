# Bảng tóm tắt vấn đề và cách giải quyết
### Bảng tóm tắt vấn đề và cách giải quyết
| Tình huống / Vấn đề | Kỹ thuật giải quyết cốt lõi |
|---|---|
| 80.000 truy cập xem thông tin concert lúc mở đặt vé | Bóc tách API (Metadata vs. Inventory) + Multi-level Caching |
| Database hoặc Cache gặp sự cố (Tải quá cao) | Graceful Degradation + Circuit Breaker |
| Tải trọng đột biến (80.000 truy cập/5 phút đầu), spam request và scalper bot lúc mở bán | Distributed Rate Limiting với thuật toán Token Bucket |
| Khán giả Retry nhiều lần thanh toán do mạng yếu, phòng chống trùng lặp đơn hàng và trừ tiền hai lần | Idempotency Mechanism sử dụng Idempotency Key |
| Cổng thanh toán VNPAY/MoMo sự cố | Circuit Breaker kết hợp Bulkhead Isolation |
| Tranh chấp đặt vé giữa nhiều người cùng lúc | Pessimistic Locking (SELECT ... FOR UPDATE) trong ACID Transaction (Tui tìm hiểu có cách kết hợp Opstimistic + Pessimistic Lock để tối ưu hiệu năng, chắc lúc code sẽ có xíu thay đổi chỗ này)|
| Nhành phần cung cấp dịch vụ Email/SMS bên thứ ba gặp vấn đề | Asynchronous Event-Driven + Retry Pattern + Dead Letter Queue (DLQ) |
| Mở rộng thông báo bằng Zalo trong tương lai | Strategy Pattern dựa trên Kiến trúc Hướng sự kiện |

---

## USECASE: Xem thông tin concert 
### 80.000 truy cập xem thông tin concert lúc mở đặt vé (Trường hợp tích hợp CDN)

### 1. Đánh giá và Lựa chọn giải pháp
- **Giải pháp:** Áp dụng kiến trúc **Bóc tách Tên miền/API (Domain & API Decoupling)** kết hợp **Mạng lưới phân phối nội dung (CDN - Content Delivery Network)**, **Luật kiểm soát tải tại biên (Edge Rate Limiting)** và **Cơ chế Thử thách Bot ngầm (Managed JS Challenge)**. Hệ thống phân tách cấu trúc hạ tầng như sau:
  * **Tên miền Static & Giao diện (`static.ticketbox.vn` / `ticketbox.vn`):** Toàn bộ mã nguồn Frontend (HTML/JS) và tài nguyên tĩnh dung lượng lớn (Tệp đồ họa SVG cấu trúc chỗ ngồi, ảnh nghệ sĩ, Bio dài do AI tóm tắt) được lưu trữ trên Object Storage độc lập và cấu hình Cache vĩnh viễn trên các máy chủ cạnh (Edge PoP) của CDN.
  * **Tên miền API (`api.ticketbox.vn`):** Phục vụ luồng API động (Số lượng vé còn lại thời gian thực từ Redis). Request đi qua CDN mà không bị cache (Bypass cache) để đảm bảo tính chính xác, nhưng tận dụng cơ chế gom kết nối (Connection Pooling) của CDN để giảm thời gian bắt tay TCP/TLS.

- **Phân tích trade-off:**
  * **Ưu điểm (Pros):** Giảm thiểu tới hơn 90% lượng traffic và chi phí băng thông đường truyền chạm tới máy chủ API gốc (Origin Server). Triệt tiêu hoàn toàn nguy cơ sập hệ thống do nghẽn băng thông truyền tải file SVG nặng khi 80.000 người dùng F5/Refresh trang cùng một lúc. Bảo vệ hạ tầng cốt lõi từ xa bằng cách lọc sạch tới 95% lượng request rác từ Scalper Bot và giảm thiểu các cuộc tấn công từ chối dịch vụ (DDoS) ngay tại biên mạng trước khi tới Gateway.
  * **Nhược điểm (Cons):** Tăng chi phí tiền tệ vận hành hệ thống do phải sử dụng các gói dịch vụ CDN doanh nghiệp cao cấp để có đầy đủ tính năng lập trình nâng cao (WAF, JS Challenge, Edge Rate Limiting). Tăng độ phức tạp trong việc quản lý trạng thái đồng bộ dữ liệu; hệ thống buộc phải triển khai thêm cơ chế xóa cache chủ động bằng API (Active Purge Cache) từ Admin App sang CDN khi có sự thay đổi đột xuất về thông tin sự kiện. Gây khó khăn hơn trong quá trình kiểm thử (Debug) do có thêm một tầng trung gian ở giữa mạng Internet công cộng và máy chủ ứng dụng.

- **Lựa chọn và Lý do:**
  * **Lựa chọn:** Quyết định triển khai giải pháp **Tích hợp mạng lưới CDN bọc ngoài** kết hợp bóc tách API.
  * **Lý do:** Đối với một hệ thống bán vé sự kiện quy mô lớn như TicketBox, việc hàng chục nghìn người dùng cùng lúc truy cập không chỉ tạo ra áp lực về mặt xử lý logic tính toán (CPU/RAM) mà còn tạo ra sự quá tải khủng khiếp về mặt hạ tầng mạng (Network Bandwidth Saturation). Việc tự gánh toàn bộ lưu lượng tệp tĩnh SVG nặng từ cụm máy chủ nội bộ là một rủi ro rất lớn. CDN đóng vai trò như một "tấm khiên" phân tán tải trọng trên quy mô rộng, đảm bảo trải nghiệm mượt mà cho khán giả thật và cô lập triệt để các hành vi gian lận của Bot.

### 2. Cơ chế triển khai chi tiết (Implementation Details cho giải pháp được chọn)
#### Luồng xử lý:
- **Bước 1 (Client truy cập hệ thống):** Khi khán giả mở trang chi tiết concert, trình duyệt thực hiện gửi 2 request bất đồng bộ: API 1 lấy Metadata tĩnh (`/api/v1/concerts/{id}/metadata`) và API 2 lấy Kho vé động (`/api/v1/concerts/{id}/inventory`).
- **Bước 2 (Xử lý API 1 tại Edge Server):** Request API 1 đi tới Máy chủ rìa (PoP) gần nhất của hệ thống CDN.
  * *Trường hợp Edge Hit (Từ user thứ 2 trở đi):* CDN PoP lập tức trả về tệp JSON chứa thông tin văn bản và chuỗi SVG từ bộ nhớ RAM/SSD của nó với độ trễ tối hạn (< 10ms). Request này bị chặn đứng tại biên, hoàn toàn không chạm tới API Gateway của NestJS.
  * *Trường hợp Edge Miss (Lần đầu tiên hoặc sau khi bị Purge):* CDN PoP gửi request ngược về máy chủ gốc (Origin Server) để NestJS đọc Database, nạp lại cho CDN lưu trữ (với chỉ thị `s-maxage=86400`), rồi trả về cho người dùng.
- **Bước 3 (Chống Scalper Bot cho API 2 tại biên):** Request API 2 (Kho vé động) đi tới CDN. CDN nhận diện đây là API không được phép cache (được định cấu hình qua Header `Cache-Control: no-store`). Trước khi chuyển tiếp request này về máy chủ gốc, tầng WAF (Web Application Firewall) của CDN thực hiện hai lớp bảo vệ ngầm:
  * *Lớp 1 (Managed Challenge):* Kiểm tra tính toàn vẹn của trình duyệt để đảm bảo request không phát ra từ các script tự động (Bot).
  * *Lớp 2 (Edge Rate Limiting):* Kiểm tra tần suất gọi của IP hiện tại. Nếu IP đó gửi quá 5 request/giây để dò số lượng vé, CDN lập tức cắt đuôi và trả về mã lỗi `HTTP 429 Too Many Requests` ngay tại biên.
- **Bước 4 (Xử lý API 2 tại Máy chủ gốc):** Các request sạch vượt qua các tầng lọc của CDN sẽ đi qua API Gateway vào trực tiếp Inventory Service của NestJS. Hệ thống đọc số lượng vé còn lại từ cụm RAM phân tán **Redis Cluster** và phản hồi dạng JSON siêu nhẹ ngược lại qua CDN để trả về cho Client.
- **Bước 5 (Đồng bộ logic xóa bộ nhớ đệm):** Khi Ban tổ chức thay đổi thông tin concert trên trang quản trị, hệ thống NestJS (Admin Module) sẽ kích hoạt một Webhook/REST API gửi lệnh **Purge Cache** kèm theo URL cụ thể sang nhà cung cấp CDN để xóa sạch bản sao cũ trên toàn cầu, sẵn sàng cho chu kỳ nạp dữ liệu mới.

#### Thành phần tham gia:
- **CDN Edge Network (Mạng lưới máy chủ rìa):** Đóng vai trò làm cổng tiền đồn chặn đứng lưu lượng đọc dữ liệu tĩnh, thực thi bảo mật WAF, lọc Bot và kiểm soát tần suất truy cập.
- **Object Storage (S3 / MinIO):** Nơi lưu trữ vật lý các tệp sơ đồ SVG gốc do Ban tổ chức tải lên, đóng vai trò là nguồn dữ liệu tĩnh cho CDN tải về khi gặp hiện tượng Edge Miss.
- **API Gateway:** Nhận các request API động đã qua bộ lọc sạch từ CDN chuyển về, thực hiện cân bằng tải (Load Balancing) vào cụm máy chủ NestJS.
- **NestJS App Node Clusters (Cụm dịch vụ Backend):** Chỉ tập trung tài nguyên CPU/RAM để xử lý API 2 (Kho vé động) và thực thi logic nghiệp vụ đặt vé cốt lõi, không bị phân tán tài nguyên để truyền tải file tĩnh.
- **Redis Cluster:** Hệ thống lưu trữ bộ nhớ RAM phân tán, chịu trách nhiệm lưu trữ các bộ đếm nguyên tử (Atomic Counters) của số lượng vé thời gian thực để phục vụ API 2.

#### Công nghệ/Dịch Vụ bên thứ 3 được sử dụng hoặc Thư viện của NNLT:
- **Dịch vụ hạ tầng biên:** Cloudflare Enterprise / AWS CloudFront (Tích hợp các tính năng nâng cao bao gồm WAF, Managed Ruleset Chống Bot, Rate Limiting Rule và Cache Purge API).
- **Hạ tầng lưu trữ file:** AWS S3 hoặc MinIO Object Storage để lưu trữ tập trung dữ liệu hình ảnh sân khấu.
- **Framework & Thư viện Backend:** NestJS làm nhân xử lý điều hướng phối hợp; `@nestjs/axios` (hoặc Axios nguyên bản) để lập trình module gọi REST API sang CDN thực hiện lệnh Purge bộ nhớ đệm chủ động.
- **Thư viện Kết nối Redis:** `ioredis` cấu hình ở chế độ Cluster kết nối trực tiếp đến các Node chứa Hot Key kho vé.
--- 