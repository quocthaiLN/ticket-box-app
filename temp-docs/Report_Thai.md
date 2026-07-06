# Report cho Thai - Auto-publish va tac dong den Checkout/Inventory

Ngay cap nhat: 2026-07-06

Pham vi: giai doan 5 phan Thanh vua implement, co anh huong den luong ban ve cua Thai.

## 1. Tom tat thay doi quan trong

Da them auto-publish scheduler trong worker:

- File moi: `ticket-box-app/apps/worker-server/src/schedulers/auto-publish.scheduler.ts`
- Worker start scheduler trong: `ticket-box-app/apps/worker-server/src/server.ts`
- Cache helper dung chung nam trong: `ticket-box-app/packages/redis/src/catalog-cache.ts`

Scheduler se dinh ky tim concert:

- `status = DRAFT`
- `planned_publish_at IS NOT NULL`
- `planned_publish_at <= now`

Neu concert du dieu kien readiness, scheduler se:

1. Chuyen concert tu `DRAFT` sang `PUBLISHED`.
2. Tu dong chuyen tat ca ticket type cua concert co `status = DRAFT` sang `ON_SALE`.
3. Invalidate catalog/cache/inventory cache cua concert.
4. Ghi audit `CONCERT_AUTO_PUBLISHED`.

## 2. Readiness auto-publish hien tai

Concert chi duoc auto-publish khi thoa cac dieu kien toi thieu:

- Concert van la `DRAFT`.
- `planned_publish_at <= now`.
- `ends_at > starts_at`.
- Co it nhat 1 `seat_zone`.
- Co it nhat 1 `ticket_type`.

Neu thieu du lieu, scheduler chi log skip va khong doi trang thai.

## 3. Diem anh huong truc tiep den Checkout/Inventory

Truoc thay doi nay, ticket type co the duoc tao o `DRAFT` va chi len `ON_SALE` theo thao tac admin/organizer hoac update rieng.

Sau thay doi nay, khi concert auto-publish:

- Ticket type `DRAFT` se tu dong thanh `ON_SALE`.
- Checkout co the bat dau accept ticket type do ngay sau tick auto-publish.
- Public catalog/detail/ticket-types se hien concert va ve sau khi cache invalidation chay xong.

Dieu nay quan trong voi cac test checkout/inventory cua Thai:

- Test tao order nen tinh den case ticket type ban dau la `DRAFT`, sau auto-publish thanh `ON_SALE`.
- Test `ticketTypeNotOnSale` can dam bao dung ngu canh: truoc publish hoac ticket type van `DRAFT/CLOSED`, checkout phai reject.
- Test success checkout nen co seed ticket type `ON_SALE`, hoac seed concert `DRAFT + planned_publish_at <= now` roi cho worker auto-publish truoc khi checkout.

## 4. Nhung thu KHONG bi thay doi

Phan auto-publish khong doi cac luong core sau:

- Khong doi `orders/repository/hold.ts`.
- Khong doi transaction hold/release inventory.
- Khong doi payment confirm/release.
- Khong doi QR/ticket issuance logic.
- Khong doi `maxPerUser`.
- Khong doi public slug/preview route.

Trong payment flow, giai doan 4 truoc do da them audit:

- `PAYMENT_WEBHOOK_SUCCEEDED`
- `PAYMENT_WEBHOOK_FAILED`
- `TICKET_ISSUED`

Audit nay chay best-effort sau transaction, khong nen lam fail checkout/payment.

## 5. File Thai nen doc

- `ticket-box-app/apps/worker-server/src/schedulers/auto-publish.scheduler.ts`
- `ticket-box-app/packages/redis/src/catalog-cache.ts`
- `ticket-box-app/apps/api-server/src/modules/payments/payment.repository.ts`
- `ticket-box-app/apps/api-server/src/modules/payments/payment.service.ts`
- `ticket-box-app/apps/api-server/src/modules/orders/repository/hold.ts`

## 6. Goi y test cho AI Agent cua Thai

Nen them hoac cap nhat test theo cac nhom sau:

1. Pre-publish rejection
   - Concert `DRAFT`, ticket type `DRAFT`.
   - Goi checkout/create order phai reject vi ticket type chua `ON_SALE`.

2. Auto-publish unlock sale
   - Seed concert `DRAFT`, `planned_publish_at` trong qua khu, co seat zone va ticket type `DRAFT`.
   - Chay auto-publish scheduler/tick hoac goi helper tu test neu expose duoc.
   - Assert concert thanh `PUBLISHED`.
   - Assert ticket type thanh `ON_SALE`.
   - Sau do checkout hold thanh cong.

3. Skip invalid readiness
   - Concert `DRAFT`, due publish, nhung thieu seat zone hoac ticket type.
   - Assert concert van `DRAFT`.
   - Assert checkout van reject.

4. Idempotency
   - Chay auto-publish 2 lan.
   - Assert ticket type khong bi doi sai, khong duplicate sale side effect.
   - Audit `CONCERT_AUTO_PUBLISHED` khong nen tang vo han cho cung mot lan publish thanh cong.

5. Inventory cache
   - Sau auto-publish, public inventory/ticket type endpoint phai doc du lieu moi.
   - Neu test co Redis, can verify cache invalidation; neu khong co Redis, it nhat verify API tra `ON_SALE`.

## 7. Luu y khi seed demo

Neu seed concert dung de checkout demo:

- Nen set `planned_publish_at` som hon thoi diem demo neu muon worker tu publish.
- Neu khong muon phu thuoc worker, seed thang `PUBLISHED` + ticket type `ON_SALE`.
- Neu quay demo auto-publish, dat `planned_publish_at` cach hien tai 1-2 phut de thay ro worker tick.

## 8. Command da verify lien quan

Da chay:

- `npx.cmd tsc -p apps/api-server/tsconfig.json --noEmit`
- `npx.cmd tsc -p apps/worker-server/tsconfig.json --noEmit`
- `npm.cmd run build -w @ticketbox/redis`

Can chay tiep truoc khi Thai ket luan:

- `npm.cmd test -w @ticketbox/tests`
- Checkout/inventory tests moi cua Thai sau khi bo sung.

## 9. Risk con lai Thai can de y

- Auto-publish hien tai chi check readiness toi thieu, chua check sale window cua tung ticket type.
- Auto-publish chuyen moi ticket type `DRAFT` cua concert sang `ON_SALE`; neu co ticket type muon giu hidden sau publish, can them co che rieng sau MVP.
- Scheduler chay trong worker process; neu worker khong chay thi concert khong tu publish.
- Neu test can deterministic, nen goi logic scheduler bang helper/test hook sau nay hoac set interval ngan trong moi truong test.
