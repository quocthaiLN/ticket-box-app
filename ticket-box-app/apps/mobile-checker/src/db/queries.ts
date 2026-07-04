import { SQLiteDatabase } from 'expo-sqlite';
import * as Crypto from 'expo-crypto';

export type AllowedSeatZone = {
  id: string;
  code: string;
  name: string;
};

export type TicketPreload = {
  ticket_id: string;
  qr_payload_hash: string;
  concert_id: string;
  zone_id: string;
  status_snapshot: string;
};

export type GuestPreload = {
  guest_id: string;
  concert_id: string;
  zone_id: string;
  full_name: string;
  phone_masked: string;
  status_snapshot: string;
};

export type QueueItem = {
  client_item_id: string;
  type: 'TICKET' | 'GUEST';
  qr_token: string | null;
  qr_payload_hash: string | null;
  guest_id: string | null;
  phone: string | null;
  concert_id: string;
  gate_id: string;
  scanned_at: string;
  status: string;
  message: string | null;
};

const BATCH_SIZE = 200;

export async function savePreloadData(
  db: SQLiteDatabase,
  allowedZones: AllowedSeatZone[],
  tickets: TicketPreload[],
  guests: GuestPreload[]
): Promise<void> {
  await db.withTransactionAsync(async () => {
    // 1. Clear existing preloaded reference data
    await db.runAsync('DELETE FROM allowed_seat_zones');
    await db.runAsync('DELETE FROM tickets');
    await db.runAsync('DELETE FROM guests');

    // 2. Insert allowed zones (thường ít, giữ nguyên insert từng dòng)
    for (const zone of allowedZones) {
      await db.runAsync(
        'INSERT INTO allowed_seat_zones (id, code, name) VALUES (?, ?, ?)',
        [zone.id, zone.code, zone.name]
      );
    }

    // 3. Insert tickets theo lô (batch) để tăng hiệu năng với dữ liệu lớn
    for (let i = 0; i < tickets.length; i += BATCH_SIZE) {
      const batch = tickets.slice(i, i + BATCH_SIZE);
      const placeholders = batch.map(() => '(?, ?, ?, ?, ?)').join(', ');
      const values: (string)[] = [];
      for (const ticket of batch) {
        values.push(
          ticket.ticket_id,
          ticket.qr_payload_hash,
          ticket.concert_id,
          ticket.zone_id,
          ticket.status_snapshot
        );
      }
      await db.runAsync(
        `INSERT INTO tickets (ticket_id, qr_payload_hash, concert_id, zone_id, status_snapshot) VALUES ${placeholders}`,
        values
      );
    }

    // 4. Insert guests theo lô (batch) để tăng hiệu năng với dữ liệu lớn
    for (let i = 0; i < guests.length; i += BATCH_SIZE) {
      const batch = guests.slice(i, i + BATCH_SIZE);
      const placeholders = batch.map(() => '(?, ?, ?, ?, ?, ?)').join(', ');
      const values: (string)[] = [];
      for (const guest of batch) {
        values.push(
          guest.guest_id,
          guest.concert_id,
          guest.zone_id,
          guest.full_name,
          guest.phone_masked,
          guest.status_snapshot
        );
      }
      await db.runAsync(
        `INSERT INTO guests (guest_id, concert_id, zone_id, full_name, phone_masked, status_snapshot) VALUES ${placeholders}`,
        values
      );
    }
  });
}

export async function getQueueItems(db: SQLiteDatabase): Promise<QueueItem[]> {
  return db.getAllAsync<QueueItem>(
    'SELECT * FROM offline_queue ORDER BY scanned_at DESC'
  );
}

export async function getPendingQueueItems(db: SQLiteDatabase): Promise<QueueItem[]> {
  return db.getAllAsync<QueueItem>(
    "SELECT * FROM offline_queue WHERE status = 'pending' OR status = 'failed' OR status = 'SUCCESS'"
  );
}

export async function updateQueueItemStatus(
  db: SQLiteDatabase,
  clientItemId: string,
  status: string,
  message: string | null
): Promise<void> {
  await db.runAsync(
    'UPDATE offline_queue SET status = ?, message = ? WHERE client_item_id = ?',
    [status, message, clientItemId]
  );
}

export async function clearQueue(db: SQLiteDatabase): Promise<void> {
  await db.runAsync('DELETE FROM offline_queue');
}

export async function clearSyncedItems(db: SQLiteDatabase): Promise<void> {
  await db.runAsync("DELETE FROM offline_queue WHERE status = 'synced'");
}

export async function searchGuestsOffline(
  db: SQLiteDatabase,
  queryText: string
): Promise<GuestPreload[]> {
  const match = `%${queryText}%`;
  return db.getAllAsync<GuestPreload>(
    'SELECT * FROM guests WHERE full_name LIKE ? OR phone_masked LIKE ?',
    [match, match]
  );
}

export async function checkInGuestOffline(
  db: SQLiteDatabase,
  guestId: string,
  concertId: string,
  gateId: string
): Promise<void> {
  const clientItemId = `local-guest-${Crypto.randomUUID()}`;
  const now = new Date().toISOString();

  await db.withTransactionAsync(async () => {
    // 1. Mark as checked_in locally
    await db.runAsync(
      "UPDATE guests SET status_snapshot = 'CHECKED_IN' WHERE guest_id = ?",
      [guestId]
    );

    // 2. Insert into offline_queue
    await db.runAsync(
      `INSERT INTO offline_queue (client_item_id, type, qr_token, qr_payload_hash, guest_id, phone, concert_id, gate_id, scanned_at, status, message)
       VALUES (?, 'GUEST', NULL, NULL, ?, NULL, ?, ?, ?, 'SUCCESS', 'Check-in khách mời offline thành công!')`,
      [clientItemId, guestId, concertId, gateId, now]
    );
  });
}
