// src/routes/smsTool.js
const express = require('express');
const router = express.Router();
const { sendCheckoutLink } = require('../services/twilio');
const { createDiscountCode } = require('../services/shopify');

router.post('/send-sms', async (req, res) => {
  const toolCall = req.body.message?.toolCallList?.[0];
  if (!toolCall) {
    return res.status(400).json({ error: 'No tool call found' });
  }

  const { customer_phone, checkout_url } = toolCall.function.arguments;

  try {
    await sendCheckoutLink(customer_phone, checkout_url);
    res.status(200).json({
      results: [{
        toolCallId: toolCall.id,
        result: `Checkout link sent to ${customer_phone}`,
      }],
    });
  } catch (err) {
    console.error('Failed to send SMS:', err.message);
    res.status(200).json({
      results: [{
        toolCallId: toolCall.id,
        result: `Failed to send SMS: ${err.message}`,
      }],
    });
  }
});

router.post('/apply-discount', async (req, res) => {
  const toolCall = req.body.message?.toolCallList?.[0];
  if (!toolCall) {
    return res.status(400).json({ error: 'No tool call found' });
  }

  const { customer_phone, checkout_url, discount_percent } = toolCall.function.arguments;

  try {
    const code = await createDiscountCode(discount_percent || 10);
    const discountUrl = `${checkout_url}?discount=${code}`;
    await sendCheckoutLink(customer_phone, discountUrl);

    res.status(200).json({
      results: [{
        toolCallId: toolCall.id,
        result: `Discount code ${code} created (${discount_percent}% off) and checkout link sent to ${customer_phone}`,
      }],
    });
  } catch (err) {
    console.error('Failed to apply discount:', err.message);
    res.status(200).json({
      results: [{
        toolCallId: toolCall.id,
        result: `Failed to apply discount: ${err.message}`,
      }],
    });
  }
});

module.exports = router;
