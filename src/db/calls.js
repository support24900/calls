const { getDb } = require('./database');

function createCallRecord({ customer_phone, customer_email, customer_name, cart_total, items_json, checkout_url }) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO calls (customer_phone, customer_email, customer_name, cart_total, items_json, checkout_url)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(customer_phone, customer_email, customer_name, cart_total, items_json, checkout_url);
  return getCallById(result.lastInsertRowid);
}

function getCallById(id) {
  const db = getDb();
  return db.prepare('SELECT * FROM calls WHERE id = ?').get(id) || null;
}

function getRecentCallByPhone(phone) {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM calls
    WHERE customer_phone = ? AND created_at > datetime('now', '-24 hours')
    ORDER BY created_at DESC LIMIT 1
  `).get(phone) || null;
}

function updateCallStatus(id, status, vapi_call_id) {
  const db = getDb();
  db.prepare(`
    UPDATE calls SET status = ?, vapi_call_id = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(status, vapi_call_id, id);
}

function updateCallOutcome(id, { outcome, transcript, duration_seconds }) {
  const db = getDb();
  db.prepare(`
    UPDATE calls SET outcome = ?, transcript = ?, duration_seconds = ?, status = 'completed', updated_at = datetime('now')
    WHERE id = ?
  `).run(outcome, transcript, duration_seconds, id);
}

module.exports = { createCallRecord, getCallById, getRecentCallByPhone, updateCallStatus, updateCallOutcome };
