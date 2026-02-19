jest.mock('twilio', () => {
  const mockCreate = jest.fn().mockResolvedValue({ sid: 'SM123', status: 'queued' });
  return jest.fn(() => ({
    messages: { create: mockCreate },
  }));
});

const { sendCheckoutLink } = require('../../src/services/twilio');
const twilio = require('twilio');

beforeEach(() => {
  process.env.TWILIO_ACCOUNT_SID = 'AC_test';
  process.env.TWILIO_AUTH_TOKEN = 'auth_test';
  process.env.TWILIO_PHONE_NUMBER = '+10000000000';
});

describe('twilio service', () => {
  test('sendCheckoutLink sends SMS with checkout URL', async () => {
    const result = await sendCheckoutLink('+15551234567', 'https://mirai-skin.com/checkout/recover/abc');

    const client = twilio();
    expect(client.messages.create).toHaveBeenCalledWith({
      body: expect.stringContaining('https://mirai-skin.com/checkout/recover/abc'),
      from: '+10000000000',
      to: '+15551234567',
    });
    expect(result.sid).toBe('SM123');
  });
});
