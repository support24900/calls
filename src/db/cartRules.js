const { getDb } = require('./database');

async function getCartRules() {
  const db = getDb();
  const result = await db.execute('SELECT rule_key, rule_value FROM cart_rules');
  const rules = {};
  for (const row of result.rows) {
    rules[row.rule_key] = row.rule_value;
  }
  return rules;
}

async function setCartRules(rules) {
  const db = getDb();
  for (const [key, value] of Object.entries(rules)) {
    await db.execute({
      sql: `INSERT INTO cart_rules (rule_key, rule_value, updated_at) VALUES (?, ?, datetime('now'))
            ON CONFLICT(rule_key) DO UPDATE SET rule_value = excluded.rule_value, updated_at = datetime('now')`,
      args: [key, String(value)],
    });
  }
  return rules;
}

async function getCartRule(key, defaultValue = null) {
  const db = getDb();
  const result = await db.execute({ sql: 'SELECT rule_value FROM cart_rules WHERE rule_key = ?', args: [key] });
  return result.rows.length > 0 ? result.rows[0].rule_value : defaultValue;
}

module.exports = { getCartRules, setCartRules, getCartRule };
