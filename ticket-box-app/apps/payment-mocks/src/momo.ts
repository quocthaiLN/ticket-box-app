import { createHmac } from 'node:crypto';
import { Router } from 'express';
import { env } from '@ticketbox/config';
import { applyFault, type ControlStore } from './control.js';

interface MomoCreateBody {
  partnerCode?: string;
  accessKey?: string;
  requestId?: string;
  amount?: string;
  orderId?: string;
  orderInfo?: string;
  redirectUrl?: string;
  ipnUrl?: string;
  requestType?: string;
  extraData?: string;
  signature?: string;
}

type MomoReturnParams = {
  partnerCode: string;
  orderId: string;
  requestId: string;
  amount: string;
  orderInfo: string;
  orderType: string;
  transId: string;
  resultCode: string;
  message: string;
  payType: string;
  responseTime: string;
  extraData: string;
};

function expectedSignature(b: MomoCreateBody): string {
  const { accessKey, secretKey } = env.momo;
  const raw =
    `accessKey=${accessKey}` +
    `&amount=${b.amount}` +
    `&extraData=${b.extraData ?? ''}` +
    `&ipnUrl=${b.ipnUrl}` +
    `&orderId=${b.orderId}` +
    `&orderInfo=${b.orderInfo}` +
    `&partnerCode=${b.partnerCode}` +
    `&redirectUrl=${b.redirectUrl}` +
    `&requestId=${b.requestId}` +
    `&requestType=${b.requestType}`;
  return createHmac('sha256', secretKey).update(raw, 'utf8').digest('hex');
}

function signReturn(params: MomoReturnParams): string {
  const raw =
    `accessKey=${env.momo.accessKey}` +
    `&amount=${params.amount}` +
    `&extraData=${params.extraData}` +
    `&message=${params.message}` +
    `&orderId=${params.orderId}` +
    `&orderInfo=${params.orderInfo}` +
    `&orderType=${params.orderType}` +
    `&partnerCode=${params.partnerCode}` +
    `&payType=${params.payType}` +
    `&requestId=${params.requestId}` +
    `&responseTime=${params.responseTime}` +
    `&resultCode=${params.resultCode}` +
    `&transId=${params.transId}`;
  return createHmac('sha256', env.momo.secretKey).update(raw, 'utf8').digest('hex');
}

function buildReturnUrl(
  redirectUrl: string,
  checkout: Pick<MomoReturnParams, 'partnerCode' | 'orderId' | 'requestId' | 'amount' | 'orderInfo' | 'extraData'>,
  resultCode: 0 | 1006,
): string {
  const params: MomoReturnParams = {
    ...checkout,
    orderType: 'momo_wallet',
    transId: String(Date.now()),
    resultCode: String(resultCode),
    message: resultCode === 0 ? 'Successful.' : 'User cancelled',
    payType: 'qr',
    responseTime: String(Date.now()),
  };
  const query = new URLSearchParams({ ...params, signature: signReturn(params) });
  const separator = redirectUrl.includes('?') ? '&' : '?';
  return `${redirectUrl}${separator}${query.toString()}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Mock of MoMo's POST /v2/gateway/api/create — validates the real HMAC-SHA256 signature. */
export function momoRouter(control: ControlStore): Router {
  const router = Router();

  // Trả về URL thanh toán cho client
  router.post('/v2/gateway/api/create', async (req, res) => {
    const body = req.body as MomoCreateBody;

    if (body.signature !== expectedSignature(body)) {
      res.json({ resultCode: 21, message: 'Invalid signature', orderId: body.orderId });
      return;
    }

    if (!body.orderId || !body.amount || !body.redirectUrl || !body.partnerCode || !body.requestId) {
      res.json({ resultCode: 20, message: 'Missing required field', orderId: body.orderId });
      return;
    }

    const { fail } = await applyFault(control.get('momo'));
    if (fail) {
      res.status(502).json({ resultCode: 1000, message: 'Upstream MoMo error' });
      return;
    }

    const checkoutQuery = new URLSearchParams({
      partnerCode: body.partnerCode,
      orderId: body.orderId,
      requestId: body.requestId,
      amount: body.amount,
      orderInfo: body.orderInfo ?? '',
      redirectUrl: body.redirectUrl,
      extraData: body.extraData ?? '',
    });
    const payUrl = `${req.protocol}://${req.get('host')}/momo/pay?${checkoutQuery.toString()}`;
    res.json({
      partnerCode: body.partnerCode,
      requestId: body.requestId,
      orderId: body.orderId,
      amount: body.amount,
      responseTime: Date.now(),
      message: 'Successful.',
      resultCode: 0,
      payUrl,
    });
  });

  router.get('/pay', async (req, res) => {
    const { fail } = await applyFault(control.get('momo'));
    if (fail) {
      res.status(502).send('MoMo mock is unavailable');
      return;
    }

    const read = (key: string) => typeof req.query[key] === 'string' ? req.query[key] as string : '';
    const checkout = {
      partnerCode: read('partnerCode'),
      orderId: read('orderId'),
      requestId: read('requestId'),
      amount: read('amount'),
      orderInfo: read('orderInfo'),
      extraData: read('extraData'),
    };
    const redirectUrl = read('redirectUrl');
    if (!checkout.partnerCode || !checkout.orderId || !checkout.requestId || !checkout.amount || !redirectUrl) {
      res.status(400).send('Missing MoMo checkout parameters');
      return;
    }

    const successUrl = buildReturnUrl(redirectUrl, checkout, 0);
    const cancelUrl = buildReturnUrl(redirectUrl, checkout, 1006);
    res.type('html').send(`<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><title>MoMo Mock</title></head>
<body style="font-family:system-ui;max-width:520px;margin:64px auto;padding:24px">
  <h1>MoMo Mock</h1>
  <p>Đơn hàng: <strong>${escapeHtml(checkout.orderId)}</strong></p>
  <p>Số tiền: <strong>${escapeHtml(Number(checkout.amount).toLocaleString('vi-VN'))} VND</strong></p>
  <p><a href="${escapeHtml(successUrl)}">Thanh toán thành công</a></p>
  <p><a href="${escapeHtml(cancelUrl)}">Hủy thanh toán</a></p>
</body></html>`);
  });

  // Trả về status của một payment cụ thể
  router.post('/v2/gateway/api/query', async (req, res) => {
    const b = req.body as { partnerCode?: string; orderId?: string; requestId?: string; signature?: string };
    const { accessKey, secretKey } = env.momo;
    const raw = `accessKey=${accessKey}&orderId=${b.orderId}&partnerCode=${b.partnerCode}&requestId=${b.requestId}`;
    const expected = createHmac('sha256', secretKey).update(raw, 'utf8').digest('hex');

    if (b.signature !== expected) {
      res.json({ resultCode: 21, message: 'Invalid signature', orderId: b.orderId });
      return;
    }

    const { fail } = await applyFault(control.get('momo'));
    if (fail) {
      res.status(502).json({ resultCode: 1000, message: 'Upstream MoMo error' });
      return;
    }

    res.json({ partnerCode: b.partnerCode, orderId: b.orderId, requestId: b.requestId, resultCode: 0, message: 'Successful.' });
  });

  return router;
}
