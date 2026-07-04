import { Router } from 'express';
import {
  getMyTicketHandler,
  getMyTicketQrHandler,
  listMyTicketsHandler,
  voidTicketHandler,
} from './ticket.controller.js';
import { requireAuth } from '../../shared/middleware/auth.middleware.js';
import { requireRole } from '../../shared/guards/role.guard.js';

const router = Router();

// AUDIENCE: list own tickets
router.get('/me/tickets', requireAuth, requireRole('AUDIENCE', 'ADMIN'), listMyTicketsHandler);

// AUDIENCE: get single ticket detail
router.get('/me/tickets/:ticket_id', requireAuth, requireRole('AUDIENCE', 'ADMIN'), getMyTicketHandler);

// AUDIENCE: get QR payload for a ticket
router.get('/me/tickets/:ticket_id/qr', requireAuth, requireRole('AUDIENCE', 'ADMIN'), getMyTicketQrHandler);

// Internal/Admin: void a ticket (refund/cancel) — ADMIN only
router.post('/internal/tickets/:ticket_id/void', requireAuth, requireRole('ADMIN'), voidTicketHandler);

export default router;
