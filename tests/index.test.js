// tests/index.test.js
const request = require('supertest');

// Mock all dependencies before requiring the app
jest.mock('../src/db/database', () => ({
  getDb: jest.fn().mockReturnValue({}),
  closeDb: jest.fn(),
}));
jest.mock('../src/db/calls', () => ({
  createCallRecord: jest.fn().mockReturnValue({ id: 1 }),
  getCallById: jest.fn(),
  getRecentCallByPhone: jest.fn().mockReturnValue(null),
  updateCallStatus: jest.fn(),
  updateCallOutcome: jest.fn(),
}));
jest.mock('../src/services/vapi', () => ({
  createOutboundCall: jest.fn().mockResolvedValue({ id: 'call_test', status: 'queued' }),
}));
jest.mock('../src/services/twilio', () => ({
  sendCheckoutLink: jest.fn().mockResolvedValue({ sid: 'SM_test' }),
}));
jest.mock('../src/services/klaviyo', () => ({
  updateProfileWithCallOutcome: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../src/services/shopify', () => ({
  createDiscountCode: jest.fn().mockResolvedValue('MIRAI-TEST'),
}));

const { createApp } = require('../src/index');

describe('Express server', () => {
  let app;

  beforeAll(() => {
    process.env.KLAVIYO_WEBHOOK_SECRET = 'test-secret';
    app = createApp();
  });

  test('GET /health returns 200', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  test('POST /api/webhook/abandoned-cart is mounted', async () => {
    const res = await request(app)
      .post('/api/webhook/abandoned-cart')
      .send({});
    // Should get 401 (no secret) — not 404
    expect(res.status).toBe(401);
  });

  test('POST /api/webhook/call-status is mounted', async () => {
    const res = await request(app)
      .post('/api/webhook/call-status')
      .send({ message: { type: 'ping' } });
    expect(res.status).toBe(200);
  });

  test('POST /api/webhook/send-sms is mounted', async () => {
    const res = await request(app)
      .post('/api/webhook/send-sms')
      .send({});
    // Should get 400 (no tool call) — not 404
    expect(res.status).toBe(400);
  });
});
