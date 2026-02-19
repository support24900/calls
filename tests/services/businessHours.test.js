const { getTimezone, isWithinCallingHours, getNextCallingWindow } = require('../../src/services/businessHours');

describe('businessHours', () => {
  test('getTimezone returns correct timezone for known states', () => {
    expect(getTimezone('CA')).toBe('America/Los_Angeles');
    expect(getTimezone('NY')).toBe('America/New_York');
    expect(getTimezone('TX')).toBe('America/Chicago');
    expect(getTimezone('CO')).toBe('America/Denver');
    expect(getTimezone('HI')).toBe('Pacific/Honolulu');
  });

  test('getTimezone returns EST for unknown state', () => {
    expect(getTimezone('XX')).toBe('America/New_York');
    expect(getTimezone(null)).toBe('America/New_York');
    expect(getTimezone(undefined)).toBe('America/New_York');
  });

  test('getTimezone is case-insensitive', () => {
    expect(getTimezone('ca')).toBe('America/Los_Angeles');
  });

  test('isWithinCallingHours returns a boolean', () => {
    const result = isWithinCallingHours('America/New_York');
    expect(typeof result).toBe('boolean');
  });

  test('getNextCallingWindow returns a future Date', () => {
    const nextWindow = getNextCallingWindow('America/New_York');
    expect(nextWindow instanceof Date).toBe(true);
    expect(nextWindow.getTime()).toBeGreaterThan(Date.now() - 1000);
  });
});
