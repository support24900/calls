const express = require('express');
const crypto = require('crypto');
const request = require('supertest');

jest.mock('../../src/db/calls', () => ({
  getRecentCallByEmailOrPhone: jest.fn().mockResolvedValue([]),
  updateCallConversion: jest.fn().mockResolvedValue(undefined),
}));

const shopifyOrderWebhook = require('../../src/routes/shopifyOrderWebhook');
const { getRecentCallByEmailOrPhone, updateCallConversion } = require('../../src/db/calls');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/webhook', shopifyOrderWebhook);
  return app;
}

const sampleOrder = {
  id: 12345,
  email: 'jane@example.com',
  total_price: '89.99',
  customer: { email: 'jane@example.com', phone: '+15551234567' },
};

beforeEach(() => {
  process.env.SHOPIFY_WEBHOOK_SECRET = 'test-secret';
  jest.clearAllMocks();
});

describe('POST /api/webhook/shopify-order', () => {
  test('returns matched:false when no matching calls', async () => {
    const app = createApp();
    const res = await request(app).post('/api/webhook/shopify-order').send(sampleOrder);
    expect(res.status).toBe(200);
    expect(res.body.matched).toBe(false);
  });

  test('updates conversion when matching call found', async () => {
    getRecentCallByEmailOrPhone.mockResolvedValueOnce([{ id: 5 }]);
    const app = createApp();
    const res = await request(app).post('/api/webhook/shopify-order').send(sampleOrder);
    expect(res.status).toBe(200);
    expect(res.body.matched).toBe(true);
    expect(res.body.callId).toBe(5);
    expect(updateCallConversion).toHaveBeenCalledWith(5, 89.99);
  });

  test('rejects invalid HMAC', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/webhook/shopify-order')
      .set('x-shopify-hmac-sha256', 'invalid-hmac')
      .send(sampleOrder);
    expect(res.status).toBe(401);
  });

  test('accepts valid HMAC', async () => {
    getRecentCallByEmailOrPhone.mockResolvedValueOnce([]);
    const body = JSON.stringify(sampleOrder);
    const hmac = crypto.createHmac('sha256', 'test-secret').update(body, 'utf8').digest('base64');
    const app = createApp();
    const res = await request(app)
      .post('/api/webhook/shopify-order')
      .set('x-shopify-hmac-sha256', hmac)
      .set('Content-Type', 'application/json')
      .send(body);
    expect(res.status).toBe(200);
  });
});
