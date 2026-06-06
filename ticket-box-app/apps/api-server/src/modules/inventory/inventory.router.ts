import { Router } from 'express';
import {
  adjustInventoryHandler,
  confirmPaymentHandler,
  getInventoryHandler,
  holdInventoryHandler,
  releaseInventoryHandler,
} from './inventory.controller.js';
import { idempotencyMiddleware, validateBody } from './middleware/index.js';
import {
  validateHoldRequest,
  validateInventoryAdjustmentRequest,
  validatePaymentConfirmationRequest,
  validateReleaseRequest,
} from './inventory.schema.js';
import { requireAuth } from '../../shared/middleware/auth.middleware.js';
import { requireRole } from '../../shared/guards/role.guard.js';

const router = Router();

// Admin: view source-of-truth inventory
router.get(
  '/admin/ticket-types/:ticket_type_id/inventory',
  requireAuth,
  requireRole('ORGANIZER', 'ADMIN'),
  getInventoryHandler,
);

// Internal: hold tickets when creating an order (called by order service — no user JWT)
router.post(
  '/internal/inventory/holds',
  idempotencyMiddleware,
  validateBody(validateHoldRequest),
  holdInventoryHandler,
);

// Internal: release held tickets when order expires or is cancelled (worker — no user JWT)
router.post(
  '/internal/inventory/releases',
  validateBody(validateReleaseRequest),
  releaseInventoryHandler,
);

// Internal: confirm payment, move held → sold (payment module — no user JWT)
router.post(
  '/internal/inventory/payment-confirmations',
  validateBody(validatePaymentConfirmationRequest),
  confirmPaymentHandler,
);

// Admin: manual inventory adjustment
router.post(
  '/admin/ticket-types/:ticket_type_id/inventory-adjustments',
  requireAuth,
  requireRole('ADMIN'),
  validateBody(validateInventoryAdjustmentRequest),
  adjustInventoryHandler,
);

export default router;
