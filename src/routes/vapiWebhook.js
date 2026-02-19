const express = require('express');
const router = express.Router();
const { updateCallOutcome, getCallById } = require('../db/calls');
const { updateProfileWithCallOutcome, triggerKlaviyoEvent } = require('../services/klaviyo');
const { sendCheckoutLink } = require('../services/twilio');

function determineOutcome(report) {
  const { endedReason, analysis } = report;

  if (analysis && analysis.successEvaluation === 'true') {
    return 'sale_recovered';
  }
  if (endedReason === 'no-answer' || endedReason === 'busy') {
    return 'no_answer';
  }
  if (endedReason === 'voicemail') {
    return 'voicemail';
  }
  return 'not_interested';
}

async function handleFallback(vapiCallId, outcome, customerPhone, customerEmail) {
  if (outcome !== 'no_answer' && outcome !== 'voicemail') return;

  // Find the call record to get checkout URL
  const { getDb } = require('../db/database');
  const db = getDb();
  const result = await db.execute({
    sql: 'SELECT * FROM calls WHERE vapi_call_id = ? LIMIT 1',
    args: [vapiCallId],
  });
  const callRecord = result.rows[0];

  // Send SMS fallback
  if (customerPhone && callRecord?.checkout_url) {
    try {
      const smsBody = `Hi${callRecord.customer_name ? ' ' + callRecord.customer_name : ''}! We tried reaching you about your Mirai Skin order. Your cart is still saved — complete your purchase here: ${callRecord.checkout_url}`;
      await sendCheckoutLink(customerPhone, callRecord.checkout_url);
      console.log(`Fallback SMS sent to ${customerPhone}`);
    } catch (err) {
      console.error('Fallback SMS failed:', err.message);
    }
  }

  // Trigger Klaviyo event for email flow
  if (customerEmail || callRecord?.customer_email) {
    const email = customerEmail || callRecord.customer_email;
    try {
      let items = [];
      try { items = JSON.parse(callRecord?.items_json || '[]'); } catch (_) {}
      await triggerKlaviyoEvent(email, 'Recovery Call Failed', {
        call_outcome: outcome,
        cart_total: callRecord?.cart_total,
        cart_items: items,
        checkout_url: callRecord?.checkout_url,
      });
      console.log(`Klaviyo "Recovery Call Failed" event triggered for ${email}`);
    } catch (err) {
      console.error('Klaviyo fallback event failed:', err.message);
    }
  }
}

router.post('/call-status', async (req, res) => {
  const { message } = req.body;

  if (!message || message.type !== 'end-of-call-report') {
    return res.status(200).json({ received: true });
  }

  const { call, transcript, durationSeconds, customer } = message;
  const outcome = determineOutcome(message);
  const vapiCallId = call?.id;

  console.log(`Call ${vapiCallId} ended — outcome: ${outcome}, duration: ${durationSeconds}s`);

  // Update local database
  if (vapiCallId) {
    await updateCallOutcome(vapiCallId, {
      outcome,
      transcript: transcript || '',
      duration_seconds: durationSeconds || 0,
    });
  }

  // Update Klaviyo profile
  if (customer?.number) {
    try {
      await updateProfileWithCallOutcome(customer.number, {
        outcome,
        calledAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Failed to update Klaviyo profile:', err.message);
    }
  }

  // Multi-channel fallback for no_answer/voicemail
  if (vapiCallId) {
    try {
      await handleFallback(vapiCallId, outcome, customer?.number, customer?.email);
    } catch (err) {
      console.error('Fallback handling failed:', err.message);
    }
  }

  res.status(200).json({ received: true, outcome });
});

module.exports = router;
module.exports.determineOutcome = determineOutcome;
module.exports.handleFallback = handleFallback;
