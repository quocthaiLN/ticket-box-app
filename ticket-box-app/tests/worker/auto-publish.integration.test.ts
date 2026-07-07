import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  AUDIT_ACTIONS,
  ConcertStatus,
  TicketTypeStatus,
  prisma,
} from '@ticketbox/database';
import { runAutoPublishTick } from '../../apps/worker-server/src/schedulers/auto-publish.scheduler.js';

const VENUE_ID = '00000000-0000-0000-0000-000000000101';
const ORGANIZER_ID = '00000000-0000-0000-0000-000000000002';
const TEST_TITLE_PREFIX = 'Auto Publish Test';

type AutoPublishFixture = {
  concertId: string;
  seatZoneId?: string;
  ticketTypeId?: string;
};

const createdConcertIds = new Set<string>();

describe('auto-publish scheduler', () => {
  beforeEach(async () => {
    await cleanupCreatedConcerts();
  });

  afterAll(async () => {
    await cleanupCreatedConcerts();
    await prisma.$disconnect();
  });

  it('publishes a due draft concert, opens draft ticket types, invalidates through the shared flow and writes audit', async () => {
    const fixture = await createAutoPublishFixture({
      withSeatZone: true,
      withTicketType: true,
      plannedPublishAt: new Date(Date.now() - 60_000),
    });

    await runAutoPublishTick(10);

    const concert = await prisma.concert.findUnique({
      where: { id: fixture.concertId },
      select: { status: true },
    });
    const ticketType = await prisma.ticketType.findUnique({
      where: { id: fixture.ticketTypeId },
      select: { status: true },
    });
    const audit = await prisma.auditLog.findFirst({
      where: {
        action: AUDIT_ACTIONS.CONCERT_AUTO_PUBLISHED,
        entityId: fixture.concertId,
      },
    });

    expect(concert?.status).toBe(ConcertStatus.PUBLISHED);
    expect(ticketType?.status).toBe(TicketTypeStatus.ON_SALE);
    expect(audit).not.toBeNull();
    expect((audit?.metadata as Record<string, unknown>).ticket_types_opened).toBe(1);
  });

  it('skips due draft concerts that are missing seat zones or ticket types', async () => {
    const missingZone = await createAutoPublishFixture({
      withSeatZone: false,
      withTicketType: false,
      plannedPublishAt: new Date(Date.now() - 60_000),
    });

    const missingTicketType = await createAutoPublishFixture({
      withSeatZone: true,
      withTicketType: false,
      plannedPublishAt: new Date(Date.now() - 60_000),
    });

    await runAutoPublishTick(10);

    const concerts = await prisma.concert.findMany({
      where: { id: { in: [missingZone.concertId, missingTicketType.concertId] } },
      select: { id: true, status: true },
    });
    const audits = await prisma.auditLog.findMany({
      where: {
        action: AUDIT_ACTIONS.CONCERT_AUTO_PUBLISHED,
        entityId: { in: [missingZone.concertId, missingTicketType.concertId] },
      },
    });

    const statusById = new Map(concerts.map((concert) => [concert.id, concert.status]));
    expect(statusById.get(missingZone.concertId)).toBe(ConcertStatus.DRAFT);
    expect(statusById.get(missingTicketType.concertId)).toBe(ConcertStatus.DRAFT);
    expect(audits).toHaveLength(0);
  });

  it('is idempotent when the same due concert is processed more than once', async () => {
    const fixture = await createAutoPublishFixture({
      withSeatZone: true,
      withTicketType: true,
      plannedPublishAt: new Date(Date.now() - 60_000),
    });

    await runAutoPublishTick(10);
    await runAutoPublishTick(10);

    const concert = await prisma.concert.findUnique({
      where: { id: fixture.concertId },
      select: { status: true },
    });
    const ticketType = await prisma.ticketType.findUnique({
      where: { id: fixture.ticketTypeId },
      select: { status: true },
    });
    const audits = await prisma.auditLog.findMany({
      where: {
        action: AUDIT_ACTIONS.CONCERT_AUTO_PUBLISHED,
        entityId: fixture.concertId,
      },
    });

    expect(concert?.status).toBe(ConcertStatus.PUBLISHED);
    expect(ticketType?.status).toBe(TicketTypeStatus.ON_SALE);
    expect(audits).toHaveLength(1);
  });
});

async function createAutoPublishFixture(input: {
  withSeatZone: boolean;
  withTicketType: boolean;
  plannedPublishAt: Date;
}): Promise<AutoPublishFixture> {
  const suffix = crypto.randomUUID().slice(0, 8);
  const concertId = crypto.randomUUID();
  const seatZoneId = input.withSeatZone ? crypto.randomUUID() : undefined;
  const ticketTypeId = input.withTicketType ? crypto.randomUUID() : undefined;

  createdConcertIds.add(concertId);

  await prisma.concert.create({
    data: {
      id: concertId,
      venueId: VENUE_ID,
      organizerId: ORGANIZER_ID,
      title: `${TEST_TITLE_PREFIX} ${suffix}`,
      slug: `auto-publish-test-${suffix}`,
      artistName: 'Auto Publish Artist',
      startsAt: new Date('2026-12-20T19:00:00Z'),
      endsAt: new Date('2026-12-20T22:00:00Z'),
      plannedPublishAt: input.plannedPublishAt,
      status: ConcertStatus.DRAFT,
    },
  });

  if (seatZoneId) {
    await prisma.seatZone.create({
      data: {
        id: seatZoneId,
        concertId,
        code: `AUTO-${suffix}`,
        name: 'Auto Publish Zone',
        capacity: 100,
        sortOrder: 1,
      },
    });
  }

  if (ticketTypeId && seatZoneId) {
    await prisma.ticketType.create({
      data: {
        id: ticketTypeId,
        concertId,
        seatZoneId,
        name: `Auto Publish Ticket ${suffix}`,
        price: 100000,
        currency: 'VND',
        totalQuantity: 100,
        heldQuantity: 0,
        soldQuantity: 0,
        maxPerUser: 5,
        saleStartAt: new Date('2026-01-01T00:00:00Z'),
        saleEndAt: new Date('2026-12-31T23:59:59Z'),
        status: TicketTypeStatus.DRAFT,
      },
    });
  }

  return { concertId, seatZoneId, ticketTypeId };
}

async function cleanupCreatedConcerts(): Promise<void> {
  const ids = [...createdConcertIds];
  if (ids.length === 0) return;

  await prisma.auditLog.deleteMany({ where: { entityId: { in: ids } } });
  await prisma.ticketType.deleteMany({ where: { concertId: { in: ids } } });
  await prisma.seatZone.deleteMany({ where: { concertId: { in: ids } } });
  await prisma.concert.deleteMany({ where: { id: { in: ids } } });
  createdConcertIds.clear();
}
