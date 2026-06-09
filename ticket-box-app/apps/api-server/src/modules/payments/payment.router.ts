import { Router } from 'express';
import { momoWebhookHandler, retryPaymentHandler, vnpayWebhookHandler } from './payment.controller.js';
import { paymentHealthHandler } from './payment.health.js';
import { webhookIdempotencyMiddleware } from './middlewares/index.js';
import { idempotencyMiddleware } from '../../shared/middleware/idempotency.middleware.js';
import { validateBody } from '../../shared/middleware/validate.middleware.js';
import { retryPaymentSchema } from './payment.schema.js';
import { requireAuth } from '../../shared/middleware/auth.middleware.js';
import { requireRole } from '../../shared/guards/role.guard.js';

const router = Router();

// POST /orders/:order_id/payments — create new payment attempt (retry) — AUDIENCE, ADMIN
router.post(
  '/orders/:order_id/payments',
  requireAuth,
  requireRole('AUDIENCE', 'ADMIN'),
  idempotencyMiddleware('payments'),
  validateBody(retryPaymentSchema, 'INVALID_REQUEST'),
  retryPaymentHandler,
);

// POST /payments/webhooks/vnpay — VNPAY IPN (public, signature-verified — no user JWT)
router.post('/payments/webhooks/vnpay', webhookIdempotencyMiddleware, vnpayWebhookHandler);

// POST /payments/webhooks/momo — MoMo IPN (public, signature-verified — no user JWT)
router.post('/payments/webhooks/momo', webhookIdempotencyMiddleware, momoWebhookHandler);

// GET /payments/health — circuit breaker status (public diagnostic)
router.get('/payments/health', paymentHealthHandler);

export default router;
