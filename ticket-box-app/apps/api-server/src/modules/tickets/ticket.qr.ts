import { sign, verify } from 'node:crypto';
import { env } from '@ticketbox/config';
import type { QrPayload } from './ticket.type.js';

export function buildQrPayload(
  ticketId: string,
  concertId: string,
  ticketTypeId: string,
  seatZoneId: string,
  gateId: string,
  issuedAt: Date,
  qrTokenHash: string,
): QrPayload {
  return {
    ticket_id: ticketId,
    concert_id: concertId,
    ticket_type_id: ticketTypeId,
    seat_zone_id: seatZoneId,
    gate_id: gateId,
    issued_at: issuedAt.toISOString(),
    qr_token: qrTokenHash,
  };
}

// Canonical hoá payload (bỏ field chữ ký, sort key) để ký và verify luôn khớp.
function canonicalize(payload: Record<string, unknown>): Buffer {
  const clone = { ...payload };
  delete clone['qr_signature'];
  delete clone['qrSignature'];
  const sorted = Object.fromEntries(
    Object.keys(clone)
      .sort()
      .map((k) => [k, clone[k]]),
  );
  return Buffer.from(JSON.stringify(sorted), 'utf8');
}

// Ký payload bằng private key Ed25519 (chỉ có ở api-server lúc cấp QR).
export function signQrPayload(payload: QrPayload): string {
  return sign(null, canonicalize(payload as unknown as Record<string, unknown>), env.qr.privateKey).toString('base64');
}

// Verify chữ ký bằng public key Ed25519 — không cần private key nên có thể chạy
// ở máy checker (kể cả offline) mà không thể giả mạo vé.
export function verifyQrSignature(
  payload: Record<string, unknown>,
  signature: string,
): boolean {
  try {
    return verify(null, canonicalize(payload), env.qr.publicKey, Buffer.from(signature, 'base64'));
  } catch {
    return false;
  }
}
