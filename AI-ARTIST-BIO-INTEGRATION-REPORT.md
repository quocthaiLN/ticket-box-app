# Báo cáo tích hợp AI Artist Bio — ảnh bio + Supabase server-side + nới token + Frontend

- **Ngày:** 27/06/2026 · **Provider:** Google Gemini (`gemini-2.0-flash`) · **Storage:** Supabase
- **Build:** ✅ xanh toàn workspace (api + worker + **web** vite build OK).
- **Scope (đã chốt với BTC):** giữ 1 press kit/concert; upload qua Supabase **server-side**; **nới token**; thêm **ảnh nghệ sĩ gắn ngay lúc nộp hồ sơ** (độc lập bio — nếu bio lỗi vẫn có ảnh).

---

## 1. Thay đổi trong đợt này

**Storage (Supabase server-side)** — `packages/storage/src/supabase.ts`
- `uploadPressKit(objectKey, buf)` → bucket `press-kits` (**private**).
- `uploadArtistImage(objectKey, buf, contentType)` → bucket `artist-images` (**public**), trả public URL.
- Bỏ `createPressKitUploadUrl` (signed URL client). `downloadPressKit` giữ nguyên (worker dùng).

**API** — `organizer.*`, `organizer-admin.*`, `catalog.*`
- 2 endpoint upload (express.raw, giống cover-image):
  - `POST /organizer/uploads/press-kit` (`application/pdf`, ≤10MB) → `{ object_key }`.
  - `POST /organizer/uploads/artist-image` (`image/*`, ≤5MB) → `{ object_key, url }`.
- Tạo hồ sơ nhận thêm `artist_bio_image_url` → lưu `OrganizerRequest.artistBioImageUrl` ngay (độc lập bio). Trigger bio job vẫn chạy khi có `press_kit_url`.
- Approve copy `request.artistBioImageUrl → concert.artistBioImageUrl` (cạnh copy bio).
- `updateDraftConcert` nhận `artist_bio_image_url` (sửa ảnh sau khi duyệt).
- Catalog concert detail/metadata trả `artist_bio_image_url`.
- DTO organizer + admin request-detail lộ `artist_bio`, `bio_status`, `artist_bio_image_url`.

**Worker (nới token)** — `apps/worker-server/src/workers/ai-bio.client.ts`
- `AI_MAX_SOURCE_CHARS` 9000 → **20000**; `AI_MAX_OUTPUT_TOKENS` 300 → **800**; prompt từ "60–120 từ" → **"150–250 từ, 1–2 đoạn"**.

**Schema** — `Concert.artistBioImageUrl`, `OrganizerRequest.artistBioImageUrl`.

**Frontend**
- `organizer.service.ts`: `uploadOrganizerPressKit`, `uploadOrganizerArtistImage`; thêm field `artist_bio_image_url` + bio fields vào các type.
- `OrganizerWorkspacePage` (form nộp hồ sơ): thay ô text "URL bộ tư liệu" → **upload PDF** + **upload ảnh nghệ sĩ** (preview), gửi `press_kit_url`(object_key) + `artist_bio_image_url`(public URL).
- `ConcertDetailPage` tab "Nghệ sĩ": hiển thị **ảnh + bio** (ảnh hiện cả khi bio trống).
- `api-client.ts`, `catalog-ui.ts`: thêm `artist_bio_image_url` / `artistBioImageUrl`.

> 16 file thay đổi. Đã **gỡ mock cũ** từ các đợt trước (worker dùng Gemini thật).

---

## 2. Thiết lập (bắt buộc trước khi chạy)

### 2.1. Supabase
1. Tạo **2 bucket** trong Storage:
   - `press-kits` — **Private**.
   - `artist-images` — **Public** (bật "Public bucket" để `getPublicUrl` hiển thị được).
2. Lấy **Project URL** + **service_role key** (Settings → API). *service_role chỉ để ở backend.*

### 2.2. Biến môi trường
**`.env` worker-server**
```bash
AI_MODEL=gemini-2.0-flash
GEMINI_API_KEY=<gemini key>
AI_MAX_SOURCE_CHARS=20000
AI_MAX_OUTPUT_TOKENS=800
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role key>
SUPABASE_PRESS_KIT_BUCKET=press-kits
SUPABASE_ARTIST_IMAGE_BUCKET=artist-images
```
**`.env` api-server**
```bash
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role key>
SUPABASE_PRESS_KIT_BUCKET=press-kits
SUPABASE_ARTIST_IMAGE_BUCKET=artist-images
```
**Web**: không cần Supabase key (upload qua API). Chỉ cần `VITE_API_BASE_URL` như cũ.

### 2.3. Migrate DB (bắt buộc)
Prisma client đã `generate`; cần tạo cột mới trong Postgres:
```bash
cd ticket-box-app
npx prisma migrate dev --name artist_bio_image --schema=packages/database/prisma/schema.prisma
```

---

## 3. Chạy
```bash
cd ticket-box-app
npm install
npm run build            # đã verify xanh
npm run dev:api          # API :3000
npm run dev:worker       # Worker (Gemini + Supabase)
npm run dev:web          # Web
```

---

## 4. Luồng end-to-end

```
BTC (Organizer) → form Nộp hồ sơ:
  • upload PDF press kit  → POST /organizer/uploads/press-kit  → object_key
  • upload ảnh nghệ sĩ    → POST /organizer/uploads/artist-image → public URL
  • Nộp hồ sơ (POST /organizer/requests, kèm press_kit_url + artist_bio_image_url)
      → OrganizerRequest PENDING; artistBioImageUrl set NGAY; bio job enqueue (bio_status=PENDING)

Worker: tải PDF (Supabase) → tách text (pdf-parse) → làm sạch + ưu tiên + token(20k/800)
      → Gemini sinh bio (~250–350 từ) → request.artistBio + bio_status=DONE
      (lỗi PDF/Gemini → bio_status=FAILED, KHÔNG chặn — ảnh vẫn còn)

Admin: xem hồ sơ (artist_bio + bio_status + ảnh) → Approve
      → Concert DRAFT tạo kèm artistBio + artistBioImageUrl

Audience: trang chi tiết concert, tab "Nghệ sĩ" → ảnh + bio
```

---

## 5. Cách test

### 5.1. Qua UI (khuyến nghị)
1. Đăng nhập **Organizer** → `/organizer/requests` → **Nộp hồ sơ**.
2. Tab "Thông tin concert": chọn **PDF press kit** (thấy "✓ … AI sẽ tự sinh…") + **ảnh nghệ sĩ** (thấy preview). Điền zone/loại vé → **Nộp hồ sơ**.
3. Mở lại hồ sơ → `bio_status` chạy `PENDING → DONE`, thấy bio + ảnh.
4. Đăng nhập **Admin** → duyệt hồ sơ.
5. Mở **trang chi tiết concert** (tab "Nghệ sĩ") → thấy **ảnh + bio**.

### 5.2. Qua API (curl)
```bash
# Upload PDF (raw body)
curl -X POST localhost:3000/v1/organizer/uploads/press-kit \
  -H "authorization: Bearer $ORG_TOKEN" -H "content-type: application/pdf" \
  --data-binary @press-kit.pdf
# → { data: { object_key } }

# Upload ảnh
curl -X POST localhost:3000/v1/organizer/uploads/artist-image \
  -H "authorization: Bearer $ORG_TOKEN" -H "content-type: image/jpeg" \
  --data-binary @artist.jpg
# → { data: { object_key, url } }

# Nộp hồ sơ (kèm press_kit_url=object_key, artist_bio_image_url=url)
curl -X POST localhost:3000/v1/organizer/requests \
  -H "authorization: Bearer $ORG_TOKEN" -H 'content-type: application/json' \
  -d '{ "venue_id":"<venue>","title":"Đêm nhạc X","artist_name":"Ca sĩ X",
        "starts_at":"2026-08-01T12:00:00Z","ends_at":"2026-08-01T15:00:00Z",
        "gate_count":2,"checker_count":2,
        "press_kit_url":"<object_key>.pdf","artist_bio_image_url":"<public url>",
        "ticket_types":[{"zone_code":"A","zone_name":"Khu A","zone_capacity":100,
          "name":"Vé A","price":{"amount":500000,"currency":"VND"},
          "total_quantity":100,"max_per_user":4,
          "sale_start_at":"2026-07-01T00:00:00Z","sale_end_at":"2026-07-31T00:00:00Z"}] }'

# Poll trạng thái bio
curl localhost:3000/v1/organizer/requests/<request_id> -H "authorization: Bearer $ORG_TOKEN"
# → bio_status=DONE, artist_bio="...", artist_bio_image_url="..."

# Admin duyệt → concert có bio + ảnh
curl -X POST localhost:3000/v1/admin/organizer-requests/<request_id>/approve -H "authorization: Bearer $ADMIN_TOKEN"
curl localhost:3000/v1/concerts/<concert_id>   # artist_bio + artist_bio_image_url
```

**Tiêu chí PASS**
- [ ] Upload PDF/ảnh trả `object_key`/`url` (file xuất hiện trong bucket Supabase).
- [ ] Nộp hồ sơ → `artist_bio_image_url` set ngay; `bio_status` PENDING→DONE; bio ~250–350 từ.
- [ ] Gemini/PDF lỗi → `bio_status=FAILED` nhưng **ảnh vẫn hiển thị**, nộp & duyệt vẫn được.
- [ ] Approve → concert có cả `artist_bio` + `artist_bio_image_url`.
- [ ] Trang chi tiết concert hiển thị ảnh + bio ở tab "Nghệ sĩ".

---

## 6. Lưu ý & giới hạn
1. **Migration là bước thủ công còn lại** (mục 2.3) — build xanh nhờ `prisma generate`, nhưng cột DB cần `migrate dev`.
2. **Bucket `artist-images` phải Public** thì ảnh mới hiển thị; `press-kits` để Private.
3. **PDF phải có text layer** — `pdf-parse` không OCR ảnh scan → `bio_status=FAILED` (ảnh vẫn còn, BTC nhập bio tay qua sửa concert DRAFT).
4. **service_role key chỉ ở backend** — web upload qua API nên không lộ key.
5. **Sửa ảnh sau duyệt**: API `updateDraftConcert` đã nhận `artist_bio_image_url`; nếu cần nút sửa ảnh ở màn concert DRAFT thì bổ sung UI sau (API sẵn sàng).
6. Cảnh báo chunk-size khi vite build là sẵn có từ trước, không liên quan thay đổi này.
```
