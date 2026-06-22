# Report — VNPAY Payment Return Redirect

Xử lý lỗi `Cannot GET /payment/return` sau khi thanh toán VNPAY và bổ sung luồng return chuẩn.

## Bối cảnh lỗi
- `vnp_ReturnUrl` trỏ `localhost:3000` (**api-server**) nhưng api-server **chưa có route** đó → `Cannot GET /payment/return`. (Web SPA chạy ở `3001`.)
- IPN (server-to-server) **không gọi tới `localhost` được**, nên ở dev chỉ có ReturnUrl là tín hiệu duy nhất → endpoint return phải tự verify + confirm.

## Files đã chỉnh / thêm

| File | Thay đổi |
|------|----------|
| `config/env.ts` | Thêm `env.web.url` (default `http://localhost:3001`); đổi default `vnpay.returnUrl` → `…/v1/payment/return` |
| `.env` | `VNPAY_RETURN_URL=http://localhost:3000/v1/payment/return` |
| `apps/api-server/src/modules/payments/payment.controller.ts` | **+ `vnpayReturnHandler`**: tái dùng `handleVnpayWebhook` (verify chữ ký + confirm đơn + idempotent) → `302` redirect sang trang kết quả frontend |
| `apps/api-server/src/modules/payments/payment.router.ts` | **+ `GET /payment/return`** (→ `/v1/payment/return`, public, signature-verified) |
| `apps/web/src/routes/payment/PaymentResultPage.tsx` | **+ trang kết quả** (success/failed), đọc `status` / `order_id` / `code` từ query |
| `apps/web/src/main.tsx` | **+ route** `payment/result` |

> Liên quan: bug ký chữ ký VNPAY đã sửa trước đó ở `vnpay.gateway.ts`, `payment.service.ts`, `tests/checkout/helpers.ts` (ký trên giá trị **đã encode**).

## Luồng mới

```
[Browser]                [api-server :3000]            [VNPAY sandbox]        [web :3001]
   |                            |                             |                    |
   | POST /v1/orders/:id/payments                             |                    |
   |--------------------------->| createPayment()             |                    |
   |   checkout_url (đã ký)      |                             |                    |
   |<---------------------------|                             |                    |
   |                            |                             |                    |
   | mở checkout_url ---------------------------------------->| nhập thẻ test NCB  |
   |                            |                             | thanh toán xong    |
   |                            |                             |                    |
   |  302 redirect về vnp_ReturnUrl (kèm vnp_* + SecureHash)  |                    |
   |<--------------------------------------------------------|                     |
   |                            |                             |                    |
   | GET /v1/payment/return?vnp_*                             |                    |
   |--------------------------->|                             |                    |
   |                            | handleVnpayWebhook():       |                    |
   |                            |  1. verify HMAC SHA-512     |                    |
   |                            |  2. check amount            |                    |
   |                            |  3. confirm/fail order      |                    |
   |                            |     (Neon -> confirmed)     |                    |
   |                            |  * idempotent               |                    |
   |                            |                             |                    |
   |  302 -> :3001/payment/result?status=success&order_id=…   |                    |
   |<---------------------------|                             |                    |
   |                                                                               |
   | GET /payment/result --------------------------------------------------------->|
   |  PaymentResultPage hiển thị thành công / thất bại                              |
   |<------------------------------------------------------------------------------|
```

## Ghi chú
- Endpoint return **idempotent** (dùng chung logic với IPN) → khi deploy production có IPN thật cũng không xác nhận trùng.
- Dev localhost: chỉ ReturnUrl hoạt động; muốn test IPN thật cần URL public (vd ngrok).
- Test lại: restart api-server, chạy web `:3001`, **tạo đơn mới** (URL cũ còn nhúng returnUrl cũ), thanh toán thẻ test.
