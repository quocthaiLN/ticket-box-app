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

### Database hoặc Cache gặp sự cố (Tải quá cao)

### 1. Đánh giá và Lựa chọn giải pháp
- **Giải pháp:** Triển khai cơ chế **Graceful Degradation** + **Circuit Breaker** tại tầng API Gateway hoặc tầng Ứng dụng Backend. Khi hệ thống phát hiện tầng lưu trữ (Database chính hoặc cụm Redis Cluster) bị quá tải, hệ thống sẽ kích hoạt chiến lược **Fallback to Static Snapshot**. Luồng gọi dữ liệu động/tĩnh thời gian thực sẽ tạm thời bị ngắt bỏ, thay thế bằng việc trả về dữ liệu snapshot cấu trúc tĩnh được đóng gói sẵn nhằm bảo vệ hệ thống khỏi bị quá tải sập dây chuyền (Cascading Failure).

- **Phân tích trade-off:**
  * **Ưu điểm (Pros):** Đảm bảo tính khả dụng tối đa (High Availability) cho toàn hệ thống;
  * **Nhược điểm (Cons):** Số lượng vé còn lại hiển thị trên giao diện không thể cập nhật theo thời gian thực (phải chuyển sang trạng thái ẩn hoặc thông báo tượng trưng).
  
### 2. Cơ chế triển khai chi tiết (Implementation Details cho giải pháp được chọn)
#### Luồng xử lý:
- **Bước 1 (Giám sát kết nối):** Khi khán giả truy cập vào trang chi tiết concert, Client gửi các request bất đồng bộ đến API 1 (Metadata) và API 2 (Inventory). Request đi qua API Gateway để kiểm tra kết nối vào Database (PostgreSQL) và Bộ nhớ đệm phân tán (Redis Cluster).
- **Bước 2 (Kích hoạt ngắt mạch):** Nếu một trong các tầng lưu trữ này gặp sự cố, Module Circuit Breaker bọc ngoài service đó sẽ lập tức chuyển từ trạng thái **Closed** sang **Open**.
- **Bước 3 (Thực thi Fallback dữ liệu):** Trong trạng thái Open, tất cả các request tiếp theo từ người dùng sẽ bị chặn lại, không cho phép truy vấn xuống Database/Redis nữa. Hệ thống tự động chuyển hướng gọi hàm Fallback:
  * *Đối với API 1 (Thông tin concert tĩnh):* Thay vì đọc từ Database, Service trả về một bản ghi snapshot tĩnh (JSON) được lưu trực tiếp trong bộ nhớ RAM cục bộ của Node ứng dụng hoặc từ một file backup tĩnh có sẵn.
  * *Đối với API 2 (Số lượng vé động):* Hệ thống chặn luồng đọc bộ đếm từ Redis và trả về một mã trạng thái đặc biệt cho Client.
- **Bước 4 (Hạ cấp hiển thị giao diện):** Ứng dụng Client (Frontend) nhận được dữ liệu fallback và điều chỉnh giao diện tương ứng:
  * Các thông tin cốt lõi (Tên nghệ sĩ, thời gian, địa điểm, sơ đồ khu vực) vẫn hiển thị bình thường dựa trên snapshot tĩnh.
  * Khối hiển thị số lượng vé còn lại theo thời gian thực tự động ẩn con số đi và thay thế số lượng vé trống là: *"Đang cập nhật"*.
- **Bước 5 (Tự động phục hồi mạch):** Sau một khoảng thời gian Circuit Breaker chuyển sang trạng thái **Half-Open**. Hệ thống cho phép một lượng nhỏ request thực tế (ví dụ: 5% lượng traffic) đi xuống Database/Cache để kiểm tra xem hạ tầng đã ổn định lại chưa. Nếu thành công, mạch quay về trạng thái **Closed**; nếu tiếp tục lỗi, mạch tái lập trạng thái **Open** để bảo vệ hệ thống.

#### Thành phần tham gia:
- **API Gateway / Backend Service Controller:** Nơi tích hợp module giám sát kết nối và quản lý trạng thái của Circuit Breaker.
- **Circuit Breaker Module:** Thành phần cốt lõi chịu trách nhiệm đếm tỷ lệ lỗi, thực hiện ngắt mạch bảo vệ và kích hoạt hàm logic dự phòng (Fallback logic).
- **Local Memory Storage:** Nơi lưu trữ sẵn các bản JSON snapshot tĩnh của thông tin concert để sẵn sàng cung cấp ngay lập tức khi mạch bị ngắt.
- **Client Frontend App (React/Next.js):** Tiếp nhận dữ liệu hạ cấp từ API, thực hiện thay đổi trạng thái UI (ẩn bộ đếm vé, hiển thị câu thông báo thay thế) nhằm duy trì trải nghiệm tâm lý ổn định cho người dùng.

#### Công nghệ/Dịch Vụ bên thứ 3 được sử dụng hoặc Thư viện của NNLT:
- **Thư viện triển khai Circuit Breaker:** Sử dụng thư viện **Opossum** (thư viện chuẩn cho Node.js/NestJS để thiết kế Pattern Circuit Breaker) hoặc xây dựng một Custom Interceptor quản lý State Machine trong NestJS.
- **Hạ tầng lưu trữ nền tảng:** ExpressJS điều phối, PostgreSQL và Redis Cluster là các đối tượng được giám sát và bảo vệ phía sau mạch ngắt.

---

## USECASE: Đặt vé (Mua vé & Thanh toán)
### Tải trọng đột biến (80.000 truy cập/5 phút đầu), spam request và scalper bot lúc mở bán

### 1. Đánh giá và Lựa chọn giải pháp
- **Giải pháp:** Triển khai **Distributed Rate Limiting** áp dụng thuật toán **Token Bucket** vận hành theo cơ chế **Lazy Evaluation** tại tầng Middleware của ExpressJS. Bucket State được lưu trữ tập trung trên **Redis Cluster** nhằm đồng bộ giữa các bản sao backend. Toàn bộ logic kiểm tra thời gian, tính toán số dư và trừ token được đóng gói trong một **Lua Script** nguyên tử (Atomic) thực thi trực tiếp trên Redis Server. Khóa định danh (Rate Limit Key) được thiết lập động dựa trên mã tài khoản `User ID` (với người dùng đã đăng nhập) hoặc dải `IP Address` (với người dùng chưa đăng nhập) kết hợp với đường dẫn API (`Route Path`).

- **Phân tích trade-off:**
  * **Ưu điểm:**
    * **Hấp thụ tải bùng nổ tốt.**
    * **Tính nguyên tử tuyệt đối.**
    * **Tối ưu hóa tài nguyên phần cứng:** Cơ chế *Lazy Evaluation* giúp hệ thống không cần duy trì các tiến trình ngầm (Background Workers/Cron Jobs) để nạp lại token liên tục, giảm thiểu hao phí CPU và RAM trên cả ExpressJS lẫn Redis.
  * **Nhược điểm:**
    * **Tăng độ phức tạp mã nguồn.**

### 2. Cơ chế triển khai chi tiết (Implementation Details cho giải pháp được chọn)
#### Luồng xử lý:
- **Bước 1 (Tiếp nhận request và định danh):** Khán giả hoặc bot thực hiện gửi request POST lên API Endpoint `api/v1/tickets/hold` để tiến hành đặt vé. Request đến tầng Gateway và chuyển đến Middleware `tokenBucketLimiter` của ExpressJS trước khi vào Backend.
- **Bước 2 (Trích xuất thông tin thiết lập khóa):** Middleware tiến hành phân tích thông tin phiên làm việc: nếu request đã được xác thực, hệ thống ưu tiên lấy mã `req.user.id`; nếu chưa đăng nhập, hệ thống sẽ trích xuất địa chỉ `req.ip`. Khóa định danh được tạo ra theo cấu trúc phân tách chặt chẽ: `ratelimit:tickets_hold:identifier` - ví dụ: `ratelimit:tickets_hold:user_23120352`, `ratelimit:tickets_hold:ip_14.226.30.12` để đảm bảo hành vi spam ở API này không làm ảnh hưởng đến quyền truy cập các tính năng khác của người dùng.
- **Bước 3 (Thực thi tập lệnh nguyên tử trên Redis):** ExpressJS lấy `current_timestamp` và gọi hàm `EVAL` của thư viện kết nối Redis, truyền theo khóa định danh cùng các tham số cấu hình hệ thống bao gồm Dung lượng xô tối đa ($B$) và Tốc độ nạp lại ($R$).
- **Bước 4 (Tính toán delta time nội bộ):** TẠI REDIS SERVER, tập lệnh Lua Script được kích hoạt đơn luồng. Lệnh `HMGET` đọc lên hai giá trị: số lượng token còn lại tại lần truy cập trước ($T_{last}$) và mốc thời gian ghi nhận gần nhất ($t_{last}$). Số lượng token hiện tại được cập nhật tức thời theo công thức: 
  $$\text{tokens} = \min(so\_luong\_token\_toi\_da, T_{last} + (t_{current} - t_{last}) \times Toc\_do\_hoi)$$
- **Bước 5 (Kiểm tra điều kiện và phân phối mã trạng thái):** Tập lệnh Lua so sánh giá trị:
  * *Nếu số lượng token lớn hơn hoặc bằng 1:* Trừ đi 1 token từ quỹ, gọi lệnh `HMSET` ghi ngược lại trạng thái mới vào Redis, thiết lập thời gian sống tự động (`EXPIRE`) cho khóa để giải phóng bộ nhớ RAM và trả về giá trị số `1` cho ExpressJS.
  * *Nếu số lượng token nhỏ hơn 1:* Giữ nguyên toàn bộ cấu trúc dữ liệu cũ và lập tức trả về giá trị số `0`.
- **Bước 6 (Điều phối xử lý tại tầng ứng dụng):** ExpressJS tiếp nhận kết quả phản hồi từ tầng lưu trữ đệm:
  * *Trường hợp nhận về giá trị 1:* Middleware đánh giá request hợp lệ, gọi hàm `next()` để chuyển giao quyền kiểm soát cho Ticket Controller thực hiện logic kiểm tra kho vé và sinh Idempotency Key xử lý giao dịch.
  * *Trường hợp nhận về giá trị 0:* Middleware chủ động ngắt luồng xử lý, từ chối hạ tầng backend phía sau và trả về mã trạng thái HTTP `429 Too Many Requests` kèm cấu trúc thông báo JSON chuẩn hóa: `{"code": "TOO_MANY_REQUESTS", "message": "Hệ thống đang bận. Vui lòng thử lại sau."}`.

#### Thành phần tham gia:
- **Client Application (Web App):** Nơi người dùng thực hiện tương tác + nhận mã lỗi HTTP 429 từ máy chủ để vô hiệu hóa nút bấm tạm thời.
- **ExpressJS API Gateway / Middleware Tầng Ứng Dụng:** Bóc tách thông tin định danh, thiết lập cấu trúc khóa và điều phối kết nối bất đồng bộ lên cụm Redis.
- **Redis Cluster (Distributed Memory Store):** Nơi lưu trữ trạng thái chân lý tạm thời của Buckets, đảm nhận toàn bộ vai trò tính toán số học nâng cao một cách cô lập và bảo mật dưới áp lực dồn tải cường độ cao.
- **Primary Database (PostgreSQL):** Hệ cơ sở dữ liệu quan hệ cốt lõi của TicketBox, hoàn toàn được che giấu và bảo vệ an toàn phía sau lớp khiên Rate Limiter, chỉ xử lý những truy vấn mua vé đã qua sàng lọc và thực sự chất lượng.

#### Công nghệ/Dịch Vụ bên thứ 3 được sử dụng hoặc Thư viện của ExpressJS:
- **ioredis (v5.x):** Thư viện điều khiển kết nối Redis nâng cao cho nền tảng Node.js, cung cấp cơ chế quản lý Connection Pooling tối ưu, tự động định tuyến các lệnh mã hóa đến chính xác các Nodes trong cụm Redis Cluster và hỗ trợ thực thi Lua Script hiệu năng cao.
- **fs (File System Core Module):** Thư viện tệp tin hệ thống nguyên bản của NodeJS, được sử dụng để đọc nội dung file chứa mã lệnh nguồn Lua (`.lua`) vào bộ nhớ đệm RAM một lần duy nhất ngay khi máy chủ ExpressJS khởi động (Bootstrap phase), ngăn chặn phát sinh thao tác Disk I/O nghẽn cổ chai trong quá trình vận hành luồng. Dùng để đọc file `.lua` tính toán số Token còn lại trong Bucket ngay tại Redis Server.

---
## Khán giả Retry nhiều lần thanh toán do mạng yếu, phòng chống trùng lặp đơn hàng và trừ tiền hai lần

### 1. Đánh giá và Lựa chọn giải pháp
- **Giải pháp:** Triển khai cơ chế **Idempotency** sử dụng **Idempotency Key** lưu trữ và quản lý trạng thái tập trung trên nền tảng **Redis Cluster**. Khi Khán giả nhấn nút "Tiến hành đặt vé", ứng dụng Client bắt buộc phải khởi tạo một chuỗi định danh duy nhất `UUIDv4` và đính kèm vào trong thuộc tính HTTP Header có tên `Idempotency-Key`. Nếu một request có cùng khóa gửi tới nhiều lần do hiện tượng nghẽn mạng hoặc thao tác bấm lặp của người dùng, hệ thống sẽ nhận diện và đưa ra phương án xử lý tương ứng mà không thực thi lại logic nghiệp vụ cốt lõi hay gọi lại sang cổng thanh toán thứ ba (VNPAY/MoMo).

- **Phân tích trade-off:**
  * **Ưu điểm:**
    * *Bảo vệ toàn vẹn tài chính.*
    * *Khả năng chịu lỗi mạng cao.*
    * *Tối ưu hóa tài nguyên Database và API đối tác.*
  * **Nhược điểm:**
    * *Gia tăng áp lực lưu trữ lên RAM của Redis.* 
    * *Ở phía Client:* Ứng dụng Frontend (Web/Mobile App) phải được thiết kế logic lưu trữ cục bộ (State/Local Storage) để giữ nguyên một `Idempotency-Key` duy nhất cho một phiên giao dịch xuyên suốt các lần thử lại (Retry), nếu Client vô tình sinh key mới cho mỗi lần bấm lại thì cơ chế phòng vệ này sẽ mất hoàn toàn tác dụng.

### 2. Cơ chế triển khai chi tiết (Implementation Details cho giải pháp được chọn)
#### Luồng xử lý:
- **Bước 1 (Khởi tạo và gửi request):** Khán giả nhấn nút "Tiến hành đặt vé" trên giao diện. Client sinh ngẫu nhiên một mã UUIDv4 (Ví dụ: `9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d`), lưu vào bộ nhớ ứng dụng và đính kèm vào HTTP Header `Idempotency-Key` trước khi gửi request POST tới API đặt vé.
- **Bước 2 (Kiểm tra sự tồn tại của khóa):** Request đi qua Idempotency Middleware trong ExpressJS. Middleware trích xuất giá trị chuỗi từ Header này, kết hợp tạo thành khóa Redis theo cấu trúc: `idempotency:tickets_hold:9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d`. Tiếp theo, hệ thống sử dụng lệnh `HGETALL` để đọc toàn bộ dữ liệu của khóa từ Redis Cluster.
- **Bước 3 (Rẽ nhánh xử lý theo mô hình trạng thái):** Dựa trên kết quả trả về từ Redis, Middleware thực hiện phân tách thành 3 kịch bản:
  * *Trường hợp 1 (Chưa tồn tại khóa - Lần đầu truy cập):* Middleware sử dụng lệnh `SETNX` nguyên tử để tạo khóa với trường `status = "PROCESSING"`, đồng thời thiết lập thời gian sống (TTL) ban đầu cho khóa (ví dụ: 5 phút). Request được phép đi tiếp sang tầng Ticket Controller để thực hiện nghiệp vụ giữ vé và gọi cổng thanh toán.
  * *Trường hợp 2 (Khóa có trạng thái `PROCESSING`):* Nhận diện đây là một request trùng lặp được gửi đến trong lúc request đầu tiên vẫn đang được backend xử lý. Hệ thống lập tức ngắt luồng và trả về mã lỗi HTTP `409 Conflict` kèm thông báo: *"Yêu cầu giao dịch đang được xử lý, vui lòng không thao tác liên tục"*.
  * *Trường hợp 3 (Khóa có trạng thái `SUCCESS`):* Nhận diện đây là một request gửi lại của một giao dịch đã xử lý thành công hoàn toàn trước đó (nhưng Client bị mất mạng nên không nhận được gói tin phản hồi gốc). Middleware trích xuất trường `response_body` và `response_status` được lưu trữ trong bộ đệm Redis, trả thẳng về cho Client mà không chạy lại bất kỳ dòng code nghiệp vụ nào phía sau.
- **Bước 4 (Cập nhật kết quả giao dịch cuối):** Khi tầng Ticket Controller xử lý hoàn tất nghiệp vụ (ví dụ: sinh link cổng thanh toán VNPAY thành công), hệ thống thu giữ lại cấu trúc Response gửi đi, gọi lệnh `HMSET` lên Redis để cập nhật trạng thái khóa từ `"PROCESSING"` sang `"SUCCESS"`, đồng thời nạp nội dung chuỗi phản hồi vào trường `response_body`. Thời gian sống (TTL) của khóa được Refresh về thời gian quy định để phục vụ các lần Retry muộn của Client trong tương lai, phục vụ trường hợp 3.

#### Thiết lập Idempotency Schema (Redis Hash):
Mỗi khóa `idempotency:tickets_hold:{key}` được lưu trữ dưới dạng một cấu trúc `Hash` trong Redis bao gồm các trường dữ liệu đặc tả sau:
* `status`: Trạng thái hiện tại của phiên xử lý (`PROCESSING` hoặc `SUCCESS`).
* `request_hash`: Chuỗi giá trị băm (`sha256`) của request payload gửi lên để đối chiếu tính nguyên vẹn dữ liệu, chống trường hợp đổi thông tin đặt vé nhưng dùng lại key cũ.
* `response_status`: Mã trạng thái HTTP phản hồi gốc từ Server (ví dụ: `201 Created`).
* `response_body`: Chuỗi JSON phản hồi gốc chứa chi tiết thông tin đơn hàng và đường dẫn link thanh toán được sinh ra.
* `created_at`: Mốc thời gian khởi tạo cấu trúc khóa dưới định dạng Unix Timestamp.

#### Thành phần tham gia:
- **Client Application (Web App):** Chịu trách nhiệm khởi tạo mã UUIDv4, lưu giữ cố định mã này trong bộ nhớ cục bộ xuyên suốt quá trình Retry đơn hàng và gửi đính kèm lên Header của request HTTP.
- **Idempotency Middleware (ExpressJS):** Tầng trung gian đánh chặn, quản lý State Machine, thực hiện các truy vấn đọc/ghi trạng thái nguyên tử lên Redis Cluster và đưa ra quyết định cho qua, ngắt mạch lỗi, hoặc trả về dữ liệu lưu đệm.
- **Ticket / Payment Controller (Backend Service):** Nơi xử lý logic nghiệp vụ giữ vé, trừ kho vé tổng, sinh đơn hàng và kết nối trực tiếp đến các cổng thanh toán bên thứ ba. Tầng này hoàn toàn độc lập và không cần biết đến sự tồn tại của Idempotency Key nhờ thiết kế bóc tách mã nguồn.
- **Redis Cluster:** Hạ tầng lưu trữ phân tán, chịu trách nhiệm lưu giữ Schema lũy đẳng với tốc độ I/O nhanh nhằm đáp ứng yêu cầu phản hồi và tra cứu trạng thái khóa trong thời gian thực.

#### Công nghệ/Dịch Vụ bên thứ 3 được sử dụng hoặc Thư viện của ExpressJS:
- **uuid (v9.x):** Thư viện ở phía Client để sinh chuỗi ngẫu nhiên chuẩn hóa thế giới UUID Version 4 nhằm triệt tiêu xác suất trùng lặp khóa.
- **ioredis (v5.x):** Thư viện kết nối cụm Redis chuyên dụng cho ExpressJS, hỗ trợ đóng gói các cấu trúc lệnh liên hoàn `MULTI / EXEC` (Redis Transactions) bảo toàn tính toàn vẹn trạng thái.
- **crypto (Node.js Core Module):** Thư viện mã hóa nội bản của NodeJS, dùng thuật toán `sha256` để băm payload phục vụ trường `request_hash` đối chiếu dữ liệu đầu vào.

---

## Cổng thanh toán VNPAY/MoMo sự cố
### 1. Đánh giá và Lựa chọn giải pháp

- **Giải pháp:** Triển khai **Circuit Breaker** và **Bulkhead** tại tầng kết nối dịch vụ thanh toán (Payment Integration Layer) của ExpressJS.
  
  * **Bulkhead Pattern:** Thực hiện phân rã và giới hạn tài nguyên độc lập cho từng cổng thanh toán ở tầng ứng dụng và mạng (Connection Pooling & Concurrency Throttling). Sự cố nghẽn mạng hoặc cạn kiệt tài nguyên của VNPAY tuyệt đối không được ảnh hưởng đến MoMo hay các luồng nghiệp vụ cốt lõi khác như Xem thông tin concert hoặc Soát vé.
  * **Circuit Breaker Pattern:** Toàn bộ các yêu cầu truyền thông mạng (HTTP Requests) sang API của đối tác được bọc trong một State Machine gồm 3 trạng thái (`Closed`, `Open`, `Half-Open`). Khi tỷ lệ lỗi hoặc hiện tượng quá thời hạn phản hồi (Timeout) từ cổng đối tác vượt quá ngưỡng thiết lập, mạch sẽ tự động chuyển sang trạng thái `Open`, chủ động chặn đứng các yêu cầu tiếp theo đâm vào hệ thống đối tác và kích hoạt ngay luồng xử lý dự phòng **Graceful Degradation**.

---

### 2. Cơ chế triển khai chi tiết (Implementation Details cho giải pháp được chọn)

#### Luồng xử lý:

-   **Bước 1 (Tiếp nhận và Định tuyến tài nguyên - Bulkhead):**
    Khi Khán giả gửi yêu cầu đặt vé và thanh toán, request đi qua bộ lọc Rate Limit và Idempotency Key. Tại tầng Payment Service, dựa trên phương thức thanh toán được chọn (VNPAY hoặc MoMo), request được đưa vào phân vùng tài nguyên cô lập tương ứng. Hệ thống sử dụng một bộ giới hạn tác vụ đồng thời (Concurrency Limiter) để kiểm tra: nếu số lượng tác vụ đang xử lý vượt ngưỡng cấu hình (ví dụ: tối đa 30 requests đồng thời), request mới sẽ phải xếp hàng chờ trong RAM, tuyệt đối không được tự ý chiếm dụng và làm cạn kiệt số lượng Socket kết nối của OS.

-   **Bước 2 (Kiểm tra trạng thái mạch ngắt - Circuit Breaker):**
    Trước khi gọi API qua Internet sang đối tác, Module Circuit Breaker bọc ngoài SDK của cổng thanh toán sẽ kiểm tra trạng thái máy trạng thái (State Machine) hiện tại của mạch:
    * *Trường hợp mạch đang ở trạng thái `Open`:* Request bị chặn, hệ thống không thực hiện bất kỳ kết nối mạng nào ra internet nhằm bảo vệ tài nguyên máy chủ, chuyển thẳng đến **Bước 4 (Fallback)**.
    * *Trường hợp mạch đang ở trạng thái `Closed`:* Cho phép request đi qua và kích hoạt bộ đếm thời gian giám sát (Timeout Watchdog, cấu hình tối đa 5 giây).

-   **Bước 3 (Giám sát, Ghi nhận chỉ số và Rẽ nhánh trạng thái):**
    Hệ thống tiếp nhận và phân tích kết quả trả về từ API đối tác:
    * *Kịch bản A (Thành công hoặc Lỗi nghiệp vụ):* Nếu phản hồi thành công hoặc trả về lỗi nghiệp vụ thông thường (như sai thông tin thẻ, tài khoản không đủ số dư), mạch ghi nhận là request thành công (về mặt hạ tầng kết nối), điều hướng Khán giả sang trang thanh toán của đối tác.
    * *Kịch bản B (Lỗi hạ tầng hoặc Quá thời gian chờ):* Nếu kết nối mạng thất bại, đối tác trả về mã lỗi `5xx`, hoặc quá 5 giây mà không có phản hồi, mạch ghi nhận 1 điểm lỗi vào bộ nhớ đệm Cửa sổ trượt (Sliding Window). Khi tỷ lệ lỗi vượt ngưỡng cấu hình (ví dụ: >50% trong tổng số 10 requests gần nhất), mạch lập tức chuyển sang trạng thái `Open` và kích hoạt bộ định thời ngủ (Sleep Window, ví dụ: 60 giây).

-   **Bước 4 (Thực thi luồng Fallback - Hạ cấp tính năng):**
    Khi mạch ở trạng thái `Open` hoặc khi một request đơn lẻ bị lỗi/timeout, hàm Fallback được kích hoạt một cách chủ động:
    * Hệ thống gọi sang Inventory Service trên Redis Cluster để giải phóng (Release) số lượng vé đang tạm giữ (Hold) của đơn hàng này, hoàn trả lại kho vé tổng để dành cơ hội cho các Khán giả khác.
    * ExpressJS lập tức trả về mã lỗi HTTP `503 Service Unavailable` kèm theo cấu trúc dữ liệu JSON đặc tả lỗi hạ cấp: ` { "status": "DEGRADED", "message": "Cổng thanh toán hiện tại đang gặp sự cố bảo trì. Vui lòng thử lại sau hoặc lựa chọn phương thức thanh toán khác." } `.

-   **Bước 5 (Tự động thăm dò và Phục hồi mạch - Half-Open):**
    Sau khi hết 60 giây của chu kỳ ngủ (Sleep Window), Circuit Breaker tự động chuyển dịch trạng thái sang `Half-Open`. Tại đây, hệ thống chỉ cho phép một lượng nhỏ traffic thực tế (ví dụ: tối đa 5% lượng request thanh toán tiếp theo) đi qua để thử thách năng lực chịu tải của cổng đối tác:
    * Nếu toàn bộ các request thử nghiệm này đều phản hồi thành công, mạch hiểu rằng đối tác đã phục hồi hạ tầng, lập tức đưa trạng thái về lại `Closed`, hệ thống trở lại vận hành bình thường.
    * Nếu xuất hiện bất kỳ request nào tiếp tục bị lỗi hoặc timeout, mạch nhận định đối tác vẫn chưa ổn định, lập tức tái lập trạng thái `Open` và bắt đầu một chu kỳ ngủ mới.

#### Thành phần tham gia:

-   **ExpressJS Payment Controller & Bulkhead Manager:** Tiếp nhận request đầu vào, chịu trách nhiệm quản lý cấu hình Connection Pool (HTTP/HTTPS Agent) độc lập và giới hạn số lượng tác vụ xử lý bất đồng bộ đồng thời cho từng cổng đối tác.
-   **Circuit Breaker Module (Thư viện Opossum):** Thành phần cốt lõi bọc quanh hàm gọi API kết nối, chịu trách nhiệm quản lý mô hình máy trạng thái (`Closed`, `Open`, `Half-Open`), tính toán tỷ lệ lỗi trong Sliding Window và kích hoạt hàm logic dự phòng khi có sự cố.
-   **Inventory Service & Redis Cluster:** Phối hợp nhận tín hiệu từ luồng Fallback của Circuit Breaker để hoàn trả số lượng vé tạm giữ về kho một cách nguyên tử, đảm bảo dữ liệu kho vé không bị sai lệch hoặc thiếu hụt.
-   **Client Frontend Application (Web/Mobile App):** Đón nhận mã lỗi HTTP 503 và trạng thái `DEGRADED` từ backend, thực hiện thay đổi giao diện trực quan (hiển thị panel thông báo lỗi tinh tế, ẩn cổng thanh toán bị sập và gợi ý người dùng chuyển sang cổng thanh toán còn lại).

#### Công nghệ/Dịch Vụ bên thứ 3 được sử dụng hoặc Thư viện của ExpressJS:

-   **Opossum (v8.x):** Thư viện chuẩn công nghiệp cho hệ sinh thái Node.js/ExpressJS để triển khai mô hình Circuit Breaker, hỗ trợ đầy đủ cấu hình nâng cao như `timeout`, `errorThresholdPercentage`, `volumeThreshold`, và `resetTimeout`.
-   **Axios (v1.x) tích hợp `http.Agent` / `https.Agent`:** Thư viện HTTP Client được cấu hình thuộc tính `maxSockets` độc lập (ví dụ: `maxSockets: 50` cho mỗi cổng) nhằm tạo vách ngăn Bulkhead vật lý về mặt kết nối mạng tại tầng Socket của Hệ điều hành.
-   **p-limit (v4.x):** Thư viện Node.js được sử dụng tại tầng ứng dụng ExpressJS để triển khai cơ chế Semaphore, khống chế số lượng Promises xử lý đồng thời cho các tác vụ gọi cổng thanh toán nhằm hoàn thiện giải pháp Bulkhead hoàn chỉnh.

---

## USECASE: Đặt vé & Thanh toán — Cơ chế Giải quyết Tranh chấp Kho vé (Race Condition)

### 1. Đánh giá và Lựa chọn giải pháp

* **Giải pháp Kiến trúc đề xuất:** Triển khai cơ chế **Khóa bi quan trong Transaction ngắn hạn (Short-lived Transaction)** kết hợp **Quản lý trạng thái phân tán (Distributed State) trên Redis Cluster**. 

Hệ thống phân rã nghiệp vụ đặt vé làm hai giai đoạn độc lập: Khóa bi quan PostgreSQL chỉ chịu trách nhiệm bảo vệ thao tác kiểm tra và trừ kho vé tổng diễn ra trong tích tắc (tính bằng mili-giây), sau đó giải phóng khóa lập tức; việc duy trì quyền giữ chỗ tạm thời trong $10$ phút của Khán giả sẽ được ủy thác hoàn toàn cho bộ nhớ đệm Redis gánh vác.

* **Phân tích Trade-off (Đánh đổi kỹ thuật):**
    * *Ưu điểm (Pros):* Bảo toàn tính toàn vẹn dữ liệu tuyệt đối (chuẩn ACID) của RDBMS, triệt tiêu hoàn toàn lỗi bán lố vé. Thời gian giữ khóa bi quan cực ngắn ($< 10\text{ms}$), giải phóng tài nguyên Connection Pool ngay lập tức, ngăn ngừa triệt để hiện tượng nghẽn mạch request dưới tải cao.
    * *Nhược điểm (Cons):* Phát sinh rủi ro **Vé ảo (Ghost Tickets)** khi Khán giả đã giữ chỗ thành công trong $10$ phút nhưng sau đó không thanh toán hoặc chủ động hủy, khiến một lượng vé bị giam giữ tạm thời, tước đi cơ hội của người mua khác.
    * *Khắc phục:* Triển khai tiến trình xử lý ngầm bất đồng bộ (Background Worker / BullMQ Delayed Job) để tự động thu hồi và hoàn trả vé về kho tổng khi phát hiện đơn hàng quá hạn.

---

### 2. Cơ chế triển khai chi tiết (Implementation Details cho giải pháp được chọn)

#### Luồng xử lý:

* **Bước 1 (Khởi tạo Transaction ngắn hạn):**
    Khi request đặt vé vượt qua lớp màng lọc bảo vệ tầng ngoài (Rate Limiter, Idempotency), Ticket Service tiếp nhận và mở một phiên giao dịch cơ sở dữ liệu mới (`BEGIN TRANSACTION`) thông qua Connection Pool của PostgreSQL.
* **Bước 2 (Thực thi truy vấn khóa bi quan cấp dòng):**
    Hệ thống gửi câu lệnh truy vấn đọc số lượng vé tồn kho của phân khu cụ thể kèm theo chỉ thị khóa cứng dòng:
    ```sql
    SELECT id, total_quantity, available_quantity 
    FROM ticket_types 
    WHERE concert_id = 1 AND name = 'SVIP' 
    FOR UPDATE;
    ```
    Lệnh `SELECT` này mang tính nguyên tử.
* **Bước 3 (Kiểm tra điều kiện kho vé tại tầng Ứng dụng):**
    ExpressJS nhận được dữ liệu tồn kho an toàn mà không sợ bị bất kỳ tiến trình song song nào can thiệp thay đổi dữ liệu. Hệ thống thực hiện phép tính toán kiểm tra logic nghiệp vụ:
    * *Trường hợp A (Hết vé):* Nếu số lượng vé khả dụng nhỏ hơn số lượng yêu cầu (`available_quantity < requested_quantity`), hệ thống thực hiện lệnh `ROLLBACK` để giải phóng khóa lập tức và trả về lỗi HTTP `400 Bad Request`: *"Loại vé này đã được bán hết hoặc không đủ số lượng yêu cầu"*.
    * *Trường hợp B (Còn vé):* Hệ thống tiến hành trừ trực tiếp số lượng vé trong kho tổng dựa trên số lượng khách hàng đặt mua (`available_quantity = available_quantity - requested_quantity`).
* **Bước 4 (Cập nhật kho vé tổng và Giải phóng khóa - `COMMIT`):**
    Hệ thống gửi lệnh `UPDATE` cập nhật số dư mới xuống cơ sở dữ liệu:
    ```sql
    UPDATE ticket_types 
    SET available_quantity = :new_available_quantity 
    WHERE id = :ticket_type_id;
    ```
    Tiếp theo, khởi tạo một bản ghi Đơn hàng mới vào bảng `orders` với trạng thái ban đầu là `PENDING` và cấu hình mốc thời gian hết hạn cụ thể (`held_until = NOW() + INTERVAL '10 minutes'`). 
    
    Sau đó, ExpressJS phát lệnh kết thúc giao dịch: `COMMIT;`. Ngay khi lệnh `COMMIT` thành công, PostgreSQL thực thi ghi dữ liệu bền vững xuống đĩa, **tự động giải phóng chiếc Khóa độc quyền cấp dòng**. Request tiếp theo đang nằm chờ ở hàng đợi của Bước 2 sẽ lập tức thức dậy, chiếm lấy khóa mới và tái lập chu kỳ xử lý an toàn. Toàn bộ chuỗi thao tác từ Bước 1 đến Bước 4 kết thúc trong vòng dưới $10\text{ms}$.
* **Bước 5 (Ủy thác trạng thái giữ chỗ sang Redis và Điều hướng thanh toán):**
    Sau khi Transaction cơ sở dữ liệu đã đóng, hệ thống nạp thông tin đơn hàng tạm thời lên **Redis Cluster** dưới dạng cấu trúc dữ liệu Redis Hash (`order:hold:{order_id}`) thiết lập thời gian sống (TTL) nghiêm ngặt là $10$ phút để thực thi việc giữ chỗ tầng ứng dụng. Sau đó, `Payment Module` tiếp quản luồng xử lý để kết nối mạng (HTTP Request) sang API của đối tác VNPAY/MoMo xin cấu hình URL giao dịch và điều hướng Khán giả đi thanh toán dòng tiền.

#### Thành phần tham gia:

* **Ticket Service Controller (ExpressJS):** Nơi tiếp nhận điều phối luồng xử lý, chịu trách nhiệm quản lý nghiêm ngặt vòng đời của một Short-lived Transaction (Đảm bảo bọc trong cấu trúc `try-catch-finally` tường minh, bắt buộc gọi `ROLLBACK` nếu xảy ra lỗi runtime để tránh hiện tượng treo khóa (Lock Hanging) vĩnh viễn ở Postgres).
* **PostgreSQL Lock Manager (Bộ quản lý khóa nội bản của DB):** Thành phần cốt lõi chịu trách nhiệm cấp phát Khóa độc quyền cấp dòng (Row-level Locks), quản lý hàng đợi xếp hàng tuần tự của các tiến trình đồng thời và tự động triệt tiêu rủi ro nghẽn mạch phần cứng.
* **Ticket Types Database Table (PostgreSQL Entity):** Bảng dữ liệu chứa cấu hình số ghế của từng phân khu, bắt buộc được thiết kế lập chỉ mục (`INDEX`) chặt chẽ trên các cột truy vấn (`concert_id`, `id`) để đảm bảo lệnh `FOR UPDATE` khóa chính xác phạm vi dòng, tuyệt đối không bị nâng cấp nhầm lên khóa toàn bảng (Table Lock).
* **Redis Cluster:** Hạ tầng lưu trữ In-memory, đóng vai trò giữ trạng thái đơn hàng tạm thời (`PENDING`) trong khung thời gian $10$ phút của người dùng, cô lập hoàn toàn thời gian chờ thanh toán ra khỏi Database chính.

#### Công nghệ/Dịch Vụ bên thứ 3 được sử dụng hoặc Thư viện của ExpressJS:

* **pg (node-postgres / v8.x):** Thư viện điều khiển kết nối cơ sở dữ liệu PostgreSQL gốc cho nền tảng Node.js, cung cấp khả năng can thiệp sâu để quản lý Client Transaction thủ công một cách chuẩn xác.
* **TypeORM / Sequelize (ORM Layer):** Sử dụng thuộc tính bọc câu lệnh chuyên dụng để kích hoạt Pessimistic Lock, ví dụ trong TypeORM: `lock: { mode: 'pessimistic_write' }` (Tự động biên dịch sang cú pháp `SELECT ... FOR UPDATE` khi thực thi truy vấn).
* **Database Connection Pool Configuration:** Thuộc tính cấu hình `max` của Pool kết nối cơ sở dữ liệu cần được tính toán đồng bộ với throughput tối đa của hệ thống để đảm bảo việc mượn/trả connection diễn ra liên tục, đáp ứng tốt cho các Short-lived Transactions.


---

## Giới hạn vé per-user khó enforce dưới tải cao
Chỗ này khó hiểu quá chắc để tui tìm hiểu thêm sau =))

---
## USECASE: Xem thông tin concert 
### Nhà cung cấp dịch vụ Email/SMS bên thứ ba gặp vấn đề
### 1. Đánh giá và Lựa chọn giải pháp

- **Giải pháp:** **Kiến trúc hướng sự kiện bất đồng bộ (Asynchronous Event-Driven Architecture)** kết hợp các mẫu thiết kế chống chịu lỗi: **Retry Pattern với Exponential Backoff & Jitter**, **Bulkhead Isolation**, và **Dead Letter Queue (DLQ)**. 

  *Hệ thống bóc tách hoàn toàn luồng đặt vé chính ra khỏi luồng gửi thông báo thông qua một Message Broker (BullMQ + Redis Cluster). Luồng chính xử lý đặt vé xong sẽ đẩy sự kiện vào hàng đợi và phản hồi ngay lập tức cho Khán giả. Một nhóm các tiến trình ngầm (Workers) độc lập sẽ tiêu thụ thông điệp từ hàng đợi và giao tiếp với API của bên thứ ba.*

- **Phân tích trade-off:**
  * **Ưu điểm:**
    * Loại bỏ hoàn toàn thời gian chờ đợi phản hồi (Latency) từ API bên thứ ba trong luồng HTTP Request-Response của Khán giả. Giảm thiểu nguy cơ nghẽn Connection Pool của ứng dụng ExpressJS dưới tải cao.
    * Nếu nhà cung cấp Email/SMS bị sập hoàn toàn (Downtime), dữ liệu e-ticket vẫn nằm an toàn trong hàng đợi Redis (được cấu hình lưu trữ bền vững - AOF) và tự động thử lại khi đối tác phục hồi.
  * **Nhược điểm:**
    * **Độ phức tạp hệ thống tăng cao:** Đòi hỏi phải vận hành, giám sát thêm hạ tầng Redis Cluster, BullMQ Workers, và xử lý bài toán trùng lặp thông điệp (Idempotent Consumer).

---

### 2. Cơ chế triển khai chi tiết (Implementation Details cho giải pháp được chọn)

#### Luồng xử lý:

- **Bước 1: Phát hành sự kiện đặt vé thành công (Publish Event)**
  Khi Khán giả thanh toán thành công, `Order Service` trong ứng dụng ExpressJS ghi nhận giao dịch vào cơ sở dữ liệu PostgreSQL, sau đó gọi phương thức `.add()` của BullMQ để đẩy một Job chứa dữ liệu e-ticket (`email`, `ticket_id`, `concert_name`, `qr_code`) vào `NotificationQueue`. Ngay sau đó, ExpressJS trả về HTTP Status `200 OK` cho giao diện Client kèm thông báo hệ thống đang xử lý mã QR.

- **Bước 2: Tiêu thụ bất đồng bộ và kiểm soát luồng (Consume & Throttling)**
  `Notification Worker` (chạy trên tiến trình độc lập hoặc container riêng) liên tục lắng nghe hàng đợi. Nhờ cấu hình `concurrency: 10`, tối đa chỉ có 10 Jobs được xử lý đồng thời trên mỗi thực thể Worker (Mẫu thiết kế Bulkhead). Worker trích xuất dữ liệu và thực hiện lời gọi HTTP API đến nhà cung cấp dịch vụ (ví dụ: SendGrid API).

- **Bước 3: Xử lý lỗi tự động (Retry with Exponential Backoff & Jitter)**
  Nếu API bên thứ ba trả về lỗi kết nối, Timeout hoặc mã phản hồi `5xx/429`:
  * Hệ thống giữ Job lại trong hàng đợi và chuyển trạng thái sang `delayed`.
  * Tính toán thời gian lùi bước tăng theo hàm số mũ kết hợp ngẫu nhiên (Jitter) nhằm phân rã các request thử lại, giảm áp lực lên server đối tác: 
    $$Delay = 	ext{base\_delay} 	imes 2^{	ext{attempts}} + 	ext{jitter}$$
  * Job sẽ được tự động kích hoạt xử lý lại khi hết thời gian trì hoãn.

- **Bước 4: Cô lập thông điệp lỗi vĩnh viễn (Dead Letter Queue - DLQ)**
  Nếu Job đã thử lại vượt quá số lần cấu hình tối đa (ví dụ: 5 lần) mà vẫn thất bại liên tục, hệ thống sẽ kích hoạt sự kiện `failed`. Worker sẽ bắt lấy sự kiện này, trích xuất toàn bộ dữ liệu Payload và chuyển dịch bản ghi sang một phân vùng riêng (Database bảng `notification_dlq` hoặc một Queue lỗi riêng biệt).

#### Thành phần tham gia:

* **ExpressJS Controller (Producer):** Tiếp nhận tín hiệu thanh toán, đóng gói thông tin vé và đẩy tác vụ gửi thông báo vào hàng đợi.
* **Redis Cluster (Message Broker):** Lưu trữ tập trung trạng thái và dữ liệu của các Jobs trong hàng đợi, đảm bảo tốc độ đọc/ghi I/O cực cao trên RAM và hỗ trợ tính năng lưu trữ bền vững.
* **BullMQ Workers (Consumer):** Các tiến trình xử lý ngầm, chịu trách nhiệm tiêu thụ Job, khống chế tải đồng thời (Concurrency) và thực thi các chiến lược thử lại (Retry).
* **Third-Party API Client (SendGrid/Twilio Service):** Thành phần tích hợp chứa mã nguồn thiết lập Header, Key xác thực và gọi API ngoại vi thông qua Axios hoặc SDK chính thức.
* **PostgreSQL DLQ Table (Data Storage):** Nơi lưu trữ cuối cùng của các thông báo lỗi để bảo toàn dữ liệu, phục vụ mục đích kiểm toán (Audit) và xử lý thủ công từ trang Quản trị (Admin Dashboard).

#### Công nghệ/Dịch Vụ bên thứ 3 được sử dụng hoặc Thư viện của ExpressJS:

* **BullMQ (v5.x):** Thư viện quản lý hàng đợi và tác vụ ngầm mạnh mẽ nhất dành cho NodeJS/ExpressJS, xây dựng trên nền tảng Redis, hỗ trợ sẵn cơ chế Auto-Retry, Exponential Backoff, và kiểm soát luồng đồng thời cực kỳ chính xác.
* **ioredis (v5.x):** Thư viện client Redis hiệu năng cao, hỗ trợ kết nối Redis Cluster ổn định, có cơ chế tự động kết nối lại và xử lý Non-blocking tốt.
* **Axios (v1.x):** Thư viện HTTP Client để gọi API bên thứ ba, được cấu hình kèm thuộc tính `timeout: 5000` (5 giây) nghiêm ngặt để chủ động cắt đứt các kết nối bị treo muộn từ phía đối tác.

### Mở rộng thông báo bằng Zalo trong tương lai
- Chỉ cần dùng Design Pattern Strategy -> thuộc về phần implement nhiều hơn
| Tranh chấp đặt vé giữa nhiều người cùng lúc | Pessimistic Locking (SELECT ... FOR UPDATE) trong ACID Transaction |
| Nhành phần cung cấp dịch vụ Email/SMS bên thứ ba gặp vấn đề | Asynchronous Event-Driven + Retry Pattern + Dead Letter Queue (DLQ) |
| Mở rộng thông báo bằng Zalo trong tương lai | Strategy Pattern dựa trên Kiến trúc Hướng sự kiện |

