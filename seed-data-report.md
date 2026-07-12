# Seed Data Report

Nguồn kiểm tra chính: `ticket-box-app/packages/database/prisma/seed.mjs`.

Cập nhật sau chuẩn hóa: `npm run db:seed` hiện trỏ về profile `demo`; load test được tách sang `npm run db:seed:loadtest`.

Mục tiêu của báo cáo này là nhìn rõ seed hiện đang sinh ra bao nhiêu dữ liệu, dữ liệu nào phục vụ demo, dữ liệu nào phục vụ load test/dev, và các điểm nên chuẩn hóa để database demo cho thầy sạch, dễ giải thích, dễ reset.

## Tóm tắt nhanh

Seed hiện tại vẫn dùng chung một file, nhưng đã được tách bằng profile:

| Script | Profile | Mục tiêu |
| --- | --- | --- |
| `npm run db:seed` | `demo` | Seed demo sạch mặc định |
| `npm run db:seed:demo` | `demo` | Alias rõ nghĩa cho demo |
| `npm run db:seed:dev` | `dev` | Seed dev nội bộ, không cleanup dữ liệu test cũ |
| `npm run db:seed:loadtest` | `loadtest` | Seed demo nền + user load test |

Các nhóm dữ liệu chính:

| Nhóm | Hàm seed | Vai trò |
| --- | --- | --- |
| Tài khoản demo | `seedUsers()` | Tạo account đăng nhập cho audience, organizer, checker, admin |
| Load test users | `seedLoadTestUsers()` | Tạo audience số lượng lớn cho k6/load test |
| Catalog concert | `seedCatalog()` | Tạo venue, concert, zone, gate, ticket type |
| Workflow organizer/admin | `seedOrganizerWorkflow()` | Tạo hồ sơ organizer request, deletion request, checker account |
| Vé, payment, vận hành | `seedDemoTickets()`, `seedOperations()` | Tạo order/payment/ticket mẫu, thiết bị check-in, guest list, AI bio job |

Điểm đã xử lý: seed demo mặc định không còn tạo **80.000 user load test**. Load test users chỉ được tạo khi chạy `db:seed:loadtest`, mặc định 1.000 user và có thể đổi bằng `LOAD_TEST_USER_COUNT`.

## Số lượng dữ liệu hiện tại

Số lượng dưới đây tính theo profile `demo` trên database sạch.

| Entity | Số lượng | Ghi chú |
| --- | ---: | --- |
| `users` demo chính | 9 | Admin, audience, 4 organizer, 3 checker |
| `users` load test | 0 | Profile demo cleanup `loadtest%@ticketbox.test` |
| `venues` | 8 | 4 venue cũ + 4 venue concert/show lớn |
| `concerts` | 10 | 9 `PUBLISHED`, 1 `DRAFT` |
| `seat_zones` catalog | 41 | Zone bán vé theo từng concert |
| `seat_zones` guest | 10 | Mỗi concert thêm 1 zone `GUEST` |
| Tổng `seat_zones` | 51 | 41 catalog + 10 guest |
| `checkin_gates` catalog | 41 | Mỗi zone bán vé có 1 gate |
| `checkin_gates` guest | 10 | Mỗi concert thêm 1 `GUEST_GATE` |
| Tổng `checkin_gates` | 51 | 41 catalog + 10 guest |
| `checkin_gate_zones` | 51 | Mapping gate-zone tương ứng |
| `ticket_types` | 41 | Khớp số zone bán vé |
| `organizer_requests` | 3 | 1 pending, 1 approved, 1 rejected |
| `concert_checker_accounts` | 11 | 9 legacy + 2 cho secret show |
| `concert_deletion_requests` | 2 | 1 pending, 1 rejected |
| `orders` mẫu | 3 | Đều `CONFIRMED`, gắn audience demo |
| `order_items` mẫu | 3 | Mỗi order 1 item |
| `payments` mẫu | 3 | 2 VNPAY, 1 MOMO, đều `SUCCEEDED` |
| `tickets` mẫu | 3 | 2 `ISSUED`, 1 `CHECKED_IN` |
| `checkin_devices` | 20 | Mỗi concert 2 device: ticket gate và guest gate |
| `artist_bio_jobs` | 10 | 2 `DONE`, 8 `PENDING` |
| `guest_list` | 3 | 2 invited, 1 checked-in cho concert đầu tiên |

## Account demo hiện có

Mật khẩu chung: `Password@123`.

| Role | Email kỳ vọng | Trạng thái hiện tại |
| --- | --- | --- |
| Admin | `admin@gmail.com` | Có |
| Audience | `audience@gmail.com` | Có |
| Organizer | `organizer@gmail.com` | Có |
| Organizer 2 | `organizer2@gmail.com` | Có |
| Organizer Yeah1 | `yeah1@gmail.com` | Có, sở hữu `Anh Trai Vượt Ngàn Chông Gai` và `Chị Đẹp Đạp Gió Rẽ Sóng` |
| Organizer DatVietVAC | `DatVietVAC@gmail.com` | Có, sở hữu `Anh Trai Say Hi` và `Em Xinh Say Hi` |
| Checker | `checker@gmail.com` | Có |
| Checker cũ | `checker@ticketbox.test` | Đã bị cleanup khỏi profile demo |
| Checker secret 1 | `checker-secret-1@ticketbox.test` | Có |
| Checker secret 2 | `checker-secret-2@ticketbox.test` | Có |

Vấn đề checker duplicate đã xử lý: `seedUsers()` chỉ còn một account checker chính là `checker@gmail.com`.

## Concert demo hiện có

| Concert | Status | Ticket types | Tổng vé cấu hình | Held | Sold |
| --- | --- | ---: | ---: | ---: | ---: |
| Ánh Sáng Màn Đêm | `PUBLISHED` | 4 | 5.000 | 0 | 0 |
| Đi Qua Thương Nhớ Live Concert | `PUBLISHED` | 5 | 35.500 | 800 | 22.970 |
| Our 20th Moment 2026 | `PUBLISHED` | 4 | 8.500 | 193 | 5.937 |
| Một Thời Đã Yêu | `PUBLISHED` | 3 | 580 | 17 | 468 |
| Nơi Tình Yêu Bắt Đầu | `PUBLISHED` | 3 | 3.050 | 83 | 2.175 |
| Sắp Công Bố: Đêm Diễn Bí Mật | `DRAFT` | 2 | 1.320 | 0 | 0 |
| Anh Trai Say Hi | `PUBLISHED` | 5 | 18.300 | 352 | 14.970 |
| Em Xinh Say Hi | `PUBLISHED` | 5 | 20.500 | 515 | 15.660 |
| Anh Trai Vượt Ngàn Chông Gai | `PUBLISHED` | 5 | 13.400 | 277 | 10.490 |
| Chị Đẹp Đạp Gió Rẽ Sóng | `PUBLISHED` | 5 | 23.000 | 510 | 17.490 |

Tổng catalog bán vé: 41 ticket types, tổng quantity cấu hình là 129.150 vé.

4 concert chính mới đều có sold ratio tối thiểu theo từng hạng vé trên 70%.

## Các điểm đã chuẩn hóa

1. `db:seed` mặc định chạy profile `demo`.
2. `db:seed:loadtest` tách riêng load test users.
3. `LOAD_TEST_USER_COUNT` điều chỉnh số user load test, mặc định 1.000.
4. Profile demo cleanup `loadtest%@ticketbox.test` nếu database từng bị seed load test.
5. Checker demo không còn bị ghi đè từ `checker@gmail.com` sang `checker@ticketbox.test`.
6. Guest checked-in dùng timestamp cố định thay vì `new Date()`.
7. Tạo `concert_checker_accounts` ổn định hơn bằng cách cleanup theo cả `id` và cặp `(concertId, userId)` trước khi tạo.

## Các điểm còn nên cân nhắc cho demo thầy

1. `seedDemoTickets()` xóa dữ liệu riêng concert đầu tiên.
   - Hàm xóa ticket/payment/order/counter của `LOAD_TEST_CONCERT_ID` trước khi tạo vé mẫu cho các concert khác.
   - Logic này hơi bất ngờ khi đọc và có thể làm mất dữ liệu nếu demo đã thao tác trên concert đầu tiên.

2. Dữ liệu organizer2 chưa thật sự là một kịch bản sạch.
   - Có account `organizer2@gmail.com`, nhưng seed chính gần như gắn catalog/workflow với `organizer@gmail.com`.
   - Nếu demo flow "organizer2 tạo hồ sơ mới", nên để organizer2 hoàn toàn trống sau seed.

3. Số lượng sold/held trong ticket type khá lớn.
   - Hữu ích để dashboard nhìn có doanh thu, nhưng không đi kèm đủ order/payment/ticket thật tương ứng.
   - Nếu thầy hỏi đối soát, số sold trên ticket type không khớp với số ticket mẫu đang có.

4. Catalog demo hiện có 10 concert và 41 ticket type.
   - Đủ phong phú để trình bày UI, gồm 4 concert chính theo yêu cầu mới và các concert cũ làm nền.
   - Nếu muốn demo cực gọn, có thể giảm nhóm concert phụ nhưng nên giữ 4 concert chính.

## Đề xuất chuẩn hóa seed demo

Seed hiện đã có 3 mức rõ ràng:

| File/lệnh đề xuất | Mục tiêu | Dữ liệu nên có |
| --- | --- | --- |
| `db:seed:demo` | Demo sạch cho thầy | Demo data, không có load test users |
| `db:seed:dev` | Dev nội bộ | Demo data, không cleanup dữ liệu test cũ |
| `db:seed:loadtest` | Test tải/k6 | Demo data + user load test tùy biến bằng env |

## Bộ dữ liệu demo sạch nên giữ

Đề xuất cho `seed:demo`:

| Nhóm | Số lượng đề xuất | Ghi chú |
| --- | ---: | --- |
| Admin | 1 | `admin@gmail.com` |
| Audience | 2 | 1 audience sạch, 1 audience đã mua vé nếu cần |
| Organizer | 4 | `organizer@gmail.com`, `organizer2@gmail.com`, `yeah1@gmail.com`, `DatVietVAC@gmail.com` |
| Checker | 3 | Email rõ ràng, không ghi đè |
| Venue | 8 | Gồm venue cũ và venue show lớn |
| Concert published | 9 | 4 concert chính + 5 concert cũ |
| Concert draft | 1 | Dùng cho flow admin approve/auto-publish |
| Ticket type/zone | 5 cho concert chính | Tránh vượt công thức seed id hiện tại |
| Order/payment/ticket mẫu | 1-2 | Đủ demo "vé của tôi" và QR |
| Guest list | 2-3 | Đủ invited + checked-in |
| Load test users | 0 | Không đưa vào demo seed |

- Tạo account Organizer `yeah1@gmail.com` sở hữu concert Anh Trai Vượt Ngàn Chông Gai, Chị Đẹp Đạp Gió Rẽ Sóng
- Tạo account Organizer `DatVietVAC@gmail.com` sở hữu concert Anh Trai Say Hi, Em Xinh Say Hi.
- Thêm concert Anh Trai Say Hi, Em Xinh Say Hi, Anh Trai Vượt Ngàn Chông Gai, Chị Đẹp Đạp Gió Rẽ Sóng là các concert chính. (Các file ảnh, thông tin, seat map cần thiết chủ động tải thêm từ network, đặt số vé đã bán trên 70%)
- Giữ các concert cũ đã có làm concert phụ.

## Việc nên sửa trước buổi demo

1. Quyết định rõ organizer nào có dữ liệu sẵn, organizer nào để sạch để demo tạo mới.
2. Giảm catalog demo xuống 3-4 concert nếu chỉ cần demo flow chính.
3. Đồng bộ `soldQuantity` với order/ticket mẫu, hoặc ghi rõ sold/held là snapshot dashboard giả lập.
4. Dùng script reset/demo rõ ràng:

```bash
npm run db:migrate
npm run db:seed
```

Nếu cần reset sạch local:

```bash
npx prisma migrate reset --schema=packages/database/prisma/schema.prisma --force
npm run db:seed:demo
```

## Kết luận

Seed hiện tại đã phù hợp hơn cho demo sạch vì load test users được tách riêng, account checker ổn định, và timestamp guest check-in không còn biến động theo thời điểm chạy seed.

Ưu tiên tiếp theo nếu muốn làm gọn hơn nữa: giảm catalog demo, quyết định kịch bản organizer2, và đồng bộ số liệu sold/held với order/ticket mẫu.
