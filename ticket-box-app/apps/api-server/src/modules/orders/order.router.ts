import { Router } from 'express';
import {
  cancelOrderHandler,
  createOrderHandler,
  expireOrderHandler,
  getOrderHandler,
  getTicketQuotaHandler,
  listAdminOrdersHandler,
} from './order.controller.js';
import { idempotencyMiddleware } from '../../shared/middleware/idempotency.middleware.js';
import { validateBody } from '../../shared/middleware/validate.middleware.js';
import { createOrderSchema } from './order.schema.js';
import { requireAuth } from '../../shared/middleware/auth.middleware.js';
import { requireRole } from '../../shared/guards/role.guard.js';

const router = Router();

// GET /concerts/:concert_id/my-ticket-quota — quota cá nhân, không cache chung.
router.get(
  '/concerts/:concert_id/my-ticket-quota',
  requireAuth,
  requireRole('AUDIENCE', 'ADMIN'),
  getTicketQuotaHandler,
);

// POST /orders - Create order (HELD) + payment URL — AUDIENCE, ADMIN
router.post(
  '/orders',
  requireAuth,
  requireRole('AUDIENCE', 'ADMIN'),
  idempotencyMiddleware('orders'),
  validateBody(createOrderSchema, 'INVALID_CHECKOUT_REQUEST'),
  createOrderHandler,
);

// GET /orders/:order_id - Poll order status (own order) — AUDIENCE, ADMIN
router.get(
  '/orders/:order_id',
  requireAuth,
  requireRole('AUDIENCE', 'ADMIN'),
  getOrderHandler,
);

// POST /orders/:order_id/cancel - Cancel HELD order — AUDIENCE, ADMIN
router.post(
  '/orders/:order_id/cancel',
  requireAuth,
  requireRole('AUDIENCE', 'ADMIN'),
  cancelOrderHandler,
);

// POST /internal/orders/:order_id/expire - Expire order (worker — no user JWT)
router.post(
  '/internal/orders/:order_id/expire',
  expireOrderHandler,
);

// GET /admin/orders - Admin cursor-based list — ORGANIZER, ADMIN
router.get(
  '/admin/orders',
  requireAuth,
  requireRole('ORGANIZER', 'ADMIN'),
  listAdminOrdersHandler,
);

export default router;
