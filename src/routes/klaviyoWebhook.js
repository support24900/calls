const express = require('express');
const router = express.Router();
const { createOutboundCall } = require('../services/vapi');
const { createCallRecord, getRecentCallByPhone, updateCallStatus, scheduleCall } = require('../db/calls');
const { getTimezone, isWithinCallingHours, getNextCallingWindow } = require('../services/businessHours');

router.post('/abandoned-cart', async (req, res) => {
  // Validate webhook secret
  const secret = req.headers['x-klaviyo-webhook-secret'];
  if (secret !== process.env.KLAVIYO_WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Invalid webhook secret' });
  }

  const { customer_phone, customer_email, customer_name, cart_total, cart_items, checkout_url, customer_state } = req.body;

  // Validate required fields
  if (!customer_phone) {
    return res.status(400).json({ error: 'customer_phone is required' });
  }

  // Dedup: skip if already called in last 24 hours
  const recentCall = await getRecentCallByPhone(customer_phone);
  if (recentCall) {
    console.log(`Skipping call to ${customer_phone} — already called recently (call #${recentCall.id})`);
    return res.status(200).json({ skipped: true, reason: 'already_called_recently' });
  }

  // Create call record
  const callRecord = await createCallRecord({
    customer_phone,
    customer_email,
    customer_name,
    cart_total,
    items_json: JSON.stringify(cart_items || []),
    checkout_url,
  });

  // COLLECT-ONLY MODE: Save abandoned cart but do NOT call yet
  // When ready to enable calls, set ENABLE_OUTBOUND_CALLS=true in env vars
  if (process.env.ENABLE_OUTBOUND_CALLS === 'true') {
    // Business hours guard
    const timezone = getTimezone(customer_state);
    if (!isWithinCallingHours(timezone)) {
      const scheduledFor = getNextCallingWindow(timezone);
      await scheduleCall(callRecord.id, scheduledFor.toISOString(), timezone);
      console.log(`Call for ${customer_name} (${customer_phone}) scheduled for ${scheduledFor.toISOString()} (${timezone})`);
      return res.status(200).json({ success: true, callId: callRecord.id, scheduled: true, scheduledFor: scheduledFor.toISOString() });
    }

    try {
      // Trigger Vapi outbound call
      const vapiCall = await createOutboundCall({
        customerPhone: customer_phone,
        customerName: customer_name,
        cartItems: cart_items || [],
        cartTotal: cart_total,
        checkoutUrl: checkout_url,
      });

      await updateCallStatus(callRecord.id, 'in_progress', vapiCall.id);

      console.log(`Call initiated for ${customer_name} (${customer_phone}) — Vapi call: ${vapiCall.id}`);
      res.status(200).json({ success: true, callId: callRecord.id, vapiCallId: vapiCall.id });
    } catch (err) {
      console.error(`Failed to create Vapi call for ${customer_phone}:`, err.message);
      await updateCallStatus(callRecord.id, 'failed', null);
      res.status(500).json({ error: 'Failed to initiate call' });
    }
  } else {
    console.log(`Cart collected for ${customer_name} (${customer_phone}) — $${cart_total} — calls disabled`);
    res.status(200).json({ success: true, callId: callRecord.id, collectOnly: true });
  }
});

module.exports = router;
