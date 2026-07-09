# Kế hoạch công việc — Thuận (Guest List / Frontend / Demo / Documentation / DevOps / Cover Thanh)

Ngày lập: 2026-07-05
Căn cứ: `PROCESS.md` (mục 2.3, 5, 6) — phạm vi giai đoạn hoàn thiện MVP.

## 1. Trạng thái hiện tại

| Hạng mục | Trạng thái | Ghi chú |
| --- | --- | --- |
| Build workspace | ✅ Xanh | `npm.cmd run build` pass; cần `prisma generate` trước khi build (nếu không sẽ RED) |
| Docker local | ✅ Chạy | Postgres `localhost:5433`, Redis `localhost:6379` |
| Test gate | ✅ 7/7 | Chỉ còn `tests/checkin`; test checkout/inventory cũ đã xóa (Thái viết lại) |
| Cleanup worktree | ✅ Xong | `Frontend/` untracked/ignored; `tsconfig.tsbuildinfo` untracked; `.env.example` đã chỉnh |
| Tài liệu setup | ✅ Đã gộp | `SET_UP_GUIDE.md` thay cho WEB_RUN_GUIDE + MOBILE_TEST_GUIDE |
| URL concert theo slug | ❌ Chưa | Backend đã hỗ trợ tìm theo slug/UUID; frontend vẫn link bằng `concert.id` |
| Trang Preview Admin/Organizer | ❌ Chưa | Nút "xem detail" hiện trỏ thẳng route public |
| Guest List baseline | ⚠️ Một phần | Sprint 2/3 OK; **thiếu** scheduler 0h ICT, Supabase download, bucket `guest-csv` (xem `GUEST-LIST-CSV-SCHEDULER-REPORT.md`) |
| Guest Drive set-folder API | ⚠️ WIP chưa commit | `guestDriveFolderId` + set-API (organizer/admin nhận `guest_drive_folder_id`) đang WIP ở tree develop, chưa lên remote |
| Demo scripts theo role | ❌ Chưa có | Audience, Organizer, Admin, Guest List, Checker |
| Seed/demo accounts | ❌ Chưa chuẩn hóa | Cần cho cả 4 role + handoff cho Quang |

## 2. Danh sách công việc cần làm

### Nhóm A — Frontend slug & preview (ưu tiên cao, chặn demo)

**A1. Chuẩn hóa URL concert detail theo slug**
1. Sửa mapping `UiConcert.slug` lấy từ API `concert.slug` (hiện map nhầm từ `concert.id`); vẫn giữ `id` cho checkout/API nội bộ.
2. Sửa mọi nơi tạo link (card/home/events/organizer/admin) sang `/concerts/${concert.slug}`.
3. Sửa route chọn ghế theo slug: `/concerts/:slug/seats`; redirect sau login cũng theo slug.
4. Khi tạo checkout: dùng `concert.id` đã resolve từ detail, không dùng slug.
5. Kiểm chứng: mở `/concerts/anh-sang-man-dem`, không còn UUID trên URL người dùng.

**A2. Trang "Xem trước" cho Admin/Organizer**
1. Tạo route `/admin/concerts/:concert_id/preview` và `/organizer/concerts/:concert_id/preview` (có auth/role).
2. Render giống Audience detail nhưng lấy dữ liệu theo quyền, xem được cả DRAFT.
3. Gắn nhãn "Xem trước"; disable nút mua vé/thanh toán nếu concert chưa `PUBLISHED`.
4. Đổi nút xem detail trong Admin/Organizer trỏ vào preview, không trỏ public route.
5. Kiểm chứng: concert DRAFT không xuất hiện ở catalog public nhưng preview xem được.

**A3. Port UI còn thiếu từ `Frontend/`**
1. Rà từng màn hình còn cần (AI Artist Bio UI, CSV/import UI) trong `Frontend/`.
2. Port sang `ticket-box-app/apps/web` — không sửa `Frontend/` như app chính.

### Nhóm B — Guest List (ưu tiên cao)

**B1. Chốt và commit phần Drive set-folder API (WIP)**
1. Review lại diff WIP: `guestDriveFolderId` trên concert + API organizer/admin nhận `guest_drive_folder_id` (URL hoặc ID).
2. Bổ sung phần còn thiếu theo `GUEST-LIST-CSV-SCHEDULER-REPORT.md`: scheduler 0h ICT, Supabase download, bucket `guest-csv`.
3. Commit tách bạch, build + test xanh trước khi push.

**B2. Dữ liệu mẫu & rà luồng import**
1. Rà `guest-list` API, worker import CSV/Drive, trang admin/organizer xem guest, trạng thái import job, danh sách lỗi từng dòng.
2. Chuẩn bị CSV mẫu/Drive folder mẫu: guest hợp lệ, trùng phone/email, sai zone/gate, dòng lỗi.
3. Seed guest list: concert, seat zone, gate mapping, guest VIP, checker handoff data cho Quang.
4. Phối hợp Quang xác nhận guest pass sau import check-in đúng cổng.

### Nhóm C — Demo scripts & seed accounts

**C1. Seed/demo accounts** cho Audience, Organizer, Checker, Admin — mật khẩu demo ghi trong tài liệu nội bộ (nếu được phép).

**C2. Demo scripts 1 phút** cho: Audience, Organizer, Admin Web, Guest List, Checker. Mỗi script gồm: mục tiêu, tài khoản, dữ liệu cần có, bước quay, kết quả mong đợi. Riêng Guest List: cấu hình folder CSV → trigger import → xem kết quả/lỗi → tìm guest → bàn giao checker scan guest pass.

### Nhóm D — Documentation & DevOps

**D1.** Chuẩn hóa README + `SET_UP_GUIDE.md` + `PROCESS.md`: thống nhất port, lệnh chạy, Docker, seed, test, known gaps.
**D2.** Kiểm tra `.env.example` khớp code: API URL, web URL, payment mock, Redis, Postgres, storage, AI, QR signing.
**D3.** Checklist trước commit: không `node_modules`, không secret thật, không build artifact tracked, `Frontend/` chỉ ignored local.
**D4.** Tách commit cleanup hợp lý nếu nhóm muốn lịch sử sạch (untrack `Frontend/` riêng, `tsconfig.tsbuildinfo` riêng).

### Nhóm E — Cover Thanh (dự phòng)

Nếu Thanh không kịp: auto-publish scheduler cho concert DRAFT có `planned_publish_at <= now` (idempotent, invalidate cache catalog, ghi audit). Nếu không kịp cả hai: ghi rõ trong demo là admin publish thủ công qua `POST /admin/concerts/:concert_id/publish`.

## 3. Thứ tự thực hiện đề xuất (step-by-step)

1. **B1** — commit phần Drive WIP trước (đang treo trên working tree, rủi ro mất/conflict cao nhất).
2. **A1** — slug URL (nhỏ, mở khóa demo Audience).
3. **A2** — preview Admin/Organizer (phụ thuộc A1 để tái dùng component detail).
4. **B2** — CSV mẫu + seed guest, bàn giao Quang sớm để Quang làm demo checker.
5. **C1** — seed accounts (Thái/Quang/Thanh đều cần).
6. **A3** — port UI còn thiếu.
7. **C2** — demo scripts (cần A1/A2/B2/C1 xong trước).
8. **D1–D4** — tài liệu + checklist, làm cuối cùng trước khi chốt giai đoạn.
9. **E** — chỉ khi Thanh báo không kịp.

## 4. Các vấn đề đang block

| Block | Ảnh hưởng | Hướng xử lý |
| --- | --- | --- |
| WIP Drive set-folder chưa commit trên develop | Không thể pull/merge an toàn; người khác không dùng được API | Ưu tiên B1 ngay đầu tuần |
| Scheduler 0h ICT + Supabase download + bucket `guest-csv` chưa có | Demo Guest List CSV tự động không chạy được end-to-end | Làm trong B1; fallback: trigger import thủ công trong demo |
| Auto-publish job (việc Thanh) chưa có | Demo publish schedule phải làm thủ công | Ghi rõ trong demo script; cover nếu Thanh không kịp (nhóm E) |
| Test checkout/inventory mới (việc Thái) chưa có | Demo Audience mua vé thiếu test gate bảo chứng | Không block trực tiếp việc của Thuận, nhưng cần trước khi chốt MVP |
| Cần credentials thật (Supabase, Google Service Account) cho Drive/CSV | Không kiểm chứng được luồng download thật ở local | Xin/xác nhận credentials demo với nhóm |

## 5. Các vấn đề chưa rõ, cần chốt với nhóm

1. **Slug trùng/đổi tên concert**: slug có unique constraint chưa? Đổi tên concert có đổi slug không, và URL cũ có redirect không?
2. **Preview route dùng `concert_id` hay slug**: PROCESS.md ghi `/admin/concerts/:concert_id/preview` — chốt dùng UUID cho route nội bộ admin (đề xuất: đúng, chỉ URL audience mới cần slug).
3. **Có được ghi mật khẩu demo vào tài liệu nộp không** (C1) — hay chỉ tài liệu nội bộ?
4. **Bucket `guest-csv`**: dùng Supabase Storage thật hay mock local cho demo? Ai giữ project Supabase?
5. **Scheduler 0h ICT**: chạy trong worker-server hiện có hay tách cron riêng? Tần suất demo (0h thật không quay video được — cần cách trigger tay).
6. **Phạm vi port từ `Frontend/`**: những màn hình nào bắt buộc cho MVP, màn hình nào bỏ? Cần danh sách chốt với nhóm.
7. **`.env.production.example`**: PROCESS.md đề xuất "về sau" — xác nhận không nằm trong scope MVP.
8. **Deadline chốt giai đoạn MVP** và ngày quay demo — để xếp lịch B2/C2 với Quang.

## 6. Đầu ra cam kết (theo PROCESS.md)

- Tài liệu setup chạy được từ đầu (clone → chạy local nhanh).
- Demo scripts theo role, gồm Guest List import/CSV và preview concert trước publish.
- Worktree sạch trước khi chốt giai đoạn.
