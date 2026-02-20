const express = require('express');
const router = express.Router();
const { bulkImportCustomers } = require('../db/customers');
const { updateCartCallStatus, getDailyStats, getAbandonedCartById } = require('../db/abandonedCarts');
const { triggerKlaviyoEvent, updateProfileWithCallOutcome } = require('../services/klaviyo');
const { getCartRules, setCartRules } = require('../db/cartRules');
const { getAllTickets, createTicket, updateTicket } = require('../db/retentionTickets');

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

// Cart Rules API
router.get('/cart-rules', async (req, res) => {
  try {
    const rules = await getCartRules();
    res.json(rules);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/cart-rules', async (req, res) => {
  try {
    const rules = await setCartRules(req.body);
    res.json({ success: true, rules });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Trigger Vapi call for a cart
router.post('/carts/:id/trigger-call', async (req, res) => {
  try {
    const cart = await getAbandonedCartById(Number(req.params.id));
    if (!cart) return res.status(404).json({ error: 'Cart not found' });
    if (!cart.customer_phone) return res.status(400).json({ error: 'No phone number for this cart' });

    const rules = await getCartRules();
    const phoneNumberId = req.body.phoneNumberId || rules.phone_number_id || 'b84f8a12-9e25-46b7-a523-57477c52b6d9';
    const assistantId = req.body.assistantId || rules.assistant_id || '1fa240b4-11a1-47b1-ab46-a468d9c2ee49';

    // Build assistant overrides with cart-specific info
    const callBody = { phoneNumberId, customer: { number: cart.customer_phone, name: cart.customer_name || '' } };
    
    // If using inline assistant (custom prompt), build it
    if (req.body.assistantId) {
      callBody.assistantId = assistantId;
    } else {
      callBody.assistantId = assistantId;
    }

    // Pass cart items to assistant as override
    let itemsSummary = '';
    try {
      const items = JSON.parse(cart.items_json || '[]');
      itemsSummary = items.map(i => `${i.title} x${i.quantity} ($${i.price})`).join(', ');
    } catch(e) {}

    if (itemsSummary) {
      callBody.assistantOverrides = {
        firstMessage: undefined, // let assistant default handle it
        variableValues: {
          customerName: cart.customer_name || 'there',
          cartItems: itemsSummary,
          cartTotal: String(cart.cart_total || 0),
        }
      };
    }

    const vapiRes = await fetch('https://api.vapi.ai/call/phone', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer 606845cb-bb9e-4fb8-8ec2-3de4fb20125d', 'Content-Type': 'application/json' },
      body: JSON.stringify(callBody),
    });
    const data = await vapiRes.json();
    await updateCartCallStatus(Number(req.params.id), { call_status: 'called', call_date: new Date().toISOString() });
    res.json({ success: true, call: data });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Save cart notes
router.patch('/carts/:id/notes', async (req, res) => {
  try {
    const cart = await updateCartCallStatus(Number(req.params.id), { call_notes: req.body.notes });
    res.json({ success: true, cart });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Tickets API
router.get('/tickets', async (req, res) => {
  try {
    const tickets = await getAllTickets({ status: req.query.status, customer_id: req.query.customer_id });
    res.json(tickets);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/tickets', async (req, res) => {
  try {
    const ticket = await createTicket(req.body);
    res.json({ success: true, ticket });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.patch('/tickets/:id', async (req, res) => {
  try {
    const ticket = await updateTicket(Number(req.params.id), req.body);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    res.json({ success: true, ticket });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Trigger Vapi call for a ticket
router.post('/tickets/:id/trigger-call', async (req, res) => {
  try {
    const { getTicketById } = require('../db/retentionTickets');
    const ticket = await getTicketById(Number(req.params.id));
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    if (!ticket.customer_phone) return res.status(400).json({ error: 'No phone number' });

    const rules = await getCartRules();
    const phoneNumberId = rules.phone_number_id || 'b84f8a12-9e25-46b7-a523-57477c52b6d9';
    const assistantId = rules.assistant_id || '1fa240b4-11a1-47b1-ab46-a468d9c2ee49';

    const vapiRes = await fetch('https://api.vapi.ai/call/phone', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer 606845cb-bb9e-4fb8-8ec2-3de4fb20125d', 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumberId, assistantId, customer: { number: ticket.customer_phone } }),
    });
    const data = await vapiRes.json();
    await updateTicket(Number(req.params.id), { status: 'in_progress', call_id: data.id || '' });
    res.json({ success: true, call: data });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
