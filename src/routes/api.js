const express = require('express');
const router = express.Router();
const { bulkImportCustomers } = require('../db/customers');
const { updateCartCallStatus, getDailyStats } = require('../db/abandonedCarts');

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
