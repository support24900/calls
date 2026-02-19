require('dotenv').config();

const express = require('express');
const { initDb } = require('./db/database');
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

const app = createApp();

// Initialize database and start server if run directly
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  initDb().then(() => {
    app.listen(PORT, () => {
      console.log(`Mirai Skin Abandoned Cart Agent running on port ${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/health`);
    });
  });
} else {
  // For serverless (Vercel) — init DB on first request
  let dbInitialized = false;
  const originalHandler = app.handle.bind(app);
  app.handle = async function (req, res, ...args) {
    if (!dbInitialized) {
      await initDb();
      dbInitialized = true;
    }
    return originalHandler(req, res, ...args);
  };
}

module.exports = app;
module.exports.createApp = createApp;
