import { createHmac } from 'node:crypto';
import { env } from '@ticketbox/config';

export function buildMomoUrl(
  orderId: string,
  amount: string,
  orderInfo: string,
): string {
  const { partnerCode, accessKey, secretKey, redirectUrl, ipnUrl, endpoint } = env.momo;
  const requestId = orderId;
  const amountStr = String(Math.round(parseFloat(amount)));
  const requestType = 'payWithMethod';
  const extraData = '';

  const rawSignature = `accessKey=${accessKey}&amount=${amountStr}&extraData=${extraData}&ipnUrl=${ipnUrl}&orderId=${orderId}&orderInfo=${orderInfo}&partnerCode=${partnerCode}&redirectUrl=${redirectUrl}&requestId=${requestId}&requestType=${requestType}`;

  const signature = createHmac('sha256', secretKey)
    .update(rawSignature, 'utf8')
    .digest('hex');

  const body = {
    partnerCode,
    accessKey,
    requestId,
    amount: amountStr,
    orderId,
    orderInfo,
    redirectUrl,
    ipnUrl,
    extraData,
    requestType,
    signature,
    lang: 'vi',
  };

  return `${endpoint}?${new URLSearchParams(body).toString()}`;
}
