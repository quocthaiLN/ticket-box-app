import crypto from 'node:crypto';

const VNPAY_TMN_CODE = process.env['VNPAY_TMN_CODE'] ?? 'TICKETBOX';
const VNPAY_HASH_SECRET = process.env['VNPAY_HASH_SECRET'] ?? 'ticketbox_secret';
const VNPAY_URL = process.env['VNPAY_URL'] ?? 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';
const VNPAY_RETURN_URL = process.env['VNPAY_RETURN_URL'] ?? 'http://localhost:3000/payment/return';

function formatVnpDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  return `${year}${month}${day}${hours}${minutes}${seconds}`;
}

function buildVnpayUrl(
  orderId: string,
  amount: string,
  currency: string,
  orderInfo: string,
): string {
  const now = new Date();
  const expireDate = new Date(now.getTime() + 15 * 60 * 1000);

  // amount in VNPay is multiplied by 100
  const vnpAmount = Math.round(parseFloat(amount) * 100);

  const params: Record<string, string> = {
    vnp_Version: '2.1.0',
    vnp_Command: 'pay',
    vnp_TmnCode: VNPAY_TMN_CODE,
    vnp_Amount: String(vnpAmount),
    vnp_CurrCode: currency,
    vnp_TxnRef: orderId,
    vnp_OrderInfo: orderInfo,
    vnp_OrderType: 'other',
    vnp_Locale: 'vn',
    vnp_ReturnUrl: VNPAY_RETURN_URL,
    vnp_IpAddr: '127.0.0.1',
    vnp_CreateDate: formatVnpDate(now),
    vnp_ExpireDate: formatVnpDate(expireDate),
  };

  // Sort keys alphabetically
  const sortedKeys = Object.keys(params).sort();
  const signData = sortedKeys.map((k) => `${k}=${params[k]}`).join('&');

  const hmac = crypto.createHmac('sha512', VNPAY_HASH_SECRET);
  const secureHash = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

  const queryParams = new URLSearchParams(
    sortedKeys.map((k) => [k, params[k]] as [string, string]),
  );
  queryParams.append('vnp_SecureHash', secureHash);

  return `${VNPAY_URL}?${queryParams.toString()}`;
}

function buildMomoUrl(
  orderId: string,
  amount: string,
  orderInfo: string,
): string {
  const MOMO_PARTNER_CODE = process.env['MOMO_PARTNER_CODE'] ?? 'TICKETBOX';
  const MOMO_REDIRECT_URL = process.env['MOMO_REDIRECT_URL'] ?? 'http://localhost:3000/payment/return';
  const MOMO_IPN_URL = process.env['MOMO_IPN_URL'] ?? 'http://localhost:4000/webhooks/momo';
  const MOMO_ENDPOINT = process.env['MOMO_ENDPOINT'] ?? 'https://test-payment.momo.vn/v2/gateway/api/create';

  const params = new URLSearchParams({
    partnerCode: MOMO_PARTNER_CODE,
    orderId,
    requestId: orderId,
    amount: String(Math.round(parseFloat(amount))),
    orderInfo,
    redirectUrl: MOMO_REDIRECT_URL,
    ipnUrl: MOMO_IPN_URL,
    requestType: 'payWithMethod',
    lang: 'vi',
  });

  return `${MOMO_ENDPOINT}?${params.toString()}`;
}

export function buildCheckoutUrl(
  provider: 'VNPAY' | 'MOMO',
  orderId: string,
  amount: string,
  currency: string,
  orderInfo: string,
): string {
  if (provider === 'MOMO') {
    return buildMomoUrl(orderId, amount, orderInfo);
  }
  return buildVnpayUrl(orderId, amount, currency, orderInfo);
}
