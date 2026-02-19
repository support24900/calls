jest.mock('../../src/db/database', () => ({
  getDb: jest.fn().mockReturnValue({
    execute: jest.fn().mockResolvedValue({
      rows: [{ id: 1, customer_name: 'Jane', customer_email: 'jane@test.com', checkout_url: 'https://example.com/checkout', items_json: '[]', cart_total: 50 }],
    }),
  }),
}));
jest.mock('../../src/db/calls', () => ({
  updateCallOutcome: jest.fn().mockResolvedValue(undefined),
  getCallById: jest.fn(),
}));
jest.mock('../../src/services/klaviyo', () => ({
  updateProfileWithCallOutcome: jest.fn().mockResolvedValue(undefined),
  triggerKlaviyoEvent: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../src/services/twilio', () => ({
  sendCheckoutLink: jest.fn().mockResolvedValue({ sid: 'SM_test' }),
}));

const { handleFallback } = require('../../src/routes/vapiWebhook');
const { sendCheckoutLink } = require('../../src/services/twilio');
const { triggerKlaviyoEvent } = require('../../src/services/klaviyo');

beforeEach(() => jest.clearAllMocks());

describe('Multi-Channel Fallback', () => {
  test('sends SMS and triggers Klaviyo event on no_answer', async () => {
    await handleFallback('call_123', 'no_answer', '+1555', 'jane@test.com');
    expect(sendCheckoutLink).toHaveBeenCalledWith('+1555', 'https://example.com/checkout');
    expect(triggerKlaviyoEvent).toHaveBeenCalledWith('jane@test.com', 'Recovery Call Failed', expect.objectContaining({ call_outcome: 'no_answer' }));
  });

  test('sends SMS and triggers Klaviyo event on voicemail', async () => {
    await handleFallback('call_123', 'voicemail', '+1555', 'jane@test.com');
    expect(sendCheckoutLink).toHaveBeenCalled();
    expect(triggerKlaviyoEvent).toHaveBeenCalled();
  });

  test('does not trigger fallback on sale_recovered', async () => {
    await handleFallback('call_123', 'sale_recovered', '+1555', 'jane@test.com');
    expect(sendCheckoutLink).not.toHaveBeenCalled();
    expect(triggerKlaviyoEvent).not.toHaveBeenCalled();
  });
});
