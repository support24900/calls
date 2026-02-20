const { getDb } = require('./database');

async function getAbandonedCartsGroupedByDay() {
  const db = getDb();
  const result = await db.execute(`
    SELECT date(abandoned_at) as day,
           COUNT(*) as count,
           SUM(cart_total) as total_value
    FROM abandoned_carts
    GROUP BY date(abandoned_at)
    ORDER BY day DESC
  `);
  return result.rows;
}

async function getAbandonedCartsByDate(date) {
  const db = getDb();
  const result = await db.execute({
    sql: `SELECT * FROM abandoned_carts WHERE date(abandoned_at) = ? ORDER BY abandoned_at DESC`,
    args: [date],
  });
  return result.rows;
}

async function getAllAbandonedCarts() {
  const db = getDb();
  const result = await db.execute('SELECT * FROM abandoned_carts ORDER BY abandoned_at DESC');
  return result.rows;
}

async function getAbandonedCartById(id) {
  const db = getDb();
  const result = await db.execute({ sql: 'SELECT * FROM abandoned_carts WHERE id = ?', args: [id] });
  return result.rows[0] || null;
}

async function updateCartCallStatus(id, { call_status, call_date, call_recording_url, call_duration, call_notes }) {
  const db = getDb();
  const fields = [];
  const args = [];
  if (call_status !== undefined) { fields.push('call_status = ?'); args.push(call_status); }
  if (call_date !== undefined) { fields.push('call_date = ?'); args.push(call_date); }
  if (call_recording_url !== undefined) { fields.push('call_recording_url = ?'); args.push(call_recording_url); }
  if (call_duration !== undefined) { fields.push('call_duration = ?'); args.push(call_duration); }
  if (call_notes !== undefined) { fields.push('call_notes = ?'); args.push(call_notes); }
  if (fields.length === 0) return null;
  fields.push("updated_at = datetime('now')");
  args.push(id);
  await db.execute({ sql: `UPDATE abandoned_carts SET ${fields.join(', ')} WHERE id = ?`, args });
  return getAbandonedCartById(id);
}

async function getDailyStats() {
  const db = getDb();
  const cartsPerDay = await db.execute(`
    SELECT date(abandoned_at) as day, COUNT(*) as carts, SUM(cart_total) as value
    FROM abandoned_carts
    GROUP BY date(abandoned_at) ORDER BY day DESC LIMIT 30
  `);
  const callsMade = await db.execute(`SELECT COUNT(*) as count FROM abandoned_carts WHERE call_status != 'pending'`);
  const conversions = await db.execute(`SELECT COUNT(*) as count FROM abandoned_carts WHERE call_status = 'converted'`);
  return {
    cartsPerDay: cartsPerDay.rows,
    callsMade: callsMade.rows[0].count,
    conversions: conversions.rows[0].count,
  };
}

module.exports = {
  getAbandonedCartsGroupedByDay, getAbandonedCartsByDate, getAllAbandonedCarts,
  getAbandonedCartById, updateCartCallStatus, getDailyStats,
};
