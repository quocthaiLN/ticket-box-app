// Task 2 — Verify checkout flow: createOrder returns HELD order + PENDING payment + checkout_url
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createFixture,
  cleanupFixture,
  createTestOrder,
  getOrderStatus,
  getPaymentStatus,
  cleanupOrder,
  USER_IDS,
  db,
  type TestFixture,
  type TestOrder,
} from './helpers.js';

describe('createOrder – checkout flow', () => {
  let fixture: TestFixture;
  let order: TestOrder;

  beforeAll(async () => {
    fixture = await createFixture({ totalQuantity: 10, maxPerUser: 5 });
    order   = await createTestOrder(fixture);
  });

  afterAll(async () => {
    await cleanupOrder(order.orderId);
    await cleanupFixture(fixture);
  });

  it('returns a checkout_url pointing to VNPAY sandbox', () => {
    expect(order.checkoutUrl).toBeTruthy();
    expect(order.checkoutUrl).toContain('vnp_TxnRef');
    expect(order.checkoutUrl).toContain(order.orderId);
    expect(order.checkoutUrl).toContain('vnp_SecureHash');
  });

  it('creates order with status HELD in DB', async () => {
    const status = await getOrderStatus(order.orderId);
    expect(status).toBe('HELD');
  });

  it('creates payment with status PENDING in DB', async () => {
    const status = await getPaymentStatus(order.paymentId);
    expect(status).toBe('PENDING');
  });

  it('hold_expires_at is ~15 minutes in the future', async () => {
    const row = await db.order.findUnique({
      where: { id: order.orderId },
      select: { holdExpiresAt: true },
    });
    const diffMs = row!.holdExpiresAt!.getTime() - Date.now();
    expect(diffMs).toBeGreaterThan(14 * 60 * 1000); // > 14 min
    expect(diffMs).toBeLessThan(16 * 60 * 1000);    // < 16 min
  });
});

// ─── Idempotency ──────────────────────────────────────────────────────────────

describe('createOrder – idempotency', () => {
  let fixture: TestFixture;
  const suffix = `idem-${Date.now()}`;
  const orders: TestOrder[] = [];

  beforeAll(async () => {
    fixture = await createFixture({ totalQuantity: 10, maxPerUser: 5 });
  });

  afterAll(async () => {
    for (const o of orders) await cleanupOrder(o.orderId).catch(() => {});
    await cleanupFixture(fixture);
  });

  it('two calls with the same idempotency key return the same order_id', async () => {
    const o1 = await createTestOrder(fixture, USER_IDS.audience, 1, suffix);
    const o2 = await createTestOrder(fixture, USER_IDS.audience, 1, suffix);
    orders.push(o1);
    // o2 is same order — do not push again (same id, would fail double-delete)

    expect(o1.orderId).toBe(o2.orderId);
    expect(o1.paymentId).toBe(o2.paymentId);
    expect(o1.checkoutUrl).toBe(o2.checkoutUrl);
  });

  it('inventory is held only once after two identical requests', async () => {
    const row = await db.ticketType.findUnique({
      where: { id: fixture.ticketTypeId },
      select: { heldQuantity: true },
    });
    expect(row!.heldQuantity).toBe(1); // only 1 held, not 2
  });
});
