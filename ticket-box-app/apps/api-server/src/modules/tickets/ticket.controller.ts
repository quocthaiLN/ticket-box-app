import type { NextFunction, Response } from 'express';
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from '@ticketbox/database';
import {
  getMyTicket,
  getMyTicketQr,
  listMyTickets,
  voidTicket,
} from './ticket.service.js';
import type { AppRequest } from './ticket.type.js';
import { parseTicketListQuery, parseUuidParam } from './ticket.schema.js';
import { auditService } from '../audit/audit.service.js';

export async function listMyTicketsHandler(req: AppRequest, res: Response, next: NextFunction) {
  try {
    const userId = res.locals['auth']?.user_id as string;
    const query = parseTicketListQuery(req.query);

    const result = await listMyTickets(userId, query);

    res.json({ ...result, meta: { request_id: req.requestId } });
  } catch (err) {
    next(err);
  }
}

export async function getMyTicketHandler(req: AppRequest, res: Response, next: NextFunction) {
  try {
    const userId = res.locals['auth']?.user_id as string;
    const ticketId = parseUuidParam(req.params['ticket_id'], 'ticket_id');

    const data = await getMyTicket(userId, ticketId);

    res.json({ data, meta: { request_id: req.requestId } });
  } catch (err) {
    next(err);
  }
}

export async function getMyTicketQrHandler(req: AppRequest, res: Response, next: NextFunction) {
  try {
    const userId = res.locals['auth']?.user_id as string;
    const ticketId = parseUuidParam(req.params['ticket_id'], 'ticket_id');

    const data = await getMyTicketQr(userId, ticketId);

    res.setHeader('Cache-Control', 'no-store');
    res.json({ data, meta: { request_id: req.requestId } });
  } catch (err) {
    next(err);
  }
}

export async function voidTicketHandler(req: AppRequest, res: Response, next: NextFunction) {
  try {
    const ticketId = parseUuidParam(req.params['ticket_id'], 'ticket_id');

    const result = await voidTicket(ticketId);
    if (result.audit.changed) {
      await auditService.record(
        {
          actor_user_id: res.locals['auth']?.user_id ?? null,
          action: AUDIT_ACTIONS.TICKET_VOIDED,
          entity_type: AUDIT_ENTITY_TYPES.TICKET,
          entity_id: result.audit.ticket_id,
          metadata: {
            previous_status: result.audit.previous_status,
            new_status: result.audit.new_status,
          },
          ip_address: req.ip,
          user_agent: req.get('user-agent') ?? null,
        },
        { bestEffort: true },
      );
    }

    res.json({ data: result.data, meta: { request_id: req.requestId } });
  } catch (err) {
    next(err);
  }
}
