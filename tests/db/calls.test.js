const { createCallRecord, getCallById, getRecentCallByPhone, updateCallStatus, updateCallOutcome } = require('../../src/db/calls');
const { getDb, closeDb } = require('../../src/db/database');

afterAll(() => {
  closeDb();
});

describe('calls database', () => {
  const sampleCall = {
    customer_phone: '+15551234567',
    customer_email: 'test@example.com',
    customer_name: 'Jane Doe',
    cart_total: 89.99,
    items_json: JSON.stringify([{ title: 'Snail Mucin Essence', price: '29.99', quantity: 1 }]),
    checkout_url: 'https://mirai-skin.com/checkout/recover/abc123',
  };

  test('createCallRecord inserts and returns a call with id', () => {
    const call = createCallRecord(sampleCall);
    expect(call.id).toBeDefined();
    expect(call.customer_phone).toBe('+15551234567');
    expect(call.status).toBe('queued');
  });

  test('getCallById returns the correct call', () => {
    const created = createCallRecord(sampleCall);
    const found = getCallById(created.id);
    expect(found.customer_email).toBe('test@example.com');
  });

  test('getRecentCallByPhone returns call within 24 hours', () => {
    createCallRecord(sampleCall);
    const recent = getRecentCallByPhone('+15551234567');
    expect(recent).not.toBeNull();
  });

  test('getRecentCallByPhone returns null for unknown phone', () => {
    const recent = getRecentCallByPhone('+19999999999');
    expect(recent).toBeNull();
  });

  test('updateCallStatus updates status and vapi_call_id', () => {
    const created = createCallRecord(sampleCall);
    updateCallStatus(created.id, 'in_progress', 'vapi_call_xyz');
    const updated = getCallById(created.id);
    expect(updated.status).toBe('in_progress');
    expect(updated.vapi_call_id).toBe('vapi_call_xyz');
  });

  test('updateCallOutcome stores outcome, transcript, duration', () => {
    const created = createCallRecord(sampleCall);
    updateCallOutcome(created.id, {
      outcome: 'sale_recovered',
      transcript: 'Hi Jane... great choice...',
      duration_seconds: 120,
    });
    const updated = getCallById(created.id);
    expect(updated.outcome).toBe('sale_recovered');
    expect(updated.transcript).toBe('Hi Jane... great choice...');
    expect(updated.duration_seconds).toBe(120);
  });
});
