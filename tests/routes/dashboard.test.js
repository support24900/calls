const express = require('express');
const session = require('express-session');
const request = require('supertest');

jest.mock('../../src/db/calls', () => ({
  getAllCalls: jest.fn().mockResolvedValue([
    { id: 1, customer_name: 'Jane', customer_phone: '+1555', cart_total: 50, outcome: 'sale_recovered', status: 'completed', created_at: '2026-02-19' },
  ]),
  getCallById: jest.fn().mockResolvedValue({
    id: 1, customer_name: 'Jane', customer_phone: '+1555', customer_email: 'jane@test.com',
    cart_total: 50, items_json: '[{"title":"Serum","price":"50","quantity":1}]',
    outcome: 'sale_recovered', status: 'completed', transcript: 'Hi Jane...', created_at: '2026-02-19',
  }),
  getDashboardStats: jest.fn().mockResolvedValue({
    totalCalls: 10, completedCalls: 8, recoveredCalls: 3, revenueRecovered: 150, callsToday: 2, dailyCalls: [],
  }),
}));

const dashboard = require('../../src/routes/dashboard');

function createApp() {
  const app = express();
  app.set('view engine', 'ejs');
  app.set('views', require('path').join(__dirname, '../../src/views'));
  app.use(session({ secret: 'test', resave: false, saveUninitialized: false }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use('/dashboard', dashboard);
  return app;
}

beforeEach(() => {
  process.env.DASHBOARD_PASSWORD = 'test123';
  jest.clearAllMocks();
});

describe('Dashboard', () => {
  test('GET /dashboard redirects to login when not authenticated', async () => {
    const app = createApp();
    const res = await request(app).get('/dashboard');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/dashboard/login');
  });

  test('GET /dashboard/login shows login page', async () => {
    const app = createApp();
    const res = await request(app).get('/dashboard/login');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Dashboard Password');
  });

  test('POST /dashboard/login with wrong password shows error', async () => {
    const app = createApp();
    const res = await request(app).post('/dashboard/login').send('password=wrong');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Invalid password');
  });

  test('POST /dashboard/login with correct password redirects to dashboard', async () => {
    const app = createApp();
    const res = await request(app).post('/dashboard/login').send('password=test123');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/dashboard');
  });

  test('authenticated user can access dashboard', async () => {
    const app = createApp();
    const agent = request.agent(app);
    await agent.post('/dashboard/login').send('password=test123');
    const res = await agent.get('/dashboard');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Total Calls');
    expect(res.text).toContain('10');
  });

  test('authenticated user can access call log', async () => {
    const app = createApp();
    const agent = request.agent(app);
    await agent.post('/dashboard/login').send('password=test123');
    const res = await agent.get('/dashboard/calls');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Jane');
  });

  test('authenticated user can access call detail', async () => {
    const app = createApp();
    const agent = request.agent(app);
    await agent.post('/dashboard/login').send('password=test123');
    const res = await agent.get('/dashboard/calls/1');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Hi Jane...');
  });
});
