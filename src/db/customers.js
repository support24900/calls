const { getDb } = require('./database');

async function getAllCustomers({ search, limit = 100, offset = 0 } = {}) {
  const db = getDb();
  let sql = 'SELECT * FROM customers WHERE 1=1';
  const args = [];
  if (search) {
    sql += ' AND (name LIKE ? OR email LIKE ? OR phone LIKE ?)';
    const s = `%${search}%`;
    args.push(s, s, s);
  }
  sql += ' ORDER BY name ASC LIMIT ? OFFSET ?';
  args.push(limit, offset);
  const result = await db.execute({ sql, args });
  return result.rows;
}

async function getCustomersForRetention() {
  const db = getDb();
  const result = await db.execute(`
    SELECT *,
      CAST(julianday('now') - julianday(last_order_date) AS INTEGER) as days_since_last_order
    FROM customers
    WHERE last_order_date IS NOT NULL
    ORDER BY days_since_last_order DESC
  `);
  return result.rows;
}

async function bulkImportCustomers(customers) {
  const db = getDb();
  let imported = 0;
  for (const c of customers) {
    try {
      await db.execute({
        sql: `INSERT INTO customers (shopify_customer_id, name, email, phone, address, city, state, country, total_orders, total_spent, first_order_date, last_order_date)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(shopify_customer_id) DO UPDATE SET
                name=excluded.name, email=excluded.email, phone=excluded.phone,
                address=excluded.address, city=excluded.city, state=excluded.state, country=excluded.country,
                total_orders=excluded.total_orders, total_spent=excluded.total_spent,
                first_order_date=excluded.first_order_date, last_order_date=excluded.last_order_date`,
        args: [
          c.shopify_customer_id, c.name, c.email, c.phone,
          c.address, c.city, c.state, c.country,
          c.total_orders || 0, c.total_spent || 0,
          c.first_order_date, c.last_order_date,
        ],
      });
      imported++;
    } catch (e) { console.error('Import error:', e.message); }
  }
  return imported;
}

module.exports = { getAllCustomers, getCustomersForRetention, bulkImportCustomers };
