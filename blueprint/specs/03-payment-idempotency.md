# Đặc tả: Payment Idempotency / Chống trừ tiền hai lần

## 1. Mô tả

Đặc tả luồng tạo payment và xử lý webhook VNPAY/MoMo theo cơ chế idempotency, đảm bảo một giao dịch chỉ được xử lý nghiệp vụ đúng một lần.

## 2. Actor / Thành phần tham gia

- Khán giả
- Payment Module
- VNPAY/MoMo Sandbox
- PostgreSQL
- Redis Idempotency Store

## 3. Bảng dữ liệu liên quan

- `payments`
- `idempotency_keys`
- `payment_webhook_events`
- `orders`
- `tickets`

## 4. Luồng chính

1. Client sinh `Idempotency-Key` cho phiên checkout và gửi kèm request tạo order/payment.
2. Idempotency middleware kiểm tra key trong Redis và PostgreSQL.
3. Nếu key mới, backend tạo bản ghi `idempotency_keys` trạng thái `PROCESSING` và tiếp tục xử lý.
4. Payment Module tạo `payments` trạng thái `PENDING` và trả payment URL cho client.
5. Khi provider gửi webhook/IPN, backend lưu raw payload vào `payment_webhook_events` trước khi xử lý.
6. Backend verify chữ ký provider, cập nhật `signature_valid`.
7. Backend dùng unique index `(provider, provider_transaction_id)` để chống webhook trùng.
8. Nếu payment thành công, cập nhật `payments.status = SUCCEEDED`, `orders.status = PAID`, phát hành tickets.
9. Backend đánh dấu webhook `processed = TRUE` và cập nhật idempotency response.

## 5. Kịch bản lỗi

- Client gửi lại cùng idempotency key khi request trước đang xử lý: trả `409 PROCESSING` hoặc response cache nếu đã xong.
- Webhook sai chữ ký: lưu `payment_webhook_events`, không cập nhật order/payment.
- Webhook trùng: trả HTTP 200 idempotent nhưng không phát hành vé lần hai.
- Provider timeout: payment giữ trạng thái `PENDING`; order được xử lý theo TTL hold.
- Provider báo fail sau khi hold: cập nhật `payments.status = FAILED`, release hold.

## 6. Ràng buộc nghiệp vụ và kỹ thuật

- `idempotency_keys.key` phải unique.
- `payments(provider, provider_transaction_id)` phải unique khi transaction id không null.
- Webhook phải được lưu trước xử lý để không mất bằng chứng.
- Không phát hành ticket nếu webhook chưa verify chữ ký hoặc amount không khớp order.
- Payment success phải chạy trong transaction với order và ticket issuing.

## 7. Tiêu chí chấp nhận

- Bấm thanh toán nhiều lần không tạo nhiều order/payment ngoài ý muốn.
- Webhook gửi lại nhiều lần không phát hành vé trùng.
- Có raw payload để audit/debug payment.
- Order không bị PAID nếu webhook sai chữ ký hoặc sai amount.
