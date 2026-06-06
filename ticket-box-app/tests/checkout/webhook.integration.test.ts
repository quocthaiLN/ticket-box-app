// Task 3 — Webhook idempotent: VNPAY IPN confirms order + issues tickets; retry safe
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { handleVnpayWebhook } from '../../apps/api-server/src/modules/payments/payment.service.js';
import {
  createFixture,
  cleanupFixture,
  createTestOrder,
  getOrderStatus,
  getPaymentStatus,
  getTicketsByOrder,
  cleanupOrder,
  buildVnpayWebhookPayload,
  db,
  type TestFixture,
  type TestOrder,
} from './helpers.js';

// ─── Success path ─────────────────────────────────────────────────────────────

describe('VNPAY webhook – success path', () => {
  let fixture: TestFixture;
  let order: TestOrder;
  const transactionNo = `TXN${Date.now()}`;

  beforeAll(async () => {
    fixture = await createFixture({ totalQuantity: 5, maxPerUser: 5 });
    order   = await createTestOrder(fixture);
  });

  afterAll(async () => {
    await cleanupOrder(order.orderId);
    await cleanupFixture(fixture);
  });

  it('returns RspCode 00 on valid IPN', async () => {
    const payload = buildVnpayWebhookPayload(order.orderId, order.totalAmount, transactionNo);
    const result  = await handleVnpayWebhook(payload);
    expect(result.RspCode).toBe('00');
  });

  it('transitions order to CONFIRMED', async () => {
    const status = await getOrderStatus(order.orderId);
    expect(status).toBe('CONFIRMED');
  });

  it('transitions payment to SUCCEEDED', async () => {
    const status = await getPaymentStatus(order.paymentId);
    expect(status).toBe('SUCCEEDED');
  });

  it('issues correct number of tickets', async () => {
    const tickets = await getTicketsByOrder(order.orderId);
    expect(tickets).toHaveLength(1); // quantity = 1
    expect(tickets[0].status).toBe('ISSUED');
  });

  it('inventory: held decreases and sold increases', async () => {
    const row = await db.ticketType.findUnique({
      where: { id: fixture.ticketTypeId },
      select: { heldQuantity: true, soldQuantity: true },
    });
    expect(row!.heldQuantity).toBe(0);
    expect(row!.soldQuantity).toBe(1);
  });
});

// ─── Idempotency (retry) ──────────────────────────────────────────────────────

describe('VNPAY webhook – idempotent on retry', () => {
  let fixture: TestFixture;
  let order: TestOrder;
  const transactionNo = `TXN${Date.now() + 1}`;

  beforeAll(async () => {
    fixture = await createFixture({ totalQuantity: 5, maxPerUser: 5 });
    order   = await createTestOrder(fixture);

    // First webhook: confirms order
    const payload = buildVnpayWebhookPayload(order.orderId, order.totalAmount, transactionNo);
    await handleVnpayWebhook(payload);
  });

  afterAll(async () => {
    await cleanupOrder(order.orderId);
    await cleanupFixture(fixture);
  });

  it('second webhook with same transactionNo returns 00 without error', async () => {
    const payload = buildVnpayWebhookPayload(order.orderId, order.totalAmount, transactionNo);
    const result  = await handleVnpayWebhook(payload);
    expect(result.RspCode).toBe('00');
  });

  it('no duplicate tickets after retry', async () => {
    const tickets = await getTicketsByOrder(order.orderId);
    expect(tickets).toHaveLength(1); // still only 1
  });
});

// ─── Invalid signature ────────────────────────────────────────────────────────

describe('VNPAY webhook – invalid signature', () => {
  let fixture: TestFixture;
  let order: TestOrder;

  beforeAll(async () => {
    fixture = await createFixture({ totalQuantity: 5, maxPerUser: 5 });
    order   = await createTestOrder(fixture);
  });

  afterAll(async () => {
    await cleanupOrder(order.orderId);
    await cleanupFixture(fixture);
  });

  it('returns RspCode 97 and does not confirm order', async () => {
    const payload = buildVnpayWebhookPayload(order.orderId, order.totalAmount, `TXN${Date.now() + 2}`);
    payload.vnp_SecureHash = 'invalid_hash_value'; // tamper signature

    const result = await handleVnpayWebhook(payload);
    expect(result.RspCode).toBe('97');

    const orderStatus = await getOrderStatus(order.orderId);
    expect(orderStatus).toBe('HELD'); // not changed
  });
});

// ─── Payment failure ──────────────────────────────────────────────────────────

describe('VNPAY webhook – payment failure (responseCode ≠ 00)', () => {
  let fixture: TestFixture;
  let order: TestOrder;

  beforeAll(async () => {
    fixture = await createFixture({ totalQuantity: 5, maxPerUser: 5 });
    order   = await createTestOrder(fixture);
  });

  afterAll(async () => {
    await cleanupOrder(order.orderId);
    await cleanupFixture(fixture);
  });

  it('cancels order and releases inventory on failed payment', async () => {
    const payload = buildVnpayWebhookPayload(
      order.orderId,
      order.totalAmount,
      `TXN${Date.now() + 3}`,
      '24', // insufficient funds
    );
    const result = await handleVnpayWebhook(payload);
    expect(result.RspCode).toBe('00'); // provider IPN still expects 00

    const orderStatus = await getOrderStatus(order.orderId);
    expect(orderStatus).toBe('CANCELLED');

    const row = await db.ticketType.findUnique({
      where: { id: fixture.ticketTypeId },
      select: { heldQuantity: true },
    });
    expect(row!.heldQuantity).toBe(0); // hold released
  });
});
