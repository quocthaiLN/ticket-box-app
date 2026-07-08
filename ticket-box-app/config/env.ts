import { fileURLToPath } from "node:url";
import path from "node:path";
import { createPrivateKey, createPublicKey } from "node:crypto";
import dotenv from "dotenv";

// Cặp khóa Ed25519 dev (chỉ để chạy local out-of-box). PRODUCTION phải override
// bằng QR_SIGNING_PRIVATE_KEY_B64 / QR_SIGNING_PUBLIC_KEY_B64. Lưu base64(PEM)
// để key vừa gọn trên 1 dòng .env. Tạo cặp mới:
//   node -e "const{generateKeyPairSync}=require('node:crypto');const{publicKey,privateKey}=generateKeyPairSync('ed25519');console.log('PRIV',Buffer.from(privateKey.export({type:'pkcs8',format:'pem'})).toString('base64'));console.log('PUB',Buffer.from(publicKey.export({type:'spki',format:'pem'})).toString('base64'))"
const DEV_QR_PRIVATE_KEY_B64 =
  "LS0tLS1CRUdJTiBQUklWQVRFIEtFWS0tLS0tCk1DNENBUUF3QlFZREsyVndCQ0lFSUZqdEJaUGhPdmk1ZkZZSkUzY2pRWU1YMU9ocjdoZGRLQUJ0ajg2YmZXcnYKLS0tLS1FTkQgUFJJVkFURSBLRVktLS0tLQo=";
const DEV_QR_PUBLIC_KEY_B64 =
  "LS0tLS1CRUdJTiBQVUJMSUMgS0VZLS0tLS0KTUNvd0JRWURLMlZ3QXlFQVJXN3RVWHM3cEFJZVU1bGgvOW13UU5pRmNQOTV1bG84VjNjYUlUM2RvZ1k9Ci0tLS0tRU5EIFBVQkxJQyBLRVktLS0tLQo=";

// Trả về PEM từ base64; coi biến môi trường rỗng/thiếu là dùng default dev.
const pemFromB64 = (value: string | undefined, fallback: string): string =>
  Buffer.from(value && value.trim() !== "" ? value : fallback, "base64").toString(
    "utf8",
  );

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

const optionalEnv = (name: string): string | undefined => {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
};

export const env = {
  server: {
    port: process.env["PORT"] ?? "3000",
    nodeEnv: process.env["NODE_ENV"] ?? "development",
    instanceId: process.env["INSTANCE_ID"] ?? "api-local",
    trustedGatewayIps: (process.env["TRUSTED_GATEWAY_IPS"] ?? "")
      .split(",")
      .map((ip) => ip.trim())
      .filter(Boolean),
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
    rateLimitWhitelistEnabled:
      process.env["ORDER_RATE_LIMIT_WHITELIST_ENABLED"] === "true",
    rateLimitWhitelist: (process.env["ORDER_RATE_LIMIT_WHITELIST"] ?? "")
      .split(",")
      .map((ip) => ip.trim())
      .filter(Boolean),
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
    // Chỉ dùng khi demo bằng payment mock. Sandbox/production vẫn tạo URL
    // VNPay cục bộ đúng contract thật và không gọi endpoint này.
    mockPrepareUrl: optionalEnv("VNPAY_MOCK_PREPARE_URL"),
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
    // Ký vé bằng private key (Ed25519) ở api-server; máy checker chỉ cần public
    // key để verify nên không thể giả mạo vé (và verify được cả khi offline).
    privateKey: createPrivateKey(
      pemFromB64(process.env["QR_SIGNING_PRIVATE_KEY_B64"], DEV_QR_PRIVATE_KEY_B64),
    ),
    publicKey: createPublicKey(
      pemFromB64(process.env["QR_SIGNING_PUBLIC_KEY_B64"], DEV_QR_PUBLIC_KEY_B64),
    ),
  },
};
