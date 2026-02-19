require('dotenv').config();

const express = require('express');
const { initDb } = require('./db/database');
const klaviyoWebhook = require('./routes/klaviyoWebhook');
const vapiWebhook = require('./routes/vapiWebhook');
const smsTool = require('./routes/smsTool');

// DB init middleware — only runs on webhook routes
let dbReady = false;
async function ensureDb(req, res, next) {
  if (!dbReady) {
    if (!process.env.TURSO_DATABASE_URL) {
      return res.status(503).json({ error: 'Database not configured. Set TURSO_DATABASE_URL in environment variables.' });
    }
    try {
      await initDb();
      dbReady = true;
    } catch (err) {
      console.error('DB init failed:', err.message);
      return res.status(500).json({ error: 'Database connection failed' });
    }
  }
  next();
}

function createApp() {
  const app = express();

  app.use(express.json());

  // These work without database
  app.get('/', (req, res) => {
    res.json({
      name: 'Mirai Skin Abandoned Cart Agent',
      status: 'running',
      endpoints: ['/health', '/api/webhook/abandoned-cart', '/api/webhook/call-status', '/api/webhook/send-sms'],
    });
  });

  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Webhook routes — require database
  app.use('/api/webhook', ensureDb, klaviyoWebhook);
  app.use('/api/webhook', ensureDb, vapiWebhook);
  app.use('/api/webhook', ensureDb, smsTool);

  return app;
}

const app = createApp();

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Mirai Skin Abandoned Cart Agent running on port ${PORT}`);
  });
}

module.exports = app;
module.exports.createApp = createApp;
