# Sửa 4 vấn đề AI Artist Bio — nguyên nhân thực & cách khắc phục

Ngày 27/06/2026. Build xanh (api + worker + web). **Cần restart worker + api + web** để áp dụng (đặc biệt worker cho #4).

---

## #4 — AI không được gọi → **nguyên nhân thực: lỗi API của pdf-parse v2** (không phải env)

Bản cài đặt là **`pdf-parse@2.4.5`** — một bản viết lại hoàn toàn (class API, dùng `pdfjs-dist`), `exports` **không** mở subpath `./lib/pdf-parse.js` mà tôi import → Node ném `ERR_PACKAGE_PATH_NOT_EXPORTED` → worker **crash tại bước tách PDF**, **trước khi** gọi Gemini ⇒ AI Studio không thấy hoạt động.

> ✅ Đính chính: giả thuyết "env đặt sai chỗ" ở báo cáo trước **không đúng** — kiểm tra `ticket-box-app/.env` thấy **đủ** `GEMINI_API_KEY` + `SUPABASE_*`.

**Đã sửa** `ai-bio.worker.ts` sang đúng API v2 + đã **chạy thử runtime** (load OK, `getText()` chạy đúng đường):
```ts
const { PDFParse } = await import("pdf-parse");
const parser = new PDFParse({ data: buffer });
try { const { text } = await parser.getText(); return text; }
finally { await parser.destroy(); }
```
Xóa file khai báo type chết `src/types/pdf-parse.d.ts`.

---

## #2 — Upload ảnh không hoạt động → **cấu hình ĐÚNG, lỗi do whitelist content-type hẹp**

**Đã test trực tiếp lên Supabase bằng `.env` thật của bạn:**
```
Buckets: Guest List Import(public=false), AI Artist Bio(public=false), Bio Image(public=true)
IMAGE upload to "Bio Image" -> OK     (publicUrl truy cập được)
PDF   upload to "AI Artist Bio" -> OK
```
⇒ Bucket + key **hoàn toàn đúng** (đúng như bạn nói). Vậy lỗi **không phải Supabase**.

**Nguyên nhân thực:** route ảnh chỉ nhận `["image/jpeg","image/png","image/webp","image/gif"]`. Nếu ảnh bạn chọn là **định dạng khác** (vd HEIC từ iPhone, AVIF, BMP) thì `express.raw` không parse → `req.body` rỗng → API trả lỗi "Empty image upload" → "không hoạt động". (Ảnh > 5MB cũng bị chặn bởi limit cũ.)

**Đã sửa:**
- Route nhận **mọi `image/*`**, nâng limit **5MB → 10MB** (`organizer.router.ts`).
- `imageExtension` suy ra đuôi từ content-type cho mọi loại (png/webp/gif/avif/heic/svg…).

---

## #1 — Chọn PDF nhiều lần → nhiều file rác trên Supabase → **đổi sang upload khi NỘP**

**Nguyên nhân:** form upload **ngay mỗi lần chọn** file → mỗi lần chọn tạo 1 object Supabase, chỉ giữ key cuối ⇒ phần còn lại thành rác.

**Đã sửa** (`OrganizerWorkspacePage.tsx`): form chỉ **giữ `File` đã chọn** (preview ảnh bằng `URL.createObjectURL`), và **chỉ upload đúng 1 lần khi bấm "Nộp hồ sơ"** (sau khi form hợp lệ). Chọn/đổi file nhiều lần trước khi nộp **không** tạo file rác.

---

## #3 — Admin không theo dõi được trạng thái bio → **thêm hiển thị**

API đã trả `bio_status`/`artist_bio`/`artist_bio_image_url` nhưng UI admin chưa render.

**Đã sửa:** `admin-organizer.view-model.ts` map thêm 3 field; `AdminOrganizerRequestsPage` thêm mục **"Giới thiệu nghệ sĩ (AI)"** trong phần xem xét hồ sơ: **badge trạng thái** (Đang chờ AI / AI đang xử lý / Đã sinh bio / Lỗi sinh bio) + nội dung bio + ảnh nghệ sĩ.

---

## File đã đổi
- `apps/worker-server/src/workers/ai-bio.worker.ts` (+ xóa `src/types/pdf-parse.d.ts`)
- `apps/api-server/src/modules/organizer/organizer.router.ts`, `organizer.controller.ts`
- `apps/web/src/routes/organizer/OrganizerWorkspacePage.tsx`
- `apps/web/src/routes/admin/admin-organizer.view-model.ts`, `AdminOrganizerRequestsPage.tsx`

## Cách kiểm tra lại
1. **Restart cả 3**: `npm run dev:api`, `npm run dev:worker`, `npm run dev:web` (worker bắt buộc, để nạp bản pdf-parse mới).
2. Nộp hồ sơ có PDF + ảnh (thử cả ảnh iPhone/HEIC) → chỉ **1 file PDF + 1 ảnh** lên Supabase.
3. Theo dõi **console worker**: `[ai-bio] done {...}` → AI Studio **sẽ thấy request**. Nếu vẫn lỗi, đọc `[ai-bio] Job ... failed: <message>` hoặc cột `artist_bio_jobs.error_message`.
4. Trang admin → mở hồ sơ → thấy **badge trạng thái bio + bio + ảnh**.
5. Concert detail (sau duyệt) tab "Nghệ sĩ" → ảnh + bio.

> Nhắc lại: env nằm ở **`ticket-box-app/.env`** (gốc), không phải `apps/*/.env` — của bạn đã đúng nên press kit/ảnh upload được.
