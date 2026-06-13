import { createHmac } from 'node:crypto';
import { paymentConfig } from '@ticketbox/config/payment.js';
import { postJson } from './http-client.js';
import type {
  CheckoutInput,
  CheckoutResult,
  PaymentGateway,
  StatusInput,
  StatusResult,
} from './payment.gateway.js';

interface MomoCreateResponse {
  resultCode: number;
  message: string;
  payUrl?: string;
  requestId?: string;
}

interface MomoQueryResponse {
  resultCode: number;
  message: string;
}

const sign = (raw: string): string =>
  createHmac('sha256', paymentConfig.momo.secretKey).update(raw, 'utf8').digest('hex');

export class MomoGateway implements PaymentGateway {
  readonly provider = 'MOMO' as const;

  async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    const { partnerCode, accessKey, redirectUrl, ipnUrl, endpoint, timeout } = paymentConfig.momo;
    const requestId = input.orderId;
    const amount = String(Math.round(parseFloat(input.amount)));
    const requestType = 'payWithMethod';
    const extraData = '';

    const raw =
      `accessKey=${accessKey}&amount=${amount}&extraData=${extraData}&ipnUrl=${ipnUrl}` +
      `&orderId=${input.orderId}&orderInfo=${input.orderInfo}&partnerCode=${partnerCode}` +
      `&redirectUrl=${redirectUrl}&requestId=${requestId}&requestType=${requestType}`;

    const body = {
      partnerCode,
      accessKey,
      requestId,
      amount,
      orderId: input.orderId,
      orderInfo: input.orderInfo,
      redirectUrl,
      ipnUrl,
      extraData,
      requestType,
      signature: sign(raw),
      lang: 'vi',
    };

    const res = await postJson<MomoCreateResponse>(endpoint, body, timeout);
    if (res.resultCode !== 0 || !res.payUrl) {
      throw new Error(`MoMo create failed: ${res.resultCode} ${res.message}`);
    }

    return { payUrl: res.payUrl, providerRef: res.requestId ?? requestId };
  }

  async queryStatus(input: StatusInput): Promise<StatusResult> {
    const { partnerCode, accessKey, queryUrl, timeout } = paymentConfig.momo;
    const requestId = input.orderId;

    const raw = `accessKey=${accessKey}&orderId=${input.orderId}&partnerCode=${partnerCode}&requestId=${requestId}`;
    const body = { partnerCode, accessKey, requestId, orderId: input.orderId, signature: sign(raw), lang: 'vi' };

    const res = await postJson<MomoQueryResponse>(queryUrl, body, timeout);
    return { paid: res.resultCode === 0, raw: res as unknown as Record<string, unknown> };
  }
}
