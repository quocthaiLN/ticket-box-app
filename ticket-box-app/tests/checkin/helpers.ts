import {
  ConcertStatus,
  DeviceStatus,
  GuestStatus,
  OrderStatus,
  PrismaClient,
  TicketStatus,
  TicketTypeStatus,
} from '@prisma/client';

export const db = new PrismaClient();

export const USER_IDS = {
  audience: '00000000-0000-0000-0000-000000000001',
  organizer: '00000000-0000-0000-0000-000000000002',
  checker: '00000000-0000-0000-0000-000000000003',
  admin: '00000000-0000-0000-0000-000000000004',
} as const;

const SEED_VENUE_ID = '00000000-0000-0000-0000-000000000101';

export type CheckinFixture = {
  concertId: string;
  allowedZoneId: string;
  otherZoneId: string;
  ticketTypeId: string;
  gateId: string;
  wrongGateId: string;
  deviceId: string;
  wrongGateDeviceId: string;
  revokedDeviceId: string;
  inactiveGateId: string;
  inactiveGateDeviceId: string;
  otherConcertId: string;
  otherConcertGateId: string;
  otherConcertDeviceId: string;
};

export type IssuedTicket = {
  ticketId: string;
  qrTokenHash: string;
};

export async function createCheckinFixture(): Promise<CheckinFixture> {
  const suffix = crypto.randomUUID().slice(0, 8);
  const concertId = crypto.randomUUID();
  const allowedZoneId = crypto.randomUUID();
  const otherZoneId = crypto.randomUUID();
  const ticketTypeId = crypto.randomUUID();
  const gateId = crypto.randomUUID();
  const wrongGateId = crypto.randomUUID();
  const deviceId = crypto.randomUUID();
  const wrongGateDeviceId = crypto.randomUUID();
  const revokedDeviceId = crypto.randomUUID();
  const inactiveGateId = crypto.randomUUID();
  const inactiveGateDeviceId = crypto.randomUUID();
  const otherConcertId = crypto.randomUUID();
  const otherConcertGateId = crypto.randomUUID();
  const otherConcertDeviceId = crypto.randomUUID();

  await db.concert.createMany({
    data: [
      {
        id: concertId,
        venueId: SEED_VENUE_ID,
        organizerId: USER_IDS.organizer,
        title: `Check-in Test ${suffix}`,
        slug: `checkin-test-${suffix}`,
        artistName: 'Check-in Artist',
        startsAt: new Date('2026-12-10T19:00:00Z'),
        endsAt: new Date('2026-12-10T22:00:00Z'),
        status: ConcertStatus.PUBLISHED,
      },
      {
        id: otherConcertId,
        venueId: SEED_VENUE_ID,
        organizerId: USER_IDS.organizer,
        title: `Check-in Test Other ${suffix}`,
        slug: `checkin-test-other-${suffix}`,
        artistName: 'Check-in Artist',
        startsAt: new Date('2026-12-10T19:00:00Z'),
        endsAt: new Date('2026-12-10T22:00:00Z'),
        status: ConcertStatus.PUBLISHED,
      },
    ],
  });

  await db.seatZone.createMany({
    data: [
      {
        id: allowedZoneId,
        concertId,
        code: `OK-${suffix}`,
        name: 'Allowed Zone',
        capacity: 100,
        sortOrder: 1,
      },
      {
        id: otherZoneId,
        concertId,
        code: `NO-${suffix}`,
        name: 'Other Zone',
        capacity: 100,
        sortOrder: 2,
      },
    ],
  });

  await db.ticketType.create({
    data: {
      id: ticketTypeId,
      concertId,
      seatZoneId: allowedZoneId,
      name: `Check-in Ticket ${suffix}`,
      price: 100000,
      currency: 'VND',
      totalQuantity: 100,
      heldQuantity: 0,
      soldQuantity: 0,
      maxPerUser: 5,
      saleStartAt: new Date('2026-01-01T00:00:00Z'),
      saleEndAt: new Date('2026-12-31T23:59:59Z'),
      status: TicketTypeStatus.ON_SALE,
    },
  });

  await db.checkinGate.createMany({
    data: [
      {
        id: gateId,
        concertId,
        code: `OK-GATE-${suffix}`,
        name: 'Allowed Gate',
        isActive: true,
        sortOrder: 1,
      },
      {
        id: wrongGateId,
        concertId,
        code: `WRONG-GATE-${suffix}`,
        name: 'Wrong Gate',
        isActive: true,
        sortOrder: 2,
      },
      {
        id: inactiveGateId,
        concertId,
        code: `INACTIVE-GATE-${suffix}`,
        name: 'Inactive Gate',
        isActive: false,
        sortOrder: 3,
      },
      {
        id: otherConcertGateId,
        concertId: otherConcertId,
        code: `OTHER-GATE-${suffix}`,
        name: 'Other Gate',
        isActive: true,
        sortOrder: 1,
      },
    ],
  });

  await db.checkinGateZone.createMany({
    data: [
      { gateId, seatZoneId: allowedZoneId, concertId },
      { gateId: wrongGateId, seatZoneId: otherZoneId, concertId },
      { gateId: inactiveGateId, seatZoneId: allowedZoneId, concertId },
    ],
  });

  await db.checkinDevice.createMany({
    data: [
      {
        id: deviceId,
        deviceCode: `CHECKIN-${suffix}`,
        staffId: USER_IDS.checker,
        concertId,
        gateId,
        name: 'Allowed checker',
        status: DeviceStatus.ACTIVE,
      },
      {
        id: wrongGateDeviceId,
        deviceCode: `CHECKIN-WRONG-${suffix}`,
        staffId: USER_IDS.checker,
        concertId,
        gateId: wrongGateId,
        name: 'Wrong gate checker',
        status: DeviceStatus.ACTIVE,
      },
      {
        id: revokedDeviceId,
        deviceCode: `CHECKIN-REVOKED-${suffix}`,
        staffId: USER_IDS.checker,
        concertId,
        gateId,
        name: 'Revoked checker',
        status: DeviceStatus.REVOKED,
      },
      {
        id: inactiveGateDeviceId,
        deviceCode: `CHECKIN-INACTIVE-${suffix}`,
        staffId: USER_IDS.checker,
        concertId,
        gateId: inactiveGateId,
        name: 'Inactive gate checker',
        status: DeviceStatus.ACTIVE,
      },
      {
        id: otherConcertDeviceId,
        deviceCode: `CHECKIN-OTHER-${suffix}`,
        staffId: USER_IDS.checker,
        concertId: otherConcertId,
        gateId: otherConcertGateId,
        name: 'Other concert checker',
        status: DeviceStatus.ACTIVE,
      },
    ],
  });

  return {
    concertId,
    allowedZoneId,
    otherZoneId,
    ticketTypeId,
    gateId,
    wrongGateId,
    deviceId,
    wrongGateDeviceId,
    revokedDeviceId,
    inactiveGateId,
    inactiveGateDeviceId,
    otherConcertId,
    otherConcertGateId,
    otherConcertDeviceId,
  };
}

export async function cleanupCheckinFixture(fixture: CheckinFixture): Promise<void> {
  const concertIds = [fixture.concertId, fixture.otherConcertId];
  await db.checkinLog.deleteMany({ where: { concertId: { in: concertIds } } });
  await db.offlineCheckinBatch.deleteMany({ where: { concertId: { in: concertIds } } });
  await db.ticket.deleteMany({ where: { concertId: { in: concertIds } } });
  await db.guestList.deleteMany({ where: { concertId: { in: concertIds } } });
  await db.order.deleteMany({ where: { concertId: { in: concertIds } } });
  await db.checkinDevice.deleteMany({ where: { concertId: { in: concertIds } } });
  await db.checkinGateZone.deleteMany({ where: { concertId: { in: concertIds } } });
  await db.checkinGate.deleteMany({ where: { concertId: { in: concertIds } } });
  await db.ticketType.deleteMany({ where: { concertId: { in: concertIds } } });
  await db.seatZone.deleteMany({ where: { concertId: { in: concertIds } } });
  await db.concert.deleteMany({ where: { id: { in: concertIds } } });
}

export async function issueTicket(
  fixture: CheckinFixture,
  status: TicketStatus = TicketStatus.ISSUED,
): Promise<IssuedTicket> {
  const orderId = crypto.randomUUID();
  const orderItemId = crypto.randomUUID();
  const ticketId = crypto.randomUUID();
  const qrTokenHash = `qr-test-${ticketId}`;

  await db.order.create({
    data: {
      id: orderId,
      userId: USER_IDS.audience,
      concertId: fixture.concertId,
      idempotencyKey: `checkin-order-${orderId}`,
      status: OrderStatus.CONFIRMED,
      totalAmount: 100000,
      currency: 'VND',
      confirmedAt: new Date(),
    },
  });

  await db.orderItem.create({
    data: {
      id: orderItemId,
      orderId,
      ticketTypeId: fixture.ticketTypeId,
      quantity: 1,
      unitPrice: 100000,
      lineTotal: 100000,
    },
  });

  await db.ticket.create({
    data: {
      id: ticketId,
      orderId,
      orderItemId,
      userId: USER_IDS.audience,
      concertId: fixture.concertId,
      ticketTypeId: fixture.ticketTypeId,
      seatZoneId: fixture.allowedZoneId,
      gateId: fixture.gateId,
      qrTokenHash,
      qrPayload: { ticket_id: ticketId, concert_id: fixture.concertId },
      qrSignature: 'test-signature',
      status,
      checkedInAt: status === TicketStatus.CHECKED_IN ? new Date() : null,
      checkedInById: status === TicketStatus.CHECKED_IN ? USER_IDS.checker : null,
    },
  });

  return { ticketId, qrTokenHash };
}

export async function createGuest(fixture: CheckinFixture, status: GuestStatus = GuestStatus.INVITED) {
  const guestId = crypto.randomUUID();
  const phone = `+849${crypto.randomUUID().replace(/\D/g, '').slice(0, 8).padEnd(8, '0')}`;

  await db.guestList.create({
    data: {
      id: guestId,
      concertId: fixture.concertId,
      seatZoneId: fixture.allowedZoneId,
      fullName: `Guest ${guestId.slice(0, 6)}`,
      phone,
      email: `${guestId}@guest.test`,
      status,
      checkedInAt: status === GuestStatus.CHECKED_IN ? new Date() : null,
      checkedInById: status === GuestStatus.CHECKED_IN ? USER_IDS.checker : null,
    },
  });

  return { guestId, phone };
}
