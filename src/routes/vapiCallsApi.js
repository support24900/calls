const express = require('express');
const router = express.Router();

const VAPI_API_KEY = '606845cb-bb9e-4fb8-8ec2-3de4fb20125d';

router.get('/calls', async (req, res) => {
  try {
    const response = await fetch('https://api.vapi.ai/call?limit=50', {
      headers: { 'Authorization': `Bearer ${VAPI_API_KEY}` }
    });
    if (!response.ok) throw new Error(`Vapi API error: ${response.status}`);
    const calls = await response.json();
    res.json(calls);
  } catch (err) {
    console.error('Vapi calls fetch error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
