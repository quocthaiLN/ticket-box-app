# Báo cáo & Kế hoạch hoàn thiện — Guest List Import CSV theo lịch (Scheduler 0h ICT)

> Phạm vi: import danh sách khách mời VIP của nhãn hàng tài trợ từ file CSV mà **ban tổ chức upload lên Supabase**, được **scheduler chạy lúc 0h (Asia/Ho_Chi_Minh)** nhập vào hệ thống để nhân sự soát vé xác nhận khách tại cổng VIP.
>
> Nhánh khảo sát: `develop` (HEAD `cabde69`). Ngày: 2026-06-26.

---

## 1. Tóm tắt điều hành

Nền tảng dữ liệu và nghiệp vụ import/check-in khách mời **đã có sẵn và khá tốt** trên `develop`: schema 3 bảng đầy đủ ràng buộc, API tạo job, worker parse CSV + upsert chống trùng, luồng check-in guest tại cổng có validate zone–gate. Đây là phần "khó" và nó đã chạy.

Tuy nhiên, **đúng yêu cầu lần này (BTC upload Supabase → scheduler 0h ICT) thì hệ thống CHƯA đáp ứng**, vì ba khoảng trống cốt lõi:

1. **Không có scheduler nào** cho guest-import trên `develop`. Luồng hiện tại enqueue **ngay khi gọi API**, không hề chạy theo lịch. Scheduler `nightly-guest-import` chỉ tồn tại dưới dạng artifact `dist/` cũ (chưa từng commit vào `src`/git) và kể cả nó cũng chạy **mỗi giờ**, không phải đúng 0h.
2. **Worker không đọc được file từ Supabase.** Hàm đọc CSV chỉ resolve **file trên ổ đĩa local**; URL `https://...supabase...` sẽ ném lỗi "not readable locally".
3. **Chưa wiring bucket guest-csv trên Supabase** (không có biến env, không có helper download riêng; `supabase.ts` đang hardcode bucket press-kit).

Ngoài ra có một số vấn đề phụ và **vệ sinh kho code** (migration orphan rỗng, lệch role/alias theo Sprint 6, thiếu endpoint xem trạng thái job).

> **Quan trọng về phạm vi:** Bản "nhãn hàng tự nhập khách qua magic-link" ghi trong memory `project_guest_list_sponsor` (2026-06-26) **chưa bao giờ được merge vào `develop`** — `git log --all` không có lịch sử của `sponsor-upload/*.ts` hay `nightly-guest-import.scheduler.ts`. Những gì còn sót lại chỉ là thư mục rỗng + artifact `dist/`. Báo cáo này dựa trên code **thực tế đang có**, không dựa trên bản magic-link đã bị bỏ.

---

## 2. Hiện trạng đang có (chạy được trên `develop`)

### 2.1. Tầng dữ liệu — `packages/database/prisma/schema.prisma`
| Model | Điểm chính | Vị trí |
| --- | --- | --- |
| `GuestImportJob` | `status: ImportStatus` (PENDING/PROCESSING/DONE/FAILED/PARTIAL), `fileUrl`, `uploadedById`, đếm `total/success/error/skippedRows`, `started/completedAt`, `errorMessage`. Index `(concertId, status)`. | `schema.prisma:707` |
| `GuestList` | **`@@unique([concertId, phone])`** + `@@unique([concertId, code])`, `seatZoneId` nullable, `status: GuestStatus` (INVITED/CHECKED_IN/CANCELLED), FK ghép `seatZone (id, concertId)`. | `schema.prisma:732` |
| `GuestImportError` | `rowNumber`, `rawData(JsonB)`, `errorCode`, `errorMessage`, **`@@unique([jobId, rowNumber, errorCode])`**. | `schema.prisma:763` |

→ Khớp với đặc tả `blueprint/specs/05-guest-list-import.md` và `blueprint/api-design/guest-list-api.md`. **Không cần đổi schema cho luồng chính** (trừ khi chọn mô hình upload cần thêm cờ — xem mục 5/§E).

### 2.2. API — `apps/api-server/src/modules/guest-list/`
- `POST /guest-list/import` **và** `POST /admin/concerts/:concert_id/guest-import-jobs` → `importGuests` (role `ORGANIZER, ADMIN`) — `guest-list.router.ts:11`.
- Body nhận **JSON** `{ concert_id, file_url | file_object_key, default_zone_id?, dry_run? }` (`guest-list.schema.ts:8`). **Không phải multipart** — tức là file phải **đã nằm sẵn trên storage**, API chỉ ghi nhận URL.
- `createImportJob` tạo job `PENDING` rồi **`enqueueGuestImport(...)` ngay lập tức**; nếu enqueue lỗi thì set job `FAILED` (`guest-list.repository.ts:31`).
- Tra cứu guest: `GET /guest-list/search`, `/check-in/guests/search`, `/admin/concerts/:concert_id/guests` — mask phone, lọc theo zone gate cho phép (`guest-list.repository.ts:103`).
- Check-in guest tại cổng: `POST /guest-list/scan`, `/check-in/guests/scans` — lock `FOR UPDATE`, Serializable, validate concert + gate-zone, chặn trùng, ghi `checkin_logs` (`guest-list.repository.ts:136`). Khớp `blueprint/specs/13-guest-checkin.md`.

### 2.3. Worker — `apps/worker-server/src/workers/guest-import.worker.ts`
Đã implement đầy đủ và **đúng tinh thần spec 05**:
- Parser CSV tự viết (xử lý dấu nháy kép, CRLF, ô có dấu phẩy) — `parseCsvRecords()`.
- Header bắt buộc `full_name|name` + `phone`; validate từng dòng; normalize phone; resolve zone theo `seat_zone_id|zone_id` hoặc `zone|zone_code`.
- **Upsert theo `(concertId, phone)`** → idempotent, import lại không tạo trùng.
- Dòng lỗi ghi `guest_import_errors` (`skipDuplicates`), **không fail cả file**; set `DONE`/`PARTIAL`/`FAILED`.
- Đã đăng ký trong `apps/worker-server/src/server.ts:43` (`createGuestImportWorker()`).

### 2.4. Hạ tầng storage & queue
- `packages/queue`: queue `GUEST_IMPORT = "guest-import"`, `getGuestImportQueue()`, `enqueueGuestImport()` đủ dùng. `bullmq ^5.0.0` (hỗ trợ repeatable job theo cron + timezone — quan trọng cho mục 6).
- `packages/storage/src/supabase.ts`: client Supabase thật nhưng **chỉ phục vụ press-kit** (`createPressKitUploadUrl`, `downloadPressKit`), hardcode bucket `SUPABASE_PRESS_KIT_BUCKET`.
- `packages/storage/src/client.ts`: **local stub** (sinh URL giả `localhost:9000`), kèm `buildObjectKey('guest-csv', owner, name)` → tiền tố `guest-imports/...`.
- `.env` hiện đã có `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PRESS_KIT_BUCKET="AI Artist Bio"` (thêm cho AI bio). **Chưa có biến bucket guest-csv.** `.env` được `.gitignore` (an toàn).
- Pattern tải file Supabase đã chạy thật: `ai-bio.worker.ts:9` dùng `downloadPressKit` từ `@ticketbox/storage` → đây là **mẫu để fix worker guest** (mục 6/Phase 1).

---

## 3. Khoảng trống so với yêu cầu (chi tiết)

| # | Khoảng trống | Mức độ | Bằng chứng |
| --- | --- | --- | --- |
| **A** | **Không có scheduler 0h.** API enqueue ngay; `server.ts` chỉ chạy reminder + expire-holds. Scheduler nightly chỉ là `dist/` cũ (chưa commit), lại chạy theo giờ + cửa sổ `[+12h,+36h]`. | Chặn | `server.ts:54`, `dist/.../nightly-guest-import.scheduler.js` |
| **B** | **Không có cron + timezone.** Các scheduler hiện dùng `setInterval` thuần, không hiểu múi giờ → không thể "đúng 0h Asia/Ho_Chi_Minh". | Chặn | `reminder.scheduler.ts:61` |
| **C** | **Worker không tải được CSV từ Supabase.** `readTextSource()`→`resolveLocalPath()` chỉ nhận `file://`/đường dẫn local/`s3://`(strip về local). `https://...supabase...` → trả undefined → ném "not readable locally". | Chặn | `guest-import.worker.ts:359-383` |
| **D** | **Chưa wiring bucket guest-csv Supabase.** Thiếu `SUPABASE_GUEST_CSV_BUCKET`, chưa tạo bucket private, chưa có `downloadGuestCsv()`. | Chặn | `supabase.ts:4`, `.env.example` (không có) |
| **E** | **Chưa định nghĩa mô hình upload & cách scheduler "tìm" file.** BTC upload qua API (tạo job) rồi scheduler nhập? hay BTC thả thẳng file vào bucket rồi scheduler **liệt kê bucket** + map file→concert? Hai hướng kéo theo code rất khác. | Chặn (cần chốt) | — |
| **F** | **Thiếu endpoint xem trạng thái/lỗi job.** Spec yêu cầu `GET /admin/guest-import-jobs/:id` và `/errors`; router không có → Admin không xem được số dòng thành công/lỗi (vi phạm tiêu chí chấp nhận). | Cao | `guest-list.router.ts` (thiếu) |
| **G** | **Lệch role & alias (Sprint 6 A4).** Router vẫn dual-role `ORGANIZER+ADMIN` và còn alias `/guest-list/search`, `/guest-list/scan` mà blueprint yêu cầu trả 404. Blueprint còn nói import là **ADMIN-only** (ORGANIZER→403). | Trung bình | `guest-list.router.ts:11-19`, `guest-list-api.md:47,259` |
| **H** | **Migration orphan hỏng.** `migrations/20260626000000_add_sponsor_upload_token/` là **thư mục rỗng, không track git, không có `migration.sql`** → Prisma migrate sẽ lệch/báo lỗi. Tàn dư của session magic-link đã bỏ. Kèm artifact `dist/` cũ (sponsor-upload, nightly scheduler) gây nhiễu. | Trung bình | `ls migrations/...add_sponsor_upload_token` rỗng |
| **I** | **`default_zone_id` không được dùng.** API parse `default_zone_id` nhưng không lưu vào job, không truyền cho worker; worker không có fallback zone. Dòng CSV thiếu zone → guest `seatZoneId=null` → **không check-in được** (spec 13 chặn null zone). | Trung bình | `guest-list.schema.ts:15`, `guest-import.worker.ts:232-248` |
| **J** | **`dry_run` chưa implement.** API nhận & trả `dry_run` nhưng worker luôn upsert. | Thấp | `guest-import.worker.ts` (không nhánh dry-run) |
| **K** | **Phụ:** `description.md` ghi "CSV import remains scaffolded for Sprint 4" (lỗi thời); worker **không gửi notification/AuditLog** cho Admin khi import xong. | Thấp | `guest-list/description.md:5` |

---

## 4. Ràng buộc cần tôn trọng

**Nghiệp vụ (đã đạt — giữ nguyên khi sửa):**
- `guest_list(concert_id, phone)` unique; import lại idempotent (upsert).
- Không rollback cả file vì một dòng lỗi; mỗi dòng lỗi có `row_number` + `raw_data`.
- Không gọi API hệ thống nhãn hàng — chỉ CSV một chiều.
- Import **không được ảnh hưởng luồng mua vé** (đang tách queue/worker riêng → ổn).
- Check-in: guest phải có `seat_zone_id` map đúng gate qua `checkin_gate_zones`; null zone bị chặn mặc định → liên quan trực tiếp tới §I.

**Kỹ thuật/vận hành (mới, cần xử lý):**
- **Múi giờ:** 0h `Asia/Ho_Chi_Minh` = **17:00 UTC hôm trước**. Server nhiều khả năng chạy UTC → **bắt buộc cron tz-aware**, không dùng giờ local máy.
- **Bảo mật:** bucket guest CSV phải **private**; chỉ backend dùng `service_role` key; upload nên qua **signed URL**. CSV chứa PII (tên + SĐT khách) → không để public, cân nhắc xóa file sau khi import.
- **Thời điểm file sẵn sàng:** nhãn hàng gửi "đêm trước ngày diễn". Nếu chạy **đúng và chỉ** 0h mà file lên lúc 0h05 → **lỡ cả đêm**. Cần cơ chế bắt trễ (chạy lại/cửa sổ tới giờ diễn) hoặc chấp nhận rủi ro (cần chốt — §3 câu hỏi).
- **Idempotency scheduler:** một đêm chỉ nhập mỗi file/đợt một lần; dùng `jobId = guestImportJob.id` để BullMQ tự khử trùng; bỏ qua job đã `DONE`.

---

## 5. Kế hoạch hoàn thiện (theo pha, có tiêu chí verify)

> Thứ tự tối ưu: chốt câu hỏi (mục 6) → Phase 0 → 1 → 2 → 3 → 4. Phase 1 và 2 độc lập nhau, có thể làm song song.

### Phase 0 — Vệ sinh & chốt thiết kế (gỡ vướng)
- Xóa thư mục migration orphan `20260626000000_add_sponsor_upload_token/`; (tùy chọn) dọn `dist/` cũ.
- Cập nhật `guest-list/description.md`.
- Chốt các câu hỏi mục 6 (đặc biệt **mô hình upload** và **role**).
- **Verify:** `prisma migrate status` sạch; `npm run build` xanh (nhớ `prisma generate` trước).

### Phase 1 — Storage: tải CSV từ Supabase
- Thêm `SUPABASE_GUEST_CSV_BUCKET` vào `.env` + `.env.example`; tạo bucket **private** trên Supabase.
- Bổ sung `downloadGuestCsv(objectKey)` (và nếu cần `createGuestCsvUploadUrl()`) trong `storage/supabase.ts`, soi theo `downloadPressKit`. Tách bucket theo tham số thay vì hardcode.
- Sửa worker: thay/extend `readTextSource()` để **tải từ Supabase** khi nguồn là object key bucket; giữ fallback local cho dev.
- **Verify:** unit test đọc 1 CSV mẫu trên bucket sandbox ra đúng nội dung.

### Phase 2 — Scheduler 0h ICT
- Viết `nightly-guest-import.scheduler.ts` dùng **BullMQ repeatable job**: `repeat: { pattern: "0 0 * * *", tz: "Asia/Ho_Chi_Minh" }` (không cần thêm thư viện). Đăng ký trong `server.ts` + graceful shutdown.
- Logic "tìm việc" theo **mô hình upload đã chốt** (§6 Q1):
  - *Mô hình A (qua API):* quét `GuestImportJob` `PENDING` của concert sắp diễn → enqueue (jobId = job.id). → cần đổi API để **không** enqueue ngay (chỉ tạo PENDING).
  - *Mô hình B (thả bucket):* **list bucket**, map file→concert theo quy ước path (vd `guest-imports/{concertId}/*.csv`), tạo job + enqueue; đánh dấu file đã xử lý (move/xóa/ghi bảng).
- Chọn cửa sổ concert (vd `startsAt` trong [hôm nay, hôm nay+1] theo ICT) để chỉ nhập đúng đêm.
- **Verify:** test với fake timer / hàm tick gọi tay → job được enqueue đúng tập concert, chạy lại không nhân đôi.

### Phase 3 — Hoàn chỉnh API & nghiệp vụ
- Thêm `GET /admin/guest-import-jobs/:job_id` và `/errors` (đọc từ `guest_import_jobs` / `guest_import_errors`, phân trang cursor như chuẩn dự án).
- Xử lý `default_zone_id` (lưu vào job → truyền worker → fallback khi dòng thiếu zone) **hoặc** quyết định bắt buộc mọi dòng có zone (§I).
- Quyết định giữ/triển khai `dry_run`.
- Căn chỉnh role/alias theo Sprint 6 A4 (sau khi chốt Q4).
- (Tùy chọn) notify Admin/BTC khi import xong kèm số liệu.
- **Verify:** Postman/integration chạy đủ tiêu chí chấp nhận spec 05 & 13.

### Phase 4 — Kiểm thử & nghiệm thu
- Unit: parser (ô có dấu phẩy/nháy/CRLF, BOM Excel), trùng phone, thiếu zone, sai concert, dòng rỗng.
- Integration: *upload → tick 0h (giả lập) → import → search → scan tại cổng đúng/sai zone*.
- Đối chiếu toàn bộ "Tiêu chí chấp nhận" trong `blueprint/specs/05` và `13`.

---

## 6. Câu hỏi cần chốt để hoàn thiện luồng

> Đây là các điểm quyết định thực sự ảnh hưởng tới code. Sắp theo độ ưu tiên.

1. **(Quan trọng nhất) Mô hình upload:** BTC đưa CSV vào hệ thống bằng cách nào?
   - **A.** Gọi **API TicketBox** (tạo `GuestImportJob` row, file qua signed URL) rồi scheduler 0h mới import các job PENDING; **hay**
   - **B.** **Thả file thẳng vào bucket Supabase** (không qua API), scheduler 0h **liệt kê bucket**, map file→concert, tự tạo job + import.
2. **Nếu chọn B — quy ước map file→concert:** theo path (vd `guest-imports/{concertId}/*.csv`)? theo tên file? hay file manifest? Và `uploadedById` ghi là ai (tài khoản hệ thống)?
3. **Ngữ nghĩa thời điểm chạy:** đúng **một lần 0h** cho concert diễn **trong ngày đó**? hay cần **cửa sổ an toàn** (chạy 0h rồi lặp lại tới giờ diễn) để bắt file lên trễ? Xác nhận tiêu chí chọn concert ("đêm trước ngày diễn").
4. **Phân quyền:** **ORGANIZER (BTC)** được phép upload/kích hoạt import (đúng câu chữ "Ban tổ chức sẽ upload"), hay **ADMIN-only** như blueprint (BTC chỉ xem)? Hai hướng lệch nhau ở Sprint 6 A4.
5. **Zone mặc định & guest null-zone:** mọi dòng CSV **bắt buộc có zone**? hay cho `default_seat_zone_id` mỗi lần import? (Dòng thiếu zone → guest **không check-in được** ở cổng.)
6. **File lên trễ / re-upload:** nếu file tới sau 0h hoặc upload lại cùng file, kỳ vọng xử lý ra sao? (Dữ liệu đã được upsert chống trùng, nhưng có **xử lý lại object** không — đánh dấu đã xử lý bằng cách move/xóa/ghi bảng?)
7. **Đường "import ngay" thủ công:** có giữ một endpoint để ops nhập tay khi đêm đó scheduler lỗi không? (Endpoint enqueue-ngay hiện tại có thể tái dùng.)
8. **`dry_run`:** có cần cho mốc này không, hay bỏ?
9. **Thông báo hoàn tất:** Admin/BTC có cần notification + số liệu (success/error) khi import xong? (Tối thiểu là 2 endpoint GET ở §F.)
10. **Định dạng/encoding CSV của nhãn hàng:** xác nhận các cột (full_name, phone, zone, email, code, note), encoding (UTF-8 vs UTF-16/BOM Excel, dấu tiếng Việt) và **định dạng SĐT** (0xxx nội địa vs +84) để normalize/dedup cho đúng.

---

## 7. Phụ lục — Bản đồ file liên quan

| Thành phần | Đường dẫn |
| --- | --- |
| Đặc tả nghiệp vụ | `blueprint/specs/05-guest-list-import.md`, `blueprint/specs/13-guest-checkin.md` |
| Thiết kế API | `blueprint/api-design/guest-list-api.md` |
| Schema | `ticket-box-app/packages/database/prisma/schema.prisma:707-777` (+ enum `134`, `144`) |
| API module | `ticket-box-app/apps/api-server/src/modules/guest-list/*` |
| Worker import | `ticket-box-app/apps/worker-server/src/workers/guest-import.worker.ts` |
| Đăng ký worker/scheduler | `ticket-box-app/apps/worker-server/src/server.ts` |
| Mẫu scheduler (interval) | `ticket-box-app/apps/worker-server/src/schedulers/reminder.scheduler.ts` |
| Scheduler cũ (chỉ còn dist) | `ticket-box-app/apps/worker-server/dist/schedulers/nightly-guest-import.scheduler.js` |
| Queue/enqueue | `ticket-box-app/packages/queue/src/{queues,enqueue,jobs}.ts` |
| Storage Supabase (mẫu) | `ticket-box-app/packages/storage/src/supabase.ts` (`downloadPressKit`) |
| Storage stub + buildObjectKey | `ticket-box-app/packages/storage/src/{client,buckets}.ts` |
| Migration orphan cần xóa | `ticket-box-app/packages/database/prisma/migrations/20260626000000_add_sponsor_upload_token/` (rỗng) |

---

## 8. Cập nhật — Quyết định đã chốt (2026-06-26)

### 8.1. Chốt từ trả lời của BTC
| Vấn đề | Quyết định |
| --- | --- |
| Mô hình upload (Q1) | **B — thả thẳng vào kho lưu trữ.** BTC tự add/sửa/xóa file trong **prefix riêng của từng concert**; hệ thống import **tự động**, BTC **không** gọi API import. |
| Thời điểm chạy (Q3) | **Đúng một lần 0h `Asia/Ho_Chi_Minh`** (không cửa sổ bắt trễ). |
| Phân quyền (Q4) | Import là **tiến trình hệ thống** (không do người kích hoạt). BTC chỉ có quyền **ghi file** vào kho. |
| Zone (Q5) | Gán **toàn bộ guest vào zone VIP** của concert — CSV **không cần** cột zone. |

### 8.2. Thiết kế kho lưu trữ (điểm BTC đang băn khoăn)

> ⚠️ **Cập nhật vòng 2:** BTC muốn **đổi khỏi Supabase** sang kho thân thiện hơn (Supabase chỉ quen với dev). Mô hình "mỗi concert một thư mục/prefix riêng" bên dưới **vẫn giữ nguyên**, nhưng **backend kho đang được chọn lại** — xem §8.5.

```
Supabase Storage — 1 bucket private: guest-csvs
  └── {concertId}/                     ← "nơi lưu riêng" của mỗi concert (path prefix)
        ├── khach-moi-dot-1.csv        ← BTC add/sửa/xóa tự do tại đây
        ├── khach-moi-bo-sung.csv
        └── ...
```
**Vì sao dùng prefix path, KHÔNG tạo bucket-per-concert:** Supabase giới hạn số bucket và tạo bucket động mỗi concert là anti-pattern. "Mỗi concert một nơi riêng" được thể hiện chuẩn bằng prefix `{concertId}/` trong **một** bucket. Quyền ghi của BTC giới hạn đúng theo prefix concert của họ (qua signed URL hoặc trang upload nội bộ của TicketBox).

**Luồng tự động:**
1. BTC upload CSV vào `guest-csvs/{concertId}/` (bất kỳ lúc nào **trước 0h**).
2. **0h ICT mỗi ngày**, scheduler quét các concert có `startsAt` trong ngày đó → với mỗi concert, **list** `guest-csvs/{concertId}/` → tạo `GuestImportJob` cho từng file → enqueue.
3. Worker **tải file từ Supabase** → parse → **gán toàn bộ guest vào zone VIP của concert** → upsert `(concertId, phone)`.
4. Nhân sự soát vé tra cứu/scan guest tại cổng VIP (luồng check-in đã có sẵn).

### 8.3. Vi-quyết định mới phát sinh (đề xuất default — cần xác nhận nhẹ)
1. **`uploadedById` của job:** worker tự động vẫn cần user id, field hiện **không nullable** → đề xuất gán **organizer sở hữu concert** (không phải đổi schema). PA khác: tài khoản system / cho null + đổi schema.
2. **Nhận diện "zone VIP"** khi concert có nhiều khu: đề xuất quy ước `seat_zone.code` ∈ {VIP, SVIP}. **Nếu concert có cả VIP lẫn SVIP thì gán vào khu nào?** (ảnh hưởng check gate-zone khi soát vé — cần chốt).
3. **File thêm/sửa sau 0h sẽ KHÔNG được nhập** (hệ quả "đúng một lần 0h") → nên quy định deadline upload cho BTC trước 0h.
4. **PII:** CSV chứa tên + SĐT → **xóa file sau khi nhập** hay giữ cho audit? Đề xuất giữ tối đa N ngày rồi tự xóa.

### 8.4. Tác động lên kế hoạch (delta so với mục 5)
- **Phase 1 (storage):** thêm helper `listGuestCsvs(concertId)` + `downloadGuestCsv(objectKey)` trong `storage/supabase.ts`; thêm `SUPABASE_GUEST_CSV_BUCKET`; tạo bucket private + cấu trúc prefix.
- **Phase 2 (scheduler):** BullMQ repeatable `{ pattern: "0 0 * * *", tz: "Asia/Ho_Chi_Minh" }`, **không** cửa sổ bắt trễ; logic "tìm việc" = **list bucket theo concert diễn ra hôm đó** (Model B).
- **Phase 3 (API):** endpoint import của BTC **không còn cần** (bỏ, hoặc giữ làm đường ops thủ công cho Admin); thay `default_zone_id` bằng **auto-resolve zone VIP của concert**. Vẫn cần `GET /admin/guest-import-jobs/:id` + `/errors` để Admin theo dõi.

### 8.5. Điều chỉnh vòng 2 (chốt thêm 2026-06-26)

| Điểm | Quyết định mới | Tác động code |
| --- | --- | --- |
| Khu vực | **Chỉ có VIP** (concert không có SVIP) | Worker gán mọi guest vào **seat_zone VIP duy nhất** của concert; CSV **không cần** cột zone. Resolve zone theo concert (1 khu VIP). Bỏ logic `default_zone_id`/resolve theo dòng. |
| Khử trùng | **Upsert theo `(concertId, email)`** (thay cho `(concertId, phone)`) | **Đổi schema + migration**: thêm `@@unique([concertId, email])`, **nới** `@@unique([concertId, phone])`; **email NOT NULL**. Worker đổi validate: bắt buộc `full_name` + `email` (phone optional), upsert theo `concertId_email`. **CSV nhãn hàng phải có cột `email`.** |
| Lưu file | **Giữ file cho audit** (không xóa sau import) | Bỏ bước cleanup; cân nhắc retention sau. |
| `uploadedById` | Gán **organizer sở hữu concert** | Không đổi schema. |
| Kho lưu trữ | **Google Drive** (đã chốt) — mỗi concert một thư mục Drive | Thay helper Supabase bằng **Drive client**; scheduler list/download qua Drive API. Chi tiết §8.6. |

**Lưu ý về khử trùng theo email (quan trọng):**
- Email là "danh tính" khách mời trong 1 concert → **mọi dòng phải có email hợp lệ**; thiếu email → ghi lỗi `EMAIL_REQUIRED`, bỏ qua (nếu không sẽ tạo trùng do Postgres cho nhiều NULL).
- Hai dòng cùng email (khác tên/sđt) trong cùng concert → **dòng sau ghi đè dòng trước**. Xác nhận đây là hành vi mong muốn.
- Cổng soát vé đang tra theo **phone hoặc tên** (`searchGuests`) → nên bổ sung **tra cứu theo email**.

**Cập nhật kế hoạch (delta vòng 2):**
- **Schema/DB:** migration đổi unique key sang email + email NOT NULL (Phase 0/1).
- **Worker:** validate require `full_name`+`email`; upsert `concertId_email`; auto-resolve **zone VIP duy nhất**; **không** xóa file.
- **Storage:** helper `list/download` theo backend đã chọn (Phase 1) — **không** dùng Supabase trực tiếp cho BTC.
- **API/Cổng:** thêm tra cứu guest theo email (Phase 3).

### 8.6. Kho lưu trữ đã chốt — Google Drive

**Mô hình map file → concert:**
- Mỗi concert ↔ **một thư mục Drive** (BTC đặt tên tùy ý, thêm/sửa/xoá file CSV thoải mái).
- Liên kết bằng **folder id**: thêm `guestDriveFolderId String?` vào model `Concert`; admin/BTC dán link thư mục khi tạo concert (hoặc cấu hình sau).
- **Service account** (Google Cloud, bật Drive API) được **share** từng thư mục (quyền Viewer).

**Luồng scheduler 0h ICT:**
1. Quét concert có `startsAt` trong ngày đó **và** có `guestDriveFolderId`.
2. Với mỗi concert: Drive `files.list(q="'<folderId>' in parents and mimeType='text/csv'")` → lấy danh sách file CSV.
3. Mỗi file: `files.get(fileId, alt=media)` tải nội dung → tạo `GuestImportJob` (`fileUrl` = Drive file id/link, **giữ cho audit**) → enqueue. `jobId = guestImportJob.id` để khử trùng.
4. Worker đọc CSV (từ Drive thay vì Supabase) → validate `full_name`+`email` → upsert `(concertId, email)` → gán **zone VIP duy nhất**.

**Phụ thuộc & cấu hình mới:**
- Package `googleapis`; env `GOOGLE_SERVICE_ACCOUNT_JSON` (base64 của JSON key) [+ optional `GOOGLE_DRIVE_ROOT_FOLDER_ID`].
- Helper mới `packages/storage/src/drive.ts`: `listConcertCsvFiles(folderId)`, `downloadDriveFile(fileId)`.

**Việc cần BTC/DevOps chuẩn bị (code không làm thay được):**
1. Tạo Google Cloud project + bật Drive API + service account + tải JSON key.
2. Share thư mục mỗi concert cho email service account (Viewer).
3. Nạp `GOOGLE_SERVICE_ACCOUNT_JSON` vào `.env`.
4. Gán `guestDriveFolderId` cho từng concert (dán link thư mục Drive).

**Bản đồ thay đổi code (tổng hợp cuối):**
| File/Khu vực | Thay đổi |
| --- | --- |
| `schema.prisma` + migration | `Concert.guestDriveFolderId`; `GuestList`: `@@unique([concertId, email])`, nới `[concertId, phone]`, `email` NOT NULL |
| `packages/storage/src/drive.ts` (mới) | Drive client: list + download |
| `packages/storage/src/index.ts` | export drive helpers |
| `apps/worker-server/src/schedulers/nightly-guest-import.scheduler.ts` (mới) | BullMQ repeatable `0 0 * * *` tz ICT; quét concert + folder → enqueue |
| `apps/worker-server/src/server.ts` | đăng ký scheduler + graceful shutdown |
| `apps/worker-server/src/workers/guest-import.worker.ts` | tải Drive (bỏ local-only); require `email`; upsert `concertId_email`; resolve zone VIP; không xoá file |
| `apps/api-server/.../guest-list.router.ts` + repo | bỏ enqueue-ngay của BTC (để scheduler lo); thêm `GET /admin/guest-import-jobs/:id` + `/errors`; thêm tra cứu guest theo email |
| Dọn dẹp | xoá migration orphan rỗng `20260626000000_add_sponsor_upload_token/` |

---
*Báo cáo lập tự động sau khi rà soát code thực tế trên `develop`. Mọi trích dẫn `file:line` theo thời điểm 2026-06-26. Mục 8 (8.1–8.4) chốt vòng 1; 8.5–8.6 chốt vòng 2 + Google Drive với BTC.*
