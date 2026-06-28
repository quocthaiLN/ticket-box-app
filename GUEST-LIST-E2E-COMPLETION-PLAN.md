# Kế hoạch hoàn thiện End-to-End — Guest List (CSV qua Google Drive)

> Lập 2026-06-26 trên `develop`. Mục tiêu: đưa chức năng guest list chạy **thông suốt từ đầu đến cuối** — từ BTC gán thư mục Drive → upload CSV → import (0h hoặc thủ công) → soát vé tại cổng VIP — kèm UI còn thiếu, sửa lỗi phát hiện, và kịch bản test.
>
> Tài liệu liên quan: [`GUEST-LIST-CSV-SCHEDULER-REPORT.md`](GUEST-LIST-CSV-SCHEDULER-REPORT.md) (phân tích), [`GUEST-LIST-DRIVE-IMPLEMENTATION-REPORT.md`](GUEST-LIST-DRIVE-IMPLEMENTATION-REPORT.md) (triển khai backend).

---

## 0. Cập nhật — quyết định đã chốt (2026-06-26)

- **Phạm vi UI: Organizer + Admin** (cả T3 + T4).
- **Khu khách mời = zone có `code = "GUEST"`** (zone riêng cho khách mời, KHÔNG dùng VIP/SVIP). Mọi chỗ ghi "zone VIP" bên dưới được hiểu là **zone GUEST**. Hệ quả:
  - Worker gán guest vào zone `code = "GUEST"` (exact, case-insensitive); concert không có zone GUEST → job `FAILED`.
  - **Dữ liệu test:** concert phải có 1 zone `GUEST` + gate map tới zone đó + checker device tại gate đó. Seed hiện chưa có → cần bổ sung (task mới **T2.5**).

### Tiến độ thực thi (đã làm & kiểm chứng 2026-06-26)
- ✅ **T1** — worker resolve zone `GUEST` (exact, sửa bug khớp nhầm "SVIP"); build xanh toàn bộ monorepo.
- ✅ **T2** — migration đã áp DB local (`localhost:5432/ticketbox`, 6/6 migration).
- ✅ **T2.5** — seed bổ sung zone `GUEST` + cổng `GUEST_GATE` + gate-zone mapping + checker device (`CHECKER-GUEST-<slug>`) cho 6 concert (dải id riêng 361/461/661 để không đụng công thức `*5`).
- ✅ **Drive** — credential service account `storage@ticketbox-500711.iam.gserviceaccount.com` xác thực OK (auth thành công, thấy file được share).
- ⏳ **Còn lại:** T3/T4 (UI organizer/admin), T7 (test E2E thật với thư mục Drive).

---

## 1. Hiện trạng (đã có / còn thiếu)

| Lớp | Thành phần | Trạng thái |
| --- | --- | --- |
| DB | Schema `guestDriveFolderId`, unique `(concertId,email)`, migration | ✅ Code xong — **migration chưa apply vào DB local** |
| Backend | Drive client, scheduler 0h, worker import, upsert email, zone VIP | ✅ Build xanh |
| Backend | API set folder (`POST /organizer/concerts/:id`, `PATCH /admin/concerts/:id`) | ✅ Bạn vừa thêm |
| Backend | API trigger import (ADMIN), job status, errors, search, scan | ✅ |
| Backend | `GET /organizer/concerts/:id/guests` | ✅ Có sẵn |
| Frontend | **Checker**: preload + scan guest tại cổng (`/check-in/preload`, `/check-in/guests/scans`) | ✅ Đã có |
| Frontend | **Organizer**: ô nhập link Drive khi sửa concert + xem danh sách guest + xem trạng thái import | ❌ **Chưa có** |
| Frontend | **Admin**: nút import thủ công + xem job/errors | ❌ **Chưa có** |
| Vận hành | Chạy migration + seed local, tạo & share thư mục Drive, test E2E | ⏳ Chưa làm |

→ **Phần lớn việc còn lại là UI organizer/admin** + chạy migration + 1 sửa lỗi (mục 2) + test.

---

## 2. Vấn đề & rủi ro cần xử lý (đặt vấn đề)

### 🔴 2.1. BUG — `resolveVipZoneId` khớp nhầm "SVIP"
`apps/worker-server/src/workers/guest-import.worker.ts` hiện dùng `zones.find(z => /vip/i.test(z.code))`. **"SVIP" cũng chứa "VIP"** → khớp nhầm. Seed có cả `SVIP` lẫn `VIP` và SVIP đứng trước → guest bị gán **sai zone SVIP**, dẫn tới **check-in tại cổng VIP trả `WRONG_GATE`**.
→ **Sửa: so khớp chính xác** `z.code.toUpperCase() === "VIP"` (giữ fallback "concert chỉ có 1 zone"). Đây là quy ước seed đang dùng (`findIndex(code === "VIP")`). **Ưu tiên sửa đầu tiên.**

### 🟠 2.2. Quy ước "zone VIP" khi concert nhiều khu
Concert thực tế có SVIP/VIP/CAT/GA. Guest list chỉ gán vào **VIP**. Cần chốt: luôn dùng zone `code = "VIP"`? Nếu concert **không có** zone code "VIP" → job `FAILED` ("Không tìm thấy seat zone VIP") — có cần cấu hình "zone khách mời" riêng cho từng concert không, hay ép buộc phải có "VIP"?

### 🟠 2.3. Vòng đời `guestDriveFolderId` vs publish
Organizer chỉ sửa concert khi `DRAFT` (`POST /organizer/concerts/:id`), nhưng scheduler **chỉ quét concert `PUBLISHED`**. Cần xác nhận: folder gán lúc DRAFT **giữ lại sau publish**; và sau publish nếu cần đổi folder thì dùng `PATCH /admin/concerts/:id` (admin). UI phải đặt ô nhập folder ở đúng nơi (lúc tạo/sửa DRAFT + cho admin sửa sau).

### 🟠 2.4. Ai trigger import / xem job — phân quyền UI
Trigger import + job status/errors hiện **ADMIN-only**. Organizer có cần **xem trạng thái import** concert của mình không (chỉ xem, không trigger)? Nếu có → thêm endpoint organizer hoặc nới quyền GET job theo chủ sở hữu concert.

### 🟡 2.5. Thông báo khi import xong / lỗi
Hiện kết quả chỉ ghi DB (`guest_import_jobs`, `guest_import_errors`). Khi đêm 0h import xong (hoặc lỗi cả file), **không ai được báo**. Có cần notification (in-app/email) cho admin/BTC kèm số liệu không?

### 🟡 2.6. Share thư mục Drive cho service account
Để worker đọc được, BTC phải share thư mục cho **`storage@ticketbox-500711.iam.gserviceaccount.com`** (Viewer). Nếu quên share → `listConcertCsvFiles` lỗi. Cần: hướng dẫn rõ trong UI + thông báo lỗi thân thiện khi không truy cập được folder.

### 🟡 2.7. Tài khoản test không đăng nhập được
Theo ghi chú dự án, seed ghi `passwordHash` giả → tài khoản demo **không login được**. Để test cần tài khoản thật (đăng ký OTP, hoặc admin tạo checker thật qua luồng A6). Cần chuẩn bị account ADMIN + ORGANIZER + CHECKER login được.

### 🟢 2.8. Edge cases (worker đã xử lý, nên kiểm thử)
Folder rỗng (0 file) → không tạo job; file không phải CSV → bỏ qua; CSV thiếu cột `email`/`full_name` → job lỗi header; dòng thiếu email → `EMAIL_REQUIRED` (bỏ qua dòng, không fail file); nhiều file trong folder → import tất cả, upsert gộp theo email.

---

## 3. Kế hoạch cài đặt (setup chạy local end-to-end)

> `.env` đã có `GOOGLE_SERVICE_ACCOUNT_JSON` + `DATABASE_URL` local (`localhost:5432/ticketbox`) + Redis Upstash. Service account: **`storage@ticketbox-500711.iam.gserviceaccount.com`**.

**B1. DB local + migration + seed**
```bash
# đảm bảo Postgres local đang chạy và đã có database "ticketbox"
cd ticket-box-app/packages/database
npx prisma migrate deploy        # áp dụng tới migration 20260626120000_guest_drive_import_email_key
npx prisma db seed               # tạo concert có zone VIP + gate VIP + checker device
# (hoặc làm sạch hẳn:  npx prisma migrate reset  → tự seed luôn)
```

**B2. Build & chạy**
```bash
cd ticket-box-app
npm run build
npm run dev -w @ticketbox/api-server      # cổng API
npm run dev -w @ticketbox/worker-server   # worker + scheduler 0h (log "[nightly-guest-import] Scheduled ...")
```

**B3. Chuẩn bị Drive**
1. Tạo 1 thư mục Drive cho concert test.
2. **Share** thư mục cho `storage@ticketbox-500711.iam.gserviceaccount.com` (Viewer).
3. Upload `ticket-box-app/scripts/sample-guest-list.csv` vào thư mục.
4. Kiểm tra nhanh: `node ticket-box-app/scripts/check-guest-drive.mjs <FOLDER_ID>`.

**B4. Gán folder cho concert** (qua API, bằng tài khoản phù hợp)
```http
# Organizer (concert DRAFT) hoặc Admin (PATCH):
PATCH /v1/admin/concerts/<CONCERT_ID>
{ "guest_drive_folder_id": "https://drive.google.com/drive/folders/<FOLDER_ID>" }
```

**B5. Chạy import & kiểm tra**
```http
POST /v1/admin/concerts/<CONCERT_ID>/guest-import-jobs      # trigger ngay (không chờ 0h)
GET  /v1/admin/guest-import-jobs/<JOB_ID>                   # total/success/error rows
GET  /v1/admin/guest-import-jobs/<JOB_ID>/errors            # dòng lỗi
GET  /v1/organizer/concerts/<CONCERT_ID>/guests            # guest đã nhập
```

---

## 4. Kế hoạch hoàn thiện (task theo thứ tự)

| # | Task | Phạm vi | Ước lượng |
| --- | --- | --- | --- |
| **T1** | **Fix bug zone VIP** (2.1) — exact `code === "VIP"` | worker | 10' |
| **T2** | Chạy migration + seed + smoke test backend (mục 3) | vận hành | 30' |
| **T3** | **UI Organizer** — ô nhập link Drive trong form tạo/sửa concert; tab/section "Khách mời" hiển thị danh sách guest (`GET /organizer/concerts/:id/guests`) + trạng thái import | apps/web (organizer) | 0.5–1 ngày |
| **T4** | **UI Admin** — nút "Nhập khách mời ngay" + bảng job (`GET /admin/guest-import-jobs/:id` + `/errors`) cho concert | apps/web (admin) | 0.5 ngày |
| **T5** | (Tùy chọn 2.4) Endpoint + UI cho organizer **xem** job status concert mình | backend + web | 0.5 ngày |
| **T6** | (Tùy chọn 2.5) Notification admin/BTC khi import xong/lỗi | worker + notif | 0.5 ngày |
| **T7** | **Test E2E** theo mục 5 (happy + error + check-in) | QA | 0.5 ngày |
| **T8** | Cập nhật README + blueprint (guest-list-api, rbac-route-map) cho khớp luồng mới | docs | 30' |

> Tối thiểu để "chạy end-to-end thật": **T1 + T2 + T3 + T7**. T4/T5/T6 nâng trải nghiệm.

### 4.1. Chi tiết UI (sau khi khảo sát web app)
Pattern: service ở `apps/web/src/services/*.service.ts` (dùng `apiGet`/`apiPost`), trang lớn ở `routes/*`. Hiện **chưa có** UI nào gọi guest-import/guest_drive_folder_id.

**Organizer** — `services/organizer.service.ts` + `routes/organizer/OrganizerWorkspacePage.tsx`:
- Thêm `guest_drive_folder_id` vào type `OrganizerConcert` + `UpdateOrganizerConcertInput`; thêm ô nhập **"Link thư mục Google Drive khách mời"** trong form sửa concert (gọi `updateOrganizerConcert`). Kèm chú thích share cho `storage@ticketbox-500711.iam.gserviceaccount.com` (Viewer).
- Thêm service `listOrganizerConcertGuests(concertId)` → `GET /organizer/concerts/:id/guests`; thêm khu **"Khách mời"** hiển thị bảng guest (họ tên / email / zone / trạng thái).

**Admin** — `services/admin-catalog.service.ts` + trang admin quản lý concert:
- Thêm service `triggerGuestImport(concertId)`, `getGuestImportJob(jobId)`, `getGuestImportJobErrors(jobId)` (gọi `/admin/...`).
- UI: nút **"Nhập khách mời ngay"** + panel trạng thái job (total/success/error + bảng lỗi từng dòng) + ô set `guest_drive_folder_id` (qua `PATCH /admin/concerts/:id`).
- Có thể đặt trong trang chi tiết/quản lý concert của admin (nếu chưa có trang này → thêm khu nhỏ trong AdminShell hoặc trang concert admin).

---

## 5. Kịch bản test End-to-End

**Chuẩn bị:** concert `PUBLISHED` có zone `VIP`, gate VIP + checker device (seed có sẵn); tài khoản ADMIN/ORGANIZER/CHECKER login được (2.7); thư mục Drive đã share + có `sample-guest-list.csv`.

**Happy path**
1. Gán folder cho concert (B4) → 200.
2. `POST .../guest-import-jobs` → 202 `SCAN_ENQUEUED`; worker log `scan done enqueued=1`, rồi `[guest-import] done`.
3. `GET .../guest-import-jobs/:id` → `total_rows=5, success_rows=4, error_rows=1, status=PARTIAL`.
4. `GET .../errors` → 1 lỗi `EMAIL_REQUIRED` (dòng 5).
5. `GET /organizer/concerts/:id/guests` → **3 guest** (vana, thib, vanc), tất cả `seatZoneId = zone VIP`, status `INVITED`.
6. Checker: preload (`/check-in/preload?...&include_guests=true`) thấy guest; `POST /check-in/guests/scans` với guest_id → `SUCCESS`.
7. Scan lại cùng guest → `ALREADY_CHECKED_IN`.

**Error/edge path**
- Folder chưa share cho service account → job `FAILED`, errorMessage rõ ràng.
- Concert không có zone "VIP" → job `FAILED` ("Không tìm thấy seat zone VIP").
- Upload lại CSV sửa email dòng 5 → chạy lại trigger → dòng đó thành công; các email cũ **upsert không tạo trùng**.
- Scheduler 0h: tạm đổi cron `*/2 * * * *` để quan sát, **nhớ trả lại `0 0 * * *`**.

---

## 6. Câu hỏi cần chốt (để hoàn thiện tốt nhất)

1. **UI làm tới đâu?** Chỉ **organizer** (set folder + xem guest) là đủ cho mốc này, hay làm cả **admin** (trigger thủ công + bảng job/errors)?
2. **Organizer có cần xem trạng thái import** concert mình (chỉ xem)? (kéo theo T5 + 1 endpoint).
3. **Zone VIP (2.2):** chốt quy ước `code = "VIP"` exact, hay thêm cấu hình "zone khách mời" cho concert (linh hoạt nhưng tốn việc)?
4. **Thông báo (2.5):** có cần notify admin/BTC khi import xong/lỗi không? kênh nào?
5. **Hiển thị gì trên UI job:** có cần link tới từng file Drive đã import + nút "chạy lại" không?
6. **Đổi folder sau publish:** cho phép organizer sửa folder khi concert đã PUBLISHED (hiện chỉ admin PATCH), hay giữ admin-only?

---

## 7. Phụ lục — API liên quan

| Method | Endpoint | Quyền | Mục đích |
| --- | --- | --- | --- |
| `PATCH` | `/admin/concerts/:id` | ADMIN | set `guest_drive_folder_id` |
| `POST` | `/organizer/concerts/:id` | ORGANIZER (DRAFT) | set `guest_drive_folder_id` |
| `POST` | `/admin/concerts/:id/guest-import-jobs` | ADMIN | import thủ công (enqueue scan) |
| `GET` | `/admin/guest-import-jobs/:job_id` | ADMIN | trạng thái job |
| `GET` | `/admin/guest-import-jobs/:job_id/errors` | ADMIN | lỗi từng dòng |
| `GET` | `/organizer/concerts/:id/guests` | ORGANIZER/ADMIN | danh sách guest |
| `GET` | `/check-in/guests/search` | CHECKER | tra cứu tại cổng |
| `POST` | `/check-in/guests/scans` | CHECKER | check-in guest |

*Scheduler tự động: BullMQ cron `0 0 * * *` (Asia/Ho_Chi_Minh) → quét concert PUBLISHED diễn ra trong 24h tới có `guestDriveFolderId`.*
