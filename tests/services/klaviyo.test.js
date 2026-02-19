// tests/services/klaviyo.test.js
const { updateProfileWithCallOutcome } = require('../../src/services/klaviyo');

global.fetch = jest.fn();

beforeEach(() => {
  process.env.KLAVIYO_API_KEY = 'pk_test_123';
  fetch.mockReset();
});

describe('klaviyo service', () => {
  test('updateProfileWithCallOutcome sends PATCH to Klaviyo profiles API', async () => {
    fetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });

    await updateProfileWithCallOutcome('test@example.com', {
      outcome: 'sale_recovered',
      calledAt: '2026-02-19T12:00:00Z',
    });

    expect(fetch).toHaveBeenCalledWith(
      'https://a.klaviyo.com/api/profile-import/',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Authorization': 'Klaviyo-API-Key pk_test_123',
          'Content-Type': 'application/json',
          'revision': '2024-10-15',
        }),
      })
    );

    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.data.attributes.email).toBe('test@example.com');
    expect(body.data.attributes.properties.last_recovery_call_outcome).toBe('sale_recovered');
  });

  test('updateProfileWithCallOutcome throws on API error', async () => {
    fetch.mockResolvedValueOnce({ ok: false, status: 401, text: async () => 'Unauthorized' });

    await expect(
      updateProfileWithCallOutcome('test@example.com', { outcome: 'no_answer', calledAt: '2026-02-19T12:00:00Z' })
    ).rejects.toThrow('Klaviyo API error 401');
  });
});
