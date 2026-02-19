// tests/routes/smsTool.test.js
const express = require('express');
const request = require('supertest');

jest.mock('../../src/services/twilio', () => ({
  sendCheckoutLink: jest.fn().mockResolvedValue({ sid: 'SM_test123' }),
}));
jest.mock('../../src/services/shopify', () => ({
  createDiscountCode: jest.fn().mockResolvedValue('MIRAI-TEST10'),
}));

const smsTool = require('../../src/routes/smsTool');
const { sendCheckoutLink } = require('../../src/services/twilio');
const { createDiscountCode } = require('../../src/services/shopify');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/webhook', smsTool);
  return app;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('POST /api/webhook/send-sms', () => {
  test('sends checkout link SMS', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/webhook/send-sms')
      .send({
        message: {
          toolCallList: [{
            id: 'tool_1',
            function: {
              name: 'send_checkout_link',
              arguments: {
                customer_phone: '+15551234567',
                checkout_url: 'https://mirai-skin.com/checkout/recover/abc',
              },
            },
          }],
        },
      });

    expect(res.status).toBe(200);
    expect(sendCheckoutLink).toHaveBeenCalledWith('+15551234567', 'https://mirai-skin.com/checkout/recover/abc');
    expect(res.body.results[0].result).toContain('sent');
  });
});

describe('POST /api/webhook/apply-discount', () => {
  test('creates discount code and sends SMS', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/webhook/apply-discount')
      .send({
        message: {
          toolCallList: [{
            id: 'tool_2',
            function: {
              name: 'apply_discount',
              arguments: {
                customer_phone: '+15551234567',
                checkout_url: 'https://mirai-skin.com/checkout/recover/abc',
                discount_percent: 10,
              },
            },
          }],
        },
      });

    expect(res.status).toBe(200);
    expect(createDiscountCode).toHaveBeenCalledWith(10);
    expect(sendCheckoutLink).toHaveBeenCalled();
    expect(res.body.results[0].result).toContain('MIRAI-TEST10');
  });
});
