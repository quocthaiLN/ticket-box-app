import { createHmac } from 'node:crypto';
import { env } from '@ticket-box/config';

function formatVnpDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

export function buildVnpayUrl(
  orderId: string,
  amount: string,
  currency: string,
  orderInfo: string,
): string {
  const now = new Date();
  const expireDate = new Date(now.getTime() + 15 * 60 * 1000);

  // VNPay requires amount multiplied by 100
  const vnpAmount = Math.round(parseFloat(amount) * 100);

  const params: Record<string, string> = {
    vnp_Version: '2.1.0',
    vnp_Command: 'pay',
    vnp_TmnCode: env.vnpay.tmnCode,
    vnp_Amount: String(vnpAmount),
    vnp_CurrCode: currency,
    vnp_TxnRef: orderId,
    vnp_OrderInfo: orderInfo,
    vnp_OrderType: 'other',
    vnp_Locale: 'vn',
    vnp_ReturnUrl: env.vnpay.returnUrl,
    vnp_IpAddr: '127.0.0.1',
    vnp_CreateDate: formatVnpDate(now),
    vnp_ExpireDate: formatVnpDate(expireDate),
  };

  const sortedKeys = Object.keys(params).sort();
  const signData = sortedKeys.map((k) => `${k}=${params[k]}`).join('&');

  const secureHash = createHmac('sha512', env.vnpay.hashSecret)
    .update(signData, 'utf8')
    .digest('hex');

  const queryParams = new URLSearchParams(
    sortedKeys.map((k) => [k, params[k]] as [string, string]),
  );
  queryParams.append('vnp_SecureHash', secureHash);

  return `${env.vnpay.url}?${queryParams.toString()}`;
}
