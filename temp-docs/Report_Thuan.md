# Báo cáo cho Thuận - Auto-publish, cache catalog, preview và demo

Ngày cập nhật: 2026-07-07

Phạm vi: phần Thanh đã triển khai ở giai đoạn 5, có ảnh hưởng đến frontend/catalog/preview/demo do Thuận phụ trách.

## 1. Tóm tắt thay đổi

Đã thêm auto-publish scheduler trong worker-server:

- `ticket-box-app/apps/worker-server/src/schedulers/auto-publish.scheduler.ts`
- Start trong `ticket-box-app/apps/worker-server/src/server.ts`

Đã tách helper cache catalog dùng chung:

- `ticket-box-app/packages/redis/src/catalog-cache.ts`
- Export qua `ticket-box-app/packages/redis/src/index.ts`
- API admin catalog, organizer controller và worker đều dùng helper chung thay vì tự xóa cache local.

Auto-publish làm các việc sau:

1. Tìm concert `DRAFT` có `planned_publish_at <= now`.
2. Check readiness tối thiểu.
3. Đổi concert sang `PUBLISHED`.
4. Đổi ticket type `DRAFT` của concert sang `ON_SALE`.
5. Invalidate cache catalog/list/detail/metadata/seat-map/ticket-types/inventory.
6. Ghi audit `CONCERT_AUTO_PUBLISHED`.

## 2. Những phần được giữ nguyên cho Thuận

Scheduler không đụng và không sửa các field/flow sau:

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

Nghĩa là frontend/preview của Thuận không cần đổi route vì auto-publish.

## 3. Ảnh hưởng đến Public Catalog

Sau khi auto-publish thành công:

- Concert sẽ xuất hiện trong public catalog vì status đã là `PUBLISHED`.
- Public detail theo slug hoạt động như publish thủ công.
- Public ticket types có vé `ON_SALE` vì scheduler auto-open ticket type `DRAFT`.
- Cache list/detail/metadata/seat-map/ticket-types/inventory được invalidate bằng helper chung.

Nếu UI đang hiển thị data cũ:

- Kiểm tra worker có đang chạy không.
- Kiểm tra Redis có dùng cùng instance với API/worker không.
- Kiểm tra concert có đủ readiness không.
- Kiểm tra `planned_publish_at` có thật sự <= current time của server không.

## 4. Ảnh hưởng đến Preview

Preview admin/organizer vẫn nên tiếp tục render DRAFT như trước.

Trước auto-publish:

- Concert status `DRAFT`.
- Preview route riêng của admin/organizer vẫn xem được.
- Public `/concerts/:slug` không nên lộ concert.
- Nút mua vé nên bị disable nếu UI đang theo rule "chưa public thì không mua".

Sau auto-publish:

- Concert status `PUBLISHED`.
- Public `/concerts/:slug` hiển thị concert.
- Ticket type `DRAFT` thành `ON_SALE`, nên flow mua vé có thể bắt đầu.
- Preview route vẫn xem được, nhưng dữ liệu lúc này gần với public hơn.

## 5. File Thuận nên đọc

- `ticket-box-app/apps/worker-server/src/schedulers/auto-publish.scheduler.ts`
- `ticket-box-app/packages/redis/src/catalog-cache.ts`
- `ticket-box-app/apps/api-server/src/modules/catalog/catalog.controller.ts`
- `ticket-box-app/apps/api-server/src/modules/organizer/organizer.controller.ts`
- `ticket-box-app/apps/web/src/routes/preview/ConcertPreviewPage.tsx`
- `ticket-box-app/apps/web/src/routes/audience/ConcertDetailPage.tsx`
- `ticket-box-app/apps/web/src/routes/audience/EventsPage.tsx`

## 6. Điều AI Agent của Thuận nên kiểm tra trên frontend

1. Link public slug
   - Concert sau auto-publish phải vào được `/concerts/:slug`.
   - Card/home/events không được quay lại dùng UUID trên URL người dùng.

2. Preview DRAFT
   - Concert DRAFT chưa due publish vẫn xem preview được bằng admin/organizer preview route.
   - Public catalog không hiện concert DRAFT.

3. Preview sau auto-publish
   - Concert due publish chuyển sang `PUBLISHED`.
   - Preview route không bị broken.
   - Public detail render đủ data, cover image/artists/seat map không mất.

4. Ticket type display
   - Ticket type `DRAFT` trước auto-publish không nên hiển thị như vé đang bán public.
   - Sau auto-publish, ticket type thành `ON_SALE` và UI có thể cho chọn/mua.

5. Guest List không bị ảnh hưởng
   - `guestDriveFolderId` không bị scheduler sửa.
   - Guest List panel/import job history/search vẫn hoạt động.

## 7. Demo script gợi ý cho Thuận

Demo auto-publish 1 phút:

1. Mở admin/organizer preview của concert DRAFT có `planned_publish_at` sát hiện tại.
2. Cho thấy concert chưa xuất hiện public catalog.
3. Chạy worker-server nếu chưa chạy.
4. Đợi worker tick auto-publish.
5. Refresh public events/detail theo slug.
6. Cho thấy concert đã public, ticket type đã `ON_SALE`.
7. Mở audit admin query với filter `action=CONCERT_AUTO_PUBLISHED` để show trace.

Dữ liệu demo cần có:

- Concert `DRAFT`.
- `planned_publish_at <= now` hoặc cách hiện tại 1-2 phút.
- Ít nhất 1 seat zone.
- Ít nhất 1 ticket type `DRAFT`.
- Cover image/artists/guest folder tùy chọn để verify không bị mất.

## 8. Lưu ý phối hợp với Thái

Auto-publish tự động chuyển ticket type `DRAFT` sang `ON_SALE`, nên UI mua vé và checkout của Thái có thể bắt đầu ngay sau publish.

Nếu Thuận làm demo frontend:

- Đảm bảo worker đang chạy trước khi kỳ vọng concert tự public.
- Nếu muốn demo không phụ thuộc worker, seed concert `PUBLISHED` và ticket type `ON_SALE`.
- Nếu muốn demo auto-publish, cần cho worker tick và refresh sau khi cache invalidation.

## 9. Rủi ro còn lại cho frontend/demo

- Scheduler chạy mỗi 60 giây mặc định; demo cần đủ thời gian đợi tick.
- Cache Redis dùng chung API/worker; nếu mỗi app trỏ Redis khác nhau thì public UI có thể thấy data cũ.
- Readiness chỉ check tối thiểu, chưa validate sale window ticket type.
- Nếu team muốn hiển thị countdown "scheduled publish", UI cần đọc `planned_publish_at` từ admin/organizer API hiện có, không lấy từ public endpoint.

## 10. Checklist trước khi quay demo

- Chạy API, worker, Redis và web cùng một `.env`.
- Build web nếu quay bản production-like.
- Kiểm tra public catalog theo slug sau auto-publish.
- Kiểm tra preview DRAFT trước khi publish.
- Kiểm tra audit `CONCERT_AUTO_PUBLISHED`.
- Kiểm tra Guest List panel vẫn đọc được folder/job/search.
