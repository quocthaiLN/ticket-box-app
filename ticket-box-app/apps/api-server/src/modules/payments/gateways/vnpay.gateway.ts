import { createHmac } from 'node:crypto';
import { env } from '@ticketbox/config';
import { postJson } from './http-client.js';
import type {
  CheckoutInput,
  CheckoutResult,
  PaymentGateway,
  StatusInput,
  StatusResult,
} from './payment.gateway.js';

// Các field cần đọc từ response QueryDR của VNPAY.
interface VnpayQueryResponse {
  vnp_ResponseCode: string;
  vnp_TransactionStatus?: string;
  vnp_Message?: string;
}

// Chuyển Date sang định dạng yyyyMMddHHmmss mà VNPAY yêu cầu.
function formatVnpDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

// VNPAY encode value theo encodeURIComponent rồi đổi %20 -> + (giống demo chính thức).
// Phải dùng đúng chuỗi đã encode này cho cả signData lẫn query URL, nếu không hash sẽ lệch.
function encodeVnpValue(value: string): string {
  return encodeURIComponent(value).replace(/%20/g, '+');
}

export class VnpayGateway implements PaymentGateway {
  // Adapter này chuyển contract chung sang tham số chuẩn của VNPAY.
  readonly provider = 'VNPAY' as const;
  // createCheckout chỉ ký URL local, không gọi mạng → không feed circuit breaker.
  readonly checkoutHitsNetwork = false;

  // VNPay checkout is a signed redirect URL — built locally, no network call.
  // Tạo redirect URL được ký cục bộ; VNPAY chưa bị gọi ở bước này.
  async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    const { tmnCode, hashSecret, url, returnUrl } = env.vnpay;
    const now = new Date();
    const expireDate = new Date(now.getTime() + 15 * 60 * 1000);
    const vnpAmount = Math.round(parseFloat(input.amount) * 100);

    // Tập hợp tham số redirect; amount của VNPAY dùng đơn vị nhỏ nhất (x100 VND).
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

    // VNPAY yêu cầu sort key, rồi ký trên chính chuỗi đã encode (không phải giá trị thô).
    const sortedKeys = Object.keys(params).sort();
    const signData = sortedKeys.map((k) => `${k}=${encodeVnpValue(params[k])}`).join('&');
    const secureHash = createHmac('sha512', hashSecret).update(signData, 'utf8').digest('hex');

    // Query URL dùng đúng chuỗi đã encode ở trên để khớp với signData; hash thêm sau cùng.
    const payUrl = `${url}?${signData}&vnp_SecureHash=${secureHash}`;

    return { payUrl, providerRef: input.orderId };
  }

  // Gọi QueryDR của VNPAY để đối soát một giao dịch đã gửi sang provider.
  async queryStatus(input: StatusInput): Promise<StatusResult> {
    const { tmnCode, hashSecret, querydrUrl, timeout } = env.vnpay;
    const now = new Date();
    const requestId = `${Date.now()}`;
    const version = '2.1.0';
    const command = 'querydr';
    const orderInfo = `Query order ${input.orderId}`;
    const createDate = formatVnpDate(now);
    const ipAddr = '127.0.0.1';

    // QueryDR ký chuỗi field nối bằng dấu | theo thứ tự do VNPAY quy định.
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

    // Payload QueryDR chứa dữ liệu giao dịch và HMAC để VNPAY xác thực merchant.
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

    // VNPAY trả TransactionStatus 00 khi giao dịch thanh toán thành công.
    const res = await postJson<VnpayQueryResponse>(querydrUrl, body, timeout);
    return { paid: res.vnp_TransactionStatus === '00', raw: res as unknown as Record<string, unknown> };
  }
}
