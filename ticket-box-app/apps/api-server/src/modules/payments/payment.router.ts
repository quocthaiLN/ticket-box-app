import { Router } from 'express';
import { momoWebhookHandler, retryPaymentHandler, vnpayWebhookHandler } from './payment.controller.js';
import { paymentHealthHandler } from './payment.health.js';
import { idempotencyMiddleware, validateBody } from './middlewares/index.js';
import { validateRetryPaymentRequest } from './payment.schema.js';
import type { RetryPaymentRequest } from './payment.type.js';

const router = Router();

// POST /orders/:order_id/payments — create new payment attempt (retry)
router.post(
  '/orders/:order_id/payments',
  idempotencyMiddleware,
  validateBody<RetryPaymentRequest>(validateRetryPaymentRequest),
  retryPaymentHandler,
);

// POST /payments/webhooks/vnpay — VNPAY IPN
router.post('/payments/webhooks/vnpay', vnpayWebhookHandler);

// POST /payments/webhooks/momo — MoMo IPN
router.post('/payments/webhooks/momo', momoWebhookHandler);

// GET /payments/health — circuit breaker and bulkhead status
router.get('/payments/health', paymentHealthHandler);

export default router;
