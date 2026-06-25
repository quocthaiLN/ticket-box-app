import * as Crypto from 'expo-crypto';
import { getDatabase } from '../db/database';

export async function validateTicketOffline(
  qrToken: string,
  concertId: string,
  gateId: string
): Promise<{ result: string; reason?: string }> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const clientItemId = `local-${Date.now()}`;
  
  // 1. Resolve QR payload (check if it is a JSON format containing qr_token or qrToken)
  let token = qrToken;
  try {
    const parsed = JSON.parse(qrToken);
    token = parsed.qr_token || parsed.qrToken || qrToken;
  } catch {}

  // 2. Hash token to SHA-256 string
  const tokenHash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    token
  );

  // 3. Query the ticket from the local SQLite database
  const ticket = await db.getFirstAsync<{
    ticket_id: string;
    zone_id: string;
    status_snapshot: string;
  }>('SELECT ticket_id, zone_id, status_snapshot FROM tickets WHERE qr_payload_hash = ?', [tokenHash]);

  if (!ticket) {
    // If not found, log invalid ticket to the queue
    await insertQueue(db, clientItemId, 'TICKET', qrToken, null, null, null, concertId, gateId, now, 'INVALID_TICKET', 'Vé không hợp lệ!');
    return { result: 'INVALID_TICKET', reason: 'Vé không hợp lệ!' };
  }

  // 4. Verify gate allowed zone
  const zoneAllowed = await db.getFirstAsync<any>(
    'SELECT id FROM allowed_seat_zones WHERE id = ?',
    [ticket.zone_id]
  );
  if (!zoneAllowed) {
    await insertQueue(db, clientItemId, 'TICKET', qrToken, ticket.ticket_id, null, null, concertId, gateId, now, 'WRONG_GATE', 'Vé đi sai cổng!');
    return { result: 'WRONG_GATE', reason: 'Vé đi sai cổng!' };
  }

  // 5. Verify double check-in
  const isAlreadyCheckedIn = ticket.status_snapshot === 'CHECKED_IN';
  if (isAlreadyCheckedIn) {
    await insertQueue(db, clientItemId, 'TICKET', qrToken, ticket.ticket_id, null, null, concertId, gateId, now, 'ALREADY_CHECKED_IN', 'Vé đã soát!');
    return { result: 'ALREADY_CHECKED_IN', reason: 'Vé đã soát!' };
  }

  // 6. DB Transaction to update ticket status snapshot and insert success sync queue record
  try {
    await db.withTransactionAsync(async () => {
      // Mark as checked in locally so subsequent scans of this ticket will be blocked
      await db.runAsync('UPDATE tickets SET status_snapshot = ? WHERE ticket_id = ?', ['CHECKED_IN', ticket.ticket_id]);
      // Save details to the offline queue table for sync
      await db.runAsync(`
        INSERT INTO offline_queue (client_item_id, type, qr_token, guest_id, phone, concert_id, gate_id, scanned_at, status, message)
        VALUES (?, 'TICKET', ?, NULL, NULL, ?, ?, ?, 'SUCCESS', 'Soát vé thành công!')
      `, [clientItemId, qrToken, concertId, gateId, now]);
    });
    return { result: 'SUCCESS' };
  } catch (error) {
    return { result: 'ERROR', reason: 'Lỗi cập nhật dữ liệu cục bộ.' };
  }
}

async function insertQueue(
  db: any,
  clientItemId: string,
  type: string,
  qrToken: string | null,
  ticketId: string | null,
  guestId: string | null,
  phone: string | null,
  concertId: string,
  gateId: string,
  scannedAt: string,
  status: string,
  message: string
) {
  await db.runAsync(`
    INSERT INTO offline_queue (client_item_id, type, qr_token, guest_id, phone, concert_id, gate_id, scanned_at, status, message)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [clientItemId, type, qrToken, guestId, phone, concertId, gateId, scannedAt, status, message]);
}

export async function validateGuestOffline(
  guestId: string,
  phone: string,
  concertId: string,
  gateId: string
): Promise<{ result: string; reason?: string }> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const clientItemId = `local-guest-${Date.now()}`;

  const cleanGuestId = guestId.trim();
  const cleanPhone = phone.trim();

  // 1. Query the guest from local SQLite database
  let guest: any = null;
  if (cleanGuestId) {
    guest = await db.getFirstAsync<any>(
      'SELECT guest_id, zone_id, status_snapshot FROM guests WHERE guest_id = ?',
      [cleanGuestId]
    );
  } else if (cleanPhone) {
    const match = `%${cleanPhone}%`;
    guest = await db.getFirstAsync<any>(
      'SELECT guest_id, zone_id, status_snapshot FROM guests WHERE phone_masked LIKE ? OR phone_masked = ?',
      [match, cleanPhone]
    );
  }

  if (!guest) {
    // Log invalid guest check-in attempt
    await insertQueue(
      db,
      clientItemId,
      'GUEST',
      null,
      null,
      cleanGuestId || null,
      cleanPhone || null,
      concertId,
      gateId,
      now,
      'INVALID_GUEST',
      'Khách mời không tồn tại!'
    );
    return { result: 'INVALID_GUEST', reason: 'Khách mời không tồn tại!' };
  }

  // 2. Verify gate seat zone
  const zoneAllowed = await db.getFirstAsync<any>(
    'SELECT id FROM allowed_seat_zones WHERE id = ?',
    [guest.zone_id]
  );
  if (!zoneAllowed) {
    await insertQueue(
      db,
      clientItemId,
      'GUEST',
      null,
      null,
      guest.guest_id,
      cleanPhone || null,
      concertId,
      gateId,
      now,
      'WRONG_GATE',
      'Khách mời đi sai cổng!'
    );
    return { result: 'WRONG_GATE', reason: 'Khách mời đi sai cổng!' };
  }

  // 3. Verify double check-in
  if (guest.status_snapshot === 'CHECKED_IN') {
    await insertQueue(
      db,
      clientItemId,
      'GUEST',
      null,
      null,
      guest.guest_id,
      cleanPhone || null,
      concertId,
      gateId,
      now,
      'ALREADY_CHECKED_IN',
      'Khách mời đã soát!'
    );
    return { result: 'ALREADY_CHECKED_IN', reason: 'Khách mời đã soát!' };
  }

  // 4. Update status and save sync logs in local database
  try {
    await db.withTransactionAsync(async () => {
      // Mark guest as checked in locally
      await db.runAsync('UPDATE guests SET status_snapshot = ? WHERE guest_id = ?', ['CHECKED_IN', guest.guest_id]);
      
      // Save check-in item in sync offline queue
      await db.runAsync(`
        INSERT INTO offline_queue (client_item_id, type, qr_token, guest_id, phone, concert_id, gate_id, scanned_at, status, message)
        VALUES (?, 'GUEST', NULL, ?, ?, ?, ?, ?, 'SUCCESS', 'Check-in khách mời offline thành công!')
      `, [clientItemId, guest.guest_id, cleanPhone || null, concertId, gateId, now]);
    });
    return { result: 'SUCCESS' };
  } catch (error) {
    return { result: 'ERROR', reason: 'Lỗi cập nhật dữ liệu cục bộ.' };
  }
}

