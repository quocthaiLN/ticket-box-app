import { fileURLToPath } from "node:url";
import path from "node:path";
import dotenv from "dotenv";

// `dotenv.config()` mặc định đọc `.env` theo process.cwd(). Khi chạy qua
// `npm run dev -w <workspace>` thì cwd là thư mục con (vd apps/api-server) nên
// KHÔNG thấy `.env` dùng chung ở gốc monorepo. Vì vậy trỏ tường minh tới
// `ticket-box-app/.env` dựa trên vị trí file này (config/env.ts -> `../.env`),
// để mọi app/worker/test/prisma đều nạp đúng cùng một file bất kể cwd.
const rootEnvPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.env",
);

dotenv.config({ path: rootEnvPath });

export const env = {
  server: {
    port: process.env["PORT"] ?? "3000",
    nodeEnv: process.env["NODE_ENV"] ?? "development",
  },

  // Web (frontend SPA) — backend redirect tới đây sau khi xử lý payment return.
  web: {
    url: process.env["WEB_URL"] ?? "http://localhost:3001",
  },

  // Auth / JWT
  auth: {
    jwtSecret: process.env["JWT_SECRET"] ?? "ticketbox-local-access-secret",
    jwtRefreshSecret:
      process.env["JWT_REFRESH_SECRET"] ?? "ticketbox-local-refresh-secret",
  },

  redis: {
    // URL chuẩn DUY NHẤT cho ioredis / BullMQ (worker, queue, cache).
    // Dùng redis:// (local/docker) hoặc rediss:// (Upstash/TLS) đều qua biến này.
    url: process.env["REDIS_URL"] ?? "redis://localhost:6379",
    // Fallback host:port khi không set REDIS_URL
    host: process.env["REDIS_HOST"] ?? "localhost",
    port: process.env["REDIS_PORT"] ?? "6379",
  },

  postgres: {
    url: process.env["DATABASE_URL"] ?? "",
  },

  // SMTP — worker dùng để gửi email (OTP, nhắc lịch, ...)
  smtp: {
    host: process.env["SMTP_HOST"] ?? "smtp.gmail.com",
    port: Number(process.env["SMTP_PORT"] ?? 587),
    secure: process.env["SMTP_SECURE"] === "true",
    user: process.env["SMTP_USER"] ?? "",
    pass: process.env["SMTP_PASS"] ?? "",
    from: process.env["SMTP_FROM"] ?? "TicketBox <noreply@ticketbox.vn>",
  },

  // Storage (local stub) — public base url + các thư mục gốc để resolve file
  storage: {
    publicBaseUrl:
      process.env["STORAGE_PUBLIC_BASE_URL"] ?? "http://localhost:9000",
    localRoot: process.env["STORAGE_LOCAL_ROOT"] ?? "",
    pressKitRoot: process.env["STORAGE_PRESS_KIT_ROOT"] ?? "",
    importRoot: process.env["STORAGE_IMPORT_ROOT"] ?? "",
  },

  // Orders — chính sách giữ chỗ: server tự đặt hạn giữ vé cho order HELD.
  order: {
    holdDurationSeconds: Number(
      process.env["ORDER_HOLD_DURATION_SECONDS"] ?? 900,
    ),
  },

  // Worker — job dọn dẹp đơn giữ chỗ hết hạn (expire-holds)
  worker: {
    expireHoldsIntervalMs: Number(
      process.env["EXPIRE_HOLDS_INTERVAL_MS"] ?? 60_000,
    ),
    expireHoldsBatchSize: Number(process.env["EXPIRE_HOLDS_BATCH_SIZE"] ?? 50),
    expireHoldsDryRun: process.env["EXPIRE_HOLDS_DRY_RUN"] === "true",
  },

  vnpay: {
    tmnCode: process.env["VNPAY_TMN_CODE"] ?? "TICKETBOX",
    hashSecret: process.env["VNPAY_HASH_SECRET"] ?? "ticketbox_secret",
    url:
      process.env["VNPAY_URL"] ??
      "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html",
    // Endpoint QueryDR để đối soát trạng thái giao dịch (khác trang redirect `url`).
    querydrUrl:
      process.env["VNPAY_QUERYDR_URL"] ??
      "https://sandbox.vnpayment.vn/merchant_webapi/api/transaction",
    returnUrl:
      process.env["VNPAY_RETURN_URL"] ??
      "http://localhost:3000/v1/payment/return",
    timeout: process.env["NODE_ENV"] === "production" ? 5_000 : 10_000,
    // Resilience: circuit breaker + bulkhead
    failureThreshold: Number(process.env["VNPAY_CB_FAILURE_THRESHOLD"] ?? 5),
    errorThreshold: Number(process.env["VNPAY_CB_ERROR_THRESHOLD"] ?? 50),
    resetTimeout: Number(process.env["VNPAY_CB_RESET_TIMEOUT"] ?? 30_000),
    bulkheadLimit: Number(process.env["VNPAY_BULKHEAD_LIMIT"] ?? 20),
  },

  momo: {
    partnerCode: process.env["MOMO_PARTNER_CODE"] ?? "TICKETBOX",
    accessKey: process.env["MOMO_ACCESS_KEY"] ?? "",
    secretKey: process.env["MOMO_SECRET_KEY"] ?? "",
    redirectUrl:
      process.env["MOMO_REDIRECT_URL"] ??
      "http://localhost:3000/v1/payment/return/momo",
    ipnUrl:
      process.env["MOMO_IPN_URL"] ??
      "http://localhost:4000/payments/webhooks/momo",
    endpoint:
      process.env["MOMO_ENDPOINT"] ??
      "https://test-payment.momo.vn/v2/gateway/api/create",
    // Endpoint query để đối soát trạng thái payment đã tạo (khác `endpoint` create).
    queryUrl:
      process.env["MOMO_QUERY_ENDPOINT"] ??
      "https://test-payment.momo.vn/v2/gateway/api/query",
    timeout: process.env["NODE_ENV"] === "production" ? 8_000 : 15_000,
    // Resilience: circuit breaker + bulkhead
    failureThreshold: Number(process.env["MOMO_CB_FAILURE_THRESHOLD"] ?? 5),
    errorThreshold: Number(process.env["MOMO_CB_ERROR_THRESHOLD"] ?? 50),
    resetTimeout: Number(process.env["MOMO_CB_RESET_TIMEOUT"] ?? 30_000),
    bulkheadLimit: Number(process.env["MOMO_BULKHEAD_LIMIT"] ?? 20),
  },

  qr: {
    signingSecret:
      process.env["QR_SIGNING_SECRET"] ??
      "qr_signing_secret_dev_change_in_prod",
  },
};
