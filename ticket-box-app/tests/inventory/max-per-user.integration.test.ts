import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  holdInventory,
  releaseInventory,
  InventoryError,
} from '../../apps/api-server/src/modules/inventory/inventory.repository.js';
import {
  createFixture,
  cleanupFixture,
  makeHoldRequest,
  makeReleaseRequest,
  USER_IDS,
  type TestFixture,
} from './helpers.js';

// ─── Basic per-user limit ────────────────────────────────────────────────────

describe('holdInventory – max_per_user (basic limit)', () => {
  let fixture: TestFixture;

  beforeAll(async () => {
    fixture = await createFixture({ totalQuantity: 20, maxPerUser: 2 });
  });

  afterAll(async () => {
    await cleanupFixture(fixture);
  });

  it('holds exactly max_per_user tickets', async () => {
    const { req, idempotencyKey } = makeHoldRequest(fixture, USER_IDS.audience, 2);
    const result = await holdInventory(req, idempotencyKey);

    expect(result.order.status).toBe('HELD');
    expect(result.itemResults[0].quantity).toBe(2);
  });

  it('throws PER_USER_LIMIT_EXCEEDED when requesting one more than max', async () => {
    // Audience already holds 2; max = 2 → cannot hold 1 more
    const { req, idempotencyKey } = makeHoldRequest(fixture, USER_IDS.audience, 1);

    await expect(holdInventory(req, idempotencyKey)).rejects.toSatisfy((e: unknown) => {
      return e instanceof InventoryError && e.code === 'PER_USER_LIMIT_EXCEEDED';
    });
  });

  it('other users are not affected by one user hitting their limit', async () => {
    // Organizer has not held anything yet
    const { req, idempotencyKey } = makeHoldRequest(fixture, USER_IDS.organizer, 2);
    const result = await holdInventory(req, idempotencyKey);

    expect(result.order.status).toBe('HELD');
  });
});

// ─── Accumulated held + paid ─────────────────────────────────────────────────

describe('holdInventory – max_per_user (accumulated counters)', () => {
  let fixture: TestFixture;

  beforeAll(async () => {
    // max = 3: user will hold 2 in one order, then try to hold 2 more → exceeds limit
    fixture = await createFixture({ totalQuantity: 20, maxPerUser: 3 });
  });

  afterAll(async () => {
    await cleanupFixture(fixture);
  });

  it('allows holding up to max_per_user across multiple holds', async () => {
    const { req: req1, idempotencyKey: key1 } = makeHoldRequest(fixture, USER_IDS.audience, 1, 'a');
    await holdInventory(req1, key1);

    // Audience now holds 1 of 3 max → can still hold 2 more
    const { req: req2, idempotencyKey: key2 } = makeHoldRequest(fixture, USER_IDS.audience, 2, 'b');
    const result = await holdInventory(req2, key2);

    expect(result.order.status).toBe('HELD');
  });

  it('throws when accumulated held quantity would exceed max_per_user', async () => {
    // Audience already holds 3 (1+2) = max → cannot hold 1 more
    const { req, idempotencyKey } = makeHoldRequest(fixture, USER_IDS.audience, 1, 'c');

    await expect(holdInventory(req, idempotencyKey)).rejects.toSatisfy((e: unknown) => {
      return e instanceof InventoryError && e.code === 'PER_USER_LIMIT_EXCEEDED';
    });
  });
});

// ─── Counter resets after release ───────────────────────────────────────────

describe('holdInventory – max_per_user counter resets after release', () => {
  let fixture: TestFixture;

  beforeAll(async () => {
    fixture = await createFixture({ totalQuantity: 20, maxPerUser: 2 });
  });

  afterAll(async () => {
    await cleanupFixture(fixture);
  });

  it('hold max → release → hold max again succeeds', async () => {
    // Step 1: hold 2 (= max)
    const { req: holdReq, idempotencyKey: holdKey } = makeHoldRequest(fixture, USER_IDS.audience, 2, '1st');
    const { order } = await holdInventory(holdReq, holdKey);
    expect(order.status).toBe('HELD');

    // Step 2: release
    const releaseResult = await releaseInventory(makeReleaseRequest(order.id));
    expect(releaseResult.status).toBe('CANCELLED');

    // Step 3: hold 2 again — counter should be back to 0
    const { req: holdReq2, idempotencyKey: holdKey2 } = makeHoldRequest(fixture, USER_IDS.audience, 2, '2nd');
    const result2 = await holdInventory(holdReq2, holdKey2);
    expect(result2.order.status).toBe('HELD');
  });
});
