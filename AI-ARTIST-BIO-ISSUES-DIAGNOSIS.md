# Chẩn đoán 4 vấn đề AI Artist Bio (báo cáo trước khi sửa)

Ngày 27/06/2026. Báo cáo **lý do** từng vấn đề (dựa trên đọc code), kèm cách xác nhận. Chưa sửa.

---

## ⚠️ Phát hiện chung quan trọng (ảnh hưởng #2, #4): env nạp SAI chỗ

`config/env.ts` **chỉ** nạp **một** file `.env` ở **gốc** monorepo, KHÔNG đọc `.env` của từng app:

```ts
// config/env.ts:26-31
const rootEnvPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.env");
dotenv.config({ path: rootEnvPath });   // → ticket-box-app/.env
```

→ Mọi `process.env.GEMINI_API_KEY`, `process.env.SUPABASE_*` chỉ có giá trị nếu nằm trong **`ticket-box-app/.env`**.

❌ **Hai báo cáo trước của tôi sai**: chúng hướng dẫn đặt key trong `apps/worker-server/.env` và `apps/api-server/.env` — các file này **không bao giờ được nạp**. Đây là nguyên nhân gốc khả năng cao nhất của #4 (và #2 nếu SUPABASE cũng đặt sai chỗ). *Vì press kit upload được (xem #1) nên `SUPABASE_*` chắc đã nằm đúng ở root; rất có thể `GEMINI_API_KEY` thì chưa.*

---

## #1. Chọn file PDF nhiều lần → gửi nhiều file lên Supabase (orphan)

**Nguyên nhân (chắc chắn — lỗi code frontend):** mỗi lần chọn file là **upload ngay**, không thay thế file cũ.

```ts
// OrganizerWorkspacePage.tsx:825-840 (handlePressKitUpload)
const upload = await uploadOrganizerPressKit(file);   // ← upload NGAY mỗi lần chọn
setForm((current) => ({ ...current, pressKitUrl: upload.object_key })); // chỉ giữ key MỚI NHẤT
```

→ Chọn N lần = **N object trên Supabase**, nhưng form chỉ giữ object_key cuối → (N−1) file thành **rác mồ côi** (không ai tham chiếu, không bị xóa).

**Hướng sửa (sẽ làm sau):** một trong các cách —
- (a) Chỉ upload **lúc bấm Nộp hồ sơ** (không upload khi chọn); hoặc
- (b) Trước khi upload file mới, **xóa object cũ** (`pressKitUrl` hiện tại) qua một endpoint delete; hoặc
- (c) Dùng **object key cố định theo phiên** + `upsert: true` để ghi đè.
Khuyến nghị (a) hoặc (b) để đảm bảo "1 file duy nhất mỗi lần thêm/sửa".

---

## #2. Upload ảnh nghệ sĩ không hoạt động

**Code FE/BE đều đúng** (`handleArtistImageUpload` OrganizerWorkspacePage.tsx:842-856; `uploadArtistImage` storage/supabase.ts; route `/organizer/uploads/artist-image`). Press kit upload chạy được → `SUPABASE_*` đã cấu hình đúng ở root. Khác biệt duy nhất là **bucket ảnh**.

**Nguyên nhân khả năng cao (cấu hình Supabase):**
1. **Bucket `artist-images` chưa được tạo** → `storage.from("artist-images").upload(...)` trả lỗi → API 500 → FE hiện "Không thể upload ảnh nghệ sĩ." (xem ô `uploadError`).
2. Hoặc bucket **chưa để Public** → upload OK nhưng `getPublicUrl()` trả URL không phục vụ được → ảnh preview/hiển thị vỡ → trông như "không hoạt động".

```ts
// storage/supabase.ts — cần bucket "artist-images" tồn tại + Public
const ARTIST_IMAGE_BUCKET = process.env.SUPABASE_ARTIST_IMAGE_BUCKET ?? "artist-images";
... .from(ARTIST_IMAGE_BUCKET).upload(...) ; ... .getPublicUrl(objectKey);
```

**Cách xác nhận:** mở **console api-server** lúc upload ảnh → nếu thấy lỗi kiểu `Bucket not found` / `The resource was not found` → đúng nguyên nhân #1; nếu upload OK nhưng ảnh không hiện → nguyên nhân #2 (bucket private). Kiểm tra Supabase → Storage có bucket `artist-images` (Public) chưa.

> Ít khả năng hơn: nếu cả `SUPABASE_*` cũng đặt sai ở `apps/api-server/.env` thì upload ảnh **và** press kit đều fail — nhưng #1 cho thấy press kit chạy, nên loại trường hợp này.

---

## #3. Admin không theo dõi được trạng thái job bio

**Nguyên nhân (chắc chắn — thiếu hiển thị ở frontend):** API **đã trả** `bio_status`/`artist_bio`/`artist_bio_image_url` (đã thêm ở `AdminRequestDetailDto`), nhưng **view-model + card của admin không map/không render**:

```ts
// admin-organizer.view-model.ts:46-56 — KHÔNG có bio_status/artist_bio/...
export function toAdminOrganizerRequestDetailView(detail) {
  return { ...toAdminOrganizerRequestView(detail), description, venueId,
           plannedPublishAt, pressKitLabel, reviewNote, ticketTypes }; // ← thiếu bio
}
```
Và `RequestReviewCard` (AdminOrganizerRequestsPage.tsx:249-291) chỉ render Mô tả / Nghệ sĩ / cổng / checker / Press Kit / loại vé — **không có badge trạng thái bio**.

Dữ liệu sẵn có (type `AdminOrganizerRequestDetail = OrganizerRequestDetail & ...`, mà `OrganizerRequestDetail` đã có `bio_status`). → Chỉ là **chưa render**.

**Hướng sửa:** thêm `bioStatus`/`artistBio`/`artistBioImageUrl` vào view-model + 1 badge trạng thái + (tuỳ chọn) xem trước bio/ảnh trong `RequestReviewCard`.

---

## #4. AI (Gemini) không được gọi — AI Studio không có hoạt động

Job bio **được tạo + enqueue** (vì admin thấy hồ sơ ⇒ `createRequest`+`kickoffArtistBio` chạy). Nhưng worker **không chạm tới HTTP Gemini**. Các nguyên nhân theo thứ tự khả năng:

1. **`GEMINI_API_KEY` không nằm trong `ticket-box-app/.env`** (đặt nhầm ở `apps/worker-server/.env` theo báo cáo cũ của tôi). Khi đó:
   ```ts
   // ai-bio.client.ts (callGemini): ném LỖI trước khi gọi mạng → AI Studio không thấy gì
   const key = process.env.GEMINI_API_KEY;
   if (!key) throw new Error("GEMINI_API_KEY chưa được cấu hình.");
   ```
   → job `FAILED` với error đúng câu này, **không có request nào tới Gemini**.
2. **Worker chưa chạy** (`npm run dev:worker`): job nằm trong Redis, không ai xử lý → AI Studio trống.
3. **Worker lỗi trước bước Gemini**: tải PDF từ Supabase lỗi / `pdf-parse` lỗi → `FAILED` trước khi gọi AI. *(Ít khả năng vì worker đọc cùng root `.env` nên cũng có `SUPABASE_*`.)*
4. Migration chưa chạy (cột `bio_status`...) → worker lỗi khi cập nhật trạng thái. *(Ít khả năng vì #3 cho thấy hồ sơ tạo được.)*

**Cách xác nhận nhanh (xác định chính xác nguyên nhân):**
- Xem **console worker**: dòng `[ai-bio] Job <id> failed: <message>`.
  - `GEMINI_API_KEY chưa được cấu hình` → nguyên nhân #1.
  - Lỗi Supabase/`pdf-parse` → nguyên nhân #3.
  - **Không có log nào** của `[ai-bio]` → worker không chạy / Redis (#2).
- Hoặc soi bảng **`artist_bio_jobs`** (`status`, `error_message`):
  - `FAILED` + message → đọc message.
  - `PENDING` mãi → worker/Redis không xử lý (#2).

---

## Tóm tắt & thứ tự sửa đề xuất

| # | Loại | Nguyên nhân | Mức |
|---|---|---|---|
| 4 | Config (tôi gây ra) | Key đặt sai `.env`; phải ở `ticket-box-app/.env` | 🔴 chặn AI |
| 2 | Cấu hình Supabase | Bucket `artist-images` chưa tạo / chưa Public | 🔴 |
| 1 | Lỗi code FE | Upload eager mỗi lần chọn → orphan | 🟡 |
| 3 | Thiếu hiển thị FE | View-model + card admin chưa render bio_status | 🟡 |

**Việc bạn cần làm để xác nhận (trước khi tôi sửa code):**
1. Mở `ticket-box-app/.env` — có `GEMINI_API_KEY=...` và `SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY` ở đây không? (không phải trong `apps/*/.env`).
2. Supabase → Storage: có bucket `press-kits` (Private) **và** `artist-images` (**Public**) chưa?
3. Worker có đang chạy không? Console worker in gì khi nộp hồ sơ?
4. Đã chạy `prisma migrate dev` (2 lần: `artist_bio_request_flow` + `artist_bio_image`) chưa?

Gửi tôi kết quả 4 mục trên (hoặc xác nhận "cứ sửa theo chẩn đoán"), tôi sẽ vào sửa: gộp env về root + hướng dẫn bucket, đổi upload PDF thành "1 file" + xóa orphan, thêm upload ảnh đúng, và hiển thị trạng thái bio bên admin.
