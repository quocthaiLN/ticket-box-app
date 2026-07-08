# Test case đặt vé (Order Checkout)

## Phạm vi và quy ước

- Luồng hiện tại tách thành hai bước: `POST /orders` tạo order `HELD`, sau đó `POST /orders/{order_id}/payments` tạo payment `PENDING` và URL thanh toán.
- Tồn kho khả dụng được tính bằng `total_quantity - held_quantity - sold_quantity`.
- Các kiểm tra tồn kho, giới hạn mỗi người và tạo order chạy trong cùng transaction `SERIALIZABLE`.
- Theo đặc tả, các API order của người mua chỉ dành cho `AUDIENCE`; endpoint expire chỉ dành cho worker/internal service.

## 1. Xác thực và phân quyền

| Tên | Mô tả | Đầu ra mong đợi |
| --- | --- | --- |
| Tạo order khi chưa đăng nhập | Gọi `POST /orders` không có JWT. | Trả `401 UNAUTHORIZED`; không tạo order, không giữ vé. |
| Vai trò không phải khán giả đặt vé | Dùng JWT `ORGANIZER` hoặc `ADMIN` gọi `POST /orders`. | Trả `403`; không thay đổi tồn kho. |
| Truy cập order của người khác | Khán giả đọc, hủy hoặc tạo payment cho order không thuộc mình. | Trả `403 ORDER_ACCESS_DENIED`; order không đổi. |

## 2. Kiểm tra dữ liệu đầu vào

| Tên | Mô tả | Đầu ra mong đợi |
| --- | --- | --- |
| Tạo order hợp lệ | Gửi `concert_id` và ít nhất một item có `ticket_type_id`, `quantity` nguyên dương. | Trả `201`; tạo order `HELD` và các order item đúng số lượng, đơn giá, thành tiền. |
| Thiếu dữ liệu bắt buộc | Thiếu/rỗng `concert_id`, `items` hoặc `ticket_type_id`. | Trả `400 INVALID_CHECKOUT_REQUEST`; không tạo dữ liệu. |
| Số lượng không hợp lệ | `quantity` bằng 0, âm, số thập phân hoặc sai kiểu. | Trả `400 INVALID_CHECKOUT_REQUEST`; không giữ vé. |

## 3. Tính hợp lệ của loại vé

| Tên | Mô tả | Đầu ra mong đợi |
| --- | --- | --- |
| Loại vé không tồn tại | Đặt một `ticket_type_id` không có trong hệ thống. | Trả `404 TICKET_TYPE_NOT_FOUND`; toàn bộ order được rollback. |
| Loại vé sai concert | Item thuộc concert khác với `concert_id` trong request. | Trả `422 TICKET_TYPE_NOT_ON_SALE`; không giữ vé. |
| Vé chưa/không còn mở bán | Loại vé không ở `ON_SALE` hoặc hiện tại ngoài `sale_start_at`–`sale_end_at`. | Trả `422 TICKET_TYPE_NOT_ON_SALE`; không thay đổi tồn kho. |

## 4. Giữ vé và tính tiền

| Tên | Mô tả | Đầu ra mong đợi |
| --- | --- | --- |
| Giữ nhiều loại vé | Đặt nhiều loại vé hợp lệ trong cùng concert. | Tạo một order `HELD`; tăng đúng `held_quantity` và counter của từng loại. |
| Tính tổng tiền | Đặt nhiều item với số lượng và giá khác nhau. | `line_total = unit_price × quantity`; `total_amount` bằng tổng các dòng và đúng tiền tệ. |
| Item loại vé bị lặp | Gửi hai item có cùng `ticket_type_id`. | Từ chối request; transaction rollback, không giữ vé hai lần. |

## 5. Tồn kho và tranh chấp đồng thời

| Tên | Mô tả | Đầu ra mong đợi |
| --- | --- | --- |
| Không đủ vé | Số lượng yêu cầu lớn hơn tồn kho khả dụng. | Trả `409 TICKET_SOLD_OUT`; không tạo order và tồn kho không âm. |
| Hai người mua vé cuối | Hai user đồng thời đặt khi tồn kho chỉ đủ cho một request. | Chỉ một request thành công; request còn lại nhận `409 TICKET_SOLD_OUT`. |
| Lỗi transaction tạm thời | Gây serialization failure/deadlock khi giữ vé. | Hệ thống retry tối đa theo cấu hình; không tạo order hoặc giữ vé trùng. |

## 6. Giới hạn vé mỗi người

| Tên | Mô tả | Đầu ra mong đợi |
| --- | --- | --- |
| Mua đúng giới hạn | Tổng `held + paid + quantity` bằng `max_per_user`. | Tạo order `HELD` thành công và counter tăng đúng. |
| Vượt giới hạn qua nhiều order | User đã có vé held/paid, order mới làm tổng vượt giới hạn. | Trả `409 PER_USER_LIMIT_EXCEEDED`; không tăng inventory/counter. |
| Gửi đồng thời để lách giới hạn | Cùng user gửi nhiều request song song, tổng vượt `max_per_user`. | Chỉ các request trong giới hạn thành công; tổng held/paid không vượt mức cấu hình. |

## 7. Idempotency khi tạo order

| Tên | Mô tả | Đầu ra mong đợi |
| --- | --- | --- |
| Thiếu Idempotency-Key | Gọi `POST /orders` không có header bắt buộc. | Request bị từ chối; không tạo order. |
| Retry cùng key | Cùng user gửi lại cùng request với cùng `Idempotency-Key`. | Trả lại cùng `order_id` và kết quả cũ; tồn kho chỉ giảm khả dụng một lần. |
| Cùng key gửi đồng thời | Cùng user gửi hai request đồng thời với một key. | Chỉ một order được tạo; request còn lại chờ/replay hoặc nhận lỗi idempotency đang xử lý. |

## 8. Tạo payment cho order

| Tên | Mô tả | Đầu ra mong đợi |
| --- | --- | --- |
| Tạo payment hợp lệ | Chủ order `HELD`, chưa hết hạn, gọi endpoint payment với `VNPAY` hoặc `MOMO`. | Trả `201`; tạo payment `PENDING` và `checkout_url`; inventory hold không đổi. |
| Order không thể thanh toán | Tạo payment cho order đã hết hạn hoặc không còn `HELD`. | Trả lỗi nghiệp vụ; không tạo payment mới. |
| Payment đang chờ | Tạo payment mới khi order đã có payment `PENDING`. | Trả `409 PAYMENT_ALREADY_PENDING`; không tạo attempt trùng. |

## 9. Tra cứu trạng thái order

| Tên | Mô tả | Đầu ra mong đợi |
| --- | --- | --- |
| Xem order đang giữ | Chủ order gọi `GET /orders/{id}` trước thanh toán. | Trả `200`, trạng thái `HELD`, chi tiết item, hạn giữ và payment/ticket hiện có; `Cache-Control: no-store`. |
| Xem order đã xác nhận | Poll sau webhook thanh toán thành công. | Trả `CONFIRMED`, payment `SUCCEEDED` và đúng số ticket đã phát hành. |
| Order không tồn tại | Tra cứu ID không tồn tại. | Trả `404 ORDER_NOT_FOUND`. |

## 10. Hủy và hết hạn order

| Tên | Mô tả | Đầu ra mong đợi |
| --- | --- | --- |
| Hủy order đang giữ | Chủ order hủy khi trạng thái còn `HELD`. | Order thành `CANCELLED`; trả lại đúng inventory và quota held một lần. |
| Hủy order đã chốt | Hủy order `CONFIRMED`, `CANCELLED` hoặc `EXPIRED`. | Trả `409 ORDER_ALREADY_FINALIZED`; không release lần nữa. |
| Worker expire order | Worker expire order quá hạn, sau đó gọi lại cùng request. | Lần đầu chuyển sang `EXPIRED` và release; lần sau idempotent, không release lần hai. |

## 11. Hoàn tất thanh toán và phát hành vé

| Tên | Mô tả | Đầu ra mong đợi |
| --- | --- | --- |
| Webhook thành công hợp lệ | Provider gửi webhook có chữ ký và amount đúng cho payment `PENDING`. | Payment `SUCCEEDED`, order `CONFIRMED`; held chuyển sang sold; phát hành đủ vé. |
| Webhook sai chữ ký/amount | Webhook có chữ ký sai hoặc số tiền lệch order. | Từ chối xác nhận; order không `CONFIRMED`, không phát hành vé. |
| Webhook thành công bị lặp | Provider gửi lại cùng giao dịch nhiều lần. | Trả kết quả idempotent; không tăng sold, counter hoặc phát hành ticket lần hai. |

## 12. Kiểm tra bảo mật route theo đặc tả

| Tên | Mô tả | Đầu ra mong đợi |
| --- | --- | --- |
| Bảo vệ endpoint expire | User bên ngoài gọi `/internal/orders/{id}/expire`. | Trả `401/403`; order không bị expire. |
| Giới hạn danh sách admin | `ORGANIZER` gọi `GET /admin/orders`. | Trả `403`; chỉ `ADMIN` được tra cứu toàn hệ thống. |
| Phân trang danh sách admin | Admin lọc theo concert/status/user/thời gian và dùng cursor. | Trả tối đa limit (không quá 100), đúng bộ lọc, không trùng bản ghi giữa các trang. |

## 13. Tính nguyên tử và ràng buộc tồn kho

| Tên | Mô tả | Đầu ra mong đợi |
| --- | --- | --- |
| Rollback order nhiều loại vé | Một order gồm nhiều loại vé, trong đó một loại đã hết vé hoặc không hợp lệ. | Toàn bộ transaction rollback; không tạo order item và không tăng hold của bất kỳ loại vé nào. |
| Bảo toàn phương trình tồn kho | Chạy xen kẽ các thao tác hold, xác nhận, hủy và expire trên cùng loại vé. | Luôn có `total_quantity >= held_quantity + sold_quantity`; số khả dụng không âm. |
| Cache tồn kho bị cũ | Redis báo còn vé nhưng PostgreSQL đã hết vé. | PostgreSQL là nguồn quyết định; request bị từ chối và không xảy ra oversell. |

## 14. Đồng bộ counter giới hạn người mua

| Tên | Mô tả | Đầu ra mong đợi |
| --- | --- | --- |
| Hủy trả quota held | User hold vé rồi hủy order trước thanh toán. | `held_quantity` của user và loại vé cùng giảm đúng số lượng; user có thể đặt lại trong giới hạn. |
| Thanh toán chuyển quota | Xác nhận payment thành công cho order `HELD`. | Counter user chuyển đúng lượng từ `held_quantity` sang `paid_quantity`; tổng quota không đổi. |
| Payment và expire tranh chấp | Webhook success và worker expire cùng xử lý một order gần thời điểm hết hạn. | Chỉ một chuyển trạng thái thắng; không vừa bán vừa release, counter và inventory nhất quán. |

## 15. Idempotency nhiều lớp

| Tên | Mô tả | Đầu ra mong đợi |
| --- | --- | --- |
| Redis mất key order | Xóa cache idempotency sau khi tạo order rồi retry cùng key. | Unique `orders.idempotency_key` chặn order trùng; API trả lại order đã có. |
| Retry tạo payment cùng key | Gửi lại request tạo payment với cùng `Idempotency-Key`. | Chỉ một payment attempt tồn tại; trả lại cùng kết quả/checkout URL. |
| Redis mất key payment | Xóa key payment trong Redis rồi retry cùng idempotency key. | Unique `payments.idempotency_key` vẫn chặn payment trùng. |
| Trùng mã giao dịch provider | Hai webhook dùng cùng `(provider, provider_transaction_id)`. | Chỉ một giao dịch được ghi nhận thành công; order và vé chỉ được xác nhận một lần. |

## 16. Toàn vẹn dữ liệu order và vé

| Tên | Mô tả | Đầu ra mong đợi |
| --- | --- | --- |
| Item khác concert ở tầng DB | Thử ghi `order_item` có ticket type không thuộc concert của order, kể cả khi bỏ qua API. | Trigger/FK từ chối bản ghi; order không chứa dữ liệu chéo concert. |
| Snapshot giá khi đặt vé | Tạo order rồi thay đổi giá của ticket type. | `unit_price`, `line_total` và `total_amount` của order cũ giữ nguyên giá lúc đặt. |
| Số vé phát hành khớp order | Payment success cho order có nhiều item và số lượng khác nhau. | Số bản ghi `tickets` của từng item đúng bằng `order_items.quantity`; QR hash không trùng. |
| Timestamp đúng trạng thái | Chuyển order sang `CONFIRMED`, `CANCELLED` hoặc `EXPIRED`. | Trường thời gian tương ứng được ghi; không tạo tổ hợp trạng thái/thời gian trái ràng buộc. |

## Ghi chú đối chiếu code hiện tại

Các test phân quyền dưới đây dự kiến sẽ phát hiện chênh lệch giữa đặc tả và triển khai hiện tại:

- Router đang cho `ADMIN` gọi các API order của người mua (`POST /orders`, xem, hủy, tạo payment).
- Router đang cho `ORGANIZER` gọi `GET /admin/orders`.
- `POST /internal/orders/{order_id}/expire` hiện chưa có middleware xác thực internal service.
- `POST /orders` hiện chỉ tạo hold; payment được tạo riêng qua `POST /orders/{order_id}/payments`, khác ví dụ response cũ trong API design.
