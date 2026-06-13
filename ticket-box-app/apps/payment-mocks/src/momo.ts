import { createHmac } from 'node:crypto';
import { Router } from 'express';
import { paymentConfig } from '@ticketbox/config/payment.js';
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

function expectedSignature(b: MomoCreateBody): string {
  const { accessKey, secretKey } = paymentConfig.momo;
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

/** Mock of MoMo's POST /v2/gateway/api/create — validates the real HMAC-SHA256 signature. */
export function momoRouter(control: ControlStore): Router {
  const router = Router();

  router.post('/v2/gateway/api/create', async (req, res) => {
    const body = req.body as MomoCreateBody;

    if (body.signature !== expectedSignature(body)) {
      res.json({ resultCode: 21, message: 'Invalid signature', orderId: body.orderId });
      return;
    }

    const { fail } = await applyFault(control.get('momo'));
    if (fail) {
      res.status(502).json({ resultCode: 1000, message: 'Upstream MoMo error' });
      return;
    }

    const payUrl = `${req.protocol}://${req.get('host')}/momo/pay?orderId=${body.orderId}`;
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

  router.post('/v2/gateway/api/query', async (req, res) => {
    const b = req.body as { partnerCode?: string; orderId?: string; requestId?: string; signature?: string };
    const { accessKey, secretKey } = paymentConfig.momo;
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
