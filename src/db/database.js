const { createClient } = require('@libsql/client');

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
      created_at DATETIME DEFAULT (datetime('now')),
      updated_at DATETIME DEFAULT (datetime('now'))
    )
  `);
  return client;
}

function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = { getDb, initDb, closeDb };
