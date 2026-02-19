// tests/services/shopify.test.js
const { createDiscountCode } = require('../../src/services/shopify');

global.fetch = jest.fn();

beforeEach(() => {
  process.env.SHOPIFY_STORE_URL = 'mirai-skin.myshopify.com';
  process.env.SHOPIFY_ACCESS_TOKEN = 'shpat_test123';
  fetch.mockReset();
});

describe('shopify service', () => {
  test('createDiscountCode creates a price rule and discount code', async () => {
    // First call: create price rule
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ price_rule: { id: 99001 } }),
    });
    // Second call: create discount code
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ discount_code: { code: 'MIRAI-ABC123', id: 5001 } }),
    });

    const code = await createDiscountCode(10);

    expect(code).toMatch(/^MIRAI-/);
    expect(fetch).toHaveBeenCalledTimes(2);

    // Verify price rule creation
    const priceRuleCall = fetch.mock.calls[0];
    expect(priceRuleCall[0]).toContain('/admin/api/2025-01/price_rules.json');
    const priceRuleBody = JSON.parse(priceRuleCall[1].body);
    expect(priceRuleBody.price_rule.value).toBe('-10.0');
    expect(priceRuleBody.price_rule.value_type).toBe('percentage');
  });

  test('createDiscountCode throws on Shopify API error', async () => {
    fetch.mockResolvedValueOnce({ ok: false, status: 422, text: async () => 'Unprocessable' });

    await expect(createDiscountCode(10)).rejects.toThrow('Shopify API error 422');
  });
});
