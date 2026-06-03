import { Router } from 'express';
import {
  getMyTicketHandler,
  getMyTicketQrHandler,
  issueTicketsHandler,
  listMyTicketsHandler,
  voidTicketHandler,
} from './ticket.controller.js';
import { idempotencyMiddleware } from './middleware/index.js';

const router = Router();

// AUDIENCE: list own tickets
router.get('/me/tickets', listMyTicketsHandler);

// AUDIENCE: get single ticket detail
router.get('/me/tickets/:ticket_id', getMyTicketHandler);

// AUDIENCE: get QR payload for a ticket
router.get('/me/tickets/:ticket_id/qr', getMyTicketQrHandler);

// Internal: issue tickets after payment success (idempotent)
router.post('/internal/orders/:order_id/tickets/issue', idempotencyMiddleware, issueTicketsHandler);

// Internal/Admin: void a ticket (refund/cancel)
router.post('/internal/tickets/:ticket_id/void', voidTicketHandler);

export default router;
