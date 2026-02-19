// src/services/klaviyo.js

async function updateProfileWithCallOutcome(email, { outcome, calledAt }) {
  const response = await fetch('https://a.klaviyo.com/api/profile-import/', {
    method: 'POST',
    headers: {
      'Authorization': `Klaviyo-API-Key ${process.env.KLAVIYO_API_KEY}`,
      'Content-Type': 'application/json',
      'revision': '2024-10-15',
    },
    body: JSON.stringify({
      data: {
        type: 'profile',
        attributes: {
          email,
          properties: {
            last_recovery_call_outcome: outcome,
            last_recovery_call_date: calledAt,
          },
        },
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Klaviyo API error ${response.status}: ${text}`);
  }
}

async function triggerKlaviyoEvent(email, eventName, properties = {}) {
  const response = await fetch('https://a.klaviyo.com/api/events/', {
    method: 'POST',
    headers: {
      'Authorization': `Klaviyo-API-Key ${process.env.KLAVIYO_API_KEY}`,
      'Content-Type': 'application/json',
      'revision': '2024-10-15',
    },
    body: JSON.stringify({
      data: {
        type: 'event',
        attributes: {
          metric: { data: { type: 'metric', attributes: { name: eventName } } },
          profile: { data: { type: 'profile', attributes: { email } } },
          properties,
        },
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Klaviyo Events API error ${response.status}: ${text}`);
  }
}

module.exports = { updateProfileWithCallOutcome, triggerKlaviyoEvent };
