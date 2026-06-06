import { createHmac } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import type { VnpayWebhookBody } from '../../apps/api-server/src/modules/payments/payment.type.js';
import {
  createFixture,
  cleanupFixture,
  USER_IDS,
  type TestFixture,
} from '../inventory/helpers.js';

export { createFixture, cleanupFixture, USER_IDS };
export type { TestFixture };

export const db = new PrismaClient();

// ─── Order helpers ────────────────────────────────────────────────────────────

export interface TestOrder {
  orderId: string;
  paymentId: string;
  checkoutUrl: string;
  totalAmount: string;
  currency: string;
}

export async function createTestOrder(
  fixture: TestFixture,
  userId = USER_IDS.audience,
  quantity = 1,
  idempotencyKeySuffix = crypto.randomUUID(),
): Promise<TestOrder> {
  const { createOrder } = await import(
    '../../apps/api-server/src/modules/orders/order.service.js'
  );

  const idempotencyKey = `test-order-${fixture.ticketTypeId}-${idempotencyKeySuffix}`;
  const result = await createOrder(
    userId,
    {
      concert_id: fixture.concertId,
      items: [{ ticket_type_id: fixture.ticketTypeId, quantity }],
      payment_provider: 'VNPAY',
    },
    idempotencyKey,
  );

  return {
    orderId: result.order_id,
    paymentId: result.payment_id,
    checkoutUrl: result.checkout_url,
    totalAmount: result.total_amount,
    currency: result.currency,
  };
}

// ─── DB query helpers ─────────────────────────────────────────────────────────

export async function getOrderStatus(orderId: string): Promise<string | null> {
  const row = await db.order.findUnique({
    where: { id: orderId },
    select: { status: true },
  });
  return row?.status ?? null;
}

export async function getPaymentStatus(paymentId: string): Promise<string | null> {
  const row = await db.payment.findUnique({
    where: { id: paymentId },
    select: { status: true },
  });
  return row?.status ?? null;
}

export async function getTicketsByOrder(orderId: string) {
  return db.ticket.findMany({
    where: { orderId },
    select: { id: true, status: true, ticketTypeId: true, qrTokenHash: true },
  });
}

export async function cleanupOrder(orderId: string): Promise<void> {
  await db.ticket.deleteMany({ where: { orderId } });
  await db.payment.deleteMany({ where: { orderId } });
  await db.order.delete({ where: { id: orderId } });
}

// ─── VNPAY signature helpers ──────────────────────────────────────────────────

function formatVnpDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

export function buildVnpayWebhookPayload(
  orderId: string,
  amountVnd: string,      // order totalAmount (in VND units, e.g. "100000")
  transactionNo: string,
  responseCode = '00',
): VnpayWebhookBody {
  const hashSecret = process.env['VNPAY_HASH_SECRET'] ?? 'vnpay_hash_secret';
  const tmnCode   = process.env['VNPAY_TMN_CODE']    ?? 'vnpay_tmn_code';

  // VNPAY amount = amount × 100
  const vnpAmount = String(Math.round(parseFloat(amountVnd) * 100));

  const fields: Record<string, string> = {
    vnp_Amount:        vnpAmount,
    vnp_BankCode:      'NCB',
    vnp_BankTranNo:    `VNP${transactionNo}`,
    vnp_OrderInfo:     `Payment for order ${orderId}`,
    vnp_PayDate:       formatVnpDate(new Date()),
    vnp_ResponseCode:  responseCode,
    vnp_TmnCode:       tmnCode,
    vnp_TransactionNo: transactionNo,
    vnp_TxnRef:        orderId,
  };

  const sortedKeys = Object.keys(fields).sort();
  const signData = sortedKeys
    .filter((k) => fields[k] !== '' && fields[k] !== undefined)
    .map((k) => `${k}=${fields[k]}`)
    .join('&');

  const vnp_SecureHash = createHmac('sha512', hashSecret)
    .update(signData, 'utf8')
    .digest('hex');

  return { ...fields, vnp_SecureHash };
}
