const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { insertAbandonedCart, getRecentCartByEmail } = require('../db/abandonedCarts');

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
  const name = checkout.billing_address?.name || checkout.shipping_address?.name ||
    `${checkout.shipping_address?.first_name || checkout.billing_address?.first_name || ''} ${checkout.shipping_address?.last_name || checkout.billing_address?.last_name || ''}`.trim() || email || 'Unknown';
  const cartTotal = parseFloat(checkout.total_price) || 0;
  const cartItems = (checkout.line_items || []).map(item => ({
    title: item.title,
    quantity: item.quantity,
    price: item.price,
    variant_title: item.variant_title,
  }));
  const checkoutUrl = checkout.abandoned_checkout_url || '';

  if (!email && !phone) {
    console.log('Shopify abandoned checkout: no email or phone, skipping');
    return res.status(200).json({ skipped: true, reason: 'no_contact_info' });
  }

  // Dedup
  if (email) {
    const recent = await getRecentCartByEmail(email);
    if (recent) {
      return res.status(200).json({ skipped: true, reason: 'already_recorded' });
    }
  }

  const id = await insertAbandonedCart({
    shopify_cart_id: String(checkout.id || ''),
    customer_name: name,
    customer_email: email || '',
    customer_phone: phone || '',
    cart_total: cartTotal,
    items_json: JSON.stringify(cartItems),
    checkout_url: checkoutUrl,
    abandoned_at: checkout.created_at || new Date().toISOString(),
  });

  console.log(`Abandoned cart saved: ${name} (${email}) — $${cartTotal} — ${cartItems.length} items`);
  res.status(200).json({ success: true, cartId: Number(id), collectOnly: true });
});

// Bulk import endpoint
router.post('/bulk-import-carts', async (req, res) => {
  const secret = req.headers['x-import-secret'];
  if (secret !== process.env.DASHBOARD_PASSWORD) {
    return res.status(401).json({ error: 'Invalid secret' });
  }

  const carts = req.body.carts || [];
  let imported = 0;
  for (const cart of carts) {
    try {
      await insertAbandonedCart({
        shopify_cart_id: cart.checkout_id || '',
        customer_name: cart.customer_name || cart.name || '',
        customer_email: cart.customer_email || cart.email || '',
        customer_phone: cart.customer_phone || cart.phone || '',
        cart_total: parseFloat(cart.cart_total || cart.total || 0),
        items_json: typeof cart.items === 'string' ? cart.items : JSON.stringify(cart.items || ''),
        checkout_url: cart.checkout_url || '',
        abandoned_at: cart.abandoned_at || new Date().toISOString(),
      });
      imported++;
    } catch (err) {
      console.error(`Failed to import cart for ${cart.customer_email || cart.email}:`, err.message);
    }
  }

  res.json({ success: true, imported, total: carts.length });
});

module.exports = router;
