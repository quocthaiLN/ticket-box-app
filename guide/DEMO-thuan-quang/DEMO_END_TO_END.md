# TicketBox — Kịch bản Demo Hoàn Chỉnh

Tài liệu này mở rộng "Luồng demo cơ bản" trong `SET_UP_GUIDE.md`, bổ sung các phần demo còn thiếu: sơ đồ hạng vé, trang preview, thanh toán MoMo, check-in bằng checker, khách mời (Google Drive), Audit log trên web và quản lý tài khoản admin.

Yêu cầu trước khi demo: đã setup theo `SET_UP_GUIDE.md` (Postgres + Redis, migrate + seed, API/Web/Worker/Payment mocks đang chạy, mobile checker nếu demo check-in trên điện thoại).

Tài khoản seed:

| Vai trò         | Email                  | Mật khẩu       |
| --------------- | ---------------------- | -------------- |
| Admin           | `admin@gmail.com`      | `Password@123` |
| Audience        | `audience@gmail.com`   | `Password@123` |
| Organizer/BTC   | `organizer@gmail.com`  | `Password@123` |
| Organizer/BTC 2 | `organizer2@gmail.com` | `Password@123` |

---

## Phần A — Luồng cơ bản (tạo hồ sơ → duyệt → auto-publish → mua vé VNPay)

1. Đăng nhập web bằng `organizer2@gmail.com` / `Password@123`.
2. Vào dashboard BTC, tạo một hồ sơ concert mới.
3. Điền `planned_publish_at` cách thời điểm hiện tại khoảng 5 phút để test auto-publish. `starts_at` phải sau `planned_publish_at`.
4. Thêm ticket type hợp lệ, sale time hợp lệ, gate/checker count hợp lệ rồi gửi hồ sơ qua admin.
5. Ảnh sơ đồ chỗ ngồi có thể đính kèm **ngay khi tạo hồ sơ** (khối "Sơ đồ chỗ ngồi (ảnh)" đầu section "Cấu hình zone" của form nộp hồ sơ — ảnh tải lên khi bấm nộp, admin xem được lúc duyệt và tự copy sang concert khi accept). Hoặc bổ sung sau khi duyệt: trong editor concert `DRAFT`, mở tab **Zone** → khối **"Sơ đồ hạng vé (ảnh)"** ở đầu tab:
   - Bấm "Chọn ảnh sơ đồ" (JPEG/PNG/WebP/GIF ≤ 10MB) — ảnh **được lưu ngay** khi upload xong, không cần bấm nút Lưu khác.
   - Ảnh nên chú thích rõ màu và tên từng hạng vé để audience đối chiếu với legend.
   - Có thể "Gỡ ảnh" để xóa ngay. Sau khi concert PUBLISHED, sơ đồ bị khóa như các field khác.
6. Vẫn trong editor concert, mở tab **Khách mời**:
   - Dán link/ID thư mục Google Drive chứa file CSV khách mời rồi bấm Lưu.
   - Lưu ý: thư mục phải được share quyền **Viewer** cho `storage@ticketbox-500711.iam.gserviceaccount.com`.
   - Hệ thống tự nhập danh sách lúc **0h ngày diễn** (scheduler nightly-guest-import trên Worker); sau mốc này folder bị khóa chỉnh sửa. Để demo nhanh có thể nhờ admin trigger nhập ngay, hoặc chỉ demo phần gán folder + xem danh sách trống.
7. Trước khi gửi hồ sơ, có thể mở trang preview của concert (`/organizer/concerts/:id/preview`) để xem concert sẽ hiển thị với audience như thế nào.
8. Đăng xuất organizer2, đăng nhập `admin@gmail.com` / `Password@123`.
9. Vào Admin → Hồ sơ Ban Tổ Chức, mở hồ sơ organizer2 vừa gửi.
   - Admin có thể mở preview concert (`/admin/concerts/:id/preview`) để thẩm định nội dung trước khi duyệt.
   - Duyệt (accept) hồ sơ.
10. Sau khi accept, mở overview concert bản `DRAFT` để kiểm tra zone, ticket type, gate và **checker account** đã được tạo. **Ghi lại email + mật khẩu checker hiển thị một lần duy nhất tại đây** — cần cho Phần C (check-in).
11. Đợi khoảng 5–6 phút. Worker auto-publish chạy mỗi 60 giây, concert chuyển từ `DRAFT` sang `PUBLISHED`.
12. Đăng xuất admin, đăng nhập `audience@gmail.com` / `Password@123`.
13. Vào concert vừa publish (URL dạng slug thân thiện `/concerts/<slug>`).
    - Ở trang chi tiết, mở tab **Sơ đồ**: ảnh sơ đồ hiển thị kèm legend chip từng hạng vé (màu + giá thấp nhất/"Hết vé"); click ảnh hoặc nhãn "Phóng to" mở lightbox full-screen (Esc để đóng).
    - Ở trang chọn vé (`/concerts/:id/seats`): click chip hạng vé trên sơ đồ → trang cuộn tới và highlight card hạng vé tương ứng; ngược lại click card vé cũng highlight chip. Concert không có ảnh sơ đồ → hiển thị lưới zone fallback ("SÂN KHẤU").
14. Chọn 1 vé và thanh toán bằng **VNPay**. Ở cổng VNPay sandbox, chọn thanh toán qua ngân hàng và nhập:

| Trường         | Giá trị               |
| -------------- | --------------------- |
| Ngân hàng      | `NCB`                 |
| Số thẻ         | `9704198526191432198` |
| Tên chủ thẻ    | `NGUYEN VAN A`        |
| Ngày phát hành | `07/15`               |
| OTP            | `123456`              |

15. Sau khi VNPay redirect về hệ thống, vào **Vé của tôi** (`/my-tickets`) để kiểm tra vé đã mua và **mã QR e-ticket** của từng vé (dùng cho Phần C).
16. Đăng nhập lại `organizer2@gmail.com` để thấy doanh thu và số vé bán tăng trên dashboard BTC.

---

## Phần B — Thanh toán MoMo

Demo phương thức thanh toán thứ hai, chứng minh hệ thống hỗ trợ đa cổng:

1. Vẫn với `audience@gmail.com`, chọn mua thêm 1 vé (hạng khác hoặc concert khác).
2. Ở trang checkout, chọn **"Thanh toán qua ví điện tử MoMo"**.
3. Hệ thống chuyển sang cổng MoMo test (`test-payment.momo.vn`); thanh toán bằng QR test hoặc luồng sandbox của MoMo, redirect về `http://localhost:3000/v1/payment/return/momo`.
4. Kiểm tra vé mới trong **Vé của tôi**; đơn hàng ghi payment provider là MoMo.

Ghi chú: nếu môi trường không truy cập được MoMo sandbox, dùng payment mocks theo cấu hình `.env` tương ứng: `npm run dev:payment:momo` cho MoMo mock ở cổng `4101`, và `npm run dev:payment:vnpay` cho VNPay mock ở cổng `4102`.

---

## Phần C — Check-in vé bằng tài khoản Checker

Chuẩn bị: email + mật khẩu checker đã ghi lại ở bước A.10 (dạng `checker-...@ticketbox.local`, mật khẩu chỉ hiển thị một lần khi admin accept).

### C1. Check-in trên web

1. Đăng xuất tài khoản hiện tại, đăng nhập bằng tài khoản checker.
2. Vào trang **Checker** (`/checker`).
3. Nhập/quét mã QR trên e-ticket của audience (mở từ `/my-tickets` trên máy/điện thoại khác).
4. Vé hợp lệ → trạng thái chuyển **Đã vào** (CHECKED_IN); quét lại lần 2 → hệ thống báo vé đã check-in (chống dùng lại vé).
5. Checker chỉ check-in được vé của **đúng concert** mình được gán — thử vé concert khác sẽ bị từ chối.

### C2. Check-in trên mobile app

1. Chạy `npm run dev:mobile -- --clear`, mở app Expo trên điện thoại/emulator.
2. Đăng nhập bằng tài khoản checker, quét QR vé bằng camera — kết quả như C1.

### C3. Khách mời check-in (nếu đã nhập danh sách Drive)

- Sau khi scheduler nhập CSV (0h ngày diễn) hoặc admin nhập tay, tab **Khách mời** của organizer hiển thị danh sách với trạng thái "Đã mời"; khách check-in xong chuyển "Đã vào".

---

## Phần D — Dashboard Organizer sau bán vé

Đăng nhập lại `organizer2@gmail.com`:

1. Dashboard hiển thị **doanh thu** và **số vé bán** tăng theo giao dịch VNPay/MoMo vừa thực hiện.
2. Panel **"Tài khoản checker theo concert"** (full-width, cuộn trong panel):
   - Dropdown lọc theo concert; danh sách nhóm accordion theo tên concert.
   - Mỗi dòng checker: tên · email (bấm icon để copy) · badge ACTIVE · ngày tạo · nút copy User ID.
   - Lưu ý: mật khẩu checker **không** hiển thị lại ở đây.

---

## Phần E — Admin: Audit log trên web + quản lý tài khoản

Đăng nhập `admin@gmail.com`:

### E1. Trang Audit log (`/admin/audit-logs`, sidebar "Audit log")

1. Bảng hiển thị bản ghi mới nhất: Thời gian / Actor (trống = "Hệ thống") / Action / Entity / IP.
2. Demo filter:
   - `action = CONCERT_AUTO_PUBLISHED` → trace worker auto-publish concert ở Phần A.
   - `action = APPROVE_ORGANIZER_REQUEST` → trace admin duyệt hồ sơ.
   - `entity_type = payment` → trace webhook thanh toán VNPay/MoMo.
   - `entity_type = ticket` → trace phát hành vé (TICKET_ISSUED).
   - Lọc theo khoảng thời gian `from`/`to`.
3. Click một dòng để expand → xem JSON `metadata` + `user_agent`.
4. Bấm **"Tải thêm"** để phân trang cursor khi >30 bản ghi.
5. (Kiểm tra phân quyền) Đăng nhập organizer rồi vào thẳng `/admin/audit-logs` → bị chặn.

Vẫn có thể query audit log bằng `curl` như mục 6 của `SET_UP_GUIDE.md` nếu muốn demo API trực tiếp.

### E2. Quản lý tài khoản (`/admin/accounts`)

- Danh sách toàn bộ account theo vai trò; email dài hiển thị gọn (wrap) và copy được — kể cả các checker account tự sinh `checker-...@ticketbox.local`.

### E3. Yêu cầu xóa tài khoản (`/admin/deletion-requests`)

- (Tùy chọn) Audience gửi yêu cầu xóa tài khoản → admin xem và xử lý tại đây.

---

## Ghi chú demo

- Worker Server phải đang chạy thì auto-publish và scheduler nhập khách mời mới hoạt động.
- API Server phải đang chạy để VNPay redirect về `http://localhost:3000/v1/payment/return` (MoMo: `/v1/payment/return/momo`).
- Nếu concert chưa publish sau 5 phút, chờ thêm 1 tick worker hoặc kiểm tra log terminal worker.
- Checker account chỉ hiển thị mật khẩu **một lần** ngay sau khi admin accept — nhớ ghi lại ở bước A.10. Dashboard BTC chỉ hiển thị email, tên, user id và concert tương ứng.
- Nhập khách mời từ Drive cần credentials Google service account hợp lệ trên môi trường chạy Worker; nếu chưa cấu hình, chỉ demo phần gán folder.
- Trước buổi demo mới, cleanup dữ liệu của `organizer2@gmail.com` theo mục "Cleanup" trong `SET_UP_GUIDE.md`.

## Bảng ánh xạ tính năng ↔ bước demo

| Tính năng                              | Bước demo |
| -------------------------------------- | --------- |
| Tạo hồ sơ + duyệt + auto-publish       | A.1–A.11  |
| Sơ đồ hạng vé (upload/lightbox/legend) | A.5, A.13 |
| Preview Organizer/Admin                | A.7, A.9  |
| Slug URL audience                      | A.13      |
| Thanh toán VNPay                       | A.14      |
| Thanh toán MoMo                        | B         |
| E-ticket QR                            | A.15, C   |
| Check-in checker (web/mobile)          | C1, C2    |
| Khách mời CSV + Google Drive           | A.6, C3   |
| Dashboard doanh thu + checker filter   | D         |
| Audit log web UI + phân quyền          | E1        |
| Quản lý tài khoản / yêu cầu xóa        | E2, E3    |
