import { createHmac } from 'node:crypto';
import { env } from '@ticket-box/config';
import { buildVnpayUrl } from './payment.vnpay.js';
import { buildMomoUrl } from './payment.momo.js';
import {
  PaymentError,
  confirmOrderPayment,
  createRetryPaymentRecord,
  failPayment,
  findPaymentByProviderTxn,
  findPendingPaymentForWebhook,
  getActivePendingPayment,
  getOrderForRetry,
  saveWebhookRawPayload,
} from './payment.repository.js';
import { getBulkhead } from './bulkhead/payment.bulkhead.js';
import { getCircuitBreaker } from './circuit-breaker/payment.circuit-breaker.js';
import type { MomoWebhookBody, RetryPaymentResponse, VnpayWebhookBody } from './payment.type.js';

// ── Provider Call Wrapper ──────────────────────────────────────────────────────

async function callProvider(
  provider: 'VNPAY' | 'MOMO',
  fn: () => Promise<string>,
): Promise<string> {
  const cb = getCircuitBreaker(provider);
  const bh = getBulkhead(provider);
  return bh.execute(() => cb.execute(fn));
}

// ── Build Checkout URL (with circuit breaker + bulkhead + fallback) ────────────

export function buildCheckoutUrl(
  provider: 'VNPAY' | 'MOMO',
  orderId: string,
  amount: string,
  currency: string,
  orderInfo: string,
): string {
  if (provider === 'MOMO') return buildMomoUrl(orderId, amount, orderInfo);
  return buildVnpayUrl(orderId, amount, currency, orderInfo);
}

export async function buildCheckoutUrlWithFallback(
  preferredProvider: 'VNPAY' | 'MOMO',
  orderId: string,
  amount: string,
  currency: string,
  orderInfo: string,
): Promise<{ url: string; provider: 'VNPAY' | 'MOMO' }> {
  const fallback: 'VNPAY' | 'MOMO' = preferredProvider === 'VNPAY' ? 'MOMO' : 'VNPAY';
  const order: Array<'VNPAY' | 'MOMO'> = [preferredProvider, fallback];

  let lastError: unknown;

  for (const provider of order) {
    if (getCircuitBreaker(provider).isOpen()) continue;

    try {
      const url = await callProvider(provider, async () =>
        buildCheckoutUrl(provider, orderId, amount, currency, orderInfo),
      );
      return { url, provider };
    } catch (err) {
      lastError = err;
    }
  }

  throw Object.assign(
    new Error('All payment providers are currently unavailable'),
    { statusCode: 503, code: 'PAYMENT_PROVIDER_UNAVAILABLE', cause: lastError },
  );
}

// ── Retry Payment ──────────────────────────────────────────────────────────────

export async function retryPayment(
  orderId: string,
  userId: string,
  provider: 'VNPAY' | 'MOMO' = 'VNPAY',
): Promise<RetryPaymentResponse> {
  const order = await getOrderForRetry(orderId, userId);

  const existing = await getActivePendingPayment(orderId);
  if (existing) {
    throw new PaymentError('PAYMENT_ALREADY_PENDING', 'An active pending payment already exists for this order', 409);
  }

  const orderInfo = `Payment for order ${orderId}`;

  const { url: checkoutUrl, provider: actualProvider } = await buildCheckoutUrlWithFallback(
    provider,
    orderId,
    order.totalAmount,
    order.currency,
    orderInfo,
  );

  const payment = await createRetryPaymentRecord(orderId, order.totalAmount, order.currency, actualProvider, checkoutUrl);

  return {
    payment_id: payment.id,
    provider: actualProvider,
    status: payment.status,
    checkout_url: payment.checkoutUrl,
    order_id: orderId,
    hold_expires_at: order.holdExpiresAt ? order.holdExpiresAt.toISOString() : '',
  };
}

// ── VNPAY Webhook ──────────────────────────────────────────────────────────────

function verifyVnpaySignature(body: VnpayWebhookBody): boolean {
  const { vnp_SecureHash, vnp_SecureHashType, ...rest } = body;
  if (!vnp_SecureHash) return false;

  const sortedKeys = Object.keys(rest).sort();
  const signData = sortedKeys
    .filter((k) => rest[k] !== '' && rest[k] !== undefined)
    .map((k) => `${k}=${rest[k]}`)
    .join('&');

  const expected = createHmac('sha512', env.vnpay.hashSecret)
    .update(signData, 'utf8')
    .digest('hex');

  return expected.toLowerCase() === vnp_SecureHash.toLowerCase();
}

export async function handleVnpayWebhook(body: VnpayWebhookBody): Promise<{ RspCode: string; Message: string }> {
  const orderId = body.vnp_TxnRef;
  const providerTxnId = body.vnp_TransactionNo;
  const vnpAmount = body.vnp_Amount;
  const responseCode = body.vnp_ResponseCode;

  if (!orderId || !providerTxnId || !vnpAmount || !responseCode) {
    return { RspCode: '99', Message: 'Missing required fields' };
  }

  const existing = await findPaymentByProviderTxn('VNPAY', providerTxnId);
  if (existing?.status === 'SUCCEEDED') {
    return { RspCode: '00', Message: 'Confirm Success' };
  }

  const signatureValid = verifyVnpaySignature(body);

  const payment = await findPendingPaymentForWebhook(orderId, 'VNPAY');
  if (payment) {
    await saveWebhookRawPayload(payment.id, body, signatureValid, providerTxnId);
  }

  if (!signatureValid) {
    return { RspCode: '97', Message: 'Invalid signature' };
  }

  if (payment) {
    const expectedAmount = Math.round(parseFloat(payment.amount) * 100);
    if (parseInt(vnpAmount, 10) !== expectedAmount) {
      return { RspCode: '04', Message: 'Invalid amount' };
    }
  }

  const isSuccess = responseCode === '00';

  if (isSuccess && payment) {
    await confirmOrderPayment(payment.id, orderId);
    getCircuitBreaker('VNPAY').recordSuccess();
  } else if (!isSuccess && payment) {
    const failureReason = `VNPAY_${responseCode}`;
    await failPayment(payment.id, orderId, failureReason);
    getCircuitBreaker('VNPAY').recordFailure();
  }

  return { RspCode: '00', Message: 'Confirm Success' };
}

// ── MoMo Webhook ───────────────────────────────────────────────────────────────

function verifyMomoSignature(body: MomoWebhookBody): boolean {
  if (!body.signature) return false;

  const rawSignature = [
    `accessKey=${env.momo.accessKey}`,
    `amount=${body.amount}`,
    `extraData=${body.extraData ?? ''}`,
    `message=${body.message ?? ''}`,
    `orderId=${body.orderId}`,
    `orderInfo=${body.orderInfo ?? ''}`,
    `orderType=${body.orderType ?? ''}`,
    `partnerCode=${body.partnerCode}`,
    `payType=${body.payType ?? ''}`,
    `requestId=${body.requestId}`,
    `responseTime=${body.responseTime}`,
    `resultCode=${body.resultCode}`,
    `transId=${body.transId}`,
  ].join('&');

  const expected = createHmac('sha256', env.momo.secretKey)
    .update(rawSignature, 'utf8')
    .digest('hex');

  return expected === body.signature;
}

export async function handleMomoWebhook(body: MomoWebhookBody): Promise<{ status: number; message: string }> {
  const orderId = body.orderId;
  const transId = body.transId?.toString();
  const resultCode = body.resultCode;

  if (!orderId || transId === undefined || resultCode === undefined) {
    return { status: 400, message: 'Missing required fields' };
  }

  const existing = await findPaymentByProviderTxn('MOMO', transId);
  if (existing?.status === 'SUCCEEDED') {
    return { status: 200, message: 'success' };
  }

  const signatureValid = verifyMomoSignature(body);

  const payment = await findPendingPaymentForWebhook(orderId, 'MOMO');
  if (payment) {
    await saveWebhookRawPayload(payment.id, body as unknown as Record<string, unknown>, signatureValid, transId);
  }

  if (!signatureValid) {
    return { status: 403, message: 'Invalid signature' };
  }

  const isSuccess = resultCode === 0;

  if (isSuccess && payment) {
    await confirmOrderPayment(payment.id, orderId);
    getCircuitBreaker('MOMO').recordSuccess();
  } else if (!isSuccess && payment) {
    const failureReason = `MOMO_${resultCode}`;
    await failPayment(payment.id, orderId, failureReason);
    getCircuitBreaker('MOMO').recordFailure();
  }

  return { status: 200, message: 'success' };
}
