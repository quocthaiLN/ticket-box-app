import type { NextFunction, Response } from 'express';
import { handleMomoWebhook, handleVnpayWebhook, retryPayment } from './payment.service.js';
import type { AppRequest, MomoWebhookBody, RetryPaymentRequest, VnpayWebhookBody } from './payment.type.js';

export async function retryPaymentHandler(req: AppRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.headers['x-user-id'] as string;
    const orderId = req.params['order_id'] as string;
    const body = req.body as RetryPaymentRequest;
    const provider = body.payment_provider ?? 'VNPAY';

    const data = await retryPayment(orderId, userId, provider);

    res.status(201).json({
      data,
      meta: { request_id: req.requestId },
    });
  } catch (err) {
    next(err);
  }
}

export async function vnpayWebhookHandler(req: AppRequest, res: Response, next: NextFunction) {
  try {
    // VNPAY IPN may arrive as query params (GET) or JSON body (POST)
    const payload: VnpayWebhookBody = Object.keys(req.query).length > 0
      ? (req.query as VnpayWebhookBody)
      : (req.body as VnpayWebhookBody);

    const result = await handleVnpayWebhook(payload);

    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function momoWebhookHandler(req: AppRequest, res: Response, next: NextFunction) {
  try {
    const payload = req.body as MomoWebhookBody;

    const result = await handleMomoWebhook(payload);

    res.status(result.status).json({ message: result.message });
  } catch (err) {
    next(err);
  }
}
