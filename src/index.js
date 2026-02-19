require('dotenv').config();

const express = require('express');
const { initDb } = require('./db/database');
const klaviyoWebhook = require('./routes/klaviyoWebhook');
const vapiWebhook = require('./routes/vapiWebhook');
const smsTool = require('./routes/smsTool');

function createApp() {
  const app = express();

  app.use(express.json());

  // Initialize DB on first request (for serverless)
  let dbReady = false;
  app.use(async (req, res, next) => {
    if (!dbReady) {
      try {
        await initDb();
        dbReady = true;
      } catch (err) {
        console.error('DB init failed:', err.message);
        return res.status(500).json({ error: 'Database initialization failed' });
      }
    }
    next();
  });

  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Root
  app.get('/', (req, res) => {
    res.json({ name: 'Mirai Skin Abandoned Cart Agent', status: 'running' });
  });

  // Webhook routes
  app.use('/api/webhook', klaviyoWebhook);
  app.use('/api/webhook', vapiWebhook);
  app.use('/api/webhook', smsTool);

  return app;
}

const app = createApp();

// Start server if run directly (not on Vercel)
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Mirai Skin Abandoned Cart Agent running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
  });
}

module.exports = app;
module.exports.createApp = createApp;
