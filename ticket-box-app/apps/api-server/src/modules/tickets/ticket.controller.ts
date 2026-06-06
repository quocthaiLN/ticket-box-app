import type { NextFunction, Response } from 'express';
import {
  getMyTicket,
  getMyTicketQr,
  issueTickets,
  listMyTickets,
  voidTicket,
} from './ticket.service.js';
import type { AppRequest, TicketListQuery } from './ticket.type.js';

export async function listMyTicketsHandler(req: AppRequest, res: Response, next: NextFunction) {
  try {
    const userId = res.locals['auth']?.user_id as string;
    const query: TicketListQuery = {
      concert_id: req.query['concert_id'] as string | undefined,
      status: req.query['status'] as TicketListQuery['status'],
      limit: req.query['limit'] ? Number(req.query['limit']) : undefined,
      cursor: req.query['cursor'] as string | undefined,
    };

    const result = await listMyTickets(userId, query);

    res.json({ ...result, meta: { request_id: req.requestId } });
  } catch (err) {
    next(err);
  }
}

export async function getMyTicketHandler(req: AppRequest, res: Response, next: NextFunction) {
  try {
    const userId = res.locals['auth']?.user_id as string;
    const ticketId = req.params['ticket_id'] as string;

    const data = await getMyTicket(userId, ticketId);

    res.json({ data, meta: { request_id: req.requestId } });
  } catch (err) {
    next(err);
  }
}

export async function getMyTicketQrHandler(req: AppRequest, res: Response, next: NextFunction) {
  try {
    const userId = res.locals['auth']?.user_id as string;
    const ticketId = req.params['ticket_id'] as string;

    const data = await getMyTicketQr(userId, ticketId);

    res.setHeader('Cache-Control', 'no-store');
    res.json({ data, meta: { request_id: req.requestId } });
  } catch (err) {
    next(err);
  }
}

export async function issueTicketsHandler(req: AppRequest, res: Response, next: NextFunction) {
  try {
    const orderId = req.params['order_id'] as string;

    const data = await issueTickets(orderId);

    res.status(201).json({ data, meta: { request_id: req.requestId } });
  } catch (err) {
    next(err);
  }
}

export async function voidTicketHandler(req: AppRequest, res: Response, next: NextFunction) {
  try {
    const ticketId = req.params['ticket_id'] as string;

    const data = await voidTicket(ticketId);

    res.json({ data, meta: { request_id: req.requestId } });
  } catch (err) {
    next(err);
  }
}
