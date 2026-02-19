const { createOutboundCall } = require('../../src/services/vapi');

// Mock global fetch
global.fetch = jest.fn();

beforeEach(() => {
  process.env.VAPI_API_KEY = 'test-vapi-key';
  process.env.VAPI_PHONE_NUMBER_ID = 'phone-123';
  process.env.VAPI_ASSISTANT_ID = 'assistant-456';
  fetch.mockReset();
});

describe('vapi service', () => {
  test('createOutboundCall sends correct request to Vapi API', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'call_abc123', status: 'queued' }),
    });

    const result = await createOutboundCall({
      customerPhone: '+15551234567',
      customerName: 'Jane Doe',
      cartItems: [{ title: 'Snail Mucin Essence', price: '29.99', quantity: 1 }],
      cartTotal: 29.99,
      checkoutUrl: 'https://mirai-skin.com/checkout/recover/abc',
    });

    expect(fetch).toHaveBeenCalledWith('https://api.vapi.ai/call', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer test-vapi-key',
        'Content-Type': 'application/json',
      },
      body: expect.any(String),
    });

    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.phoneNumberId).toBe('phone-123');
    expect(body.customer.number).toBe('+15551234567');
    expect(body.assistantOverrides.variableValues.customerName).toBe('Jane Doe');
    expect(result.id).toBe('call_abc123');
  });

  test('createOutboundCall throws on API error', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => 'Bad Request',
    });

    await expect(createOutboundCall({
      customerPhone: '+15551234567',
      customerName: 'Jane',
      cartItems: [],
      cartTotal: 0,
      checkoutUrl: 'https://example.com',
    })).rejects.toThrow('Vapi API error 400');
  });
});
