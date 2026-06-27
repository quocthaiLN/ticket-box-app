# Tích hợp AI Artist Bio — KẾ HOẠCH ĐÃ CHỐT (single bio + ảnh + Supabase)

> Bản này thay cho thiết kế đa file trước đó (đã loại sau khi trao đổi). Scope rút gọn theo quyết định của BTC.

## Quyết định đã chốt
1. **Chỉ 1 press kit / concert** — giữ nguyên mô hình single-bio hiện có (không thêm bảng đa nghệ sĩ, không phân loại file).
2. **Upload qua Supabase, server-side** — API nhận file rồi đẩy lên Supabase bằng service-role key (đúng pattern `apiUploadFile` của cover-image). Gỡ endpoint signed-URL client cũ.
3. **Nới lỏng giới hạn token** cho bio (bio đang quá ngắn).
4. **Ảnh cho bio**: BTC upload **sau khi bio sinh xong**, ảnh lưu Supabase (public để hiển thị).

---

## 1. Backend đã có (giữ nguyên)
Schema bind job vào `OrganizerRequest`, worker Gemini (tách PDF + làm sạch + token budget), trigger khi nộp hồ sơ, approve copy `request.artistBio → concert.artistBio`, DTO admin có `artist_bio`/`bio_status`.

## 2. Thay đổi cần làm

### 2.1. Storage — chuyển press-kit sang server-side + thêm upload ảnh
- `@ticketbox/storage`: thêm `uploadPressKit(objectKey, buf)` (bucket `press-kits`, **private**) và `uploadArtistImage(objectKey, buf, contentType)` (bucket `artist-images`, **public**, trả public URL). **Gỡ** `createPressKitUploadUrl` (signed URL).
- Endpoint organizer (express.raw, giống cover-image):
  - `POST /organizer/uploads/press-kit` (`application/pdf`, ≤10MB) → `{ object_key }`.
  - `POST /organizer/uploads/artist-image` (`image/*`, ≤5MB) → `{ object_key, url }`.
- Controller `createPressKitUpload` (signed URL) → thay bằng 2 handler trên.

### 2.2. Nới token cho bio (`ai-bio.client.ts`)
- Mặc định mới: `AI_MAX_SOURCE_CHARS` 9000 → **20000** (~6–7k token input); `AI_MAX_OUTPUT_TOKENS` 300 → **800** (~250–350 từ).
- Prompt: nới độ dài "ngắn gọn 60–120 từ" → **"khoảng 150–250 từ, 1–2 đoạn"** (vẫn cấm bịa, vẫn bỏ nhiễu hậu cần/liên hệ).

### 2.3. Ảnh cho bio (sau khi bio xong)
- **Schema**: thêm `artistBioImageUrl` vào `Concert` (đích hiển thị) và `OrganizerRequest` (giữ trước khi duyệt, carry khi approve).
- **Luồng**: bio sinh xong (`bio_status=DONE`) → BTC upload ảnh (`/organizer/uploads/artist-image`) → gắn vào hồ sơ qua `POST /organizer/requests/:id/bio-image { image_object_key|url }` (set `request.artistBioImageUrl`).
- **Approve**: copy `request.artistBioImageUrl → concert.artistBioImageUrl` (cạnh chỗ copy bio đã có).
- **Sau duyệt**: cho sửa ảnh qua `updateDraftConcert` (thêm `artist_bio_image_url` vào field cho phép).
- **Catalog**: concert detail/metadata trả `artist_bio_image_url`.

### 2.4. Frontend
- Form nộp hồ sơ: thay ô text "URL bộ tư liệu" → **upload file PDF** (dùng `apiUploadFile('/organizer/uploads/press-kit')`), gửi `press_kit_url = object_key`.
- Màn hồ sơ/organizer: khi `bio_status=DONE` hiện bio + nút **"Tải ảnh nghệ sĩ"** (upload ảnh → gắn vào hồ sơ). Hiện badge trạng thái bio.
- Concert detail, tab **"Nghệ sĩ"**: hiển thị **ảnh + bio** (ảnh từ `artist_bio_image_url`, fallback avatar khi chưa có).

---

## 3. Phạm vi file
- **DB**: +`Concert.artistBioImageUrl`, +`OrganizerRequest.artistBioImageUrl` → migrate + generate.
- **storage**: `uploadPressKit`, `uploadArtistImage`; gỡ signed-URL.
- **api**: 2 endpoint upload + `bio-image` set; approve copy ảnh; `updateDraftConcert` nhận ảnh; catalog trả ảnh.
- **worker**: nới token (client) — không đổi luồng.
- **web**: uploader PDF ở form; upload ảnh sau khi bio xong; concert detail hiển thị ảnh+bio.

Ước lượng: ~1–1.5 ngày.

---

## 4. Điểm cần xác nhận nhanh
- Token: dùng **20000 ký tự / 800 token** (có thể chỉnh qua env) — OK chứ?
- Ảnh gắn ở **hồ sơ đang chờ** (rồi tự sang concert khi duyệt) + sửa được ở concert DRAFT — đúng ý chứ?
- Bucket ảnh **public** để hiển thị trực tiếp (PDF vẫn private) — OK chứ?
