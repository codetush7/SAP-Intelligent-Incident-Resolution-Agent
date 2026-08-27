const DatabaseAdapter = require('../db/DatabaseAdapter');
const { setDb } = require('../config/database');

class MockDatabaseAdapter extends DatabaseAdapter {
  constructor() {
    super('MockDB');
    this.tables = { users: [], tenants: [], jira_configs: [], tickets: [], alerts: [], monitoring_logs: [], agent_logs: [] };
    this.connected = true;
  }
  async connect() { this.connected = true; }
  async disconnect() { this.connected = false; }
  isConnected() { return this.connected; }
  async initSchema() {}
  _norm(t) {
    const k = String(t).toLowerCase().replace(/s$/, '');
    if (k === 'user') return 'users';
    if (k === 'tenant') return 'tenants';
    if (k === 'jira' || k === 'jira_config' || k === 'jiraconfig') return 'jira_configs';
    if (k === 'ticket') return 'tickets';
    if (k === 'alert') return 'alerts';
    if (k === 'monitoring_log' || k === 'monitoringlog') return 'monitoring_logs';
    if (k === 'agent_log' || k === 'agentlog') return 'agent_logs';
    return String(t).toLowerCase();
  }
  _match(item, filter) {
    for (const [k, v] of Object.entries(filter)) {
      if (v === undefined) continue;
      if (v === null && item[k] !== null && item[k] !== undefined) return false;
      if (v !== null) {
        if (k.toLowerCase() === 'email') {
          if (String(item[k] || '').toLowerCase() !== String(v).toLowerCase()) return false;
        } else if (item[k] !== v) return false;
      }
    }
    return true;
  }
  async insert(t, data) {
    const name = this._norm(t);
    if (!this.tables[name]) this.tables[name] = [];
    const copy = JSON.parse(JSON.stringify(data));
    this.tables[name].push(copy);
    return JSON.parse(JSON.stringify(copy));
  }
  async findOne(t, f = {}) {
    const res = await this.find(t, f, { limit: 1 });
    return res.length > 0 ? res[0] : null;
  }
  async find(t, f = {}, opt = {}) {
    const name = this._norm(t);
    const list = this.tables[name] || [];
    let matches = list.filter(i => this._match(i, f));
    if (opt.sort) {
      const [field, dir] = Object.entries(opt.sort)[0] || [];
      if (field) {
        matches.sort((a, b) => {
          if (a[field] < b[field]) return dir === -1 ? 1 : -1;
          if (a[field] > b[field]) return dir === -1 ? -1 : 1;
          return 0;
        });
      }
    }
    if (opt.limit) matches = matches.slice(0, parseInt(opt.limit, 10));
    return JSON.parse(JSON.stringify(matches));
  }
  async update(t, f, data) {
    const name = this._norm(t);
    const list = this.tables[name] || [];
    const idx = list.findIndex(i => this._match(i, f));
    if (idx === -1) return null;
    list[idx] = { ...list[idx], ...JSON.parse(JSON.stringify(data)), updatedAt: new Date().toISOString() };
    return JSON.parse(JSON.stringify(list[idx]));
  }
  async remove(t, f) {
    const name = this._norm(t);
    const list = this.tables[name] || [];
    const initLen = list.length;
    this.tables[name] = list.filter(i => !this._match(i, f));
    return this.tables[name].length < initLen;
  }
  async count(t, f = {}) {
    const name = this._norm(t);
    const list = this.tables[name] || [];
    return list.filter(i => this._match(i, f)).length;
  }
}

// Set DB before requiring app/server
process.env.JWT_SECRET = 'test-api-jwt-secret-2026';
process.env.ENCRYPTION_KEY = 'test-api-encryption-key-2026';
setDb(new MockDatabaseAdapter());

const request = require('supertest');
const { app } = require('../server');

describe('API Endpoints Integration with DB & JWT Auth', () => {
  let authToken;
  let userId;

  it('GET /health should return 200 and report DB status', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body.database).toBeDefined();
    expect(res.body.database.connected).toBe(true);
  });

  it('POST /api/auth/signup should create user, return JWT and user profile', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({
        name: 'Test Engineer',
        email: 'engineer@sap.com',
        password: 'Password@2026',
        confirmPassword: 'Password@2026'
      });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe('engineer@sap.com');
    expect(res.body.user.role).toBe('admin');

    authToken = res.body.token;
    userId = res.body.user.id;
  });

  it('POST /api/auth/login should authenticate and return JWT token', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'engineer@sap.com',
        password: 'Password@2026'
      });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.id).toBe(userId);
  });

  it('GET /api/auth/me should return authenticated user profile', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('engineer@sap.com');
  });

  it('GET /api/tenants without token should return 401', async () => {
    const res = await request(app).get('/api/tenants');
    expect(res.status).toBe(401);
  });

  it('POST /api/tickets should create a new ticket in DB', async () => {
    const res = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        title: 'Salesforce Outbound 401',
        description: 'Bearer token expired for outbound Salesforce endpoint',
        priority: 'HIGH',
        category: 'API_CONNECTIVITY',
        interface: 'Salesforce',
        iflow: 'SF_Order_Sync_v2',
        errorCode: 'HTTP_401'
      });

    expect(res.status).toBe(201);
    expect(res.body.ticketNumber).toMatch(/^CPI-/);
    expect(res.body.title).toBe('Salesforce Outbound 401');
    expect(res.body.status).toBe('OPEN');
  });

  it('GET /api/tickets should return list of tickets for authenticated user', async () => {
    const res = await request(app)
      .get('/api/tickets')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0].title).toBe('Salesforce Outbound 401');
  });

  it('GET /api/dashboard/stats should return computed metrics from DB', async () => {
    const res = await request(app)
      .get('/api/dashboard/stats')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.tickets).toBeDefined();
    expect(res.body.tickets.total).toBeGreaterThan(0);
    expect(res.body.monitoring).toBeDefined();
    expect(res.body.categories).toBeDefined();
  });
});
