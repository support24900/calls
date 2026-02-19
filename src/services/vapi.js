// src/services/vapi.js

async function createOutboundCall({ customerPhone, customerName, cartItems, cartTotal, checkoutUrl }) {
  const itemsSummary = cartItems
    .map(item => `${item.title} ($${item.price} x${item.quantity})`)
    .join(', ');

  const response = await fetch('https://api.vapi.ai/call', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.VAPI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      assistantId: process.env.VAPI_ASSISTANT_ID,
      phoneNumberId: process.env.VAPI_PHONE_NUMBER_ID,
      customer: {
        number: customerPhone,
      },
      assistantOverrides: {
        variableValues: {
          customerName,
          cartItems: itemsSummary,
          cartTotal: `$${cartTotal}`,
          checkoutUrl,
        },
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Vapi API error ${response.status}: ${text}`);
  }

  return response.json();
}

module.exports = { createOutboundCall };
