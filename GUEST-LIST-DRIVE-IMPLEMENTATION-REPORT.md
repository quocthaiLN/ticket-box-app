# Báo cáo triển khai — Guest List import CSV qua Google Drive (scheduler 0h)

> Triển khai trên nhánh `develop`, 2026-06-26. **Build toàn monorepo xanh** (7 workspace).
> Báo cáo phân tích/kế hoạch gốc: [`GUEST-LIST-CSV-SCHEDULER-REPORT.md`](GUEST-LIST-CSV-SCHEDULER-REPORT.md).

---

## 1. Tóm tắt

Đã hoàn thiện luồng: **BTC bỏ file CSV khách mời vào thư mục Google Drive riêng của từng concert → scheduler chạy đúng 0h (giờ Việt Nam) → worker tải file từ Drive, validate, khử trùng theo email, gán vào zone VIP → nhân sự soát vé tra cứu & xác nhận tại cổng VIP.**

Các quyết định đã chốt được hiện thực hóa đầy đủ:
- Kho lưu trữ = **Google Drive** (mỗi concert một thư mục, BTC tự thêm/sửa/xoá file).
- Hệ thống **tự import** lúc **0h `Asia/Ho_Chi_Minh`** (BullMQ repeatable cron, không cần thư viện cron ngoài).
- Khử trùng theo **`(concertId, email)`**; mọi guest gán vào **zone VIP** duy nhất của concert.
- **Giữ file trên Drive cho audit** (không xoá).

Đã **loại bỏ phần mock cũ**: đọc CSV từ ổ đĩa local trong worker, alias route `/guest-list/*` lỗi thời, thư mục migration orphan rỗng, và dist `sponsor-upload` cũ.

---

## 2. Thay đổi theo file

### 2.1. Database / schema
| File | Thay đổi |
| --- | --- |
| `packages/database/prisma/schema.prisma` | `Concert.guestDriveFolderId` (mới); `GuestList`: `email` → **NOT NULL**, `phone` → **nullable**, đổi unique `@@unique([concertId, phone])` → **`@@unique([concertId, email])`**. |
| `.../migrations/20260626120000_guest_drive_import_email_key/migration.sql` (mới) | Thêm cột `guest_drive_folder_id`; drop unique cũ theo phone; phone DROP NOT NULL; dọn email NULL rồi SET NOT NULL; tạo unique theo email. |

### 2.2. Storage — Google Drive
| File | Thay đổi |
| --- | --- |
| `packages/storage/src/drive.ts` (mới) | `listConcertCsvFiles(folderId)` + `downloadDriveFile(fileId)` dùng `@googleapis/drive` (service account, scope `drive.readonly`). Đọc key từ `GOOGLE_SERVICE_ACCOUNT_JSON` (base64 hoặc JSON thô). |
| `packages/storage/src/index.ts` | export `./drive.js`. |
| `packages/storage/package.json` | thêm dependency `@googleapis/drive`. |

### 2.3. Queue
| File | Thay đổi |
| --- | --- |
| `packages/queue/src/jobs.ts` | `GuestImportScanData` (mới); cập nhật comment `csv_object_key` = Drive file id. |
| `packages/queue/src/enqueue.ts` | `enqueueGuestImportScan(concertId?)` (mới). |
| `packages/queue/src/index.ts` | export type + helper mới. |

### 2.4. Worker / Scheduler
| File | Thay đổi |
| --- | --- |
| `apps/worker-server/src/schedulers/nightly-guest-import.scheduler.ts` (mới) | `registerNightlyGuestImportSchedule(queue)` — BullMQ `upsertJobScheduler` cron `0 0 * * *` tz `Asia/Ho_Chi_Minh`; `scanAndEnqueueGuestImports(concertId?)` — quét Drive theo concert diễn ra trong 24h tới (hoặc 1 concert), tạo `GuestImportJob` + enqueue, khử trùng theo file id. |
| `apps/worker-server/src/workers/guest-import.worker.ts` | **Bỏ đọc local** → `downloadDriveFile`; branch xử lý job `scan-drive-folders`; validate **require `full_name`+`email`**; upsert `(concertId, email)`; gán **zone VIP** (`resolveVipZoneId`); không xoá file. |
| `apps/worker-server/src/server.ts` | đăng ký scheduler 0h. |

### 2.5. API (api-server)
| File | Thay đổi |
| --- | --- |
| `.../guest-list/guest-list.router.ts` | Bỏ alias cũ `/guest-list/import|search|scan`; **ADMIN-only** cho import; thêm `GET /admin/guest-import-jobs/:job_id` + `/errors`. |
| `.../guest-list.controller.ts` | `triggerGuestImport` (enqueue scan 1 concert), `getGuestImportJob`, `getGuestImportJobErrors`. |
| `.../guest-list.service.ts`, `.../guest-list.repository.ts` | `triggerConcertImport`, `getImportJob`, `listImportErrors`; search thêm **email** (OR + trả về email); guard phone null. |
| `.../guest-list.schema.ts`, `.../guest-list.types.ts` | Bỏ contract upload file_url; thêm type job-status/errors-page; `GuestSummary` thêm `email`. |
| `shared/http/problem-details.ts` | thêm `guestImportJobNotFound`. |
| `checkin.repository.ts`, `organizer.repository.ts` | guard `phone` nullable (giữ contract DTO là string). |
| `.../guest-list/description.md` | cập nhật mô tả luồng mới. |

### 2.6. Cấu hình & dọn dẹp
- `.env` + `.env.example`: thêm `GOOGLE_SERVICE_ACCOUNT_JSON`.
- Xoá thư mục migration orphan rỗng `20260626000000_add_sponsor_upload_token/`.
- Xoá dist cũ `apps/api-server/dist/modules/sponsor-upload/`.
- `scripts/check-guest-drive.mjs` + `scripts/sample-guest-list.csv` (phục vụ test).

---

## 3. Luồng hoạt động

```
BTC → upload CSV vào Drive: guest-csvs/<thư mục concert>/*.csv   (trước 0h)
        │
0h ICT  ▼   BullMQ cron "0 0 * * *" (Asia/Ho_Chi_Minh)
   scan-drive-folders → quét concert PUBLISHED diễn ra hôm đó & có guestDriveFolderId
        │   với mỗi file CSV: tạo GuestImportJob (PENDING) + enqueue import-guest-csv
        ▼
   worker guest-import → downloadDriveFile → parse CSV
        │   require full_name + email; gán zone VIP; upsert (concertId, email)
        ▼
   guest_list (INVITED)   +  guest_import_errors (dòng lỗi)   →  job DONE/PARTIAL/FAILED
        │
   Checker → GET /check-in/guests/search → POST /check-in/guests/scans  (cổng VIP)
```

---

## 4. Hướng dẫn thiết lập (setup)

### Bước 1 — Google Cloud service account
1. Vào [console.cloud.google.com](https://console.cloud.google.com) → tạo project (hoặc dùng project sẵn có).
2. **APIs & Services → Library → bật "Google Drive API"**.
3. **IAM & Admin → Service Accounts → Create service account** (không cần gán role).
4. Vào service account vừa tạo → **Keys → Add key → JSON** → tải file `service-account.json`.
5. Ghi lại **email** của service account (dạng `xxx@<project>.iam.gserviceaccount.com`).

### Bước 2 — Thư mục Drive cho concert
1. Trên Google Drive, tạo **một thư mục cho mỗi concert** (đặt tên tuỳ ý cho BTC dễ nhận).
2. **Share** thư mục đó cho email service account ở Bước 1, quyền **Viewer**.
3. Lấy **folder id** từ URL: `https://drive.google.com/drive/folders/<FOLDER_ID>`.

### Bước 3 — Cấu hình `.env`
Đặt service account JSON dưới dạng base64 vào `GOOGLE_SERVICE_ACCOUNT_JSON`:
- **PowerShell:** `[Convert]::ToBase64String([IO.File]::ReadAllBytes("service-account.json"))`
- **Git Bash:** `base64 -w0 service-account.json`

```env
GOOGLE_SERVICE_ACCOUNT_JSON=<chuỗi base64>
```
(Có thể dán JSON thô cũng được — helper tự nhận diện.)

### Bước 4 — Migration DB
> ⚠️ **Bắt buộc trước khi chạy** (upsert theo email cần unique index; code đã expect cột mới).
> Migration có lệnh `DELETE FROM guest_list WHERE email IS NULL` — nếu DB đang có guest email rỗng sẽ bị xoá. DB dev thường trống.

```bash
cd packages/database
npx prisma migrate deploy      # áp dụng lên DATABASE_URL hiện tại (Neon)
# hoặc dev sạch:  npx prisma migrate reset
npx prisma generate            # nếu chưa generate
```

### Bước 5 — Gán thư mục Drive cho concert
Hiện chưa có API set `guestDriveFolderId` (xem mục 6). Set tạm bằng SQL hoặc Prisma Studio:
```sql
UPDATE concerts SET guest_drive_folder_id = '<FOLDER_ID>' WHERE id = '<CONCERT_ID>';
```
hoặc `cd packages/database && npx prisma studio` → bảng `concerts` → điền `guest_drive_folder_id`.

### Bước 6 — Build & chạy
```bash
npm run build
npm run dev -w @ticketbox/api-server      # API
npm run dev -w @ticketbox/worker-server   # Worker + scheduler 0h
```
Khi worker khởi động sẽ log: `[nightly-guest-import] Scheduled at 0h Asia/Ho_Chi_Minh (cron "0 0 * * *")`.

---

## 5. Hướng dẫn test

### 5.1. Kiểm tra kết nối Drive (nhanh nhất)
Upload `scripts/sample-guest-list.csv` vào thư mục Drive của concert, rồi:
```bash
node scripts/check-guest-drive.mjs <FOLDER_ID>
```
Kỳ vọng: in ra số file CSV + 3 dòng đầu của file. Nếu lỗi → script gợi ý kiểm tra key/Drive API/quyền share.

### 5.2. Test nhập **thủ công** (không phải chờ 0h)
Đăng nhập tài khoản **ADMIN**, gọi:
```http
POST /v1/admin/concerts/<CONCERT_ID>/guest-import-jobs
Authorization: Bearer <admin_token>
```
→ `202 { "data": { "concert_id": "...", "status": "SCAN_ENQUEUED", "queue_job_id": "..." } }`.
Worker sẽ quét Drive của concert đó và import ngay (xem log `[nightly-guest-import] scan done ...` và `[guest-import] done ...`).

### 5.3. Xem kết quả job
Lấy `job_id` (worker log hoặc bảng `guest_import_jobs`):
```http
GET /v1/admin/guest-import-jobs/<JOB_ID>          → trạng thái + total/success/error rows
GET /v1/admin/guest-import-jobs/<JOB_ID>/errors   → lỗi từng dòng (row_number, error_code, raw_data)
```

### 5.4. Kết quả mong đợi với `sample-guest-list.csv`
| Dòng | Dữ liệu | Kết quả |
| --- | --- | --- |
| 2 | Nguyen Van A, vana@ | ✓ tạo guest |
| 3 | Tran Thi B, thib@, **không phone** | ✓ tạo guest (phone optional) |
| 4 | Le Van C, vanc@ | ✓ tạo guest |
| 5 | Pham Thi D, **không email** | ✗ lỗi `EMAIL_REQUIRED` |
| 6 | Nguyen Van A, vana@ (trùng email) | ✓ **upsert đè** dòng 2, không tạo trùng |

→ Job: `total_rows=5, success_rows=4, error_rows=1` → status **PARTIAL**. Số guest thực tế trong `guest_list` = **3** (vana, thib, vanc).

### 5.5. Tra cứu & check-in tại cổng
```http
GET  /v1/check-in/guests/search?concert_id=<ID>&gate_id=<GATE>&q=vana@example.com   (CHECKER)
POST /v1/check-in/guests/scans   { concert_id, device_id, gate_id, guest_id }       (CHECKER)
```
Tra cứu được theo **email/phone/tên**. Guest được gán zone VIP nên check-in tại cổng map với zone VIP sẽ `SUCCESS`; check-in lần 2 → `ALREADY_CHECKED_IN`; sai cổng → `WRONG_GATE`.

### 5.6. Test scheduler 0h mà không chờ tới nửa đêm
- Cách 1 (khuyến nghị): dùng trigger thủ công ở 5.2 — cùng đường code `scanAndEnqueueGuestImports`.
- Cách 2: tạm đổi cron trong `nightly-guest-import.scheduler.ts` thành ví dụ `"*/2 * * * *"` (mỗi 2 phút), build lại, chạy worker, quan sát log; **nhớ trả lại `"0 0 * * *"`**.

---

## 6. Ràng buộc, lưu ý & việc còn lại

**Ràng buộc/giả định đã hiện thực:**
- CSV của nhãn hàng **bắt buộc có cột `email`** (và `full_name`/`name`); thiếu email → ghi lỗi, bỏ qua dòng, không fail cả file.
- Concert phải có **đúng một khu VIP** — worker resolve zone có `code` chứa "VIP", hoặc nếu concert chỉ có 1 zone thì dùng zone đó; không resolve được → job `FAILED` ("Không tìm thấy seat zone VIP").
- Scheduler chạy **đúng 0h ICT**: file BTC thêm/sửa **sau 0h sẽ không được nhập đêm đó** (đúng theo "một lần 0h"). Khuyến nghị deadline upload trước 0h. Có thể chạy lại bằng trigger thủ công (5.2).
- File CSV **được giữ lại** trên Drive cho audit.
- Khử trùng theo email: 2 dòng cùng email → dòng sau **đè** dòng trước.

**Việc còn lại (nhỏ, không chặn luồng chính):**
- Chưa có **API set `guestDriveFolderId`** — hiện set qua SQL/Prisma Studio (mục 5/Bước 5). Đề xuất thêm field này vào luồng tạo/sửa concert của admin sau.
- Migration đặt `email` NOT NULL bằng cách **xoá** hàng email NULL — nếu môi trường có dữ liệu guest thật phải backfill email trước khi chạy.

**Trạng thái build:** `npm run build` xanh toàn bộ (redis, database, queue, storage, api-server, web, worker-server). Migration **chưa được áp dụng tự động** (DB là Neon cloud) — chạy theo mục 4/Bước 4.
