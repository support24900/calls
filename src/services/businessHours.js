// Map US state codes to IANA timezones
const STATE_TIMEZONES = {
  // Eastern
  CT: 'America/New_York', DE: 'America/New_York', FL: 'America/New_York', GA: 'America/New_York',
  IN: 'America/New_York', KY: 'America/New_York', ME: 'America/New_York', MD: 'America/New_York',
  MA: 'America/New_York', MI: 'America/New_York', NH: 'America/New_York', NJ: 'America/New_York',
  NY: 'America/New_York', NC: 'America/New_York', OH: 'America/New_York', PA: 'America/New_York',
  RI: 'America/New_York', SC: 'America/New_York', VT: 'America/New_York', VA: 'America/New_York',
  WV: 'America/New_York', DC: 'America/New_York',
  // Central
  AL: 'America/Chicago', AR: 'America/Chicago', IL: 'America/Chicago', IA: 'America/Chicago',
  KS: 'America/Chicago', LA: 'America/Chicago', MN: 'America/Chicago', MS: 'America/Chicago',
  MO: 'America/Chicago', NE: 'America/Chicago', ND: 'America/Chicago', OK: 'America/Chicago',
  SD: 'America/Chicago', TN: 'America/Chicago', TX: 'America/Chicago', WI: 'America/Chicago',
  // Mountain
  AZ: 'America/Phoenix', CO: 'America/Denver', ID: 'America/Boise', MT: 'America/Denver',
  NM: 'America/Denver', UT: 'America/Denver', WY: 'America/Denver',
  // Pacific
  CA: 'America/Los_Angeles', NV: 'America/Los_Angeles', OR: 'America/Los_Angeles', WA: 'America/Los_Angeles',
  // Other
  AK: 'America/Anchorage', HI: 'Pacific/Honolulu',
};

const DEFAULT_TIMEZONE = 'America/New_York';
const CALL_HOURS_START = 9; // 9 AM
const CALL_HOURS_END = 20;  // 8 PM

function getTimezone(state) {
  if (!state) return DEFAULT_TIMEZONE;
  return STATE_TIMEZONES[state.toUpperCase()] || DEFAULT_TIMEZONE;
}

function isWithinCallingHours(timezone) {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    hour12: false,
  });
  const hour = parseInt(formatter.format(now), 10);
  return hour >= CALL_HOURS_START && hour < CALL_HOURS_END;
}

function getNextCallingWindow(timezone) {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    hour12: false,
  });
  const hour = parseInt(formatter.format(now), 10);

  let hoursUntilOpen;
  if (hour < CALL_HOURS_START) {
    hoursUntilOpen = CALL_HOURS_START - hour;
  } else {
    // After 8 PM, next window is tomorrow at 9 AM
    hoursUntilOpen = (24 - hour) + CALL_HOURS_START;
  }

  return new Date(now.getTime() + hoursUntilOpen * 60 * 60 * 1000);
}

module.exports = { getTimezone, isWithinCallingHours, getNextCallingWindow, STATE_TIMEZONES };
