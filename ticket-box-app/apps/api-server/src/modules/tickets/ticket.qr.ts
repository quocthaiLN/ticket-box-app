import { createHmac } from 'node:crypto';
import { env } from '@ticketbox/config';
import type { QrPayload } from './ticket.type.js';

export function buildQrPayload(
  ticketId: string,
  concertId: string,
  ticketTypeId: string,
  seatZoneId: string,
  issuedAt: Date,
  qrTokenHash: string,
): QrPayload {
  return {
    ticket_id: ticketId,
    concert_id: concertId,
    ticket_type_id: ticketTypeId,
    seat_zone_id: seatZoneId,
    issued_at: issuedAt.toISOString(),
    qr_token: qrTokenHash,
  };
}

export function signQrPayload(payload: QrPayload): string {
  const sorted = Object.fromEntries(
    (Object.keys(payload) as (keyof QrPayload)[]).sort().map((k) => [k, payload[k]]),
  );
  const canonical = JSON.stringify(sorted);
  return createHmac('sha256', env.qr.signingSecret)
    .update(canonical, 'utf8')
    .digest('base64');
}
