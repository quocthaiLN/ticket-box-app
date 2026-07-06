import { createHmac } from 'node:crypto';
import { env } from '@ticketbox/config';
import { enqueueNotification } from '@ticketbox/queue';
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from '@ticketbox/database';
import { getGateway } from './gateways/index.js';
import { ApiError, Errors } from '../../shared/http/problem-details.js';
import { auditService } from '../audit/audit.service.js';
import {
  confirmOrderPayment,
  createPaymentRecord,
  failPayment,
  findPaymentByProviderTxn,
  findPendingPaymentForWebhook,
  getActivePendingPayment,
  getOrderForRetry,
  saveWebhookRawPayload,
} from './payment.repository.js';
import type { ConfirmOrderPaymentResult } from './payment.repository.js';
import { getBulkhead } from './bulkhead/payment.bulkhead.js';
import { getCircuitBreaker } from './circuit-breaker/payment.circuit-breaker.js';
import type { CreatePaymentResponse, MomoWebhookBody, VnpayWebhookBody } from './payment.type.js';

// Gọi provider qua bulkhead và circuit breaker để cô lập lỗi giữa các provider.
async function callProvider<T>(
  provider: 'VNPAY' | 'MOMO',
  fn: () => Promise<T>,
): Promise<T> {
  const cb = getCircuitBreaker(provider);
  const bh = getBulkhead(provider);
  return bh.execute(() => cb.execute(fn));
}

// Tạo checkout URL thử lần lượt các provider trong danh sách, trả về ngay khi 1 cổng OK.
// 1 phần tử = KHÔNG fallback (client đã chỉ định provider); nhiều phần tử = có fallback.
export async function buildCheckoutUrl(
  providers: Array<'VNPAY' | 'MOMO'>,
  orderId: string,
  amount: string,
  currency: string,
  orderInfo: string,
): Promise<{ url: string; provider: 'VNPAY' | 'MOMO' }> {
  let lastError: unknown;

  for (const provider of providers) {
    // Bỏ qua provider đang bị circuit breaker chặn (tín hiệu từ queryStatus/webhook).
    if (getCircuitBreaker(provider).isOpen()) continue;

    try {
      // Provider trả checkout URL dùng để redirect user sang trang thanh toán.
      const gateway = getGateway(provider);
      const run = () => gateway.createCheckout({ orderId, amount, currency, orderInfo });
      // Chỉ checkout chạm mạng (MoMo) mới feed circuit breaker; VNPay ký URL local
      // nên không record vào breaker để tránh reset/đóng nhầm trạng thái sức khỏe.
      const { payUrl } = gateway.checkoutHitsNetwork
        ? await callProvider(provider, run)
        : await run();
      return { url: payUrl, provider };
    } catch (err) {
      console.warn(`[payment] ${provider} checkout failed:`, err instanceof Error ? err.message : err);
      lastError = err;
    }
  }

  // Không cổng nào tạo được checkout: ném ApiError chuẩn (503) để errorMiddleware trả
  // problem+json với code PAYMENT_PROVIDER_UNAVAILABLE → client hiện thông báo và để
  // user chọn phương thức khác rồi POST lại endpoint payment.
  console.error('[payment] no provider could create checkout:', lastError instanceof Error ? lastError.message : lastError);
  throw Errors.paymentProviderUnavailable(
    `Could not start payment via ${providers.join(', ')}. Please choose another payment method and try again.`,
  );
}

// Truy vấn trạng thái thanh toán tại provider để phục vụ đối soát.
export async function queryPaymentStatus(
  provider: 'VNPAY' | 'MOMO',
  orderId: string,
  transactionDate: string,
): Promise<{ paid: boolean; raw: Record<string, unknown> }> {
  return callProvider(provider, () =>
    getGateway(provider).queryStatus({ orderId, transactionDate }),
  );
}

// Tạo một payment attempt cho order HELD và trả checkout URL cho client.
export async function createPayment(
  orderId: string,
  userId: string,
  provider?: 'VNPAY' | 'MOMO',
): Promise<CreatePaymentResponse> {
  // Xác nhận user sở hữu order và order vẫn có thể thanh toán.
  const order = await getOrderForRetry(orderId, userId);

  // Không cho phép đồng thời tồn tại nhiều payment PENDING.
  const existing = await getActivePendingPayment(orderId);
  if (existing) {
    throw new ApiError({
      title: 'PAYMENT_ALREADY_PENDING',
      status: 409,
      code: 'PAYMENT_ALREADY_PENDING',
      detail: 'An active pending payment already exists for this order',
    });
  }

  // Chuẩn bị dữ liệu giao dịch và yêu cầu provider tạo checkout URL.
  const orderInfo = `Payment for order ${orderId}`;

  // Client chỉ định provider → CHỈ dùng đúng provider đó (không fallback) để khi lỗi
  // user tự chọn lại & POST lại. Không chỉ định → thử VNPAY rồi MOMO (resilience).
  const providers: Array<'VNPAY' | 'MOMO'> = provider ? [provider] : ['VNPAY', 'MOMO'];

  const { url: checkoutUrl, provider: actualProvider } = await buildCheckoutUrl(
    providers,
    orderId,
    order.totalAmount,
    order.currency,
    orderInfo,
  );

  // Lưu attempt với provider thực tế (chỉ khác provider yêu cầu khi không chỉ định + fallback).
  const payment = await createPaymentRecord(orderId, order.totalAmount, order.currency, actualProvider, checkoutUrl);

  // Chuẩn hoá dữ liệu cần thiết để client chuyển sang bước thanh toán.
  return {
    payment_id: payment.id,
    provider: actualProvider,
    status: payment.status,
    checkout_url: payment.checkoutUrl,
    order_id: orderId,
    hold_expires_at: order.holdExpiresAt ? order.holdExpiresAt.toISOString() : '',
  };
}

// VNPAY Webhook
// Xác minh HMAC SHA-512 của webhook VNPAY trước khi thay đổi trạng thái payment.
function verifyVnpaySignature(body: VnpayWebhookBody): boolean {
  const { vnp_SecureHash, vnp_SecureHashType, ...rest } = body;
  if (!vnp_SecureHash) return false;

  // VNPAY ký trên value đã encode (encodeURIComponent, %20 -> +); framework parse query
  // trả về value đã decode nên phải encode lại đúng cách thì hash mới khớp.
  const encodeVnpValue = (value: string) => encodeURIComponent(value).replace(/%20/g, '+');
  const sortedKeys = Object.keys(rest).sort();
  const signData = sortedKeys
    .filter((k) => rest[k] !== '' && rest[k] !== undefined)
    .map((k) => `${k}=${encodeVnpValue(String(rest[k]))}`)
    .join('&');

  const expected = createHmac('sha512', env.vnpay.hashSecret)
    .update(signData, 'utf8')
    .digest('hex');

  return expected.toLowerCase() === vnp_SecureHash.toLowerCase();
}

// Xử lý webhook VNPAY: kiểm tra dữ liệu, chữ ký, số tiền rồi xác nhận/thất bại payment.
export async function handleVnpayWebhook(body: VnpayWebhookBody): Promise<{ RspCode: string; Message: string }> {
  const orderId = body.vnp_TxnRef;
  const providerTxnId = body.vnp_TransactionNo;
  const vnpAmount = body.vnp_Amount;
  const responseCode = body.vnp_ResponseCode;

  if (!orderId || !providerTxnId || !vnpAmount || !responseCode) {
    return { RspCode: '99', Message: 'Missing required fields' };
  }

  // Webhook trùng của giao dịch thành công được chấp nhận idempotent.
  const existing = await findPaymentByProviderTxn('VNPAY', providerTxnId);
  if (existing?.status === 'SUCCEEDED') {
    return { RspCode: '00', Message: 'Confirm Success' };
  }

  // Luôn lưu payload nếu tìm được payment để phục vụ audit, kể cả chữ ký không hợp lệ.
  const signatureValid = verifyVnpaySignature(body);

  const payment = await findPendingPaymentForWebhook(orderId, 'VNPAY');
  if (payment) {
    await saveWebhookRawPayload(payment.id, body, signatureValid, providerTxnId);
  }

  if (!signatureValid) {
    if (payment) {
      void recordPaymentWebhookAudit({
        action: AUDIT_ACTIONS.PAYMENT_WEBHOOK_FAILED,
        paymentId: payment.id,
        provider: 'VNPAY',
        orderId,
        providerTransactionId: providerTxnId,
        reason: 'INVALID_SIGNATURE',
        signatureValid,
        responseCode,
      });
    }
    return { RspCode: '97', Message: 'Invalid signature' };
  }

  if (payment) {
    // VNPAY biểu diễn số tiền theo đơn vị nhỏ nhất, nên nhân amount với 100 để so sánh.
    const expectedAmount = Math.round(parseFloat(payment.amount) * 100);
    if (parseInt(vnpAmount, 10) !== expectedAmount) {
      void recordPaymentWebhookAudit({
        action: AUDIT_ACTIONS.PAYMENT_WEBHOOK_FAILED,
        paymentId: payment.id,
        provider: 'VNPAY',
        orderId,
        providerTransactionId: providerTxnId,
        reason: 'INVALID_AMOUNT',
        signatureValid,
        responseCode,
        amount: vnpAmount,
        expectedAmount,
      });
      return { RspCode: '04', Message: 'Invalid amount' };
    }
  }

  const isSuccess = responseCode === '00';

  // Webhook hợp lệ sẽ xác nhận payment hoặc giải phóng hold khi thất bại.
  if (isSuccess && payment) {
    const { issuedNotifications, issuedTickets } = await confirmOrderPayment(payment.id, orderId);
    getCircuitBreaker('VNPAY').recordSuccess();
    void recordPaymentWebhookAudit({
      action: AUDIT_ACTIONS.PAYMENT_WEBHOOK_SUCCEEDED,
      paymentId: payment.id,
      provider: 'VNPAY',
      orderId,
      providerTransactionId: providerTxnId,
      signatureValid,
      responseCode,
      issuedTicketCount: issuedTickets.length,
      notificationCount: issuedNotifications.length,
    });
    void recordTicketIssuedAudits({
      provider: 'VNPAY',
      paymentId: payment.id,
      orderId,
      issuedTickets,
    });
    void enqueueIssuedTicketNotifications(issuedNotifications);
  } else if (!isSuccess && payment) {
    const failureReason = `VNPAY_${responseCode}`;
    await failPayment(payment.id, orderId, failureReason);
    getCircuitBreaker('VNPAY').recordFailure();
    void recordPaymentWebhookAudit({
      action: AUDIT_ACTIONS.PAYMENT_WEBHOOK_FAILED,
      paymentId: payment.id,
      provider: 'VNPAY',
      orderId,
      providerTransactionId: providerTxnId,
      reason: failureReason,
      signatureValid,
      responseCode,
    });
  }

  return { RspCode: '00', Message: 'Confirm Success' };
}

// MoMo Webhook
// Xác minh HMAC SHA-256 của payload webhook MoMo.
function verifyMomoSignature(body: MomoWebhookBody): boolean {
  if (!body.signature) return false;

  // MoMo yêu cầu chuỗi ký gồm các field theo đúng thứ tự này.
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

// Xử lý webhook MoMo: kiểm tra chữ ký rồi xác nhận/thất bại payment tương ứng.
export async function handleMomoWebhook(body: MomoWebhookBody): Promise<{ status: number; message: string }> {
  const orderId = body.orderId;
  const transId = body.transId?.toString();
  const resultCode = body.resultCode;

  if (!orderId || transId === undefined || resultCode === undefined) {
    return { status: 400, message: 'Missing required fields' };
  }

  // Webhook trùng của giao dịch thành công được chấp nhận idempotent.
  const existing = await findPaymentByProviderTxn('MOMO', transId);
  if (existing?.status === 'SUCCEEDED') {
    return { status: 200, message: 'success' };
  }

  // Lưu payload trước khi kết thúc xử lý để có dữ liệu audit/reconcile.
  const signatureValid = verifyMomoSignature(body);

  const payment = await findPendingPaymentForWebhook(orderId, 'MOMO');
  if (payment) {
    await saveWebhookRawPayload(payment.id, body as unknown as Record<string, unknown>, signatureValid, transId);
  }

  if (!signatureValid) {
    if (payment) {
      void recordPaymentWebhookAudit({
        action: AUDIT_ACTIONS.PAYMENT_WEBHOOK_FAILED,
        paymentId: payment.id,
        provider: 'MOMO',
        orderId,
        providerTransactionId: transId,
        reason: 'INVALID_SIGNATURE',
        signatureValid,
        resultCode,
      });
    }
    return { status: 403, message: 'Invalid signature' };
  }

  const isSuccess = resultCode === 0;

  // Webhook hợp lệ sẽ xác nhận payment hoặc giải phóng hold khi thất bại.
  if (isSuccess && payment) {
    const { issuedNotifications, issuedTickets } = await confirmOrderPayment(payment.id, orderId);
    getCircuitBreaker('MOMO').recordSuccess();
    void recordPaymentWebhookAudit({
      action: AUDIT_ACTIONS.PAYMENT_WEBHOOK_SUCCEEDED,
      paymentId: payment.id,
      provider: 'MOMO',
      orderId,
      providerTransactionId: transId,
      signatureValid,
      resultCode,
      issuedTicketCount: issuedTickets.length,
      notificationCount: issuedNotifications.length,
    });
    void recordTicketIssuedAudits({
      provider: 'MOMO',
      paymentId: payment.id,
      orderId,
      issuedTickets,
    });
    void enqueueIssuedTicketNotifications(issuedNotifications);
  } else if (!isSuccess && payment) {
    const failureReason = `MOMO_${resultCode}`;
    await failPayment(payment.id, orderId, failureReason);
    getCircuitBreaker('MOMO').recordFailure();
    void recordPaymentWebhookAudit({
      action: AUDIT_ACTIONS.PAYMENT_WEBHOOK_FAILED,
      paymentId: payment.id,
      provider: 'MOMO',
      orderId,
      providerTransactionId: transId,
      reason: failureReason,
      signatureValid,
      resultCode,
    });
  }

  return { status: 200, message: 'success' };
}

type IssuedNotification = {
  id: string;
  userId: string;
  channel: string;
  payload: Record<string, unknown>;
};

async function recordPaymentWebhookAudit(input: {
  action:
    | typeof AUDIT_ACTIONS.PAYMENT_WEBHOOK_SUCCEEDED
    | typeof AUDIT_ACTIONS.PAYMENT_WEBHOOK_FAILED;
  paymentId: string;
  provider: 'VNPAY' | 'MOMO';
  orderId: string;
  providerTransactionId?: string;
  reason?: string;
  signatureValid: boolean;
  responseCode?: string;
  resultCode?: number;
  amount?: string;
  expectedAmount?: number;
  issuedTicketCount?: number;
  notificationCount?: number;
}): Promise<void> {
  await auditService.record(
    {
      actor_user_id: null,
      action: input.action,
      entity_type: AUDIT_ENTITY_TYPES.PAYMENT,
      entity_id: input.paymentId,
      metadata: {
        provider: input.provider,
        order_id: input.orderId,
        provider_transaction_id: input.providerTransactionId,
        reason: input.reason,
        signature_valid: input.signatureValid,
        response_code: input.responseCode,
        result_code: input.resultCode,
        amount: input.amount,
        expected_amount: input.expectedAmount,
        issued_ticket_count: input.issuedTicketCount,
        notification_count: input.notificationCount,
      },
    },
    { bestEffort: true },
  );
}

async function recordTicketIssuedAudits(input: {
  provider: 'VNPAY' | 'MOMO';
  paymentId: string;
  orderId: string;
  issuedTickets: ConfirmOrderPaymentResult['issuedTickets'];
}): Promise<void> {
  await Promise.allSettled(
    input.issuedTickets.map((ticket) =>
      auditService.record(
        {
          actor_user_id: null,
          action: AUDIT_ACTIONS.TICKET_ISSUED,
          entity_type: AUDIT_ENTITY_TYPES.TICKET,
          entity_id: ticket.id,
          metadata: {
            provider: input.provider,
            payment_id: input.paymentId,
            order_id: input.orderId,
            user_id: ticket.userId,
            concert_id: ticket.concertId,
          },
        },
        { bestEffort: true },
      ),
    ),
  );
}

// Đẩy notification phát hành vé sang queue sau khi transaction thanh toán đã commit.
async function enqueueIssuedTicketNotifications(
  notifications: IssuedNotification[],
): Promise<void> {
  // Một notification lỗi không được làm ảnh hưởng các notification còn lại.
  await Promise.allSettled(
    notifications.map((n) =>
      enqueueNotification({
        notification_id: n.id,
        channel: n.channel as 'EMAIL' | 'PUSH' | 'IN_APP',
        recipient_user_id: n.userId,
        subject: n.payload.subject as string | undefined,
        body: (n.payload.body as string | undefined) ?? '',
      }).catch((err: unknown) =>
        console.error(`[payment] Failed to enqueue notification ${n.id}:`, err),
      ),
    ),
  );
}
