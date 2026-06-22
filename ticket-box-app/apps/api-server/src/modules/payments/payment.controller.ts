import type { NextFunction, Response } from 'express';
import { env } from '@ticketbox/config';
import { handleMomoWebhook, handleVnpayWebhook, createPayment } from './payment.service.js';
import type { AppRequest, CreatePaymentRequest, MomoWebhookBody, VnpayWebhookBody } from './payment.type.js';

export async function createPaymentHandler(req: AppRequest, res: Response, next: NextFunction) {
  try {
    const userId = res.locals['auth']?.user_id as string;
    const orderId = req.params['order_id'] as string;
    const body = req.body as CreatePaymentRequest;
    const provider = body.payment_provider ?? 'VNPAY';

    const data = await createPayment(orderId, userId, provider);

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

// GET /payment/return — browser redirect từ VNPAY (UX). Tái dùng cùng logic verify+confirm
// như IPN (idempotent), vì trên localhost IPN server-to-server không gọi tới được.
// Sau khi xử lý, redirect người dùng sang trang kết quả ở web frontend.
export async function vnpayReturnHandler(req: AppRequest, res: Response, next: NextFunction) {
  try {
    const query = req.query as VnpayWebhookBody;

    const result = await handleVnpayWebhook(query);
    // RspCode '00' nghĩa là đã xử lý hợp lệ; thanh toán thực sự thành công khi vnp_ResponseCode '00'.
    const paid = result.RspCode === '00' && query.vnp_ResponseCode === '00';

    const params = new URLSearchParams({
      status: paid ? 'success' : 'failed',
      order_id: query.vnp_TxnRef ?? '',
      code: query.vnp_ResponseCode ?? '',
    });
    res.redirect(`${env.web.url}/payment/result?${params.toString()}`);
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
