// src/services/twilio.js
const twilio = require('twilio');

let client;

function getClient() {
  if (!client) {
    client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  }
  return client;
}

async function sendCheckoutLink(toPhone, checkoutUrl) {
  const message = await getClient().messages.create({
    body: `Here's your checkout link from Mirai Skin! Complete your order here: ${checkoutUrl}`,
    from: process.env.TWILIO_PHONE_NUMBER,
    to: toPhone,
  });
  return message;
}

module.exports = { sendCheckoutLink };
