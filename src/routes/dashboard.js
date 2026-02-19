const express = require('express');
const router = express.Router();
const { getAllCalls, getCallById, getDashboardStats } = require('../db/calls');

// Auth middleware
function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) {
    return next();
  }
  res.redirect('/dashboard/login');
}

// Login page
router.get('/login', (req, res) => {
  res.render('login', { error: null });
});

router.post('/login', (req, res) => {
  const { password } = req.body;
  if (password === process.env.DASHBOARD_PASSWORD) {
    req.session.authenticated = true;
    return res.redirect('/dashboard');
  }
  res.render('login', { error: 'Invalid password' });
});

router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/dashboard/login');
});

// Dashboard overview
router.get('/', requireAuth, async (req, res) => {
  const stats = await getDashboardStats();
  const recoveryRate = stats.completedCalls > 0
    ? ((stats.recoveredCalls / stats.completedCalls) * 100).toFixed(1)
    : '0.0';
  res.render('dashboard', { stats, recoveryRate });
});

// Call log
router.get('/calls', requireAuth, async (req, res) => {
  const { outcome, dateFrom, dateTo } = req.query;
  const calls = await getAllCalls({ outcome, dateFrom, dateTo });
  res.render('calls', { calls, filters: { outcome, dateFrom, dateTo } });
});

// Single call detail
router.get('/calls/:id', requireAuth, async (req, res) => {
  const call = await getCallById(Number(req.params.id));
  if (!call) {
    return res.status(404).render('error', { message: 'Call not found' });
  }
  res.render('call-detail', { call });
});

module.exports = router;
