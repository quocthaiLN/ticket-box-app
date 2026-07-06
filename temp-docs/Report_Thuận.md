# Report cho Thuan - Auto-publish, cache catalog, preview va demo

Ngay cap nhat: 2026-07-06

Pham vi: giai doan 5 phan Thanh vua implement, co anh huong den frontend/catalog/preview/demo cua Thuan.

## 1. Tom tat thay doi

Da them auto-publish scheduler trong worker-server:

- `ticket-box-app/apps/worker-server/src/schedulers/auto-publish.scheduler.ts`
- Start trong `ticket-box-app/apps/worker-server/src/server.ts`

Da tach helper cache catalog dung chung:

- `ticket-box-app/packages/redis/src/catalog-cache.ts`
- Export qua `ticket-box-app/packages/redis/src/index.ts`
- API admin catalog va organizer controller da dung helper chung thay vi tu xoa cache local.

Auto-publish lam cac viec sau:

1. Tim concert `DRAFT` co `planned_publish_at <= now`.
2. Check readiness toi thieu.
3. Doi concert sang `PUBLISHED`.
4. Doi ticket type `DRAFT` cua concert sang `ON_SALE`.
5. Invalidate cache catalog/list/detail/metadata/seat-map/ticket-types/inventory.
6. Ghi audit `CONCERT_AUTO_PUBLISHED`.

## 2. Dieu gi duoc giu nguyen cho phan Thuan

Scheduler khong dung va khong sua cac field/flow sau:

- `slug`
- `artists`
- `artistBio`
- `artistBioImageUrl`
- `coverImageUrl`
- `seatMapUrl`
- `guestDriveFolderId`
- Admin preview route
- Organizer preview route
- Public detail route theo slug
- Guest List import UI/API
- AI Artist Bio flow

Nghia la frontend/preview cua Thuan khong can doi route vi auto-publish.

## 3. Anh huong den Public Catalog

Sau khi auto-publish thanh cong:

- Concert se xuat hien trong public catalog vi status da la `PUBLISHED`.
- Public detail theo slug se hoat dong nhu publish thu cong.
- Public ticket types se co ve `ON_SALE` vi scheduler auto-open ticket type `DRAFT`.
- Cache list/detail/metadata/seat-map/ticket-types/inventory duoc invalidate bang helper chung.

Neu UI dang hien data cu:

- Kiem tra worker co dang chay khong.
- Kiem tra Redis co dung instance voi API/worker khong.
- Kiem tra concert co du readiness khong.
- Kiem tra `planned_publish_at` co that su <= current time cua server khong.

## 4. Anh huong den Preview

Preview admin/organizer van nen tiep tuc render DRAFT nhu truoc.

Truoc auto-publish:

- Concert status `DRAFT`.
- Preview route rieng cua admin/organizer van xem duoc.
- Public `/concerts/:slug` khong nen lo concert.
- Nut mua ve nen bi disable neu UI dang theo rule "chua public thi khong mua".

Sau auto-publish:

- Concert status `PUBLISHED`.
- Public `/concerts/:slug` hien concert.
- Ticket type `DRAFT` thanh `ON_SALE`, nen flow mua ve co the bat dau.
- Preview route van co the xem, nhung luc nay du lieu giong public hon.

## 5. File Thuan nen doc

- `ticket-box-app/apps/worker-server/src/schedulers/auto-publish.scheduler.ts`
- `ticket-box-app/packages/redis/src/catalog-cache.ts`
- `ticket-box-app/apps/api-server/src/modules/catalog/catalog.controller.ts`
- `ticket-box-app/apps/api-server/src/modules/organizer/organizer.controller.ts`
- `ticket-box-app/apps/web/src/routes/preview/ConcertPreviewPage.tsx`
- `ticket-box-app/apps/web/src/routes/audience/ConcertDetailPage.tsx`
- `ticket-box-app/apps/web/src/routes/audience/EventsPage.tsx`

## 6. Dieu AI Agent cua Thuan nen kiem tra tren frontend

1. Link public slug
   - Concert sau auto-publish phai vao duoc `/concerts/:slug`.
   - Card/home/events khong duoc quay lai dung UUID tren URL nguoi dung.

2. Preview DRAFT
   - Concert DRAFT chua due publish van xem preview duoc bang admin/organizer preview route.
   - Public catalog khong hien concert DRAFT.

3. Preview sau auto-publish
   - Concert due publish chuyen sang `PUBLISHED`.
   - Preview route khong bi broken.
   - Public detail render du data, cover image/artists/seat map khong mat.

4. Ticket type display
   - Ticket type `DRAFT` truoc auto-publish khong nen hien nhu ve dang ban public.
   - Sau auto-publish, ticket type thanh `ON_SALE` va UI co the cho chon/mua.

5. Guest List khong bi anh huong
   - `guestDriveFolderId` khong bi scheduler sua.
   - Guest List panel/import job history/search van hoat dong.

## 7. Demo script goi y cho Thuan

Demo auto-publish 1 phut:

1. Mo admin/organizer preview cua concert DRAFT co `planned_publish_at` sat hien tai.
2. Cho thay concert chua xuat hien public catalog.
3. Chay worker-server neu chua chay.
4. Doi worker tick auto-publish.
5. Refresh public events/detail theo slug.
6. Cho thay concert da public, ticket type da `ON_SALE`.
7. Mo audit admin query voi filter `action=CONCERT_AUTO_PUBLISHED` de show trace.

Du lieu demo can co:

- Concert `DRAFT`.
- `planned_publish_at <= now` hoac cach hien tai 1-2 phut.
- It nhat 1 seat zone.
- It nhat 1 ticket type `DRAFT`.
- Cover image/artists/guest folder tuy chon de verify khong bi mat.

## 8. Luu y phoi hop voi Thai

Auto-publish tu dong chuyen ticket type `DRAFT` sang `ON_SALE`, nen UI mua ve va checkout cua Thai co the bat dau ngay sau publish.

Neu Thuan lam demo frontend:

- Dam bao worker dang chay truoc khi ky vong concert tu public.
- Neu muon demo khong phu thuoc worker, seed concert `PUBLISHED` va ticket type `ON_SALE`.
- Neu muon demo auto-publish, can cho worker tick va refresh sau khi cache invalidation.

## 9. Risk con lai cho frontend/demo

- Scheduler chay moi 60 giay mac dinh; demo can du thoi gian doi tick.
- Cache Redis dung chung API/worker; neu moi app tro Redis khac nhau thi public UI co the thay data cu.
- Readiness chi check toi thieu, chua validate sale window ticket type.
- Neu team muon hien countdown "scheduled publish", UI can doc `planned_publish_at` tu admin/organizer API hien co, khong lay tu public endpoint.

## 10. Command da verify lien quan

Da chay:

- `npx.cmd tsc -p apps/api-server/tsconfig.json --noEmit`
- `npx.cmd tsc -p apps/worker-server/tsconfig.json --noEmit`
- `npm.cmd run build -w @ticketbox/redis`

Can chay tiep truoc khi quay demo:

- `npm.cmd run build -w @ticketbox/api-server`
- `npm.cmd run build -w @ticketbox/worker-server`
- `npm.cmd run build -w @ticketbox/web`
- Worker local voi Redis/Postgres dung `.env`.
