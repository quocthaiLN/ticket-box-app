import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { TicketStatus } from '@prisma/client';
import { CheckinRepository } from '../../apps/api-server/src/modules/checkin/checkin.repository.js';
import { GuestListRepository } from '../../apps/api-server/src/modules/guest-list/guest-list.repository.js';
import {
  cleanupCheckinFixture,
  createCheckinFixture,
  createGuest,
  db,
  issueTicket,
  USER_IDS,
  type CheckinFixture,
} from './helpers.js';

describe('check-in ticket, guest, and offline sync conflicts', () => {
  let fixture: CheckinFixture;
  let fixtureCreated = false;
  const checkin = new CheckinRepository();
  const guests = new GuestListRepository();

  beforeAll(async () => {
    fixture = await createCheckinFixture();
    fixtureCreated = true;
  });

  afterAll(async () => {
    if (fixtureCreated) {
      await cleanupCheckinFixture(fixture);
    }
    await db.$disconnect();
  });

  it('checks in a ticket at the correct gate and rejects a second online scan', async () => {
    const ticket = await issueTicket(fixture);

    const first = await checkin.recordOnlineScan({
      concert_id: fixture.concertId,
      gate_id: fixture.gateId,
      device_id: fixture.deviceId,
      qr_token: ticket.qrTokenHash,
      scanned_at: new Date().toISOString(),
    });

    const second = await checkin.recordOnlineScan({
      concert_id: fixture.concertId,
      gate_id: fixture.gateId,
      device_id: fixture.deviceId,
      qr_token: ticket.qrTokenHash,
      scanned_at: new Date().toISOString(),
    });

    expect(first.result).toBe('SUCCESS');
    expect(second.result).toBe('ALREADY_CHECKED_IN');
    expect(second.ticket_id).toBe(ticket.ticketId);
  });

  it('rejects a ticket scan at the wrong gate', async () => {
    const ticket = await issueTicket(fixture);

    const response = await checkin.recordOnlineScan({
      concert_id: fixture.concertId,
      gate_id: fixture.wrongGateId,
      device_id: fixture.wrongGateDeviceId,
      qr_token: ticket.qrTokenHash,
      scanned_at: new Date().toISOString(),
    });

    expect(response.result).toBe('WRONG_GATE');
    expect(response.ticket_id).toBe(ticket.ticketId);
  });

  it('checks in a guest at the correct gate and rejects repeat/wrong-gate guest scans', async () => {
    const guest = await createGuest(fixture);
    const wrongGateGuest = await createGuest(fixture);

    const first = await guests.recordGuestScan({
      concert_id: fixture.concertId,
      gate_id: fixture.gateId,
      device_id: fixture.deviceId,
      guest_id: guest.guestId,
      scanned_at: new Date().toISOString(),
    });

    const second = await guests.recordGuestScan({
      concert_id: fixture.concertId,
      gate_id: fixture.gateId,
      device_id: fixture.deviceId,
      guest_id: guest.guestId,
      scanned_at: new Date().toISOString(),
    });

    const wrongGate = await guests.recordGuestScan({
      concert_id: fixture.concertId,
      gate_id: fixture.wrongGateId,
      device_id: fixture.wrongGateDeviceId,
      guest_id: wrongGateGuest.guestId,
      scanned_at: new Date().toISOString(),
    });

    expect(first.result).toBe('SUCCESS');
    expect(second.result).toBe('ALREADY_CHECKED_IN');
    expect(wrongGate.result).toBe('WRONG_GATE');
  });

  it('syncs an offline ticket batch once and replays the completed batch on retry', async () => {
    const ticket = await issueTicket(fixture);
    const batchId = `batch-${crypto.randomUUID()}`;

    const first = await checkin.recordOfflineSyncBatch({
      batch_id: batchId,
      concert_id: fixture.concertId,
      gate_id: fixture.gateId,
      device_id: fixture.deviceId,
      items: [
        {
          client_item_id: 'offline-1',
          type: 'TICKET',
          ticket_id: ticket.ticketId,
          qr_token: ticket.qrTokenHash,
          concert_id: fixture.concertId,
          gate_id: fixture.gateId,
          scanned_at: new Date().toISOString(),
        },
      ],
    });

    const retry = await checkin.recordOfflineSyncBatch({
      batch_id: batchId,
      items: [
        {
          client_item_id: 'offline-1',
          type: 'TICKET',
          ticket_id: ticket.ticketId,
          qr_token: ticket.qrTokenHash,
          concert_id: fixture.concertId,
          gate_id: fixture.gateId,
          scanned_at: new Date().toISOString(),
        },
      ],
    });

    const logs = await db.checkinLog.findMany({
      where: { ticketId: ticket.ticketId, result: 'SUCCESS' },
    });

    expect(first.status).toBe('DONE');
    expect(first.results[0].status).toBe('SUCCESS');
    expect(retry.results).toHaveLength(1);
    expect(retry.results[0].status).toBe('SUCCESS');
    expect(logs).toHaveLength(1);
  });

  it('marks duplicate offline items in the same batch even when client ids differ', async () => {
    const ticket = await issueTicket(fixture);

    const response = await checkin.recordOfflineSyncBatch({
      batch_id: `batch-${crypto.randomUUID()}`,
      concert_id: fixture.concertId,
      gate_id: fixture.gateId,
      device_id: fixture.deviceId,
      items: [
        {
          client_item_id: 'dup-1',
          type: 'TICKET',
          ticket_id: ticket.ticketId,
          qr_token: ticket.qrTokenHash,
          concert_id: fixture.concertId,
          gate_id: fixture.gateId,
          scanned_at: new Date().toISOString(),
        },
        {
          client_item_id: 'dup-2',
          type: 'TICKET',
          ticket_id: ticket.ticketId,
          qr_token: ticket.qrTokenHash,
          concert_id: fixture.concertId,
          gate_id: fixture.gateId,
          scanned_at: new Date().toISOString(),
        },
      ],
    });

    expect(response.results.map((item) => item.status)).toEqual(['SUCCESS', 'DUPLICATE_ITEM']);
  });

  it('reports an offline conflict when the ticket was already scanned online', async () => {
    const ticket = await issueTicket(fixture, TicketStatus.ISSUED);

    await checkin.recordOnlineScan({
      concert_id: fixture.concertId,
      gate_id: fixture.gateId,
      device_id: fixture.deviceId,
      qr_token: ticket.qrTokenHash,
      staff_user_id: USER_IDS.checker,
      scanned_at: new Date().toISOString(),
    });

    const response = await checkin.recordOfflineSyncBatch({
      batch_id: `batch-${crypto.randomUUID()}`,
      concert_id: fixture.concertId,
      gate_id: fixture.gateId,
      device_id: fixture.deviceId,
      items: [
        {
          client_item_id: 'offline-after-online',
          type: 'TICKET',
          ticket_id: ticket.ticketId,
          qr_token: ticket.qrTokenHash,
          concert_id: fixture.concertId,
          gate_id: fixture.gateId,
          scanned_at: new Date().toISOString(),
        },
      ],
    });

    expect(response.results[0].status).toBe('ALREADY_CHECKED_IN');
    expect(response.conflict_item_count).toBe(1);
  });

  it('syncs offline guest check-in and rejects a repeated guest item', async () => {
    const guest = await createGuest(fixture);

    const response = await checkin.recordOfflineSyncBatch({
      batch_id: `batch-${crypto.randomUUID()}`,
      concert_id: fixture.concertId,
      gate_id: fixture.gateId,
      device_id: fixture.deviceId,
      items: [
        {
          client_item_id: 'guest-offline-1',
          type: 'GUEST',
          guest_id: guest.guestId,
          concert_id: fixture.concertId,
          gate_id: fixture.gateId,
          scanned_at: new Date().toISOString(),
        },
        {
          client_item_id: 'guest-offline-2',
          type: 'GUEST',
          guest_id: guest.guestId,
          concert_id: fixture.concertId,
          gate_id: fixture.gateId,
          scanned_at: new Date().toISOString(),
        },
      ],
    });

    expect(response.results.map((item) => item.status)).toEqual(['SUCCESS', 'DUPLICATE_ITEM']);
    const updated = await db.guestList.findUnique({ where: { id: guest.guestId } });
    expect(updated?.status).toBe('CHECKED_IN');
  });
});
