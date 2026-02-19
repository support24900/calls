// src/services/shopify.js
const crypto = require('crypto');

function generateCode() {
  return 'MIRAI-' + crypto.randomBytes(4).toString('hex').toUpperCase();
}

async function shopifyFetch(endpoint, options = {}) {
  const url = `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2025-01${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Shopify API error ${response.status}: ${text}`);
  }

  return response.json();
}

async function createDiscountCode(percentOff) {
  const code = generateCode();

  // Create price rule
  const priceRuleData = await shopifyFetch('/price_rules.json', {
    method: 'POST',
    body: JSON.stringify({
      price_rule: {
        title: code,
        target_type: 'line_item',
        target_selection: 'all',
        allocation_method: 'across',
        value_type: 'percentage',
        value: `-${percentOff}.0`,
        customer_selection: 'all',
        usage_limit: 1,
        starts_at: new Date().toISOString(),
      },
    }),
  });

  // Create discount code for the price rule
  await shopifyFetch(`/price_rules/${priceRuleData.price_rule.id}/discount_codes.json`, {
    method: 'POST',
    body: JSON.stringify({
      discount_code: { code },
    }),
  });

  return code;
}

module.exports = { createDiscountCode };
