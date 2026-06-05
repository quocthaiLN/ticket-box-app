import { Router } from 'express';
import {
  cancelOrderHandler,
  createOrderHandler,
  expireOrderHandler,
  getOrderHandler,
  listAdminOrdersHandler,
} from './order.controller.js';
import { idempotencyMiddleware, validateBody } from './middleware/index.js';
import { validateCreateOrderRequest } from './order.schema.js';

const router = Router();

// POST /orders - Create order (HELD) + payment URL
router.post(
  '/orders',
  idempotencyMiddleware,
  validateBody(validateCreateOrderRequest),
  createOrderHandler,
);

// GET /orders/:order_id - Poll order status (own order)
router.get(
  '/orders/:order_id',
  getOrderHandler,
);

// POST /orders/:order_id/cancel - Cancel HELD order
router.post(
  '/orders/:order_id/cancel',
  cancelOrderHandler,
);

// POST /internal/orders/:order_id/expire - Expire order (worker, idempotent)
router.post(
  '/internal/orders/:order_id/expire',
  expireOrderHandler,
);

// GET /admin/orders - Admin cursor-based list
router.get(
  '/admin/orders',
  listAdminOrdersHandler,
);

export default router;
