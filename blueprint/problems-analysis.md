### Bảng tóm tắt vấn đề và cách giải quyết
| Tình huống / Vấn đề | Kỹ thuật giải quyết cốt lõi |
|---|---|
| 80.000 truy cập xem thông tin concert lúc mở đặt vé | Bóc tách API (Metadata vs. Inventory) + Multi-level Caching |
| Database hoặc Cache gặp sự cố (Tải quá cao) | Graceful Degradation + Circuit Breaker |
| Tải trọng đột biến (80.000 truy cập/5 phút đầu), spam request và scalper bot lúc mở bán | Distributed Rate Limiting với thuật toán Token Bucket |
| Khán giả Retry nhiều lần thanh toán do mạng yếu, phòng chống trùng lặp đơn hàng và trừ tiền hai lần | Idempotency Mechanism sử dụng Idempotency Key |
| Cổng thanh toán VNPAY/MoMo sự cố | Circuit Breaker kết hợp Bulkhead Isolation |
| Tranh chấp đặt vé giữa nhiều người cùng lúc | Pessimistic Locking (SELECT ... FOR UPDATE) trong ACID Transaction |
| Nhành phần cung cấp dịch vụ Email/SMS bên thứ ba gặp vấn đề | Asynchronous Event-Driven + Retry Pattern + Dead Letter Queue (DLQ) |
| Mở rộng thông báo bằng Zalo trong tương lai | Strategy Pattern dựa trên Kiến trúc Hướng sự kiện |