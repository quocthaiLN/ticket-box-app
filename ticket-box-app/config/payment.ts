/// <reference types="node" />

export const paymentConfig = {
  vnpay: {
    tmnCode: process.env['VNPAY_TMN_CODE'] ?? 'TICKETBOX',
    hashSecret: process.env['VNPAY_HASH_SECRET'] ?? 'ticketbox_secret',
    url: process.env['VNPAY_URL'] ?? 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
    // VNPay server-to-server QueryDR endpoint (reconciliation). Point at the mock in tests.
    querydrUrl: process.env['VNPAY_QUERYDR_URL'] ?? 'https://sandbox.vnpayment.vn/merchant_webapi/api/transaction',
    returnUrl: process.env['VNPAY_RETURN_URL'] ?? 'http://localhost:3000/payment/return',
    timeout: process.env.NODE_ENV === 'production' ? 5000 : 10000,
    // Circuit breaker: open after this many consecutive failures
    failureThreshold: Number(process.env['VNPAY_CB_FAILURE_THRESHOLD'] ?? 5),
    // Circuit breaker: % error rate threshold (informational, used for observability)
    errorThreshold: Number(process.env['VNPAY_CB_ERROR_THRESHOLD'] ?? 50),
    // Circuit breaker: ms to wait in OPEN state before probing (HALF_OPEN)
    resetTimeout: Number(process.env['VNPAY_CB_RESET_TIMEOUT'] ?? 30000),
    // Circuit breaker: successful HALF_OPEN probes required before closing
    halfOpenSuccessThreshold: Number(process.env['VNPAY_CB_HALF_OPEN_SUCCESS_THRESHOLD'] ?? 5),
    // Bulkhead: max concurrent calls to this provider
    bulkheadLimit: Number(process.env['VNPAY_BULKHEAD_LIMIT'] ?? 20),
  },

  momo: {
    partnerCode: process.env['MOMO_PARTNER_CODE'] ?? 'TICKETBOX',
    accessKey: process.env['MOMO_ACCESS_KEY'] ?? '',
    secretKey: process.env['MOMO_SECRET_KEY'] ?? '',
    redirectUrl: process.env['MOMO_REDIRECT_URL'] ?? 'http://localhost:3000/payment/return',
    ipnUrl: process.env['MOMO_IPN_URL'] ?? 'http://localhost:4000/payments/webhooks/momo',
    endpoint: process.env['MOMO_ENDPOINT'] ?? 'https://test-payment.momo.vn/v2/gateway/api/create',
    // MoMo server-to-server query endpoint (reconciliation). Point at the mock in tests.
    queryUrl: process.env['MOMO_QUERY_URL'] ?? 'https://test-payment.momo.vn/v2/gateway/api/query',
    timeout: process.env.NODE_ENV === 'production' ? 8000 : 15000,
    failureThreshold: Number(process.env['MOMO_CB_FAILURE_THRESHOLD'] ?? 5),
    errorThreshold: Number(process.env['MOMO_CB_ERROR_THRESHOLD'] ?? 50),
    resetTimeout: Number(process.env['MOMO_CB_RESET_TIMEOUT'] ?? 30000),
    halfOpenSuccessThreshold: Number(process.env['MOMO_CB_HALF_OPEN_SUCCESS_THRESHOLD'] ?? 5),
    bulkheadLimit: Number(process.env['MOMO_BULKHEAD_LIMIT'] ?? 20),
  },
};
