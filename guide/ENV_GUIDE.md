# TicketBox — Hướng dẫn cấu hình biến môi trường (.env)

Tài liệu này giải thích từng biến trong `ticket-box-app/.env.example`, mức độ bắt buộc, và hướng dẫn chi tiết cách lấy từng giá trị ở đâu, như thế nào.

## 1. Nguyên tắc chung

Toàn bộ monorepo (api-server, worker-server, payment-mocks, tests, prisma) đọc duy nhất một file `.env` đặt tại `ticket-box-app/.env`.

Cách tạo file:

```
cd ticket-box-app
cp .env.example .env
```

Trên Windows PowerShell dùng: `Copy-Item .env.example .env`.

Không commit file `.env` thật lên git, chỉ commit `.env.example`. Không đưa secret thật vào `.env.example`. Sau khi chỉnh `DATABASE_URL`, chạy lại `npm run db:generate`, `db:migrate`, `db:seed`.

## 2. Mức độ bắt buộc

Nhóm bắt buộc để chạy local: core server/web, database, auth JWT, redis. Các nhóm này đã có sẵn giá trị đúng trong `.env.example`, chỉ cần chỉnh nếu môi trường bạn khác.

Nhóm chỉ cần khi demo tính năng tương ứng: SMTP (email thật), AI Artist Bio, Supabase (press kit và ảnh nghệ sĩ), Google Drive (import khách mời), VNPay, MoMo.

Nhóm tùy chọn có sẵn default, thường không cần đụng: chính sách giữ chỗ, job dọn hold, storage local, payment mock port. Riêng QR ký vé bỏ trống sẽ dùng khóa dev; bản production bắt buộc phải tự sinh và điền.

## 3. Core server và web

```
NODE_ENV=development
PORT=3000
WEB_URL=http://localhost:3001
VITE_API_BASE_URL=http://localhost:3000/v1
```

Đây là các giá trị mặc định, không cần lấy từ đâu, chỉ tự đặt cho khớp môi trường. Cổng mặc định: API 3000, Web 3001, Payment mock 4100. Nếu đổi `PORT` của API thì phải cập nhật `VITE_API_BASE_URL` và tất cả URL return/IPN của payment cho khớp.

## 4. Database (PostgreSQL)

```
DATABASE_URL=postgresql://ticketbox:ticketbox@localhost:5433/ticketbox?schema=public
```

Giá trị này khớp sẵn với `docker-compose.yml`: container `ticketbox-postgres` map cổng 5433 ở máy vào 5432 trong container, user và password đều là `ticketbox`, database tên `ticketbox`.

Cách có được database: chạy `cd ticket-box-app && docker compose up -d postgres redis`. Không cần lấy thông tin ở đâu vì user/password/tên DB đã định nghĩa trong `docker-compose.yml`.

Lưu ý quan trọng: nếu máy bạn đang chạy sẵn một PostgreSQL local ở cổng 5432, đừng đổi URL sang cổng đó. Container demo dùng 5433. Nối nhầm sang Postgres 5432 khác timezone có thể làm order ở trạng thái HELD bị hết hạn sớm.

## 5. Auth (JWT)

```
JWT_SECRET=ticketbox-local-access-secret
JWT_REFRESH_SECRET=ticketbox-local-refresh-secret
```

Local dùng luôn giá trị mẫu. Đây là chuỗi bí mật do bạn tự đặt, không lấy từ dịch vụ nào. Với production, tự sinh một chuỗi ngẫu nhiên đủ dài và khác nhau cho access và refresh, ví dụ chạy `node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"` hai lần.

## 6. Redis

```
REDIS_URL=redis://localhost:6379
```

Dùng cho hàng đợi worker (BullMQ) và cache catalog. Redis chạy từ chính docker compose ở trên, container `ticketbox-redis` map 6379. Không cần lấy thông tin ở đâu. Có thể thay bằng cặp `REDIS_HOST` và `REDIS_PORT` nếu muốn tách.

## 7. SMTP (email OTP, nhắc lịch)

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SMTP_FROM=TicketBox <noreply@ticketbox.vn>
```

Nếu để trống `SMTP_USER` và `SMTP_PASS`, worker chỉ in email ra console, đủ để demo luồng notification mà không gửi thật.

Cách lấy khi muốn gửi email thật bằng Gmail: vào tài khoản Google, bật xác thực hai bước, sau đó vào phần Bảo mật chọn App passwords (mật khẩu ứng dụng), tạo một mật khẩu mới cho ứng dụng. Google sinh chuỗi 16 ký tự, dán chuỗi đó vào `SMTP_PASS` và điền địa chỉ Gmail vào `SMTP_USER`. Không dùng mật khẩu đăng nhập thường vì Gmail chặn.

## 8. Orders và Worker (tùy chọn, có default)

```
ORDER_HOLD_DURATION_SECONDS=900
EXPIRE_HOLDS_INTERVAL_MS=60000
EXPIRE_HOLDS_BATCH_SIZE=50
EXPIRE_HOLDS_DRY_RUN=false
```

Là các con số chính sách do bạn tự chọn, không lấy từ đâu. `ORDER_HOLD_DURATION_SECONDS` là thời gian giữ chỗ tính bằng giây. `EXPIRE_HOLDS_INTERVAL_MS` là chu kỳ job dọn hold hết hạn. `EXPIRE_HOLDS_DRY_RUN` đặt true thì job chỉ log chứ không đổi trạng thái.

## 9. Storage local (tùy chọn)

```
STORAGE_PUBLIC_BASE_URL=http://localhost:9000
STORAGE_LOCAL_ROOT=
STORAGE_PRESS_KIT_ROOT=
STORAGE_IMPORT_ROOT=
```

Bỏ trống sẽ dùng đường dẫn mặc định trong code. Chỉ điền khi muốn đổi nơi lưu file trên máy, giá trị là đường dẫn thư mục do bạn tự chọn.

## 10. AI Artist Bio

```
AI_BASE_URL=https://api.groq.com/openai/v1
AI_API_KEY=
AI_MODEL=llama-3.3-70b-versatile
AI_MAX_SOURCE_CHARS=8000
AI_TOKENS_PER_SECTION=500
AI_MAX_OUTPUT_TOKENS=6000
```

Mặc định dùng Groq vì miễn phí và không cần thẻ tín dụng.

Cách lấy `AI_API_KEY` của Groq: mở console.groq.com, đăng nhập bằng email hoặc Google, vào mục API Keys, bấm Create API Key, copy chuỗi key và dán vào `AI_API_KEY`. Hai biến `AI_BASE_URL` và `AI_MODEL` giữ nguyên.

Đổi nhà cung cấp chỉ bằng ba biến trên. Nếu dùng Ollama chạy offline trên máy thì đặt `AI_BASE_URL=http://localhost:11434/v1`, `AI_MODEL=qwen2.5`, `AI_API_KEY=ollama` (Ollama không kiểm tra key nên điền chữ bất kỳ). Nếu dùng OpenRouter thì lấy key tại openrouter.ai trong mục Keys, đặt `AI_BASE_URL=https://openrouter.ai/api/v1` và `AI_MODEL=meta-llama/llama-3.3-70b-instruct:free`.

Ba biến còn lại điều chỉnh ngân sách token, để nguyên là được.

## 11. Supabase Storage (press kit và ảnh nghệ sĩ)

```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_PRESS_KIT_BUCKET=press-kits
SUPABASE_ARTIST_IMAGE_BUCKET=artist-images
```

Cách lấy: vào supabase.com, tạo tài khoản và tạo một project mới. Sau khi project khởi tạo xong, vào phần Project Settings rồi mục API. Tại đó copy Project URL dán vào `SUPABASE_URL`, và copy khóa service_role (nằm ở phần Project API keys, khóa bí mật) dán vào `SUPABASE_SERVICE_ROLE_KEY`. Khóa service_role chỉ để ở backend, tuyệt đối không đưa ra frontend.

Tiếp theo vào mục Storage của project, tạo hai bucket: bucket tên `press-kits` để chế độ Private, bucket tên `artist-images` để chế độ Public. Tên bucket phải trùng với hai biến còn lại.

## 12. Guest List CSV import (Google Drive)

```
GOOGLE_SERVICE_ACCOUNT_JSON=
```

Cách lấy: vào Google Cloud Console, tạo hoặc chọn một project. Vào mục APIs & Services, bật Google Drive API cho project. Sau đó vào IAM & Admin rồi Service Accounts, tạo một service account mới. Mở service account vừa tạo, sang tab Keys, bấm Add Key rồi Create new key, chọn định dạng JSON, hệ thống tải về một file JSON.

Chuyển nội dung file JSON đó thành base64 rồi dán vào biến, chạy `base64 -w0 service-account.json`. Có thể dán trực tiếp nội dung JSON thô cũng được vì code chấp nhận cả hai.

Cuối cùng lấy địa chỉ email của service account (dạng tên@project.iam.gserviceaccount.com, xem trong màn hình service account), rồi chia sẻ thư mục Google Drive chứa file CSV khách mời cho email đó với quyền Viewer. Không share thì worker không đọc được thư mục. Scheduler nightly-guest-import trên worker sẽ tự nhập lúc 0h ngày diễn; khi demo có thể nhờ admin trigger nhập ngay.

## 13. QR ký vé (Ed25519)

```
QR_SIGNING_PRIVATE_KEY_B64=
QR_SIGNING_PUBLIC_KEY_B64=
```

Bỏ trống thì hệ thống dùng cặp khóa dev mặc định trong `config/env.ts`, đủ để chạy local và demo. Bản production bắt buộc phải tự sinh cặp khóa riêng và điền vào.

Cách sinh cặp khóa, chạy lệnh sau rồi copy hai dòng kết quả vào file:

```
node -e "const{generateKeyPairSync}=require('node:crypto');const{publicKey,privateKey}=generateKeyPairSync('ed25519');console.log('QR_SIGNING_PRIVATE_KEY_B64='+Buffer.from(privateKey.export({type:'pkcs8',format:'pem'})).toString('base64'));console.log('QR_SIGNING_PUBLIC_KEY_B64='+Buffer.from(publicKey.export({type:'spki',format:'pem'})).toString('base64'))"
```

Private key dùng để ký QR ở api-server, public key dùng để verify và có thể đặt ở máy checker.

## 14. VNPay (sandbox)

```
VNPAY_TMN_CODE=TICKETBOX
VNPAY_HASH_SECRET=ticketbox_secret
VNPAY_URL=https://sandbox.vnpayment.vn/paymentv2/vpcpay.html
VNPAY_QUERYDR_URL=https://sandbox.vnpayment.vn/merchant_webapi/api/transaction
VNPAY_RETURN_URL=http://localhost:3000/v1/payment/return
```

Để demo local có thể dùng luôn giá trị mẫu kết hợp payment mock ở mục 16, không cần tài khoản thật. `VNPAY_RETURN_URL` phải trỏ về đúng cổng API.

Nếu muốn kết nối sandbox VNPay thật, đăng ký tài khoản merchant sandbox tại trang sandbox.vnpayment.vn, sau khi được cấp sẽ có mã website (TMN code) và chuỗi bí mật (hash secret), dán lần lượt vào `VNPAY_TMN_CODE` và `VNPAY_HASH_SECRET`. Các URL còn lại giữ nguyên. Những biến bắt đầu bằng `VNPAY_CB_` và `VNPAY_BULKHEAD_LIMIT` là cấu hình circuit breaker, để mặc định.

## 15. MoMo (sandbox)

```
MOMO_PARTNER_CODE=TICKETBOX
MOMO_ACCESS_KEY=
MOMO_SECRET_KEY=
MOMO_REDIRECT_URL=http://localhost:3000/v1/payment/return/momo
MOMO_IPN_URL=http://localhost:3000/v1/payments/webhooks/momo
MOMO_ENDPOINT=https://test-payment.momo.vn/v2/gateway/api/create
MOMO_QUERY_ENDPOINT=https://test-payment.momo.vn/v2/gateway/api/query
MOMO_QUERY_URL=https://test-payment.momo.vn/v2/gateway/api/query
```

Để demo local dùng payment mock thì không cần điền access key và secret key thật.

Nếu muốn kết nối sandbox MoMo thật, vào trang developers.momo.vn, đăng ký tài khoản test, hệ thống cấp partner code, access key và secret key. Dán ba giá trị đó vào `MOMO_PARTNER_CODE`, `MOMO_ACCESS_KEY`, `MOMO_SECRET_KEY`. Các URL endpoint giữ nguyên. Biến `MOMO_QUERY_URL` là alias cũ nhưng file `config/payment.ts` vẫn đọc nên giữ lại để tránh lỗi.

## 16. Payment mock server

```
MOCK_PAYMENTS_PORT=4100
```

Cổng của server giả lập cổng thanh toán trong `apps/payment-mocks`, cho phép demo VNPay và MoMo mà không cần tài khoản merchant thật. Là số cổng do bạn tự chọn, mặc định 4100.

## 17. Checklist trước khi chạy

Khởi động database và redis bằng `docker compose up -d postgres redis`, đảm bảo Postgres ở cổng 5433 và Redis ở 6379.

Copy `.env.example` thành `.env`, kiểm tra `DATABASE_URL` trỏ đúng cổng 5433.

Cài dependency bằng `npm install` ở gốc `ticket-box-app`.

Chạy lần lượt `npm run db:generate`, `npm run db:migrate`, `npm run db:seed`.

Chạy API, Web, Worker, Payment mock theo `SET_UP_GUIDE.md`.

Muốn demo tính năng nào (AI, Supabase, Google Drive, VNPay, MoMo) thì mới cần lấy và điền nhóm biến tương ứng ở các mục trên.
