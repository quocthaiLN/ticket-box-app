import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  
  db = await SQLite.openDatabaseAsync('ticketbox_checker.db');
  
  // Run Migrations to setup SQLite tables
  await db.execAsync('PRAGMA journal_mode = WAL;');

  // Kiểm tra tính nhất quán của schema (nếu thiếu cột qr_payload_hash thì tái tạo bảng)
  try {
    await db.execAsync('SELECT qr_payload_hash FROM offline_queue LIMIT 1;');
  } catch (error) {
    console.log('Phát hiện schema SQLite cũ hoặc thiếu cột qr_payload_hash, tiến hành tái tạo các bảng...');
    await db.execAsync('DROP TABLE IF EXISTS allowed_seat_zones;');
    await db.execAsync('DROP TABLE IF EXISTS tickets;');
    await db.execAsync('DROP TABLE IF EXISTS guests;');
    await db.execAsync('DROP TABLE IF EXISTS offline_queue;');
  }

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS allowed_seat_zones (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL,
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tickets (
      ticket_id TEXT PRIMARY KEY,
      qr_payload_hash TEXT NOT NULL,
      concert_id TEXT NOT NULL,
      zone_id TEXT NOT NULL,
      status_snapshot TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS guests (
      guest_id TEXT PRIMARY KEY,
      concert_id TEXT NOT NULL,
      zone_id TEXT NOT NULL,
      full_name TEXT NOT NULL,
      phone_masked TEXT NOT NULL,
      status_snapshot TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS offline_queue (
      client_item_id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      qr_token TEXT,
      qr_payload_hash TEXT,
      guest_id TEXT,
      phone TEXT,
      concert_id TEXT NOT NULL,
      gate_id TEXT NOT NULL,
      scanned_at TEXT NOT NULL,
      status TEXT NOT NULL,
      message TEXT
    );
  `);
  
  return db;
}
