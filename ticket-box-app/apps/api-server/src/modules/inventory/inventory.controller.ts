import type { NextFunction, Response } from 'express';
import {
  adjustTicketInventory,
  confirmTicketPayment,
  getInventory,
  holdTickets,
  releaseTickets,
} from './inventory.service.js';
import type { AppRequest, HoldRequest, InventoryAdjustmentRequest, PaymentConfirmationRequest, ReleaseRequest } from './inventory.type.js';

export async function getInventoryHandler(req: AppRequest, res: Response, next: NextFunction) {
  try {
    const ticket_type_id = req.params['ticket_type_id'] as string;
    const data = await getInventory(ticket_type_id);
    res.json({
      data,
      meta: {
        request_id: req.requestId,
        computed_fields: ['available_quantity'],
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function holdInventoryHandler(req: AppRequest, res: Response, next: NextFunction) {
  try {
    const idempotencyKey = req.headers['idempotency-key'] as string;
    const data = await holdTickets(req.body as HoldRequest, idempotencyKey);
    res.status(201).json({
      data,
      meta: { request_id: req.requestId },
    });
  } catch (err) {
    next(err);
  }
}

export async function releaseInventoryHandler(req: AppRequest, res: Response, next: NextFunction) {
  try {
    const data = await releaseTickets(req.body as ReleaseRequest);
    res.json({
      data,
      meta: { request_id: req.requestId },
    });
  } catch (err) {
    next(err);
  }
}

export async function confirmPaymentHandler(req: AppRequest, res: Response, next: NextFunction) {
  try {
    const data = await confirmTicketPayment(req.body as PaymentConfirmationRequest);
    res.json({
      data,
      meta: { request_id: req.requestId },
    });
  } catch (err) {
    next(err);
  }
}

export async function adjustInventoryHandler(req: AppRequest, res: Response, next: NextFunction) {
  try {
    const ticket_type_id = req.params['ticket_type_id'] as string;
    const actorUserId = res.locals['auth']?.user_id as string | undefined;
    const data = await adjustTicketInventory(ticket_type_id, req.body as InventoryAdjustmentRequest, actorUserId);
    res.json({
      data,
      meta: {
        request_id: req.requestId,
        computed_fields: ['available_quantity'],
      },
    });
  } catch (err) {
    next(err);
  }
}
