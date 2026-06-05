/// <reference types="node" />

export const env = {
  server: {
    port: process.env['PORT'] ?? '3000',
    nodeEnv: process.env['NODE_ENV'] ?? 'development',
  },

  redis: {
    url: process.env['UPSTASH_REDIS_URL'] ?? '',
  },

  postgres: {
    url: process.env['DATABASE_URL'] ?? '',
  },

  vnpay: {
    tmnCode: process.env['VNPAY_TMN_CODE'] ?? 'TICKETBOX',
    hashSecret: process.env['VNPAY_HASH_SECRET'] ?? 'ticketbox_secret',
    url: process.env['VNPAY_URL'] ?? 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
    returnUrl: process.env['VNPAY_RETURN_URL'] ?? 'http://localhost:3000/payment/return',
  },

  momo: {
    partnerCode: process.env['MOMO_PARTNER_CODE'] ?? 'TICKETBOX',
    accessKey: process.env['MOMO_ACCESS_KEY'] ?? '',
    secretKey: process.env['MOMO_SECRET_KEY'] ?? '',
    redirectUrl: process.env['MOMO_REDIRECT_URL'] ?? 'http://localhost:3000/payment/return',
    ipnUrl: process.env['MOMO_IPN_URL'] ?? 'http://localhost:4000/payments/webhooks/momo',
    endpoint: process.env['MOMO_ENDPOINT'] ?? 'https://test-payment.momo.vn/v2/gateway/api/create',
  },

  qr: {
    signingSecret: process.env['QR_SIGNING_SECRET'] ?? 'qr_signing_secret_dev_change_in_prod',
  },
};
