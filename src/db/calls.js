const { getDb } = require('./database');

async function createCallRecord({ customer_phone, customer_email, customer_name, cart_total, items_json, checkout_url }) {
  const db = getDb();
  const result = await db.execute({
    sql: `INSERT INTO calls (customer_phone, customer_email, customer_name, cart_total, items_json, checkout_url)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [customer_phone, customer_email, customer_name, cart_total, items_json, checkout_url],
  });
  return getCallById(Number(result.lastInsertRowid));
}

async function getCallById(id) {
  const db = getDb();
  const result = await db.execute({ sql: 'SELECT * FROM calls WHERE id = ?', args: [id] });
  return result.rows[0] || null;
}

async function getRecentCallByPhone(phone) {
  const db = getDb();
  const result = await db.execute({
    sql: `SELECT * FROM calls
          WHERE customer_phone = ? AND created_at > datetime('now', '-24 hours')
          ORDER BY created_at DESC LIMIT 1`,
    args: [phone],
  });
  return result.rows[0] || null;
}

async function updateCallStatus(id, status, vapi_call_id) {
  const db = getDb();
  await db.execute({
    sql: `UPDATE calls SET status = ?, vapi_call_id = ?, updated_at = datetime('now') WHERE id = ?`,
    args: [status, vapi_call_id, id],
  });
}

async function updateCallOutcome(id, { outcome, transcript, duration_seconds }) {
  const db = getDb();
  await db.execute({
    sql: `UPDATE calls SET outcome = ?, transcript = ?, duration_seconds = ?, status = 'completed', updated_at = datetime('now') WHERE id = ?`,
    args: [outcome, transcript, duration_seconds, id],
  });
}

module.exports = { createCallRecord, getCallById, getRecentCallByPhone, updateCallStatus, updateCallOutcome };
