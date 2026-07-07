import type { NextFunction, Response } from 'express';
import { env } from '@ticketbox/config';
import { ApiError } from '../../shared/http/problem-details.js';
import { handleMomoWebhook, handleVnpayWebhook, createPayment } from './payment.service.js';
import type {
  AppRequest,
  CreatePaymentRequest,
  MomoReturnQuery,
  MomoWebhookBody,
  VnpayReturnQuery,
  VnpayWebhookBody,
} from './payment.type.js';

export async function createPaymentHandler(req: AppRequest, res: Response, next: NextFunction) {
  try {
    const userId = res.locals['auth']?.user_id as string;
    const orderId = req.params['order_id'] as string;
    const body = req.body as CreatePaymentRequest;
    // Không default ở đây: truyền undefined khi client không chỉ định để service biết
    // được phép fallback; nếu client chỉ định thì service chỉ dùng đúng provider đó.
    const data = await createPayment(orderId, userId, body.payment_provider);

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
export async function vnpayReturnHandler(req: AppRequest, res: Response, _next: NextFunction) {
  // Query đã được validateQuery(vnpayReturnQuerySchema) xử lý (giữ nguyên mọi field vnp_*).
  const query = req.query as VnpayReturnQuery;
  try {
    const result = await handleVnpayWebhook(query as VnpayWebhookBody);
    // RspCode '00' nghĩa là đã xử lý hợp lệ; thanh toán thực sự thành công khi vnp_ResponseCode '00'.
    const paid = result.RspCode === '00' && query.vnp_ResponseCode === '00';

    const params = new URLSearchParams({
      status: paid ? 'success' : 'failed',
      order_id: query.vnp_TxnRef ?? '',
      code: query.vnp_ResponseCode ?? '',
    });
    res.redirect(`${env.web.url}/payment/result?${params.toString()}`);
  } catch (err) {
    // Endpoint này là trang browser của người dùng cuối: KHÔNG trả ProblemDetails
    // thô (lộ request_id + toàn bộ query VNPay gồm vnp_SecureHash). Log server và
    // đưa user về trang kết quả với mã lỗi gọn.
    console.error('[payment] vnpay return failed:', err);
    res.redirect(`${env.web.url}/payment/result?${failedReturnParams(query.vnp_TxnRef, err)}`);
  }
}

// Build query redirect cho nhánh lỗi của return handler (VNPay/MoMo dùng chung).
function failedReturnParams(orderId: string | undefined, err: unknown): string {
  const code = err instanceof ApiError ? err.problem.code : 'PAYMENT_RETURN_ERROR';
  return new URLSearchParams({
    status: 'failed',
    order_id: orderId ?? '',
    code,
  }).toString();
}

// GET /payment/return/momo — browser redirect từ MoMo (UX). Tái dùng cùng logic verify+confirm
// như IPN MoMo (idempotent). validateQuery(momoReturnQuerySchema) đã ép string -> number sẵn.
export async function momoReturnHandler(req: AppRequest, res: Response, _next: NextFunction) {
  const query = req.query as MomoReturnQuery;
  try {
    const result = await handleMomoWebhook(query as MomoWebhookBody);
    // resultCode 0 = thành công; status 200 nghĩa là đã xử lý hợp lệ (chữ ký đúng).
    const paid = result.status === 200 && query.resultCode === 0;

    const params = new URLSearchParams({
      status: paid ? 'success' : 'failed',
      order_id: query.orderId ?? '',
      code: query.resultCode !== undefined ? String(query.resultCode) : '',
    });
    res.redirect(`${env.web.url}/payment/result?${params.toString()}`);
  } catch (err) {
    console.error('[payment] momo return failed:', err);
    res.redirect(`${env.web.url}/payment/result?${failedReturnParams(query.orderId, err)}`);
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
