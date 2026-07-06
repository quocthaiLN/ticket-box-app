import { prisma, Prisma, TicketStatus } from '@ticketbox/database';
import { buildQrPayload, signQrPayload } from './ticket.qr.js';
import type { QrPayload, TicketListQuery } from './ticket.type.js';
import { ApiError } from '../../shared/http/problem-details.js';

// Row types

type TicketListRow = {
  id: string;
  concertId: string;
  concertTitle: string;
  ticketTypeId: string;
  ticketTypeName: string;
  seatZoneId: string;
  seatZoneCode: string;
  status: string;
  issuedAt: Date;
};

type TicketDetailRow = {
  id: string;
  orderId: string;
  userId: string;
  concertId: string;
  concertTitle: string;
  concertStartsAt: Date;
  ticketTypeId: string;
  ticketTypeName: string;
  seatZoneId: string;
  seatZoneCode: string;
  seatZoneName: string;
  gateId: string;
  status: string;
  issuedAt: Date;
  checkedInAt: Date | null;
  qrTokenHash: string;
  qrPayload: unknown;
  qrSignature: string | null;
};

// List

export async function listTicketsForUser(userId: string, query: TicketListQuery) {
  const limit = Math.min(query.limit ?? 20, 100);

  const rows = await prisma.$queryRaw<TicketListRow[]>(Prisma.sql`
    SELECT
      t.id,
      t.concert_id       AS "concertId",
      c.title            AS "concertTitle",
      t.ticket_type_id   AS "ticketTypeId",
      tt.name            AS "ticketTypeName",
      t.seat_zone_id     AS "seatZoneId",
      sz.code            AS "seatZoneCode",
      t.status::text     AS "status",
      t.issued_at        AS "issuedAt"
    FROM tickets t
    JOIN concerts     c  ON c.id  = t.concert_id
    JOIN ticket_types tt ON tt.id = t.ticket_type_id
    JOIN seat_zones   sz ON sz.id = t.seat_zone_id
    WHERE t.user_id = ${userId}::uuid
      ${query.concert_id ? Prisma.sql`AND t.concert_id = ${query.concert_id}::uuid` : Prisma.empty}
      ${query.status ? Prisma.sql`AND t.status = ${query.status}::"ticket_status"` : Prisma.empty}
      ${query.cursor ? Prisma.sql`AND t.id > ${query.cursor}::uuid` : Prisma.empty}
    ORDER BY t.id
    LIMIT ${limit + 1}
  `);

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? (items[items.length - 1]?.id ?? null) : null;

  return { items, nextCursor, limit };
}

// Detail
export async function getTicketDetailForUser(ticketId: string, userId: string) {
  const [row] = await prisma.$queryRaw<TicketDetailRow[]>(Prisma.sql`
    SELECT
      t.id,
      t.order_id         AS "orderId",
      t.user_id          AS "userId",
      t.concert_id       AS "concertId",
      c.title            AS "concertTitle",
      c.starts_at        AS "concertStartsAt",
      t.ticket_type_id   AS "ticketTypeId",
      tt.name            AS "ticketTypeName",
      t.seat_zone_id     AS "seatZoneId",
      sz.code            AS "seatZoneCode",
      sz.name            AS "seatZoneName",
      t.gate_id          AS "gateId",
      t.status::text     AS "status",
      t.issued_at        AS "issuedAt",
      t.checked_in_at    AS "checkedInAt",
      t.qr_token_hash    AS "qrTokenHash",
      t.qr_payload       AS "qrPayload",
      t.qr_signature     AS "qrSignature"
    FROM tickets t
    JOIN concerts     c  ON c.id  = t.concert_id
    JOIN ticket_types tt ON tt.id = t.ticket_type_id
    JOIN seat_zones   sz ON sz.id = t.seat_zone_id
    WHERE t.id = ${ticketId}::uuid
  `);

  if (!row) throw new ApiError({ title: 'TICKET_NOT_FOUND', status: 404, code: 'TICKET_NOT_FOUND', detail: 'Ticket not found' });
  if (row.userId !== userId) throw new ApiError({ title: 'TICKET_ACCESS_DENIED', status: 403, code: 'TICKET_ACCESS_DENIED', detail: 'Access denied to this ticket' });

  return row;
}

// QR
export async function getTicketQrForUser(
  ticketId: string,
  userId: string,
): Promise<{ ticketId: string; payload: QrPayload; qrSignature: string }> {
  const row = await getTicketDetailForUser(ticketId, userId);

  if (row.status === 'CANCELLED' || row.status === 'REFUNDED') {
    throw new ApiError({
      title: 'TICKET_NOT_USABLE',
      status: 422,
      code: 'TICKET_NOT_USABLE',
      detail: 'Ticket is cancelled or refunded',
    });
  }

  if (row.qrPayload && row.qrSignature) {
    return { ticketId: row.id, payload: row.qrPayload as QrPayload, qrSignature: row.qrSignature };
  }

  // Backfill QR data if missing (tickets created before this module existed)
  const payload = buildQrPayload(row.id, row.concertId, row.ticketTypeId, row.seatZoneId, row.gateId, row.issuedAt, row.qrTokenHash);
  const signature = signQrPayload(payload);

  await prisma.ticket.update({
    where: { id: ticketId },
    data: { qrPayload: payload as unknown as Prisma.InputJsonValue, qrSignature: signature },
  });

  return { ticketId: row.id, payload, qrSignature: signature };
}

// Void
export async function voidTicketById(ticketId: string) {
  return prisma.$transaction(async (tx) => {
    const [row] = await tx.$queryRaw<Array<{ id: string; status: string }>>(Prisma.sql`
      SELECT id, status::text AS "status"
      FROM tickets WHERE id = ${ticketId}::uuid FOR UPDATE
    `);

    if (!row) throw new ApiError({ title: 'TICKET_NOT_FOUND', status: 404, code: 'TICKET_NOT_FOUND', detail: 'Ticket not found' });

    if (row.status === 'CANCELLED' || row.status === 'REFUNDED') {
      return {
        id: row.id,
        status: row.status,
        previousStatus: row.status,
        changed: false,
        voidedAt: new Date(),
      };
    }

    const now = new Date();
    await tx.ticket.update({ where: { id: ticketId }, data: { status: TicketStatus.CANCELLED } });
    return {
      id: row.id,
      status: 'CANCELLED',
      previousStatus: row.status,
      changed: true,
      voidedAt: now,
    };
  });
}
