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
