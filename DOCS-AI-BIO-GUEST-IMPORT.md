# Tài liệu chức năng: AI Artist Bio & Import Guest List

Cập nhật: 2026-07-06 — mô tả đúng code hiện tại trên develop (sau đợt multi-artist).
Đối tượng đọc: thành viên nhóm cần hiểu/bảo trì 2 luồng nền này.

---

# PHẦN 1 — AI ARTIST BIO (sinh giới thiệu concert + nghệ sĩ từ press kit)

## 1.1. Chức năng làm gì

Ban tổ chức (BTC) nộp hồ sơ xin tổ chức concert kèm **1 file PDF press kit**. Hệ thống tự động:
1. Tách **văn bản** từ PDF → gọi AI sinh ra **giới thiệu concert** (tab "Thông tin" phía audience) và **bio riêng cho từng nghệ sĩ** (tab "Nghệ sĩ").
2. Tách **ảnh nhúng** trong PDF → upload lên Supabase: ảnh concert (cover) + ảnh từng nghệ sĩ.

Admin xem kết quả ở trang xem xét hồ sơ; khi duyệt, toàn bộ (bio, ảnh, danh sách nghệ sĩ) được copy sang concert nháp.

## 1.2. Quy ước press kit (BTC phải tuân theo)

| Vị trí trong PDF | Hệ thống hiểu là |
| --- | --- |
| Ảnh ở **trang 1** (lấy ảnh lớn nhất) | Ảnh concert / cover |
| Ảnh từ **trang 2 trở đi**, theo thứ tự (trang, vị trí trong trang) | Ảnh nghệ sĩ thứ 1, 2, 3… — ảnh thứ i gán cho nghệ sĩ thứ i xuất hiện trong hồ sơ |
| Văn bản mô tả chương trình | Nguồn cho `concert_bio` |
| Văn bản hồ sơ từng nghệ sĩ (theo thứ tự) | Nguồn cho `artists[i].bio` |

Ảnh nhỏ hơn 200px (logo/icon) bị loại; tối đa 8 ảnh nghệ sĩ. File mẫu chuẩn: `press-kit-mau-anh-thuan.pdf` (1 nghệ sĩ), `press-kit-mau-nhieu-nghe-si.pdf` (3 nghệ sĩ) ở repo root.

## 1.3. Luồng chạy end-to-end

```
Organizer nộp hồ sơ (web)
  └─ POST /organizer/uploads/press-kit  → upload PDF vào bucket private (Supabase), trả object_key
  └─ POST /organizer/requests (kèm press_kit_url = object_key)
       └─ organizer.repository.createRequest()
            ├─ tạo OrganizerRequest
            └─ kickoffArtistBio(): tạo ArtistBioJob (PENDING) + enqueue BullMQ queue AI_BIO
                 (enqueue lỗi → job đánh dấu FAILED, KHÔNG chặn việc nộp hồ sơ)

Worker-server (ai-bio.worker.ts) nhận job:
  1. markProcessing: ArtistBioJob → PROCESSING, request.bioStatus → PROCESSING
  2. Tải PDF từ Supabase (downloadPressKit) → pdf-parse v2 getText() → làm sạch text
  3. generateBios() (ai-bio.client.ts):
       - prioritizeText: lọc đoạn nhiễu (hotline/giá vé/tài trợ...), chấm điểm đoạn quan trọng, cắt theo budget
       - Gọi API AI (OpenAI-compatible, mặc định Groq) với JSON mode
       - Model trả {"concert_bio": "...", "artists": [{"name","bio"}]} theo ĐÚNG THỨ TỰ trong hồ sơ
       - parseBios: 4 tầng fallback (JSON chuẩn → JSON lồng trong text → format cũ {artist_bio} → toàn bộ text = 1 nghệ sĩ)
  4. persistDone (transaction):
       - ArtistBioJob → DONE, lưu generatedBio (bản legacy), extractedText, modelName
       - Ghi vào OrganizerRequest (hoặc Concert nếu job gắn concert — luồng cũ):
           artists (JSONB [{name,bio,image_url:null}]), artistBio (legacy: bio đầu / gộp "Tên — bio"),
           description = concert_bio (CHỈ khi description đang rỗng — không đè bản nhập tay), bioStatus → DONE
  5. Tách ảnh (press-kit-images.ts) — bước NON-FATAL (lỗi chỉ log warn, bio vẫn DONE):
       - pdf-parse getImage({imageThreshold: 200}) → ảnh PNG theo trang
       - Trang 1: ảnh lớn nhất → upload "press-kit/<id>/cover.png" (bucket public)
       - Trang 2+: theo thứ tự → "press-kit/<id>/artist-1.png", "artist-2.png"...
       - persistImages: gán image_url vào artists[i]; field legacy coverImageUrl/artistBioImageUrl
         chỉ điền khi đang trống
  6. Job lỗi ở bước 2-4 → markFailed (ArtistBioJob FAILED + bioStatus FAILED) rồi ném lại
     để BullMQ retry (attempts: 5)

Admin duyệt hồ sơ (POST /admin/organizer-requests/:id/approve):
  └─ approveRequest (1 transaction): tạo Concert DRAFT và copy description, artistBio,
     artistBioImageUrl, coverImageUrl, artists từ request sang; liên kết lại ArtistBioJob
```

## 1.4. Dữ liệu

| Bảng/cột | Vai trò |
| --- | --- |
| `artist_bio_jobs` | 1 job AI cho 1 press kit: status PENDING/PROCESSING/DONE/FAILED, extractedText, generatedBio, modelName, errorMessage |
| `organizer_requests.artists` / `concerts.artists` (JSONB) | `[{name, bio, image_url}]` — nguồn hiển thị chính |
| `artist_bio`, `artist_bio_image_url`, `description`, `cover_image_url` | Field đơn legacy — fallback cho concert cũ + nơi chưa nâng cấp |
| `organizer_requests.bio_status` | Badge trạng thái AI trên UI admin/organizer |

Quy tắc chung: **AI chỉ điền vào chỗ trống, không đè dữ liệu nhập tay** (description, ảnh legacy).

## 1.5. Cấu hình (.env)

| Biến | Ý nghĩa |
| --- | --- |
| `AI_BASE_URL` | Endpoint OpenAI-compatible (mặc định Groq `https://api.groq.com/openai/v1`) |
| `AI_API_KEY` | Bắt buộc — thiếu thì job FAILED với "AI_API_KEY chưa được cấu hình" |
| `AI_MODEL` | Mặc định `llama-3.3-70b-versatile` (cần model hỗ trợ JSON mode) |
| `AI_MAX_SOURCE_CHARS` (8000) / `AI_MAX_OUTPUT_TOKENS` (2000) | Ngân sách token input/output |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Kho lưu trữ |
| `SUPABASE_PRESS_KIT_BUCKET` = "AI Artist Bio" (private) | Chứa PDF press kit |
| `SUPABASE_ARTIST_IMAGE_BUCKET` = "Bio Image" (public) | Chứa ảnh cover + nghệ sĩ (serve thẳng cho web) |

## 1.6. Hiển thị

| Nơi | Nguồn dữ liệu | Hành vi |
| --- | --- | --- |
| Audience `/concerts/:slug` tab "Nghệ sĩ" + Preview admin/organizer | `UiConcert.artists` (map từ `concert.artists`; concert cũ → mảng 1 phần tử từ field đơn) | Mỗi nghệ sĩ 1 khối ảnh+tên+bio; thiếu ảnh → placeholder "Chưa có ảnh" |
| Tab "Thông tin" | `description` | Giới thiệu concert (AI hoặc nhập tay) |
| Admin trang xem xét hồ sơ `/admin/organizer-requests/:id` | request.artists | Từng khối nghệ sĩ + badge bioStatus |
| Admin trang concert `/admin/concerts/:id` tab Bio | metadata.artists | Card từng nghệ sĩ + ảnh cover |

## 1.7. Giới hạn đã biết / xử lý sự cố

- **Ghép ảnh↔nghệ sĩ theo thứ tự**, không hiểu nội dung ảnh → press kit sai quy ước sẽ gán sai; admin phát hiện ở trang xem xét trước khi duyệt.
- Upload ảnh dùng `upsert: false` → BullMQ retry sau khi đã upload sẽ lỗi trùng key (nằm trong nhánh non-fatal, ảnh đợt đầu vẫn còn).
- PDF ảnh vector/CMYK có thể không trích được (`getImage` bỏ qua) → chỉ mất ảnh, bio vẫn có.
- Bio FAILED: xem `artist_bio_jobs.error_message`; nguyên nhân thường gặp: thiếu `AI_API_KEY`, PDF không tách được text (<20 ký tự), API AI lỗi/quota.
- Upload press kit lỗi Supabase → API trả **503 `storage_unavailable`** kèm nguyên nhân (đã từng gặp: project Supabase cũ bị xóa → ENOTFOUND).

---

# PHẦN 2 — IMPORT GUEST LIST (nhập khách mời từ Google Drive)

## 2.1. Chức năng làm gì

BTC quản lý danh sách khách mời (VIP/sponsor) bằng **file CSV đặt trong 1 thư mục Google Drive** của concert. Hệ thống tự quét thư mục lúc **0h giờ Việt Nam mỗi ngày** (cho concert sắp diễn ra) hoặc khi admin bấm "Nhập ngay", đọc CSV, tạo bản ghi khách mời gắn vào **khu GUEST**, để checker quét guest pass tại cổng.

## 2.2. Thiết lập ban đầu

1. BTC/Admin gán thư mục Drive cho concert:
   - Organizer: `PUT /organizer/concerts/:id/guest-drive-folder` (nhận link đầy đủ hoặc folder ID; chỉ được sửa **trước 0h ngày diễn** — sau mốc đó cron đã chạy nên khóa).
   - Admin: `PATCH /admin/concerts/:id` với `guest_drive_folder_id`, hoặc tab "Khách mời" trong trang `/admin/concerts/:id`.
2. **Share thư mục Drive (quyền Viewer)** cho service account: `storage@ticketbox-500711.iam.gserviceaccount.com` — thiếu bước này worker không đọc được file.
3. Bỏ các file `.csv` vào thư mục.

## 2.3. Định dạng CSV

- Bắt buộc có header, tối thiểu cột `full_name` (hoặc `name`) và `email`.
- Cột tùy chọn: `phone` (hoặc `phone_number`/`mobile`), `code` (hoặc `guest_code`), `note`, `concert_id` (nếu có và khác concert của job → dòng lỗi `WRONG_CONCERT`).
- Parser tự viết, hỗ trợ quote `"..."` và escape `""`; dòng trống bị bỏ qua; header được chuẩn hóa lowercase.

Mã lỗi từng dòng: `FULL_NAME_REQUIRED`, `EMAIL_REQUIRED`, `WRONG_CONCERT` — lưu kèm dữ liệu thô của dòng để admin xem.

## 2.4. Luồng chạy end-to-end

```
[Đường 1 — tự động 0h ICT]
worker-server khởi động → registerNightlyGuestImportSchedule():
  BullMQ upsertJobScheduler cron "0 0 * * *" (Asia/Ho_Chi_Minh) → job "scan-drive-folders"

[Đường 2 — thủ công]
Admin bấm "Nhập ngay" (tab Khách mời) → POST /admin/concerts/:id/guest-import-jobs
  → enqueue job "scan-drive-folders" với concert_id cụ thể

Worker guest-import xử lý "scan-drive-folders" → scanAndEnqueueGuestImports():
  - Không có concert_id (lịch 0h): quét mọi concert PUBLISHED có folder Drive,
    diễn ra trong 24h TỚI
  - Có concert_id (thủ công): quét đúng concert đó, bất kể trạng thái
  - Với từng file .csv trong folder (Drive API, service account):
      * Khử trùng: đã tồn tại GuestImportJob cho (concert, fileId) chưa FAILED → skip
        (job FAILED được phép chạy lại)
      * Tạo GuestImportJob PENDING (fileUrl = Drive file id) + enqueue job import

Worker xử lý job import 1 file:
  1. Job → PROCESSING
  2. downloadDriveFile(fileId) → text CSV → parseCsv (validate header)
  3. resolveGuestZoneId: seat zone code "GUEST" của concert — TỰ TẠO nếu chưa có
     (name "Khu khách mời", capacity 1000, sortOrder 99)
  4. Từng dòng: validate → upsert GuestList theo khóa (concertId, email)
     → import lại email cũ chỉ CẬP NHẬT thông tin, không tạo trùng; status = INVITED
  5. Dòng lỗi → GuestImportError (rowNumber, errorCode, errorMessage, rawData)
  6. Job → DONE (không lỗi) / PARTIAL (có dòng lỗi) / FAILED (lỗi cả file:
     tải Drive fail, CSV sai header...) kèm số liệu total/success/error
```

## 2.5. Dữ liệu

| Bảng | Vai trò |
| --- | --- |
| `concerts.guest_drive_folder_id` | Thư mục Drive nguồn của concert |
| `guest_import_jobs` | 1 job / 1 file CSV: status PENDING/PROCESSING/DONE/PARTIAL/FAILED + thống kê dòng |
| `guest_import_errors` | Lỗi từng dòng của job (xem trong UI admin) |
| `guest_list` | Khách mời: unique (concert_id, email); status INVITED → CHECKED_IN/CANCELLED; gắn seatZone GUEST |

## 2.6. UI theo dõi

- **Admin** `/admin/concerts/:id` tab "Khách mời" (`GuestListPanel`): gán/sửa folder, nút Nhập ngay, lịch sử job (badge trạng thái, số dòng), bấm "Xem lỗi" để xổ lỗi từng dòng, bảng khách mời (tên/email/SĐT che số/trạng thái).
- **Organizer**: xem danh sách guest concert của mình (`GET /organizer/concerts/:id/guests`) + gán folder Drive.
- **Checker**: guest pass được quét tại cổng thuộc khu GUEST (luồng check-in, đã có test gate).

## 2.7. Cấu hình (.env)

| Biến | Ý nghĩa |
| --- | --- |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Credentials service account đọc Drive (email trong 2.2) |
| `REDIS_URL` | BullMQ queue + scheduler |
| `DATABASE_URL` | Postgres |

Worker-server phải chạy thì cả lịch 0h lẫn "Nhập ngay" mới có tác dụng (API chỉ enqueue).

## 2.8. Giới hạn đã biết / xử lý sự cố

- File CSV **sửa nội dung nhưng giữ nguyên file id** sẽ KHÔNG được import lại (khử trùng theo fileId + job chưa FAILED). Muốn nhập lại: upload file mới (tên khác) vào folder.
- Lịch 0h chỉ quét concert **PUBLISHED diễn ra trong 24h tới** — demo/quay video dùng nút "Nhập ngay" (không phụ thuộc giờ).
- Job FAILED cả file: thường do chưa share folder cho service account, sai folder id, hoặc CSV thiếu header `full_name`/`email` — xem `error_message` của job.
- Số điện thoại hiển thị dạng che (`phone_masked`) trên API admin/organizer.

---

## Phụ lục — file code chính

| Chức năng | File |
| --- | --- |
| AI bio worker | `apps/worker-server/src/workers/ai-bio.worker.ts` |
| AI client (prompt/parse) | `apps/worker-server/src/workers/ai-bio.client.ts` |
| Tách ảnh press kit | `apps/worker-server/src/workers/press-kit-images.ts` |
| Upload/download Supabase | `packages/storage/src/supabase.ts` |
| Kickoff bio khi nộp hồ sơ | `apps/api-server/src/modules/organizer/organizer.repository.ts` (`kickoffArtistBio`) |
| Approve copy sang concert | `apps/api-server/src/modules/organizer-admin/organizer-admin.repository.ts` (`approveRequest`) |
| Guest import worker + CSV parser | `apps/worker-server/src/workers/guest-import.worker.ts` |
| Scheduler 0h + quét Drive | `apps/worker-server/src/schedulers/nightly-guest-import.scheduler.ts` |
| Drive API (list/download) | `packages/storage/src/drive.ts` |
| API guest list (admin/organizer) | `apps/api-server/src/modules/guest-list/*` |
| UI tab Khách mời | `apps/web/src/routes/admin/GuestListPanel.tsx` |
| UI tab Nghệ sĩ (audience/preview) | `apps/web/src/routes/audience/ConcertDetailPage.tsx` (`ConcertDetailView`) |
