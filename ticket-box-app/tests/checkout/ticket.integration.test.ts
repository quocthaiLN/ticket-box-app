// Task 4 — Issue tickets + QR: verify ticket list and QR payload after payment success
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { handleVnpayWebhook } from '../../apps/api-server/src/modules/payments/payment.service.js';
import { listMyTickets, getMyTicket, getMyTicketQr } from '../../apps/api-server/src/modules/tickets/ticket.service.js';
import {
  createFixture,
  cleanupFixture,
  createTestOrder,
  cleanupOrder,
  buildVnpayWebhookPayload,
  USER_IDS,
  type TestFixture,
  type TestOrder,
} from './helpers.js';

describe('Ticket issuance + QR — after payment success', () => {
  let fixture: TestFixture;
  let order: TestOrder;
  let issuedTicketId: string;

  beforeAll(async () => {
    fixture = await createFixture({ totalQuantity: 5, maxPerUser: 3 });

    // Create order for 2 tickets
    order = await createTestOrder(fixture, USER_IDS.audience, 2);

    // Confirm via VNPAY webhook
    const payload = buildVnpayWebhookPayload(
      order.orderId,
      order.totalAmount,
      `TXN-TICKET-${Date.now()}`,
    );
    await handleVnpayWebhook(payload);
  });

  afterAll(async () => {
    await cleanupOrder(order.orderId);
    await cleanupFixture(fixture);
  });

  // ── Task 4a: listMyTickets ────────────────────────────────────────────────

  it('listMyTickets returns the issued tickets for the user', async () => {
    const result = await listMyTickets(USER_IDS.audience, {});
    const tickets = result.data.filter((t) => t.concert_id === fixture.concertId);

    expect(tickets).toHaveLength(2); // quantity = 2
    expect(tickets[0].status).toBe('ISSUED');
    issuedTicketId = tickets[0].id;
  });

  it('ticket has correct concert and zone info', async () => {
    const result = await listMyTickets(USER_IDS.audience, {});
    const ticket = result.data.find((t) => t.concert_id === fixture.concertId);

    expect(ticket!.ticket_type_id).toBe(fixture.ticketTypeId);
    expect(ticket!.seat_zone_id).toBe(fixture.seatZoneId);
  });

  // ── Task 4b: getMyTicket ──────────────────────────────────────────────────

  it('getMyTicket returns full ticket detail', async () => {
    const ticket = await getMyTicket(USER_IDS.audience, issuedTicketId);

    expect(ticket.id).toBe(issuedTicketId);
    expect(ticket.order_id).toBe(order.orderId);
    expect(ticket.status).toBe('ISSUED');
    expect(ticket.concert.id).toBe(fixture.concertId);
    expect(ticket.ticket_type.id).toBe(fixture.ticketTypeId);
  });

  // ── Task 4c: getMyTicketQr ────────────────────────────────────────────────

  it('getMyTicketQr returns a non-empty QR payload and signature', async () => {
    const qr = await getMyTicketQr(USER_IDS.audience, issuedTicketId);

    expect(qr.ticket_id).toBe(issuedTicketId);
    expect(qr.payload).toBeTruthy();
    expect(qr.qr_signature).toBeTruthy();
  });

  it('QR payload contains expected fields', async () => {
    const qr = await getMyTicketQr(USER_IDS.audience, issuedTicketId);
    const payload = qr.payload as Record<string, unknown>;

    expect(payload['ticket_id']).toBe(issuedTicketId);
    expect(payload['concert_id']).toBe(fixture.concertId);
    expect(payload['ticket_type_id']).toBe(fixture.ticketTypeId);
  });

  it('QR payload is re-reproducible (same ticket → same hash)', async () => {
    const qr1 = await getMyTicketQr(USER_IDS.audience, issuedTicketId);
    const qr2 = await getMyTicketQr(USER_IDS.audience, issuedTicketId);

    expect(qr1.qr_signature).toBe(qr2.qr_signature);
  });
});
