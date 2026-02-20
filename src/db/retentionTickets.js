const { getDb } = require('./database');

async function getAllTickets(filters = {}) {
  const db = getDb();
  let sql = 'SELECT * FROM retention_tickets WHERE 1=1';
  const args = [];
  if (filters.status) { sql += ' AND status = ?'; args.push(filters.status); }
  if (filters.customer_id) { sql += ' AND customer_id = ?'; args.push(filters.customer_id); }
  sql += ' ORDER BY created_at DESC';
  const result = await db.execute({ sql, args });
  return result.rows;
}

async function getTicketById(id) {
  const db = getDb();
  const result = await db.execute({ sql: 'SELECT * FROM retention_tickets WHERE id = ?', args: [id] });
  return result.rows[0] || null;
}

async function createTicket(data) {
  const db = getDb();
  const result = await db.execute({
    sql: `INSERT INTO retention_tickets (customer_id, customer_name, customer_email, customer_phone, action_type, scheduled_date, offer_details, max_discount, notes, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', datetime('now'), datetime('now'))`,
    args: [data.customer_id, data.customer_name, data.customer_email, data.customer_phone, data.action_type, data.scheduled_date, data.offer_details, data.max_discount || 0, data.notes || ''],
  });
  return { id: Number(result.lastInsertRowid), ...data, status: 'open' };
}

async function updateTicket(id, data) {
  const db = getDb();
  const fields = [];
  const args = [];
  for (const [key, value] of Object.entries(data)) {
    if (['status', 'outcome', 'notes', 'call_id', 'scheduled_date', 'offer_details', 'max_discount', 'action_type'].includes(key)) {
      fields.push(`${key} = ?`);
      args.push(value);
    }
  }
  if (fields.length === 0) return null;
  fields.push("updated_at = datetime('now')");
  args.push(id);
  await db.execute({ sql: `UPDATE retention_tickets SET ${fields.join(', ')} WHERE id = ?`, args });
  return getTicketById(id);
}

async function getTicketCountsByCustomer() {
  const db = getDb();
  const result = await db.execute("SELECT customer_id, COUNT(*) as count FROM retention_tickets WHERE status != 'cancelled' GROUP BY customer_id");
  const counts = {};
  for (const row of result.rows) counts[row.customer_id] = Number(row.count);
  return counts;
}

module.exports = { getAllTickets, getTicketById, createTicket, updateTicket, getTicketCountsByCustomer };
