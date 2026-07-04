# Đặc tả: Payment Idempotency / Chống trừ tiền hai lần

## 1. Mô tả

Đặc tả luồng tạo payment và xử lý webhook VNPAY/MoMo theo cơ chế idempotency, đảm bảo một giao dịch chỉ được xử lý nghiệp vụ đúng một lần.

Trong MVP, idempotency runtime nằm ở Redis; PostgreSQL chỉ giữ unique constraint cuối cùng trên `orders.idempotency_key`, `payments.idempotency_key` và `(provider, provider_transaction_id)`.

## 2. Actor / Thành phần tham gia

- Khán giả
- Payment Module
- VNPAY/MoMo Sandbox
- PostgreSQL
- Redis Idempotency Store

## 3. Bảng dữ liệu liên quan

- `payments`
- `orders`
- `tickets`
- `audit_logs` nếu cần audit nghiệp vụ

## 4. Luồng chính

1. Client sinh `Idempotency-Key` cho phiên checkout và gửi kèm request tạo order/payment.
2. Idempotency middleware kiểm tra key trong Redis theo scope `user_id + route + key`.
3. Nếu key mới, middleware lock key trạng thái `PROCESSING` trong Redis và tiếp tục xử lý.
4. Backend tạo `orders.idempotency_key` và `payments.idempotency_key`; PostgreSQL unique constraint bảo vệ nếu Redis lỗi hoặc request đua nhau.
5. Payment Module tạo `payments` trạng thái `PENDING` và trả payment URL cho client.
6. Khi provider gửi webhook/IPN, backend lưu raw payload cuối vào `payments.webhook_payload`, `webhook_received_at`, `webhook_signature_valid`.
7. Backend verify chữ ký provider và kiểm tra amount khớp order.
8. Backend dùng unique index `(provider, provider_transaction_id)` để chống webhook trùng.
9. Nếu payment thành công, cập nhật `payments.status = SUCCEEDED`, `orders.status = CONFIRMED`, chuyển held sang sold và phát hành tickets.
10. Backend cập nhật Redis idempotency response để retry trả lại kết quả cũ.

## 5. Kịch bản lỗi

- Client gửi lại cùng idempotency key khi request trước đang xử lý: trả `409 IDEMPOTENCY_IN_PROGRESS` hoặc response cache nếu đã xong.
- Webhook sai chữ ký: lưu payload vào `payments.webhook_payload`, set `webhook_signature_valid = false`, không cập nhật order/payment thành công.
- Webhook trùng: trả HTTP 200 idempotent nhưng không phát hành vé lần hai.
- Provider timeout: payment giữ trạng thái `PENDING`; order được xử lý theo TTL hold.
- Provider báo fail sau khi hold: cập nhật `payments.status = FAILED`, release hold nếu order còn `HELD`.

## 6. Ràng buộc nghiệp vụ và kỹ thuật

- Không có bảng `idempotency_keys` riêng trong PostgreSQL MVP.
- Không có bảng `payment_webhook_events` riêng; raw webhook cuối nằm trong `payments`.
- `orders.idempotency_key` và `payments.idempotency_key` phải unique.
- `payments(provider, provider_transaction_id)` phải unique khi transaction id không null.
- Không phát hành ticket nếu webhook chưa verify chữ ký hoặc amount không khớp order.
- Payment success phải chạy trong transaction với order, inventory counter và ticket issuing.

## 7. Tiêu chí chấp nhận

- Bấm thanh toán nhiều lần không tạo nhiều order/payment ngoài ý muốn.
- Webhook gửi lại nhiều lần không phát hành vé trùng.
- Có raw payload cuối để audit/debug payment.
- Order không bị `CONFIRMED` nếu webhook sai chữ ký hoặc sai amount.