require('dotenv').config();

const express = require('express');
const path = require('path');
const session = require('express-session');
const { initDb } = require('./db/database');
const klaviyoWebhook = require('./routes/klaviyoWebhook');
const vapiWebhook = require('./routes/vapiWebhook');
const smsTool = require('./routes/smsTool');
const dashboard = require('./routes/dashboard');
const shopifyOrderWebhook = require('./routes/shopifyOrderWebhook');
const shopifyAbandonedWebhook = require('./routes/shopifyAbandonedWebhook');
const discountTool = require('./routes/discountTool');
const { startScheduler } = require('./services/scheduler');

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

  // EJS setup
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));

  // Session for dashboard auth
  app.use(session({
    secret: process.env.SESSION_SECRET || 'mirai-skin-default-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 }, // 24 hours
  }));

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Landing page
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'pages', 'landing.html'));
  });

  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Dashboard routes — require database
  app.use('/dashboard', ensureDb, dashboard);

  // Webhook routes — require database
  app.use('/api/webhook', ensureDb, klaviyoWebhook);
  app.use('/api/webhook', ensureDb, vapiWebhook);
  app.use('/api/webhook', ensureDb, smsTool);
  app.use('/api/webhook', ensureDb, shopifyOrderWebhook);
  app.use('/api/webhook', ensureDb, shopifyAbandonedWebhook);
  app.use('/api/tool', discountTool);

  return app;
}

const app = createApp();

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, async () => {
    console.log(`Mirai Skin Abandoned Cart Agent running on port ${PORT}`);
    if (process.env.TURSO_DATABASE_URL) {
      try {
        await initDb();
        dbReady = true;
        startScheduler();
        console.log('Database initialized, scheduler started');
      } catch (err) {
        console.error('DB init on startup failed:', err.message);
      }
    }
  });
}

module.exports = app;
module.exports.createApp = createApp;
