// tests/routes/vapiWebhook.test.js
const express = require('express');
const request = require('supertest');

jest.mock('../../src/db/calls', () => ({
  updateCallOutcome: jest.fn().mockResolvedValue(undefined),
  getCallById: jest.fn().mockResolvedValue(null),
}));
jest.mock('../../src/db/database', () => ({
  getDb: jest.fn().mockReturnValue({
    execute: jest.fn().mockResolvedValue({ rows: [] }),
  }),
}));
jest.mock('../../src/services/klaviyo', () => ({
  updateProfileWithCallOutcome: jest.fn().mockResolvedValue(undefined),
  triggerKlaviyoEvent: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../src/services/twilio', () => ({
  sendCheckoutLink: jest.fn().mockResolvedValue({ sid: 'SM_test' }),
}));

const vapiWebhook = require('../../src/routes/vapiWebhook');
const { updateCallOutcome } = require('../../src/db/calls');
const { updateProfileWithCallOutcome } = require('../../src/services/klaviyo');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/webhook', vapiWebhook);
  return app;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('POST /api/webhook/call-status', () => {
  test('logs call outcome and updates Klaviyo on end-of-call-report', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/webhook/call-status')
      .send({
        message: {
          type: 'end-of-call-report',
          call: { id: 'call_abc123' },
          endedReason: 'customer-ended-call',
          transcript: 'Hi Jane, this is Mia from Mirai Skin...',
          summary: 'Customer was interested, sent checkout link',
          durationSeconds: 95,
          customer: { number: '+15551234567' },
          analysis: {
            successEvaluation: 'true',
          },
        },
      });

    expect(res.status).toBe(200);
    expect(updateCallOutcome).toHaveBeenCalled();
  });

  test('returns 200 for non-end-of-call-report messages', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/webhook/call-status')
      .send({
        message: { type: 'status-update', status: 'ringing' },
      });

    expect(res.status).toBe(200);
    expect(updateCallOutcome).not.toHaveBeenCalled();
  });
});
