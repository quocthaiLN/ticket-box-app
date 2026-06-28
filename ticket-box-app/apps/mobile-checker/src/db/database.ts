import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  
  db = await SQLite.openDatabaseAsync('ticketbox_checker.db');
  
  // Run Migrations to setup SQLite tables
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    
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
