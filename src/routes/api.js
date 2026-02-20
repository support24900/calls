const express = require('express');
const router = express.Router();
const { bulkImportCustomers } = require('../db/customers');
const { updateCartCallStatus, getDailyStats, getAbandonedCartById } = require('../db/abandonedCarts');
const { triggerKlaviyoEvent, updateProfileWithCallOutcome } = require('../services/klaviyo');

// POST /api/customers/import
router.post('/customers/import', async (req, res) => {
  try {
    const customers = req.body;
    if (!Array.isArray(customers)) return res.status(400).json({ error: 'Expected JSON array of customers' });
    const imported = await bulkImportCustomers(customers);
    res.json({ success: true, imported });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/carts/:id/call
router.patch('/carts/:id/call', async (req, res) => {
  try {
    const cart = await updateCartCallStatus(Number(req.params.id), req.body);
    if (!cart) return res.status(404).json({ error: 'Cart not found or no fields to update' });

    // Send event to Klaviyo if we have email and call_status
    const fullCart = await getAbandonedCartById(Number(req.params.id));
    if (fullCart && fullCart.email && req.body.call_status) {
      const eventMap = {
        called: 'Recovery Call Made',
        answered: 'Recovery Call Answered',
        converted: 'Recovery Call Converted',
        failed: 'Recovery Call Failed',
      };
      const eventName = eventMap[req.body.call_status];
      if (eventName) {
        try {
          await triggerKlaviyoEvent(fullCart.email, eventName, {
            cart_id: fullCart.id,
            cart_total: fullCart.total_price,
            call_date: req.body.call_date || new Date().toISOString(),
            call_duration: req.body.call_duration || null,
            call_notes: req.body.call_notes || null,
            recording_url: req.body.call_recording_url || null,
            items: fullCart.items || null,
          });
          await updateProfileWithCallOutcome(fullCart.email, {
            outcome: req.body.call_status,
            calledAt: req.body.call_date || new Date().toISOString(),
          });
          console.log(`[Klaviyo] Event "${eventName}" sent for ${fullCart.email}`);
        } catch (klaviyoErr) {
          console.error(`[Klaviyo] Error sending event:`, klaviyoErr.message);
        }
      }
    }

    res.json({ success: true, cart });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/dashboard/stats
router.get('/dashboard/stats', async (req, res) => {
  try {
    const stats = await getDailyStats();
    res.json(stats);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
