import {
  listTicketsForUser,
  getTicketDetailForUser,
  getTicketQrForUser,
  voidTicketById,
} from './ticket.repository.js';
import type {
  TicketDetail,
  TicketListQuery,
  TicketListResponse,
  TicketQrResponse,
  VoidTicketResponse,
} from './ticket.type.js';

export async function listMyTickets(userId: string, query: TicketListQuery): Promise<TicketListResponse> {
  const { items, nextCursor, limit } = await listTicketsForUser(userId, query);

  return {
    data: items.map((r) => ({
      id: r.id,
      concert_id: r.concertId,
      concert_title: r.concertTitle,
      ticket_type_id: r.ticketTypeId,
      ticket_type_name: r.ticketTypeName,
      seat_zone_id: r.seatZoneId,
      zone_code: r.seatZoneCode,
      status: r.status,
      issued_at: r.issuedAt.toISOString(),
    })),
    pagination: {
      next_cursor: nextCursor,
      has_more: nextCursor !== null,
      limit,
    },
  };
}

export async function getMyTicket(userId: string, ticketId: string): Promise<TicketDetail> {
  const row = await getTicketDetailForUser(ticketId, userId);

  return {
    id: row.id,
    order_id: row.orderId,
    concert: {
      id: row.concertId,
      title: row.concertTitle,
      starts_at: row.concertStartsAt.toISOString(),
    },
    ticket_type: {
      id: row.ticketTypeId,
      name: row.ticketTypeName,
    },
    seat_zone: {
      id: row.seatZoneId,
      code: row.seatZoneCode,
      name: row.seatZoneName,
    },
    status: row.status,
    issued_at: row.issuedAt.toISOString(),
    checked_in_at: row.checkedInAt ? row.checkedInAt.toISOString() : null,
  };
}

export async function getMyTicketQr(userId: string, ticketId: string): Promise<TicketQrResponse> {
  const { ticketId: id, payload, qrSignature } = await getTicketQrForUser(ticketId, userId);

  return {
    ticket_id: id,
    payload,
    qr_signature: qrSignature,
    expires_at: null,
  };
}

export async function voidTicket(ticketId: string): Promise<{
  data: VoidTicketResponse;
  audit: {
    ticket_id: string;
    previous_status: string;
    new_status: string;
    changed: boolean;
  };
}> {
  const result = await voidTicketById(ticketId);

  return {
    data: {
      ticket_id: result.id,
      status: result.status,
      voided_at: result.voidedAt.toISOString(),
    },
    audit: {
      ticket_id: result.id,
      previous_status: result.previousStatus,
      new_status: result.status,
      changed: result.changed,
    },
  };
}
