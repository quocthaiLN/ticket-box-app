import { PrismaClient, TicketTypeStatus, ConcertStatus } from '@prisma/client';
import type { HoldRequest, ReleaseRequest } from '../../apps/api-server/src/modules/inventory/inventory.type.js';
import type { ReleaseReason } from '../../apps/api-server/src/modules/inventory/inventory.constants.js';
import type { Role } from '../../apps/api-server/src/shared/guards/role.guard.js';

// Singleton for test fixtures (separate from the app's prisma singleton)
export const db = new PrismaClient();

// Seed user IDs (from seed.mjs)
export const USER_IDS = {
  audience:  '00000000-0000-0000-0000-000000000001',
  organizer: '00000000-0000-0000-0000-000000000002',
  checker:   '00000000-0000-0000-0000-000000000003',
  admin:     '00000000-0000-0000-0000-000000000004',
} as const;

// Fixed venue from seed
const SEED_VENUE_ID = '00000000-0000-0000-0000-000000000101';

export interface TestFixture {
  concertId: string;
  seatZoneId: string;
  ticketTypeId: string;
}

export async function createFixture(opts: {
  totalQuantity: number;
  maxPerUser: number;
}): Promise<TestFixture> {
  const suffix = crypto.randomUUID().slice(0, 8);
  const concertId = crypto.randomUUID();
  const seatZoneId = crypto.randomUUID();
  const ticketTypeId = crypto.randomUUID();

  const now = new Date();
  const saleStart = new Date(now.getTime() - 24 * 60 * 60 * 1000); // yesterday
  const saleEnd   = new Date(now.getTime() + 24 * 60 * 60 * 1000); // tomorrow

  await db.concert.create({
    data: {
      id:          concertId,
      venueId:     SEED_VENUE_ID,
      organizerId: USER_IDS.organizer,
      title:       `Test Concert ${suffix}`,
      slug:        `test-concert-${suffix}`,
      artistName:  'Test Artist',
      startsAt:    new Date('2026-12-01T19:00:00Z'),
      endsAt:      new Date('2026-12-01T23:00:00Z'),
      status:      ConcertStatus.PUBLISHED,
    },
  });

  await db.seatZone.create({
    data: {
      id:        seatZoneId,
      concertId,
      code:      'TEST',
      name:      'Test Zone',
      capacity:  1000,
      sortOrder: 1,
    },
  });

  await db.ticketType.create({
    data: {
      id:            ticketTypeId,
      concertId,
      seatZoneId,
      name:          'Test Ticket',
      price:         100000,
      currency:      'VND',
      totalQuantity: opts.totalQuantity,
      heldQuantity:  0,
      soldQuantity:  0,
      maxPerUser:    opts.maxPerUser,
      saleStartAt:   saleStart,
      saleEndAt:     saleEnd,
      status:        TicketTypeStatus.ON_SALE,
    },
  });

  return { concertId, seatZoneId, ticketTypeId };
}

export async function cleanupFixture(fixture: TestFixture): Promise<void> {
  const { concertId, ticketTypeId } = fixture;

  // Delete in FK-safe order
  await db.ticket.deleteMany({ where: { ticketTypeId } });
  await db.order.deleteMany({ where: { concertId } }); // cascades → order_items, payments
  await db.ticketType.deleteMany({ where: { concertId } }); // cascades → user_ticket_type_counters
  await db.seatZone.deleteMany({ where: { concertId } });
  await db.concert.delete({ where: { id: concertId } });
}

export function makeHoldRequest(
  fixture: TestFixture,
  userId: string,
  quantity = 1,
  idempotencyKeySuffix?: string,
): { req: HoldRequest; idempotencyKey: string } {
  const holdExpiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 min from now
  return {
    req: {
      user_id:       userId,
      concert_id:    fixture.concertId,
      items:         [{ ticket_type_id: fixture.ticketTypeId, quantity }],
      hold_expires_at: holdExpiresAt.toISOString(),
    },
    idempotencyKey: `test-${userId}-${fixture.ticketTypeId}-${idempotencyKeySuffix ?? crypto.randomUUID()}`,
  };
}

export function makeReleaseRequest(orderId: string, reason: ReleaseReason = 'USER_CANCELLED'): ReleaseRequest {
  return { order_id: orderId, reason };
}

export async function getHeldQuantity(ticketTypeId: string): Promise<number> {
  const row = await db.ticketType.findUnique({
    where: { id: ticketTypeId },
    select: { heldQuantity: true },
  });
  return row?.heldQuantity ?? 0;
}

// ─── Auth helpers for HTTP-level tests ───────────────────────────────────────
//
// requireAuth is a stub (Sprint 2 pending) that ignores the token and injects
// role: 'ADMIN'. These helpers produce a well-formed header so HTTP tests
// compile correctly and will work once real JWT is wired in Sprint 2.

export function makeAuthHeader(role: Role = 'AUDIENCE'): Record<string, string> {
  // Stub token: role is encoded in the fake payload so tests are self-documenting.
  // Replace with a real signAccessToken() call after Sprint 2 implements JWT.
  const fakeToken = Buffer.from(JSON.stringify({ sub: USER_IDS.audience, role })).toString('base64');
  return { Authorization: `Bearer ${fakeToken}` };
}

export const AUTH_HEADERS: Record<Role, Record<string, string>> = {
  AUDIENCE:  makeAuthHeader('AUDIENCE'),
  ORGANIZER: makeAuthHeader('ORGANIZER'),
  CHECKER:   makeAuthHeader('CHECKER'),
  ADMIN:     makeAuthHeader('ADMIN'),
};
