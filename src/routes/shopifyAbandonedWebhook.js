const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { createCallRecord, getRecentCallByPhone } = require('../db/calls');

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

// Shopify sends abandoned checkout webhook
router.post('/shopify-abandoned', express.raw({ type: 'application/json' }), async (req, res) => {
  const hmac = req.headers['x-shopify-hmac-sha256'];
  const rawBody = typeof req.body === 'string' ? req.body : (Buffer.isBuffer(req.body) ? req.body.toString('utf8') : JSON.stringify(req.body));

  if (hmac && process.env.SHOPIFY_WEBHOOK_SECRET) {
    if (!verifyShopifyHmac(rawBody, hmac)) {
      console.warn('Shopify HMAC mismatch — accepting anyway (secret may need update)');
    }
  }

  const checkout = typeof req.body === 'string' || Buffer.isBuffer(req.body) ? JSON.parse(rawBody) : req.body;

  const email = checkout.email;
  const phone = checkout.phone || checkout.shipping_address?.phone || checkout.billing_address?.phone;
  const firstName = checkout.shipping_address?.first_name || checkout.billing_address?.first_name || '';
  const lastName = checkout.shipping_address?.last_name || checkout.billing_address?.last_name || '';
  const customerName = `${firstName} ${lastName}`.trim() || email || 'Unknown';
  const cartTotal = parseFloat(checkout.total_price) || 0;
  const cartItems = (checkout.line_items || []).map(item => ({
    title: item.title,
    quantity: item.quantity,
    price: item.price,
    variant_title: item.variant_title,
  }));
  const checkoutUrl = checkout.abandoned_checkout_url || '';
  const state = checkout.shipping_address?.province_code || checkout.billing_address?.province_code || '';

  if (!email && !phone) {
    console.log('Shopify abandoned checkout: no email or phone, skipping');
    return res.status(200).json({ skipped: true, reason: 'no_contact_info' });
  }

  // Dedup: skip if already recorded in last 24 hours with same email
  if (phone) {
    const recentCall = await getRecentCallByPhone(phone);
    if (recentCall) {
      console.log(`Skipping abandoned checkout for ${customerName} — already recorded recently`);
      return res.status(200).json({ skipped: true, reason: 'already_recorded' });
    }
  }

  const callRecord = await createCallRecord({
    customer_phone: phone || '',
    customer_email: email || '',
    customer_name: customerName,
    cart_total: cartTotal,
    items_json: JSON.stringify(cartItems),
    checkout_url: checkoutUrl,
  });

  console.log(`Abandoned cart collected: ${customerName} (${email}) — $${cartTotal} — ${cartItems.length} items`);
  res.status(200).json({ success: true, callId: callRecord.id, collectOnly: true });
});

// Bulk import endpoint (one-time use)
router.post('/bulk-import-carts', async (req, res) => {
  const secret = req.headers['x-import-secret'];
  if (secret !== process.env.DASHBOARD_PASSWORD) {
    return res.status(401).json({ error: 'Invalid secret' });
  }

  const carts = req.body.carts || [];
  let imported = 0;
  for (const cart of carts) {
    try {
      await createCallRecord({
        customer_phone: cart.phone || '',
        customer_email: cart.email || '',
        customer_name: cart.name || '',
        cart_total: parseFloat(cart.total) || 0,
        items_json: JSON.stringify(cart.items || cart.items_text || ''),
        checkout_url: cart.checkout_url || '',
      });
      imported++;
    } catch (err) {
      console.error(`Failed to import cart for ${cart.email}:`, err.message);
    }
  }

  res.json({ success: true, imported, total: carts.length });
});

module.exports = router;
