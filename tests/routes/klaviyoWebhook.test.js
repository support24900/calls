// tests/routes/klaviyoWebhook.test.js
const express = require('express');
const request = require('supertest');

// Mock services
jest.mock('../../src/services/vapi', () => ({
  createOutboundCall: jest.fn().mockResolvedValue({ id: 'call_test123', status: 'queued' }),
}));
jest.mock('../../src/db/calls', () => ({
  getRecentCallByPhone: jest.fn().mockReturnValue(null),
  createCallRecord: jest.fn().mockReturnValue({ id: 1 }),
  updateCallStatus: jest.fn(),
}));

const klaviyoWebhook = require('../../src/routes/klaviyoWebhook');
const { createOutboundCall } = require('../../src/services/vapi');
const { getRecentCallByPhone, createCallRecord, updateCallStatus } = require('../../src/db/calls');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/webhook', klaviyoWebhook);
  return app;
}

beforeEach(() => {
  process.env.KLAVIYO_WEBHOOK_SECRET = 'test-secret';
  jest.clearAllMocks();
});

const validPayload = {
  customer_phone: '+15551234567',
  customer_email: 'jane@example.com',
  customer_name: 'Jane Doe',
  cart_total: 59.99,
  cart_items: [
    { title: 'Snail Mucin Essence', price: '29.99', quantity: 1 },
    { title: 'Centella Cream', price: '30.00', quantity: 1 },
  ],
  checkout_url: 'https://mirai-skin.com/checkout/recover/abc123',
};

describe('POST /api/webhook/abandoned-cart', () => {
  test('returns 401 without valid webhook secret', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/webhook/abandoned-cart')
      .send(validPayload);

    expect(res.status).toBe(401);
  });

  test('returns 200 and triggers Vapi call with valid payload', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/webhook/abandoned-cart')
      .set('x-klaviyo-webhook-secret', 'test-secret')
      .send(validPayload);

    expect(res.status).toBe(200);
    expect(createCallRecord).toHaveBeenCalled();
    expect(createOutboundCall).toHaveBeenCalledWith(
      expect.objectContaining({
        customerPhone: '+15551234567',
        customerName: 'Jane Doe',
      })
    );
    expect(updateCallStatus).toHaveBeenCalledWith(1, 'in_progress', 'call_test123');
  });

  test('returns 200 with skipped message if already called recently', async () => {
    getRecentCallByPhone.mockReturnValueOnce({ id: 99 });
    const app = createApp();
    const res = await request(app)
      .post('/api/webhook/abandoned-cart')
      .set('x-klaviyo-webhook-secret', 'test-secret')
      .send(validPayload);

    expect(res.status).toBe(200);
    expect(res.body.skipped).toBe(true);
    expect(createOutboundCall).not.toHaveBeenCalled();
  });

  test('returns 400 if customer_phone is missing', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/webhook/abandoned-cart')
      .set('x-klaviyo-webhook-secret', 'test-secret')
      .send({ ...validPayload, customer_phone: undefined });

    expect(res.status).toBe(400);
  });
});
