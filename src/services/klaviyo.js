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

module.exports = { updateProfileWithCallOutcome };
