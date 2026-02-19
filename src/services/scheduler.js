const { getScheduledCalls, updateCallStatus } = require('../db/calls');
const { createOutboundCall } = require('./vapi');
const { isWithinCallingHours } = require('./businessHours');

const INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
let intervalId = null;

async function processScheduledCalls() {
  try {
    const calls = await getScheduledCalls();
    for (const call of calls) {
      const tz = call.customer_timezone || 'America/New_York';
      if (!isWithinCallingHours(tz)) continue;

      try {
        let items = [];
        try { items = JSON.parse(call.items_json || '[]'); } catch (_) {}

        const vapiCall = await createOutboundCall({
          customerPhone: call.customer_phone,
          customerName: call.customer_name,
          cartItems: items,
          cartTotal: call.cart_total,
          checkoutUrl: call.checkout_url,
        });

        await updateCallStatus(call.id, 'in_progress', vapiCall.id);
        console.log(`Scheduled call #${call.id} dispatched → Vapi ${vapiCall.id}`);
      } catch (err) {
        console.error(`Failed to dispatch scheduled call #${call.id}:`, err.message);
        await updateCallStatus(call.id, 'failed', null);
      }
    }
  } catch (err) {
    console.error('Scheduler error:', err.message);
  }
}

function startScheduler() {
  if (intervalId) return;
  intervalId = setInterval(processScheduledCalls, INTERVAL_MS);
  console.log('Scheduler started (every 5 minutes)');
}

function stopScheduler() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

module.exports = { startScheduler, stopScheduler, processScheduledCalls };
