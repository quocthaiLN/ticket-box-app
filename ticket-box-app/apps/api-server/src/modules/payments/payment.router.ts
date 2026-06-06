import { Router } from 'express';
import { momoWebhookHandler, retryPaymentHandler, vnpayWebhookHandler } from './payment.controller.js';
import { paymentHealthHandler } from './payment.health.js';
import { idempotencyMiddleware, validateBody } from './middlewares/index.js';
import { validateRetryPaymentRequest } from './payment.schema.js';
import type { RetryPaymentRequest } from './payment.type.js';
import { requireAuth } from '../../shared/middleware/auth.middleware.js';
import { requireRole } from '../../shared/guards/role.guard.js';

const router = Router();

// POST /orders/:order_id/payments — create new payment attempt (retry) — AUDIENCE, ADMIN
router.post(
  '/orders/:order_id/payments',
  requireAuth,
  requireRole('AUDIENCE', 'ADMIN'),
  idempotencyMiddleware,
  validateBody<RetryPaymentRequest>(validateRetryPaymentRequest),
  retryPaymentHandler,
);

// POST /payments/webhooks/vnpay — VNPAY IPN (public, signature-verified — no user JWT)
router.post('/payments/webhooks/vnpay', vnpayWebhookHandler);

// POST /payments/webhooks/momo — MoMo IPN (public, signature-verified — no user JWT)
router.post('/payments/webhooks/momo', momoWebhookHandler);

// GET /payments/health — circuit breaker status (public diagnostic)
router.get('/payments/health', paymentHealthHandler);

export default router;
