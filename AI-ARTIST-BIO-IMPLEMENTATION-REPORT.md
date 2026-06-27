# Báo cáo triển khai: Luồng AI Artist Bio (end-to-end) — Gemini + Supabase

- **Ngày:** 26/06/2026
- **Provider AI:** Google Gemini (`gemini-2.0-flash`)
- **Storage:** Supabase Storage (bucket `press-kits`)
- **Build:** ✅ xanh — `redis → database → queue → storage → api → worker` compile sạch (TypeScript).
- **Thiết kế tham chiếu:** [AI-ARTIST-BIO-E2E-PLAN.md](AI-ARTIST-BIO-E2E-PLAN.md)

---

## 1. Luồng đã hoàn thiện

```
Organizer xin upload URL → PUT file PDF lên Supabase → POST /organizer/requests (press_kit_url = path)
   → tạo OrganizerRequest (PENDING) + ArtistBioJob (PENDING) + enqueue
   → [Worker] tải PDF từ Supabase → tách text (pdf-parse) → làm sạch → ưu tiên + giới hạn token
            → Gemini sinh bio ngắn gọn → ghi request.artist_bio + bio_status=DONE
   → Admin xem hồ sơ (kèm artist_bio) → approve
   → Concert(DRAFT) được tạo với artist_bio sẵn → hiển thị trên trang chi tiết concert
```

Đặc điểm: **soft-gate** (AI lỗi không chặn nộp/duyệt), **denormalize** bio lên `OrganizerRequest`, luồng cũ (bio theo `concert_id`) vẫn chạy.

---

## 2. Thay đổi theo file

**Schema & queue**
- `packages/database/prisma/schema.prisma` — `ArtistBioJob`: `concertId` nullable + `organizerRequestId`, `modelName`, `completedAt` + relation/index. `OrganizerRequest`: `artistBio`, `bioStatus`, relation `artistBioJobs`.
- `packages/queue/src/jobs.ts` — `AiBioJobData`: `concert_id?` + `organizer_request_id?`.

**Storage (Supabase)**
- `packages/storage/src/supabase.ts` *(mới)* — `createPressKitUploadUrl()` (signed upload URL) + `downloadPressKit()` (tải buffer bằng service-role key).
- `packages/storage/src/index.ts` — export thêm `supabase.js`.
- `packages/storage/package.json` — thêm `@supabase/supabase-js`.

**Worker (Gemini, bỏ mock)**
- `apps/worker-server/src/workers/ai-bio.client.ts` *(mới)* — gọi Gemini REST + `prioritizeText` (làm sạch nhiễu, chấm điểm từ khoá quan trọng, giới hạn token) + prompt "giới thiệu ngắn gọn".
- `apps/worker-server/src/workers/ai-bio.worker.ts` — viết lại: 2 nhánh concert/request, Supabase download + `pdf-parse`, `cleanExtractedText` mạnh hơn, audit + invalidate cache (nhánh concert).
- `apps/worker-server/src/types/pdf-parse.d.ts` *(mới)* — khai báo type cho subpath import.
- `apps/worker-server/package.json` — thêm `pdf-parse` + `@types/pdf-parse`.

**API (trigger + approve + DTO)**
- `organizer/organizer.repository.ts` — `createRequest` gọi `kickoffArtistBio` (tạo job + enqueue, non-blocking).
- `organizer/organizer.controller.ts` + `organizer.router.ts` — endpoint `POST /organizer/press-kits/upload-url`.
- `organizer-admin/organizer-admin.repository.ts` — `approveRequest` set `concert.artistBio = request.artistBio` + backfill `job.concertId`; DTO review thêm `artist_bio` + `bio_status`.

### Mock cũ đã loại bỏ
- `generateMockArtistBio()` (ghép chuỗi tĩnh) — **xóa**, thay bằng Gemini thật.
- `readOptionalTextSource()` / `resolveLocalPath()` / `localObjectCandidates()` (đọc file local kiểu mock) — **xóa**, thay bằng Supabase download + `pdf-parse`.

---

## 3. Hướng dẫn thiết lập

### 3.1. Supabase
1. Tạo project Supabase (free). Vào **Storage → New bucket**: tên `press-kits`, để **Private**.
2. Lấy **Project URL** + **service_role key** (Settings → API). *service_role key chỉ dùng ở backend, KHÔNG đưa vào web.*

### 3.2. Gemini
- Vào Google AI Studio → **Get API key** (miễn phí). Test nhanh:
  ```bash
  curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=$GEMINI_API_KEY" \
    -H 'content-type: application/json' -d '{"contents":[{"parts":[{"text":"Xin chào"}]}]}'
  ```

### 3.3. Biến môi trường
**`.env` worker-server** (gọi Gemini + đọc Supabase):
```bash
AI_MODEL=gemini-2.0-flash
GEMINI_API_KEY=<gemini key>
AI_MAX_SOURCE_CHARS=9000      # input ~3.000 token
AI_MAX_OUTPUT_TOKENS=300      # output ~90–130 từ (ngắn gọn)
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role key>
SUPABASE_PRESS_KIT_BUCKET=press-kits
```
**`.env` api-server** (cấp signed upload URL):
```bash
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role key>
SUPABASE_PRESS_KIT_BUCKET=press-kits
```

### 3.4. Cài đặt, migrate, build
```bash
cd ticket-box-app
npm install                                            # đã thêm @supabase/supabase-js, pdf-parse
npx prisma migrate dev --name artist_bio_request_flow \
  --schema=packages/database/prisma/schema.prisma      # ⬅ BẮT BUỘC: tạo cột mới trong DB
npm run build                                          # hoặc build:api + build:worker
```
> ⚠️ Prisma **client đã được generate**, nhưng **DB chưa migrate**. Phải chạy lệnh `migrate dev` ở trên với Postgres đang chạy thì luồng mới hoạt động.

### 3.5. Chạy
```bash
npm run dev:api       # API server
npm run dev:worker    # Worker (Gemini + Supabase)
```

---

## 4. Test end-to-end

> Cần token ORGANIZER + ADMIN (đăng nhập qua `/v1/auth/...`). `<port>` mặc định theo cấu hình api-server.

```bash
# 1) Xin signed upload URL
curl -X POST localhost:<port>/v1/organizer/press-kits/upload-url \
  -H "authorization: Bearer $ORG_TOKEN" -H 'content-type: application/json' -d '{}'
# → { data: { path, token, signed_url } }

# 2) Đẩy file PDF lên Supabase qua signed URL
curl -X PUT "<signed_url>" -H "content-type: application/pdf" --data-binary @press-kit.pdf

# 3) Nộp hồ sơ kèm press_kit_url = path → tự kích hoạt bio job
curl -X POST localhost:<port>/v1/organizer/requests \
  -H "authorization: Bearer $ORG_TOKEN" -H 'content-type: application/json' \
  -d '{ "venue_id":"<venue>", "title":"Đêm nhạc X", "artist_name":"Ca sĩ X",
        "starts_at":"2026-08-01T12:00:00Z", "ends_at":"2026-08-01T15:00:00Z",
        "gate_count":2, "checker_count":2, "press_kit_url":"<path>.pdf",
        "ticket_types":[{"zone_code":"A","zone_name":"Khu A","zone_capacity":100,
          "name":"Vé A","price":{"amount":500000,"currency":"VND"},
          "total_quantity":100,"max_per_user":4,
          "sale_start_at":"2026-07-01T00:00:00Z","sale_end_at":"2026-07-31T00:00:00Z"}] }'
# → request PENDING, bio_status=PENDING

# 4) Đợi worker vài giây → admin xem bio
curl localhost:<port>/v1/admin/organizer-requests/<request_id> \
  -H "authorization: Bearer $ADMIN_TOKEN"
# → bio_status=DONE, artist_bio="<đoạn giới thiệu ngắn gọn do Gemini sinh>"

# 5) Admin duyệt → concert kèm artist_bio
curl -X POST localhost:<port>/v1/admin/organizer-requests/<request_id>/approve \
  -H "authorization: Bearer $ADMIN_TOKEN"

# 6) Trang chi tiết concert hiển thị bio
curl localhost:<port>/v1/concerts/<slug-or-id>   # artist_bio đã có
```

**Tiêu chí PASS**
- [ ] Upload PDF lên bucket `press-kits` thành công.
- [ ] Nộp hồ sơ → `bio_status=PENDING` → worker → `PROCESSING` → `DONE`; `artist_bio` là đoạn ngắn gọn của Gemini.
- [ ] Log worker: `[ai-bio] done { organizer_request_id, generated_chars }`.
- [ ] Key Gemini sai / PDF lỗi → `bio_status=FAILED`, **nộp hồ sơ vẫn thành công**, admin vẫn approve được (soft-gate).
- [ ] Approve → `concerts.artist_bio = request.artist_bio`; concert DRAFT đủ zones/ticketTypes/gates/checkers.
- [ ] Luồng cũ (job theo `concert_id`) vẫn ghi concert + invalidate cache + audit `PUBLISH_ARTIST_BIO`.

---

## 5. Lưu ý & giới hạn

1. **Migration là việc bắt buộc còn lại** để chạy thật: `prisma migrate dev` (mục 3.4). Build đã xanh nhờ `prisma generate`.
2. **PDF phải có text layer.** `pdf-parse` không OCR ảnh scan → trả rỗng → job `FAILED` (soft-gate, BTC nhập bio tay qua `PATCH` concert DRAFT). OCR ngoài phạm vi.
3. **Bảo mật khóa.** `service_role` key chỉ ở `.env` backend. Web upload bằng signed URL + `anon` key (`VITE_SUPABASE_*`).
4. **Rate limit free tier Gemini.** BullMQ retry sẵn (attempts 5, backoff mũ); nếu 429 nhiều thì giảm tần suất.
5. **Token đã chỉnh cho "ngắn gọn":** input 9000 ký tự / output 300 token. Đổi qua env nếu bio bị cụt/dài.
6. **Web UI** (nút upload PDF + badge `bio_status` + nút "Sinh lại") chưa làm — backend đã đủ để chạy/test end-to-end qua API. Đây là phần mở rộng cho demo.
