# Bảng tóm tắt vấn đề và cách giải quyết

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