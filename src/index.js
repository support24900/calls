// src/index.js
require('dotenv').config();

const express = require('express');
const klaviyoWebhook = require('./routes/klaviyoWebhook');
const vapiWebhook = require('./routes/vapiWebhook');
const smsTool = require('./routes/smsTool');

function createApp() {
  const app = express();

  app.use(express.json());

  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Webhook routes
  app.use('/api/webhook', klaviyoWebhook);
  app.use('/api/webhook', vapiWebhook);
  app.use('/api/webhook', smsTool);

  return app;
}

// Only start listening if run directly (not in tests)
if (require.main === module) {
  const app = createApp();
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Mirai Skin Abandoned Cart Agent running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
  });
}

module.exports = { createApp };
