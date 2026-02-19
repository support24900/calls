const { createClient } = require('@libsql/client/web');

let db;

function getDb() {
  if (!db) {
    db = createClient({
      url: process.env.TURSO_DATABASE_URL || 'file:local.db',
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  }
  return db;
}

async function initDb() {
  const client = getDb();
  await client.execute(`
    CREATE TABLE IF NOT EXISTS calls (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_phone TEXT NOT NULL,
      customer_email TEXT,
      customer_name TEXT,
      cart_total REAL,
      items_json TEXT,
      checkout_url TEXT,
      discount_code TEXT,
      vapi_call_id TEXT,
      status TEXT NOT NULL DEFAULT 'queued',
      outcome TEXT,
      transcript TEXT,
      duration_seconds INTEGER,
      revenue_recovered REAL,
      converted_at DATETIME,
      scheduled_for DATETIME,
      customer_timezone TEXT,
      created_at DATETIME DEFAULT (datetime('now')),
      updated_at DATETIME DEFAULT (datetime('now'))
    )
  `);

  // Migration: add new columns to existing tables
  const migrations = [
    'ALTER TABLE calls ADD COLUMN revenue_recovered REAL',
    'ALTER TABLE calls ADD COLUMN converted_at DATETIME',
    'ALTER TABLE calls ADD COLUMN scheduled_for DATETIME',
    'ALTER TABLE calls ADD COLUMN customer_timezone TEXT',
  ];
  for (const sql of migrations) {
    try { await client.execute(sql); } catch (_) { /* column already exists */ }
  }

  return client;
}

function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = { getDb, initDb, closeDb };
