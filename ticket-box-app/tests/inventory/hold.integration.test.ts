import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  holdInventory,
  InventoryError,
} from '../../apps/api-server/src/modules/inventory/inventory.repository.js';
import {
  createFixture,
  cleanupFixture,
  makeHoldRequest,
  getHeldQuantity,
  USER_IDS,
  type TestFixture,
} from './helpers.js';

// ─── Oversell: single sequential ─────────────────────────────────────────────

describe('holdInventory – oversell (sequential)', () => {
  let fixture: TestFixture;

  beforeAll(async () => {
    fixture = await createFixture({ totalQuantity: 5, maxPerUser: 5 });
  });

  afterAll(async () => {
    await cleanupFixture(fixture);
  });

  it('holds the full available quantity successfully', async () => {
    const { req, idempotencyKey } = makeHoldRequest(fixture, USER_IDS.audience, 5);
    const result = await holdInventory(req, idempotencyKey);

    expect(result.order.status).toBe('HELD');
    expect(result.itemResults[0].quantity).toBe(5);
    expect(result.itemResults[0].available_quantity_after).toBe(0);
  });

  it('throws TICKET_SOLD_OUT when no tickets remain', async () => {
    // Previous test consumed all 5 tickets
    const { req, idempotencyKey } = makeHoldRequest(fixture, USER_IDS.organizer, 1);

    await expect(holdInventory(req, idempotencyKey)).rejects.toSatisfy((e: unknown) => {
      return e instanceof InventoryError && e.code === 'TICKET_SOLD_OUT';
    });
  });

  it('throws with statusCode 409 on sold-out error', async () => {
    const { req, idempotencyKey } = makeHoldRequest(fixture, USER_IDS.checker, 1);

    await expect(holdInventory(req, idempotencyKey)).rejects.toSatisfy((e: unknown) => {
      return e instanceof InventoryError && e.statusCode === 409;
    });
  });
});

// ─── Oversell: concurrent ────────────────────────────────────────────────────

describe('holdInventory – oversell (concurrent)', () => {
  let fixture: TestFixture;

  beforeAll(async () => {
    // 4 users each request 1 ticket, only 2 available
    fixture = await createFixture({ totalQuantity: 2, maxPerUser: 4 });
  });

  afterAll(async () => {
    await cleanupFixture(fixture);
  });

  it('held_quantity never exceeds total_quantity under concurrent load', async () => {
    const users = [
      USER_IDS.audience,
      USER_IDS.organizer,
      USER_IDS.checker,
      USER_IDS.admin,
    ];

    // Fire all holds concurrently; some may fail with TICKET_SOLD_OUT or
    // P2034 serialization errors — both are acceptable "did not hold" outcomes.
    await Promise.allSettled(
      users.map((userId) => {
        const { req, idempotencyKey } = makeHoldRequest(fixture, userId, 1);
        return holdInventory(req, idempotencyKey);
      }),
    );

    // The invariant: held_quantity must never exceed total_quantity (2)
    const held = await getHeldQuantity(fixture.ticketTypeId);
    expect(held).toBeGreaterThan(0);        // at least one hold succeeded
    expect(held).toBeLessThanOrEqual(2);    // no oversell
  });
});

// ─── Oversell: partial quantity ──────────────────────────────────────────────

describe('holdInventory – partial quantity request', () => {
  let fixture: TestFixture;

  beforeAll(async () => {
    fixture = await createFixture({ totalQuantity: 3, maxPerUser: 5 });
  });

  afterAll(async () => {
    await cleanupFixture(fixture);
  });

  it('rejects a hold whose quantity alone exceeds available supply', async () => {
    const { req, idempotencyKey } = makeHoldRequest(fixture, USER_IDS.audience, 5); // 5 > 3 available

    await expect(holdInventory(req, idempotencyKey)).rejects.toSatisfy((e: unknown) => {
      return e instanceof InventoryError && e.code === 'TICKET_SOLD_OUT';
    });
  });

  it('accepts a hold whose quantity is within available supply', async () => {
    const { req, idempotencyKey } = makeHoldRequest(fixture, USER_IDS.audience, 3);
    const result = await holdInventory(req, idempotencyKey);

    expect(result.order.status).toBe('HELD');
  });
});
