// tests/index.test.js
const request = require('supertest');

// Mock all dependencies before requiring the app
jest.mock('../src/db/database', () => ({
  getDb: jest.fn().mockReturnValue({}),
  initDb: jest.fn().mockResolvedValue({}),
  closeDb: jest.fn(),
}));
jest.mock('../src/db/calls', () => ({
  createCallRecord: jest.fn().mockResolvedValue({ id: 1 }),
  getCallById: jest.fn().mockResolvedValue(null),
  getRecentCallByPhone: jest.fn().mockResolvedValue(null),
  updateCallStatus: jest.fn().mockResolvedValue(undefined),
  updateCallOutcome: jest.fn().mockResolvedValue(undefined),
  getAllCalls: jest.fn().mockResolvedValue([]),
  getDashboardStats: jest.fn().mockResolvedValue({ totalCalls: 0, completedCalls: 0, recoveredCalls: 0, revenueRecovered: 0, callsToday: 0, dailyCalls: [] }),
  getRecentCallByEmailOrPhone: jest.fn().mockResolvedValue([]),
  updateCallConversion: jest.fn().mockResolvedValue(undefined),
  getScheduledCalls: jest.fn().mockResolvedValue([]),
  scheduleCall: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../src/services/vapi', () => ({
  createOutboundCall: jest.fn().mockResolvedValue({ id: 'call_test', status: 'queued' }),
}));
jest.mock('../src/services/twilio', () => ({
  sendCheckoutLink: jest.fn().mockResolvedValue({ sid: 'SM_test' }),
}));
jest.mock('../src/services/klaviyo', () => ({
  updateProfileWithCallOutcome: jest.fn().mockResolvedValue(undefined),
  triggerKlaviyoEvent: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../src/services/shopify', () => ({
  createDiscountCode: jest.fn().mockResolvedValue('MIRAI-TEST'),
}));
jest.mock('../src/services/scheduler', () => ({
  startScheduler: jest.fn(),
  stopScheduler: jest.fn(),
}));
jest.mock('../src/services/businessHours', () => ({
  getTimezone: jest.fn().mockReturnValue('America/New_York'),
  isWithinCallingHours: jest.fn().mockReturnValue(true),
  getNextCallingWindow: jest.fn().mockReturnValue(new Date()),
}));

const { createApp } = require('../src/index');

describe('Express server', () => {
  let app;

  beforeAll(() => {
    process.env.KLAVIYO_WEBHOOK_SECRET = 'test-secret';
    process.env.TURSO_DATABASE_URL = 'file::memory:';
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
