jest.mock('../../src/db/calls', () => ({
  getScheduledCalls: jest.fn().mockResolvedValue([]),
  updateCallStatus: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../src/services/vapi', () => ({
  createOutboundCall: jest.fn().mockResolvedValue({ id: 'call_sched1' }),
}));
jest.mock('../../src/services/businessHours', () => ({
  isWithinCallingHours: jest.fn().mockReturnValue(true),
}));

const { processScheduledCalls, startScheduler, stopScheduler } = require('../../src/services/scheduler');
const { getScheduledCalls, updateCallStatus } = require('../../src/db/calls');
const { createOutboundCall } = require('../../src/services/vapi');

beforeEach(() => jest.clearAllMocks());

describe('scheduler', () => {
  test('processScheduledCalls dispatches due calls', async () => {
    getScheduledCalls.mockResolvedValueOnce([
      { id: 1, customer_phone: '+1555', customer_name: 'Jane', customer_timezone: 'America/New_York', cart_total: 50, items_json: '[]', checkout_url: 'https://example.com' },
    ]);
    await processScheduledCalls();
    expect(createOutboundCall).toHaveBeenCalled();
    expect(updateCallStatus).toHaveBeenCalledWith(1, 'in_progress', 'call_sched1');
  });

  test('processScheduledCalls does nothing with no scheduled calls', async () => {
    await processScheduledCalls();
    expect(createOutboundCall).not.toHaveBeenCalled();
  });

  test('startScheduler and stopScheduler work without errors', () => {
    startScheduler();
    stopScheduler();
  });
});
