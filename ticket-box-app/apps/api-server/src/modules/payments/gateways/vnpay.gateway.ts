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

interface VnpayQueryResponse {
  vnp_ResponseCode: string;
  vnp_TransactionStatus?: string;
  vnp_Message?: string;
}

function formatVnpDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

export class VnpayGateway implements PaymentGateway {
  readonly provider = 'VNPAY' as const;

  // VNPay checkout is a signed redirect URL — built locally, no network call.
  async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    const { tmnCode, hashSecret, url, returnUrl } = paymentConfig.vnpay;
    const now = new Date();
    const expireDate = new Date(now.getTime() + 15 * 60 * 1000);
    const vnpAmount = Math.round(parseFloat(input.amount) * 100);

    const params: Record<string, string> = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: tmnCode,
      vnp_Amount: String(vnpAmount),
      vnp_CurrCode: input.currency,
      vnp_TxnRef: input.orderId,
      vnp_OrderInfo: input.orderInfo,
      vnp_OrderType: 'other',
      vnp_Locale: 'vn',
      vnp_ReturnUrl: returnUrl,
      vnp_IpAddr: '127.0.0.1',
      vnp_CreateDate: formatVnpDate(now),
      vnp_ExpireDate: formatVnpDate(expireDate),
    };

    const sortedKeys = Object.keys(params).sort();
    const signData = sortedKeys.map((k) => `${k}=${params[k]}`).join('&');
    const secureHash = createHmac('sha512', hashSecret).update(signData, 'utf8').digest('hex');

    const query = new URLSearchParams(sortedKeys.map((k) => [k, params[k]] as [string, string]));
    query.append('vnp_SecureHash', secureHash);

    return { payUrl: `${url}?${query.toString()}`, providerRef: input.orderId };
  }

  async queryStatus(input: StatusInput): Promise<StatusResult> {
    const { tmnCode, hashSecret, querydrUrl, timeout } = paymentConfig.vnpay;
    const now = new Date();
    const requestId = `${Date.now()}`;
    const version = '2.1.0';
    const command = 'querydr';
    const orderInfo = `Query order ${input.orderId}`;
    const createDate = formatVnpDate(now);
    const ipAddr = '127.0.0.1';

    const hashData = [
      requestId,
      version,
      command,
      tmnCode,
      input.orderId,
      input.transactionDate,
      createDate,
      ipAddr,
      orderInfo,
    ].join('|');
    const secureHash = createHmac('sha512', hashSecret).update(hashData, 'utf8').digest('hex');

    const body = {
      vnp_RequestId: requestId,
      vnp_Version: version,
      vnp_Command: command,
      vnp_TmnCode: tmnCode,
      vnp_TxnRef: input.orderId,
      vnp_OrderInfo: orderInfo,
      vnp_TransactionDate: input.transactionDate,
      vnp_CreateDate: createDate,
      vnp_IpAddr: ipAddr,
      vnp_SecureHash: secureHash,
    };

    const res = await postJson<VnpayQueryResponse>(querydrUrl, body, timeout);
    return { paid: res.vnp_TransactionStatus === '00', raw: res as unknown as Record<string, unknown> };
  }
}
