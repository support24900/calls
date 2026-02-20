const express = require('express');
const router = express.Router();
const { getAllCalls, getCallById, getDashboardStats } = require('../db/calls');
const { getAbandonedCartsGroupedByDay, getAbandonedCartsByDate, getAllAbandonedCarts } = require('../db/abandonedCarts');
const { getAllCustomers, getCustomersForRetention } = require('../db/customers');
const { getDailyStats } = require('../db/abandonedCarts');

function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) return next();
  res.redirect('/dashboard/login');
}

router.get('/login', (req, res) => res.render('login', { error: null }));

router.post('/login', (req, res) => {
  const { password } = req.body;
  if (password === process.env.DASHBOARD_PASSWORD) {
    req.session.authenticated = true;
    return res.redirect('/dashboard');
  }
  res.render('login', { error: 'Invalid password' });
});

router.get('/logout', (req, res) => { req.session.destroy(); res.redirect('/dashboard/login'); });

// Main dashboard — abandoned carts grouped by day
router.get('/', requireAuth, async (req, res) => {
  const dailyGroups = await getAbandonedCartsGroupedByDay();
  const expandDate = req.query.date;
  let expandedCarts = [];
  if (expandDate) {
    expandedCarts = await getAbandonedCartsByDate(expandDate);
  }
  res.render('dashboard', { dailyGroups, expandDate, expandedCarts, page: 'carts' });
});

// Customers page
router.get('/customers', requireAuth, async (req, res) => {
  const search = req.query.search || '';
  const customers = await getAllCustomers({ search });
  res.render('customers', { customers, search, page: 'customers' });
});

// Retention page
router.get('/retention', requireAuth, async (req, res) => {
  const customers = await getCustomersForRetention();
  res.render('retention', { customers, page: 'retention' });
});

// Stats page
router.get('/stats', requireAuth, async (req, res) => {
  const stats = await getDailyStats();
  const callStats = await getDashboardStats();
  res.render('stats', { stats, callStats, page: 'stats' });
});

// Legacy calls pages
router.get('/calls', requireAuth, async (req, res) => {
  const { outcome, dateFrom, dateTo } = req.query;
  const calls = await getAllCalls({ outcome, dateFrom, dateTo });
  res.render('calls', { calls, filters: { outcome, dateFrom, dateTo }, page: 'calls' });
});

router.get('/calls/:id', requireAuth, async (req, res) => {
  const call = await getCallById(Number(req.params.id));
  if (!call) return res.status(404).render('error', { message: 'Call not found' });
  res.render('call-detail', { call, page: 'calls' });
});

module.exports = router;
