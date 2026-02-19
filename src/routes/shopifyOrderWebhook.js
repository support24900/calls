const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { getRecentCallByEmailOrPhone, updateCallConversion } = require('../db/calls');

function verifyShopifyHmac(body, hmacHeader) {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
  if (!secret) return false;
  const digest = crypto.createHmac('sha256', secret).update(body, 'utf8').digest('base64');
  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(hmacHeader));
  } catch (_) {
    return false;
  }
}

// We need the raw body for HMAC verification
router.post('/shopify-order', express.raw({ type: 'application/json' }), async (req, res) => {
  const hmac = req.headers['x-shopify-hmac-sha256'];
  const rawBody = typeof req.body === 'string' ? req.body : (Buffer.isBuffer(req.body) ? req.body.toString('utf8') : JSON.stringify(req.body));

  if (hmac && !verifyShopifyHmac(rawBody, hmac)) {
    return res.status(401).json({ error: 'Invalid HMAC signature' });
  }

  const order = typeof req.body === 'string' || Buffer.isBuffer(req.body) ? JSON.parse(rawBody) : req.body;
  const email = order.email || order.customer?.email;
  const phone = order.customer?.phone || order.shipping_address?.phone || order.billing_address?.phone;
  const totalPrice = parseFloat(order.total_price) || 0;

  if (!email && !phone) {
    return res.status(200).json({ matched: false, reason: 'no_customer_identifier' });
  }

  const matchingCalls = await getRecentCallByEmailOrPhone(email, phone);

  if (matchingCalls.length === 0) {
    return res.status(200).json({ matched: false, reason: 'no_matching_calls' });
  }

  // Update the most recent matching call
  const call = matchingCalls[0];
  await updateCallConversion(call.id, totalPrice);

  console.log(`Conversion tracked: Call #${call.id} → $${totalPrice} (Order ${order.id})`);
  res.status(200).json({ matched: true, callId: call.id, revenue: totalPrice });
});

module.exports = router;
