# Guest List — Báo cáo triển khai & hướng dẫn cài đặt (toàn bộ luồng)

> Cập nhật 2026-06-26. **Build xanh toàn monorepo (7 workspace).** Báo cáo này gộp toàn bộ quá trình: backend, frontend, dữ liệu, cài đặt và cách test.
> Tài liệu chi tiết kèm theo: [`GUEST-LIST-CSV-SCHEDULER-REPORT.md`](GUEST-LIST-CSV-SCHEDULER-REPORT.md) (phân tích), [`GUEST-LIST-DRIVE-IMPLEMENTATION-REPORT.md`](GUEST-LIST-DRIVE-IMPLEMENTATION-REPORT.md) (backend chi tiết), [`GUEST-LIST-E2E-COMPLETION-PLAN.md`](GUEST-LIST-E2E-COMPLETION-PLAN.md) (kế hoạch + vấn đề).

---

## 1. Tổng quan & kiến trúc

Khách mời VIP của nhãn hàng tài trợ được nhập từ **file CSV trên Google Drive** vào hệ thống, để nhân sự soát vé xác nhận tại **cổng khách mời (zone `GUEST`)**.

```
BTC/Admin gán thư mục Drive cho concert  ──►  Concert.guestDriveFolderId
        │   (BTC upload CSV vào thư mục đó, share Viewer cho service account)
        ▼
Tự động 0h (giờ VN)  HOẶC  Admin bấm "Nhập ngay"
   → BullMQ scan "scan-drive-folders" (cron 0 0 * * * tz Asia/Ho_Chi_Minh)
   → quét concert PUBLISHED + có folderId → tạo GuestImportJob → enqueue
        ▼
Worker guest-import: tải CSV từ Drive → parse → validate (full_name + email)
   → upsert guest_list theo (concertId, email) → gán zone "GUEST"
        ▼
guest_list (INVITED)  +  guest_import_errors (dòng lỗi)  →  job DONE/PARTIAL/FAILED
        ▼
Soát vé: Checker tra cứu (email/phone/tên) + check-in tại cổng GUEST
Theo dõi: Admin xem job/lỗi + danh sách guest;  Organizer xem danh sách guest
```

---

## 2. Thành phần đã triển khai

### 2.1. Backend (api-server + worker + packages)
| Khu vực | Nội dung |
| --- | --- |
| Schema | `Concert.guestDriveFolderId`; `GuestList`: `email` NOT NULL + `@@unique([concertId,email])`, `phone` nullable. Migration `20260626120000_guest_drive_import_email_key`. |
| Storage | `packages/storage/src/drive.ts` — `listConcertCsvFiles`, `downloadDriveFile` (dep `@googleapis/drive`). |
| Queue | `GuestImportScanData`, `enqueueGuestImportScan`. |
| Scheduler | `nightly-guest-import.scheduler.ts` — BullMQ `upsertJobScheduler` cron `0 0 * * *` tz `Asia/Ho_Chi_Minh`; `scanAndEnqueueGuestImports(concertId?)`. |
| Worker | `guest-import.worker.ts` — tải Drive, validate `full_name`+`email`, upsert theo email, gán zone **`GUEST`** (`resolveGuestZoneId`, exact, case-insensitive). |
| API guest-list | `POST /admin/concerts/:id/guest-import-jobs` (nhập thủ công), `GET /admin/concerts/:id/guest-import-jobs` (lịch sử job), `GET /admin/guest-import-jobs/:id` + `/errors`, `GET /admin/concerts/:id/guests`, `GET /organizer/concerts/:id/guests`, `GET /check-in/guests/search`, `POST /check-in/guests/scans`. |
| API set folder | `PATCH /admin/concerts/:id` (admin, mọi trạng thái) & `POST /organizer/concerts/:id` (organizer, DRAFT) nhận `guest_drive_folder_id`. **`PUT /organizer/concerts/:id/guest-drive-folder`** (organizer, **mọi trạng thái**, chặn sau 0h ngày diễn) — dùng cho UI organizer. URL Drive hoặc ID đều được (`shared/utils/drive.ts` chuẩn hoá). |

### 2.2. Frontend (apps/web)
| File | Nội dung |
| --- | --- |
| `services/guest-list.service.ts` (mới) | Set folder, trigger import, list job, list errors, list guest (+ hằng email service account). |
| `services/organizer.service.ts` | `guest_drive_folder_id` trong type concert/update; `listOrganizerConcertGuests` + type `OrganizerGuest`. |
| `routes/admin/AdminGuestListPage.tsx` (mới) | Trang "Khách mời": chọn concert → gán thư mục Drive → "Nhập ngay" → bảng lịch sử job (status/total/success/error + xem lỗi) → bảng guest. |
| `routes/admin/AdminShell.tsx` | Thêm mục nav **"Khách mời"** (`/admin/guest-list`). |
| `main.tsx` | Route `admin/guest-list`. |
| `routes/organizer/OrganizerWorkspacePage.tsx` | Khu **"Khách mời"** (component `GuestSection`) ở **mỗi concert card** (danh sách `/organizer/concerts`) **và** trong trang sửa concert: ô **xem/sửa/nhập link thư mục Drive** (nút Lưu) + danh sách guest. Input bị khoá sau 0h ngày diễn (kèm thông báo). |

### 2.3. Dữ liệu seed
- Mỗi concert chính có thêm **zone `GUEST`** + **cổng `GUEST_GATE`** + gate-zone mapping + **checker device** (`CHECKER-GUEST-<slug>`), dùng dải id riêng (361/461/661).
- Tài khoản demo (mật khẩu chung **`Password@123`**, bcrypt thật): `admin@gmail.com` (ADMIN), `organizer@gmail.com` (ORGANIZER, sở hữu các concert seed), `checker-secret-2@ticketbox.test` (CHECKER cổng GUEST).

---

## 3. Hướng dẫn cài đặt

> `.env` (gốc `ticket-box-app/`) đã có sẵn `GOOGLE_SERVICE_ACCOUNT_JSON`, `DATABASE_URL` (Postgres local), `REDIS_URL` (Upstash). Service account Drive: **`storage@ticketbox-500711.iam.gserviceaccount.com`**.

### B1. Database
```bash
cd ticket-box-app
# Áp migration (prisma đọc .env ở cwd gốc):
npx prisma migrate deploy --schema packages/database/prisma/schema.prisma
# Seed dữ liệu (concert + zone GUEST + device + tài khoản demo):
export $(grep -E '^DATABASE_URL=' .env | head -1) && node packages/database/prisma/seed.mjs
```

### B2. Google Drive (cho mỗi concert muốn test)
1. Tạo 1 thư mục Drive.
2. **Share** thư mục cho `storage@ticketbox-500711.iam.gserviceaccount.com` (quyền **Viewer**).
3. Upload file CSV khách mời (mẫu: `ticket-box-app/scripts/sample-guest-list.csv`). CSV bắt buộc cột `full_name` (hoặc `name`) và `email`; tuỳ chọn `phone`, `code`, `note`.
4. Kiểm tra nhanh: `node ticket-box-app/scripts/check-guest-drive.mjs <FOLDER_ID>`.

### B3. Chạy
```bash
cd ticket-box-app
npm run build
npm run dev -w @ticketbox/api-server      # API  (http://localhost:3000/v1)
npm run dev -w @ticketbox/worker-server   # Worker + scheduler 0h  (BẮT BUỘC chạy để import xử lý)
npm run dev -w @ticketbox/web              # Web UI
```

---

## 4. Hướng dẫn test qua giao diện

### 4.1. Admin (luồng chính — dùng được với concert seed PUBLISHED)
1. Đăng nhập `admin@gmail.com` / `Password@123`.
2. Vào **Admin → Khách mời** (`/admin/guest-list`).
3. Chọn concert (vd "Ánh Sáng Màn Đêm").
4. Dán **link thư mục Drive** (đã share + có CSV) → **Lưu thư mục**.
5. Bấm **Nhập ngay** → chờ vài giây (worker quét Drive) → mục **"Nhập khách mời"** hiện job với `Tổng / Thành công / Lỗi`. Bấm **Xem lỗi** để xem dòng lỗi.
6. Mục **"Khách mời"** hiển thị danh sách guest đã nhập (họ tên / email / SĐT / trạng thái).

> Với `sample-guest-list.csv`: kết quả `Tổng 5 · Thành công 4 · Lỗi 1` (1 dòng thiếu email → `EMAIL_REQUIRED`), trùng email → upsert đè → **3 guest** thực tế, job **PARTIAL**.

### 4.2. Organizer
1. Đăng nhập `organizer@gmail.com` / `Password@123` (tài khoản sở hữu concert seed) → tab **Sự kiện** (`/organizer/concerts`).
2. Bấm nút **sửa (✎)** trên concert (hiện cho cả **DRAFT lẫn PUBLISHED**) → trang sửa có tab **"Khách mời"**: ô **Thư mục Google Drive** (xem/sửa/nhập link + **Lưu**) và **danh sách khách mời**.
3. Concert **PUBLISHED**: 3 tab thông tin (Thông tin cơ bản / Zone / Loại vé) **chỉ đọc** (khoá), chỉ tab **Khách mời** sửa được — đúng "đã publish thì không sửa thông tin nhưng vẫn sửa được link". Mặc định mở tab Khách mời + banner nhắc.
4. Link chỉ sửa được **trước 0h (giờ VN) ngày diễn** (PUBLISHED); quá mốc → input khoá + API trả `409 GUEST_FOLDER_LOCKED`. Concert **DRAFT** luôn sửa được.

### 4.3. Checker (soát vé tại cổng GUEST — tuỳ chọn)
- Đăng nhập `checker-secret-2@ticketbox.test` / `Password@123`, dùng trang Checker (`/checker`) với thiết bị `CHECKER-GUEST-<slug>` để tra cứu + check-in guest tại cổng khách mời.

### 4.4. Tự động 0h
- Worker đang chạy sẽ tự quét và nhập cho mọi concert PUBLISHED có `guestDriveFolderId`, đúng 0h giờ VN. Muốn quan sát ngay: tạm sửa cron trong `nightly-guest-import.scheduler.ts` thành `*/2 * * * *`, chạy lại worker, **nhớ trả lại `0 0 * * *`**.

---

## 5. Ràng buộc & lưu ý

- **CSV bắt buộc cột `email`** (định danh khử trùng). Dòng thiếu email → ghi lỗi `EMAIL_REQUIRED`, bỏ qua (không fail cả file). Trùng email trong 1 concert → dòng sau **upsert đè**.
- **Zone khách mời = code `GUEST`**: concert phải có zone `GUEST` (seed đã thêm). Không có → job `FAILED`.
- **Thư mục phải share cho service account**, nếu không worker không đọc được (job `FAILED` với thông báo lỗi Drive).
- **Đúng một lần 0h**: file thêm/sửa sau 0h sẽ không được nhập đêm đó (dùng "Nhập ngay" để chạy lại). File **giữ lại** trên Drive cho audit.
- **Gán folder mọi trạng thái**: organizer dùng `PUT /organizer/concerts/:id/guest-drive-folder` (UI khu "Khách mời"); admin dùng `PATCH /admin/concerts/:id`.
- **Khoá sửa folder sau 0h ngày diễn**: chỉ với concert **PUBLISHED** (sẽ được cron nhập) — organizer sửa link **trước 0h (giờ VN) ngày diễn**; sau đó endpoint trả `409 GUEST_FOLDER_LOCKED` và UI khoá input. Concert **DRAFT luôn sửa được** (chưa nhập). Admin (`PATCH`) không bị khoá (override). UI organizer: khu "Khách mời" là **tab riêng** trong trang sửa concert, và section cuối mỗi concert card.
- **Worker phải chạy** thì import mới được xử lý (cả 0h lẫn "Nhập ngay").

## 6. Việc còn lại (tuỳ chọn, không chặn luồng)
- Thông báo (in-app/email) cho Admin/BTC khi import xong/lỗi.
- Tra cứu/hiển thị thư mục Drive hiện tại của concert trên UI admin (hiện chỉ ghi, chưa đọc lại để hiển thị).
- Dọn component dead `ConcertCard` trong `OrganizerWorkspacePage.tsx` (đã có sẵn từ trước, không thuộc phạm vi này).

## 7. Trạng thái
`npm run build` **xanh toàn bộ** (redis, database, queue, storage, api-server, web, worker-server). Migration đã áp DB local; seed đã tạo zone/cổng/device GUEST; credential Drive xác thực OK. Import thật cần thư mục Drive đã share + CSV (B2).
