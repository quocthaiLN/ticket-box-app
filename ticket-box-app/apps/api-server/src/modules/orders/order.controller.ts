import type { NextFunction, Response } from 'express';
import {
  cancelOrder,
  createOrder,
  expireOrder,
  getOrder,
  getTicketQuota,
  listAdminOrders,
} from './order.service.js';
import type { AdminOrdersQuery, AppRequest, CreateOrderRequest } from './order.type.js';

export async function createOrderHandler(req: AppRequest, res: Response, next: NextFunction) {
  try {
    const userId = res.locals['auth']?.user_id as string;
    const idempotencyKey = req.headers['idempotency-key'] as string;

    const data = await createOrder(userId, req.body as CreateOrderRequest, idempotencyKey);

    res.status(201).json({
      data,
      meta: { request_id: req.requestId },
    });
  } catch (err) {
    next(err);
  }
}

export async function getOrderHandler(req: AppRequest, res: Response, next: NextFunction) {
  try {
    const userId = res.locals['auth']?.user_id as string;
    const orderId = req.params['order_id'] as string;

    const data = await getOrder(orderId, userId);

    res.set('Cache-Control', 'no-store').json({
      data,
      meta: { request_id: req.requestId },
    });
  } catch (err) {
    next(err);
  }
}

export async function getTicketQuotaHandler(req: AppRequest, res: Response, next: NextFunction) {
  try {
    const userId = res.locals['auth']?.user_id as string;
    const concertId = req.params['concert_id'] as string;
    const data = await getTicketQuota(userId, concertId);

    res.set('Cache-Control', 'no-store').json({
      data,
      meta: { request_id: req.requestId },
    });
  } catch (err) {
    next(err);
  }
}

export async function cancelOrderHandler(req: AppRequest, res: Response, next: NextFunction) {
  try {
    const userId = res.locals['auth']?.user_id as string;
    const orderId = req.params['order_id'] as string;

    const data = await cancelOrder(orderId, userId);

    res.json({
      data,
      meta: { request_id: req.requestId },
    });
  } catch (err) {
    next(err);
  }
}

export async function expireOrderHandler(req: AppRequest, res: Response, next: NextFunction) {
  try {
    const orderId = req.params['order_id'] as string;

    const data = await expireOrder(orderId);

    res.json({
      data,
      meta: { request_id: req.requestId },
    });
  } catch (err) {
    next(err);
  }
}

export async function listAdminOrdersHandler(req: AppRequest, res: Response, next: NextFunction) {
  try {
    const query: AdminOrdersQuery = {
      cursor: req.query['cursor'] as string | undefined,
      limit: req.query['limit'] ? parseInt(req.query['limit'] as string, 10) : undefined,
      concert_id: req.query['concert_id'] as string | undefined,
      status: req.query['status'] as string | undefined,
      user_id: req.query['user_id'] as string | undefined,
      from: req.query['from'] as string | undefined,
      to: req.query['to'] as string | undefined,
    };

    const result = await listAdminOrders(query);

    res.json({
      data: result.data,
      meta: {
        request_id: req.requestId,
        next_cursor: result.next_cursor,
        has_more: result.has_more,
      },
    });
  } catch (err) {
    next(err);
  }
}
