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

// Chỉ mô tả các field MoMo response mà gateway cần dùng.
interface MomoCreateResponse {
  resultCode: number; // MoMo trả 0 khi tạo checkout thành công.
  message: string; // Thông điệp chẩn đoán của MoMo khi request lỗi.
  payUrl?: string; // URL để redirect user; chỉ có khi tạo request thành công.
  requestId?: string; // Mã request do MoMo echo/trả về để đối soát.
}

// Response query chỉ cần resultCode/message cho mục đích chuẩn hóa paid/raw.
interface MomoQueryResponse {
  resultCode: number;
  message: string;
}

// Ký chuỗi canonical theo HMAC SHA-256 mà MoMo yêu cầu.
const sign = (raw: string): string =>
  createHmac('sha256', env.momo.secretKey).update(raw, 'utf8').digest('hex');

export class MomoGateway implements PaymentGateway {
  // Adapter này chuyển contract chung sang định dạng API MoMo.
  readonly provider = 'MOMO' as const;
  // createCheckout POST tới endpoint MoMo (network) → feed circuit breaker.
  readonly checkoutHitsNetwork = true;

  // Tạo payment request, ký body và lấy payUrl để redirect user.
  async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    // Lấy credential, endpoint và URL callback từ cấu hình; không nhận từ client.
    const { partnerCode, accessKey, redirectUrl, ipnUrl, endpoint, timeout } = env.momo;
    // Dùng orderId làm requestId để liên kết request provider với order nội bộ.
    const requestId = input.orderId;
    // MoMo nhận số tiền nguyên VND, nên loại phần thập phân trước khi gửi.
    const amount = String(Math.round(parseFloat(input.amount)));
    // Tài khoản sandbox chỉ được cấp quyền captureWallet; payWithMethod trả resultCode 11
    // (access denied). Dùng captureWallet để create thành công với credential test.
    const requestType = 'captureWallet';
    const extraData = '';

    // Thứ tự field trong raw string phải trùng với quy định chữ ký của MoMo.
    const raw =
      `accessKey=${accessKey}&amount=${amount}&extraData=${extraData}&ipnUrl=${ipnUrl}` +
      `&orderId=${input.orderId}&orderInfo=${input.orderInfo}&partnerCode=${partnerCode}` +
      `&redirectUrl=${redirectUrl}&requestId=${requestId}&requestType=${requestType}`;

    // Body gửi provider chứa raw business data kèm chữ ký chống bị chỉnh sửa.
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

    // Lỗi HTTP/timeout hoặc resultCode khác 0 đều làm lời gọi thất bại.
    const res = await postJson<MomoCreateResponse>(endpoint, body, timeout);
    // Không có payUrl cũng được xem là thất bại dù HTTP request đã thành công.
    if (res.resultCode !== 0 || !res.payUrl) {
      throw new Error(`MoMo create failed: ${res.resultCode} ${res.message}`);
    }

    // Ưu tiên reference MoMo trả về; fallback về requestId đã gửi để vẫn trace được.
    return { payUrl: res.payUrl, providerRef: res.requestId ?? requestId };
  }

  // Gọi API query của MoMo để đối soát trạng thái payment đã tạo.
  async queryStatus(input: StatusInput): Promise<StatusResult> {
    // Query sử dụng cùng orderId/requestId đã dùng ở bước tạo checkout.
    const { partnerCode, accessKey, queryUrl, timeout } = env.momo;
    const requestId = input.orderId;

    // Query request cũng phải được ký theo chuỗi field cố định của MoMo.
    const raw = `accessKey=${accessKey}&orderId=${input.orderId}&partnerCode=${partnerCode}&requestId=${requestId}`;
    const body = { partnerCode, accessKey, requestId, orderId: input.orderId, signature: sign(raw), lang: 'vi' };

    const res = await postJson<MomoQueryResponse>(queryUrl, body, timeout);
    // Chuẩn hóa resultCode 0 của MoMo thành cờ nghiệp vụ paid.
    return { paid: res.resultCode === 0, raw: res as unknown as Record<string, unknown> };
  }
}
