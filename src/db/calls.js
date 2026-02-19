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

async function getAllCalls({ outcome, dateFrom, dateTo, limit = 50, offset = 0 } = {}) {
  const db = getDb();
  let sql = 'SELECT * FROM calls WHERE 1=1';
  const args = [];
  if (outcome) { sql += ' AND outcome = ?'; args.push(outcome); }
  if (dateFrom) { sql += ' AND created_at >= ?'; args.push(dateFrom); }
  if (dateTo) { sql += ' AND created_at <= ?'; args.push(dateTo); }
  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  args.push(limit, offset);
  const result = await db.execute({ sql, args });
  return result.rows;
}

async function getDashboardStats() {
  const db = getDb();
  const total = await db.execute('SELECT COUNT(*) as count FROM calls');
  const completed = await db.execute("SELECT COUNT(*) as count FROM calls WHERE status = 'completed'");
  const recovered = await db.execute("SELECT COUNT(*) as count FROM calls WHERE outcome = 'sale_recovered'");
  const revenue = await db.execute('SELECT COALESCE(SUM(revenue_recovered), 0) as total FROM calls WHERE revenue_recovered IS NOT NULL');
  const today = await db.execute("SELECT COUNT(*) as count FROM calls WHERE created_at >= date('now')");
  const dailyCalls = await db.execute(`
    SELECT date(created_at) as day, COUNT(*) as count
    FROM calls WHERE created_at >= date('now', '-30 days')
    GROUP BY date(created_at) ORDER BY day
  `);
  return {
    totalCalls: total.rows[0].count,
    completedCalls: completed.rows[0].count,
    recoveredCalls: recovered.rows[0].count,
    revenueRecovered: revenue.rows[0].total,
    callsToday: today.rows[0].count,
    dailyCalls: dailyCalls.rows,
  };
}

async function getRecentCallByEmailOrPhone(email, phone, daysBack = 7) {
  const db = getDb();
  let sql = `SELECT * FROM calls WHERE created_at > datetime('now', '-${daysBack} days') AND (`;
  const args = [];
  const conditions = [];
  if (email) { conditions.push('customer_email = ?'); args.push(email); }
  if (phone) { conditions.push('customer_phone = ?'); args.push(phone); }
  if (conditions.length === 0) return [];
  sql += conditions.join(' OR ') + ') ORDER BY created_at DESC';
  const result = await db.execute({ sql, args });
  return result.rows;
}

async function updateCallConversion(id, revenueRecovered) {
  const db = getDb();
  await db.execute({
    sql: `UPDATE calls SET revenue_recovered = ?, converted_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`,
    args: [revenueRecovered, id],
  });
}

async function getScheduledCalls() {
  const db = getDb();
  const result = await db.execute({
    sql: `SELECT * FROM calls WHERE status = 'scheduled' AND scheduled_for <= datetime('now')`,
    args: [],
  });
  return result.rows;
}

async function scheduleCall(id, scheduledFor, timezone) {
  const db = getDb();
  await db.execute({
    sql: `UPDATE calls SET status = 'scheduled', scheduled_for = ?, customer_timezone = ?, updated_at = datetime('now') WHERE id = ?`,
    args: [scheduledFor, timezone, id],
  });
}

module.exports = {
  createCallRecord, getCallById, getRecentCallByPhone, updateCallStatus, updateCallOutcome,
  getAllCalls, getDashboardStats, getRecentCallByEmailOrPhone, updateCallConversion,
  getScheduledCalls, scheduleCall,
};
