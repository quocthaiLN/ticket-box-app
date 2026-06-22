import { Router } from 'express';
import { momoWebhookHandler, createPaymentHandler, vnpayWebhookHandler, vnpayReturnHandler, momoReturnHandler } from './payment.controller.js';
import { paymentHealthHandler } from './payment.health.js';
import { webhookIdempotencyMiddleware } from './middlewares/index.js';
import { idempotencyMiddleware } from '../../shared/middleware/idempotency.middleware.js';
import { validateBody, validateQuery } from '../../shared/middleware/validate.middleware.js';
import { createPaymentSchema, momoReturnQuerySchema, vnpayReturnQuerySchema } from './payment.schema.js';
import { requireAuth } from '../../shared/middleware/auth.middleware.js';
import { requireRole } from '../../shared/guards/role.guard.js';

const router = Router();

// POST /orders/:order_id/payments — create new payment attempt (retry) — AUDIENCE, ADMIN
router.post(
  '/orders/:order_id/payments',
  requireAuth,
  requireRole('AUDIENCE', 'ADMIN'),
  idempotencyMiddleware('payments'),
  validateBody(createPaymentSchema, 'INVALID_REQUEST'),
  createPaymentHandler,
);

// GET /payment/return — VNPAY browser return (public, signature-verified — no user JWT)
router.get('/payment/return', validateQuery(vnpayReturnQuerySchema, 'INVALID_PAYMENT_RETURN'), vnpayReturnHandler);

// GET /payment/return/momo — MoMo browser return (public, signature-verified — no user JWT)
router.get('/payment/return/momo', validateQuery(momoReturnQuerySchema, 'INVALID_PAYMENT_RETURN'), momoReturnHandler);

// POST /payments/webhooks/vnpay — VNPAY IPN (public, signature-verified — no user JWT)
router.post('/payments/webhooks/vnpay', webhookIdempotencyMiddleware, vnpayWebhookHandler);

// POST /payments/webhooks/momo — MoMo IPN (public, signature-verified — no user JWT)
router.post('/payments/webhooks/momo', webhookIdempotencyMiddleware, momoWebhookHandler);

// GET /payments/health — circuit breaker status (public diagnostic)
router.get('/payments/health', paymentHealthHandler);

export default router;
