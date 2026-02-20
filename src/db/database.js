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
      revenue_recovered REAL,
      converted_at DATETIME,
      scheduled_for DATETIME,
      customer_timezone TEXT,
      created_at DATETIME DEFAULT (datetime('now')),
      updated_at DATETIME DEFAULT (datetime('now'))
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS abandoned_carts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shopify_cart_id TEXT,
      customer_name TEXT,
      customer_email TEXT,
      customer_phone TEXT,
      cart_total REAL DEFAULT 0,
      currency TEXT DEFAULT 'USD',
      items_json TEXT,
      checkout_url TEXT,
      abandoned_at DATETIME DEFAULT (datetime('now')),
      call_status TEXT DEFAULT 'pending',
      call_date DATETIME,
      call_recording_url TEXT,
      call_duration INTEGER,
      call_notes TEXT,
      discount_codes TEXT,
      total_discounts REAL DEFAULT 0,
      created_at DATETIME DEFAULT (datetime('now')),
      updated_at DATETIME DEFAULT (datetime('now'))
    )
  `);

  // Add discount columns if missing (migration)
  try { await client.execute(`ALTER TABLE abandoned_carts ADD COLUMN discount_codes TEXT`); } catch(e) {}
  try { await client.execute(`ALTER TABLE abandoned_carts ADD COLUMN total_discounts REAL DEFAULT 0`); } catch(e) {}

  await client.execute(`
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shopify_customer_id TEXT UNIQUE,
      name TEXT,
      email TEXT,
      phone TEXT,
      address TEXT,
      city TEXT,
      state TEXT,
      country TEXT,
      total_orders INTEGER DEFAULT 0,
      total_spent REAL DEFAULT 0,
      first_order_date DATETIME,
      last_order_date DATETIME,
      created_at DATETIME DEFAULT (datetime('now'))
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS cart_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rule_key TEXT UNIQUE NOT NULL,
      rule_value TEXT,
      updated_at DATETIME DEFAULT (datetime('now'))
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS retention_tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id TEXT,
      customer_name TEXT,
      customer_email TEXT,
      customer_phone TEXT,
      action_type TEXT,
      scheduled_date TEXT,
      offer_details TEXT,
      max_discount INTEGER DEFAULT 0,
      notes TEXT,
      status TEXT DEFAULT 'open',
      call_id TEXT,
      outcome TEXT,
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
    'ALTER TABLE abandoned_carts ADD COLUMN call_status TEXT DEFAULT \'pending\'',
    'ALTER TABLE abandoned_carts ADD COLUMN call_date DATETIME',
    'ALTER TABLE abandoned_carts ADD COLUMN call_recording_url TEXT',
    'ALTER TABLE abandoned_carts ADD COLUMN call_duration INTEGER',
    'ALTER TABLE abandoned_carts ADD COLUMN call_notes TEXT',
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
