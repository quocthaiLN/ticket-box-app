# Đặc tả: Per-user Ticket Limit

## 1. Mô tả

Đặc tả kiểm soát số lượng vé tối đa mà một tài khoản được mua hoặc giữ cho từng loại vé.

## 2. Actor / Thành phần tham gia

- Khán giả
- Ticketing Module
- PostgreSQL

## 3. Bảng dữ liệu liên quan

- `ticket_types`
- `user_ticket_type_counters`
- `orders`
- `order_items`
- `tickets`

## 4. Luồng chính

1. Backend nhận request giữ vé sau khi request đã qua rate limit và idempotency middleware.
2. Backend mở transaction và khóa dòng `ticket_types` cần mua.
3. Backend tìm hoặc tạo dòng `user_ticket_type_counters` theo `(user_id, ticket_type_id)`.
4. Backend khóa dòng counter bằng `SELECT ... FOR UPDATE`.
5. Backend tính `held_quantity + paid_quantity + requested_quantity` và so sánh với `ticket_types.max_per_user`.
6. Nếu hợp lệ, tăng `user_ticket_type_counters.held_quantity` và tiếp tục hold tồn kho.
7. Khi payment thành công, giảm `held_quantity`, tăng `paid_quantity`, phát hành ticket.
8. Khi order hết hạn/hủy, giảm `held_quantity` đúng số lượng.

## 5. Kịch bản lỗi

- Vượt giới hạn: rollback và trả lỗi `PER_USER_LIMIT_EXCEEDED`.
- Hai request song song cùng user: request thứ hai phải chờ lock counter; sau khi request đầu commit, kiểm tra lại tổng mới.
- Payment fail hoặc order expired: phải release counter, không để user bị kẹt quota.
- Counter lệch do lỗi hệ thống: chạy job reconcile từ `tickets` và `orders` để sửa counter.

## 6. Ràng buộc nghiệp vụ và kỹ thuật

- Counter phải được cập nhật trong cùng transaction với tồn kho vé.
- Không được chỉ query tổng từ `tickets` dưới tải cao mà không khóa counter.
- Chỉ tính các trạng thái còn hiệu lực: order `HELD`, ticket/order `PAID` hoặc ticket `ISSUED`.
- Index bắt buộc: `tickets(user_id, ticket_type_id, status)` và PK `(user_id, ticket_type_id)` trên counter.

## 7. Tiêu chí chấp nhận

- User không thể mua vượt `max_per_user` dù gửi nhiều request đồng thời.
- User có order hết hạn được hoàn quota.
- Payment success chuyển quota từ held sang paid đúng số lượng.
- Có thể truy vết hoặc reconcile counter khi cần.
