import { Router } from "express";
import {
  adjustInventoryHandler,
  confirmPaymentHandler,
  getInventoryHandler,
  holdInventoryHandler,
  releaseInventoryHandler,
} from "./inventory.controller.js";
import { idempotencyMiddleware } from "../../shared/middleware/idempotency.middleware.js";
import { validateBody } from "../../shared/middleware/validate.middleware.js";
import {
  holdSchema,
  inventoryAdjustmentSchema,
  paymentConfirmationSchema,
  releaseSchema,
} from "./inventory.schema.js";
import { requireAuth } from "../../shared/middleware/auth.middleware.js";
import { requireRole } from "../../shared/guards/role.guard.js";

const router = Router();

// Admin: view source-of-truth inventory
router.get(
  "/admin/ticket-types/:ticket_type_id/inventory",
  requireAuth,
  requireRole("ORGANIZER", "ADMIN"),
  getInventoryHandler,
);

// Internal: hold tickets when creating an order (called by order service — no user JWT)
router.post(
  "/internal/inventory/holds",
  idempotencyMiddleware("inventory"),
  validateBody(holdSchema),
  holdInventoryHandler,
);

// Internal: release held tickets when order expires or is cancelled (worker — no user JWT)
router.post(
  "/internal/inventory/releases",
  validateBody(releaseSchema),
  releaseInventoryHandler,
);

// Internal: confirm payment, move held → sold (payment module — no user JWT)
router.post(
  "/internal/inventory/payment-confirmations",
  validateBody(paymentConfirmationSchema),
  confirmPaymentHandler,
);

// Admin: manual inventory adjustment
router.post(
  "/admin/ticket-types/:ticket_type_id/inventory-adjustments",
  requireAuth,
  requireRole("ADMIN"),
  validateBody(inventoryAdjustmentSchema),
  adjustInventoryHandler,
);

export default router;
