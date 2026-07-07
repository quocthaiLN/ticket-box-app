# Báo cáo cho Thái - Auto-publish và tác động đến Checkout/Inventory

Ngày cập nhật: 2026-07-07

Phạm vi: phần Thanh đã triển khai ở giai đoạn 5, có ảnh hưởng trực tiếp đến luồng bán vé, checkout và inventory do Thái phụ trách.

## 1. Tóm tắt thay đổi quan trọng

Đã thêm scheduler auto-publish trong worker:

- File mới: `ticket-box-app/apps/worker-server/src/schedulers/auto-publish.scheduler.ts`
- Worker khởi động scheduler trong: `ticket-box-app/apps/worker-server/src/server.ts`
- Cache helper dùng chung nằm ở: `ticket-box-app/packages/redis/src/catalog-cache.ts`

Scheduler định kỳ tìm concert:

- `status = DRAFT`
- `planned_publish_at IS NOT NULL`
- `planned_publish_at <= now`

Khi concert đủ điều kiện, scheduler sẽ:

1. Chuyển concert từ `DRAFT` sang `PUBLISHED`.
2. Tự động chuyển tất cả ticket type của concert có `status = DRAFT` sang `ON_SALE`.
3. Xóa cache catalog/detail/ticket-types/inventory liên quan.
4. Ghi audit `CONCERT_AUTO_PUBLISHED`.

## 2. Điều kiện readiness hiện tại

Concert chỉ được auto-publish khi thỏa các điều kiện tối thiểu:

- Concert vẫn là `DRAFT`.
- `planned_publish_at <= now`.
- `ends_at > starts_at`.
- Có ít nhất 1 `seat_zone`.
- Có ít nhất 1 `ticket_type`.

Nếu thiếu dữ liệu, scheduler chỉ log skip và không đổi trạng thái.

## 3. Tác động trực tiếp đến Checkout/Inventory

Trước thay đổi này, ticket type có thể được tạo ở `DRAFT` và chỉ lên `ON_SALE` qua thao tác admin/organizer hoặc update riêng.

Sau thay đổi này, khi concert auto-publish:

- Ticket type `DRAFT` sẽ tự động thành `ON_SALE`.
- Checkout có thể bắt đầu nhận ticket type đó ngay sau tick auto-publish.
- Public catalog/detail/ticket-types sẽ thấy concert và vé sau khi cache invalidation chạy xong.

Điều này quan trọng với test checkout/inventory:

- Test tạo order cần tính đến case ticket type ban đầu là `DRAFT`, sau auto-publish thành `ON_SALE`.
- Test `ticketTypeNotOnSale` phải đặt đúng ngữ cảnh: trước publish hoặc ticket type vẫn `DRAFT/CLOSED`, checkout phải reject.
- Test success checkout nên seed ticket type `ON_SALE`, hoặc seed concert `DRAFT + planned_publish_at <= now` rồi cho worker auto-publish trước khi checkout.

## 4. Những phần không bị thay đổi

Auto-publish không đổi các luồng core sau:

- Không đổi `orders/repository/hold.ts`.
- Không đổi transaction hold/release inventory.
- Không đổi payment confirm/release.
- Không đổi QR/ticket issuance logic.
- Không đổi `maxPerUser`.
- Không đổi public slug/preview route.

Trong payment flow, giai đoạn 4 đã thêm audit:

- `PAYMENT_WEBHOOK_SUCCEEDED`
- `PAYMENT_WEBHOOK_FAILED`
- `TICKET_ISSUED`

Audit chạy best-effort sau transaction, không nên làm fail checkout/payment.

### Ghi chú lỗi VNPAY cancel/fail đã gặp ngày 2026-07-07

Triệu chứng thực tế:

- User tạo payment attempt thành công qua `POST /v1/orders/:order_id/payments`, API trả `201`.
- Khi browser quay về `GET /v1/payment/return` với `vnp_ResponseCode=24`, `vnp_TransactionStatus=02`, `vnp_TransactionNo=0`, backend trả `500`.
- Prisma báo lỗi unique constraint trên `payments(provider, provider_transaction_id)` tại `payment.repository.ts`, hàm `saveWebhookRawPayload`.

Nguyên nhân:

- VNPAY có thể gửi `vnp_TransactionNo=0` cho giao dịch bị hủy/thất bại.
- Code cũ xem `"0"` như mã giao dịch provider thật và lưu vào `provider_transaction_id`.
- Vì DB có unique key `(provider, provider_transaction_id)`, nhiều giao dịch VNPAY fail/cancel cùng lưu `"0"` sẽ đụng unique constraint.

Cách xử lý đã áp dụng trong `ticket-box-app/apps/api-server/src/modules/payments/payment.service.ts`:

- Thêm helper normalize `vnp_TransactionNo`.
- Nếu `vnp_TransactionNo` rỗng hoặc bằng `"0"` trong case `vnp_ResponseCode != "00"`, không lưu vào `provider_transaction_id`.
- Với payment thành công `vnp_ResponseCode = "00"`, vẫn bắt buộc phải có provider transaction id thật để giữ idempotency webhook.
- Raw payload VNPAY vẫn được lưu vào `payments.webhook_payload`.
- Audit payment webhook vẫn ghi thêm `raw_provider_transaction_id` để đối soát được provider đã gửi giá trị gốc là `"0"`.

Kỳ vọng sau fix:

- Return/IPN fail hoặc cancel của VNPAY không còn làm API trả `500` vì unique constraint.
- Payment attempt bị fail/cancel vẫn được cập nhật trạng thái đúng và có raw payload để audit.
- Payment success vẫn idempotent theo provider transaction id thật.

Test regression Thái nên thêm khi viết lại checkout/payment tests:

1. Tạo 2 order/payment VNPAY khác nhau.
2. Gửi return/webhook fail cho cả 2 với `vnp_ResponseCode=24`, `vnp_TransactionStatus=02`, `vnp_TransactionNo=0`.
3. Assert cả 2 request không trả `500`.
4. Assert `payments.provider_transaction_id` của các payment fail/cancel không bị set thành `"0"`.
5. Assert `payments.webhook_payload` vẫn còn `vnp_TransactionNo: "0"`.
6. Assert audit log có `raw_provider_transaction_id = "0"` nếu audit được bật trong test.

### Ghi chú lỗi VNPAY success nhưng backend trả 500 do thiếu gate-zone mapping

Triệu chứng thực tế:

- User thanh toán VNPAY sandbox thành công bằng thẻ NCB.
- VNPAY redirect về backend với payload thành công:
  - `vnp_ResponseCode=00`
  - `vnp_TransactionStatus=00`
  - `vnp_TransactionNo=15612311`
  - `vnp_TxnRef=0d9263e4-0a65-48fe-86f8-d30cfcceaf43`
- Backend trả `500 INTERNAL_ERROR` tại `GET /v1/payment/return`.

Err response đã gặp:

```json
{
  "title": "Internal server error",
  "status": 500,
  "code": "INTERNAL_ERROR",
  "detail": "Unexpected server error.",
  "instance": "/v1/payment/return?vnp_Amount=25000000&vnp_BankCode=NCB&vnp_BankTranNo=VNP15612311&vnp_CardType=ATM&vnp_OrderInfo=Payment+for+order+0d9263e4-0a65-48fe-86f8-d30cfcceaf43&vnp_PayDate=20260707110137&vnp_ResponseCode=00&vnp_TmnCode=6B4JGUGA&vnp_TransactionNo=15612311&vnp_TransactionStatus=00&vnp_TxnRef=0d9263e4-0a65-48fe-86f8-d30cfcceaf43&vnp_SecureHash=61acb155aa412686486d1fc04ceccf1f66985618a1a79ee28ebd60fdc3a2565419a0d9c170c8416bc86f500adbbd3ff4bd49e5ea26fd6ca20cf56248cc7937d4",
  "request_id": "req_9e0ad1cc-53b7-4988-b3f2-0267816effc0"
}
```

Trạng thái DB trước khi xử lý:

- `payments.webhook_signature_valid = true`, tức chữ ký VNPAY hợp lệ.
- `payments.provider_transaction_id = "15612311"` đã được lưu.
- `orders.status` vẫn là `HELD`.
- `payments.status` vẫn là `PENDING`.
- Chưa có ticket được issue.
- Concert được tạo từ organizer request có 1 `seat_zone` code `GEN`, 1 `checkin_gate` code `GATE-1`, nhưng không có dòng nào trong `checkin_gate_zones`.

Nguyên nhân:

- Luồng `confirmOrderPayment` cần chọn một gate active phục vụ seat zone của ticket để gán `tickets.gate_id`.
- Query phát hành ticket đọc mapping từ `checkin_gate_zones`.
- Concert tạo từ admin approve organizer request trước đó chỉ tạo `seat_zones`, `ticket_types`, `checkin_gates`, nhưng chưa tạo mapping `checkin_gate_zones`.
- Vì không có gate active phục vụ zone, payment success bị throw lỗi trong bước issue ticket và return handler trả `500`.

Cách xử lý đã áp dụng:

- Vá dữ liệu local cho concert bị lỗi: tạo mapping `GATE-1 -> GEN` trong `checkin_gate_zones`.
- Gọi lại đúng return URL VNPAY success; backend đã redirect về `payment/result?status=success&order_id=0d9263e4-0a65-48fe-86f8-d30cfcceaf43&code=00`.
- Xác nhận sau xử lý:
  - `orders.status = CONFIRMED`
  - `payments.status = SUCCEEDED`
  - ticket đã được tạo với `status = ISSUED`
  - audit có `PAYMENT_WEBHOOK_SUCCEEDED`
  - audit có `TICKET_ISSUED`

Code fix trong `ticket-box-app/apps/api-server/src/modules/organizer-admin/organizer-admin.repository.ts`:

- Khi admin approve organizer request, sau khi tạo `seat_zones` và `checkin_gates`, backend tự tạo mapping `checkin_gate_zones`.
- Policy hiện tại: mỗi gate tạo từ organizer request mặc định phục vụ mọi seat zone của concert.
- Lý do: UI request hiện chỉ khai báo `gate_count`, chưa có bước organizer/admin chỉ định gate nào phục vụ zone nào. Mapping mặc định giúp checkout/payment success không bị kẹt ở bước issue ticket.

Test regression Thái nên thêm:

1. Tạo organizer request có ít nhất 1 ticket type, 1 zone và `gate_count >= 1`.
2. Admin approve request.
3. Assert concert được tạo có `checkin_gates`.
4. Assert mỗi `seat_zone` của concert có ít nhất 1 mapping trong `checkin_gate_zones` tới gate active.
5. Auto-publish concert để ticket type sang `ON_SALE`.
6. Audience tạo order và payment VNPAY.
7. Gửi VNPAY return success với `vnp_ResponseCode=00`, `vnp_TransactionStatus=00`, `vnp_TransactionNo` khác `"0"`.
8. Assert API không trả `500`.
9. Assert order thành `CONFIRMED`, payment thành `SUCCEEDED`, ticket thành `ISSUED`.
10. Assert ticket có `gate_id` không null và thuộc một gate active của concert.
11. Assert audit có `PAYMENT_WEBHOOK_SUCCEEDED` và `TICKET_ISSUED`.

Lưu ý cho dữ liệu cũ:

- Các concert đã được approve trước khi fix có thể vẫn thiếu `checkin_gate_zones`.
- Nếu gặp payment success nhưng 500 ở bước issue ticket, kiểm tra nhanh:

```sql
SELECT *
FROM checkin_gate_zones
WHERE concert_id = '<concert_id>';
```

- Nếu rỗng, cần tạo mapping gate-zone cho concert đó trước khi retry return/webhook payment.

## 5. File Thái nên đọc

- `ticket-box-app/apps/worker-server/src/schedulers/auto-publish.scheduler.ts`
- `ticket-box-app/packages/redis/src/catalog-cache.ts`
- `ticket-box-app/apps/api-server/src/modules/payments/payment.repository.ts`
- `ticket-box-app/apps/api-server/src/modules/payments/payment.service.ts`
- `ticket-box-app/apps/api-server/src/modules/orders/repository/hold.ts`

## 6. Gợi ý test cho AI Agent của Thái

Nên thêm hoặc cập nhật test theo các nhóm sau:

1. Pre-publish rejection
   - Concert `DRAFT`, ticket type `DRAFT`.
   - Gọi checkout/create order phải reject vì ticket type chưa `ON_SALE`.

2. Auto-publish unlock sale
   - Seed concert `DRAFT`, `planned_publish_at` trong quá khứ, có seat zone và ticket type `DRAFT`.
   - Chạy auto-publish scheduler/tick hoặc gọi helper test nếu sau này expose được.
   - Assert concert thành `PUBLISHED`.
   - Assert ticket type thành `ON_SALE`.
   - Sau đó checkout hold thành công.

3. Skip invalid readiness
   - Concert `DRAFT`, due publish, nhưng thiếu seat zone hoặc ticket type.
   - Assert concert vẫn `DRAFT`.
   - Assert checkout vẫn reject.

4. Idempotency
   - Chạy auto-publish 2 lần.
   - Assert ticket type không bị đổi sai, không duplicate sale side effect.
   - Audit `CONCERT_AUTO_PUBLISHED` không tăng vô hạn cho cùng một lần publish thành công.

5. Inventory cache
   - Sau auto-publish, public inventory/ticket type endpoint phải đọc dữ liệu mới.
   - Nếu test có Redis, verify cache invalidation; nếu không có Redis, ít nhất verify API trả `ON_SALE`.

## 7. Lưu ý khi seed demo

Nếu seed concert dùng để checkout demo:

- Nên set `planned_publish_at` sớm hơn thời điểm demo nếu muốn worker tự publish.
- Nếu không muốn phụ thuộc worker, seed thẳng `PUBLISHED` + ticket type `ON_SALE`.
- Nếu quay demo auto-publish, đặt `planned_publish_at` cách hiện tại 1-2 phút để thấy rõ worker tick.

## 8. Checklist trước khi Thái kết luận

- Chạy `npm.cmd test -w @ticketbox/tests`.
- Bổ sung checkout/inventory tests mới theo flow hold -> payment -> webhook -> issue ticket/release inventory.
- Kiểm tra lại các case `ON_SALE`, `DRAFT`, `CLOSED`, `SOLD_OUT`.
- Kiểm tra max-per-user sau auto-publish.
- Kiểm tra audit không làm payment/checkout fail.

## 9. Rủi ro còn lại Thái cần để ý

- Auto-publish hiện chỉ check readiness tối thiểu, chưa check sale window của từng ticket type.
- Auto-publish chuyển mọi ticket type `DRAFT` của concert sang `ON_SALE`; nếu có ticket type cần giữ hidden sau publish, cần cơ chế riêng ở giai đoạn sau.
- Scheduler chạy trong worker process; nếu worker không chạy thì concert không tự publish.
- Nếu test cần deterministic, nên tạo test hook riêng cho auto-publish hoặc set interval ngắn trong môi trường test.
