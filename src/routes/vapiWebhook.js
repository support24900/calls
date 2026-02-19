// src/routes/vapiWebhook.js
const express = require('express');
const router = express.Router();
const { updateCallOutcome } = require('../db/calls');
const { updateProfileWithCallOutcome } = require('../services/klaviyo');

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
    updateCallOutcome(vapiCallId, {
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

  res.status(200).json({ received: true, outcome });
});

module.exports = router;
