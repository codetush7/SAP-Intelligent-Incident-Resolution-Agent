const DatabaseAdapter = require('../db/DatabaseAdapter');
const { setDb, getDb, HanaAdapter } = require('../config/database');

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

// Set mock adapter before loading stores
setDb(new MockDatabaseAdapter());

const userStore = require('../utils/userStore');
const tenantStore = require('../utils/tenantStore');
const jiraStore = require('../utils/jiraStore');
const dataStore = require('../utils/dataStore');
const { signToken } = require('../middleware/authMiddleware');
const jwt = require('jsonwebtoken');

describe('Database Agnostic Layer & Stores', () => {
  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-jwt-secret-key-12345';
    process.env.ENCRYPTION_KEY = 'test-encryption-key-12345';
  });

  describe('Database Adapters Interface Compliance', () => {
    it('HanaAdapter should properly format HANA table names and column case conversions', () => {
      const hana = new HanaAdapter({ host: 'localhost', user: 'DBADMIN', schema: 'TEST_SCHEMA' });
      expect(hana._getTableName('users')).toBe('"TEST_SCHEMA"."USERS"');
      expect(hana._getTableName('jira_configs')).toBe('"TEST_SCHEMA"."JIRA_CONFIGS"');

      const dbRow = hana._recordToDb({
        userId: 'u123',
        clientSecretEnc: 'enc_sec',
        isActive: true,
        payload: { foo: 'bar' }
      });
      expect(dbRow.USER_ID).toBe('u123');
      expect(dbRow.CLIENT_SECRET_ENC).toBe('enc_sec');
      expect(dbRow.IS_ACTIVE).toBe(true);
      expect(dbRow.PAYLOAD).toBe(JSON.stringify({ foo: 'bar' }));

      const record = hana._dbToRecord({
        USER_ID: 'u123',
        CLIENT_SECRET_ENC: 'enc_sec',
        IS_ACTIVE: 1,
        PAYLOAD: JSON.stringify({ foo: 'bar' })
      });
      expect(record.userId).toBe('u123');
      expect(record.clientSecretEnc).toBe('enc_sec');
      expect(record.isActive).toBe(true);
      expect(record.payload).toEqual({ foo: 'bar' });
    });
  });

  describe('UserStore with Database Persistence & Password Hashing', () => {
    let createdUser;

    it('should create an initial user as admin and hash password', async () => {
      createdUser = await userStore.create({
        name: 'Admin User',
        email: 'admin@example.com',
        password: 'Password@123'
      });

      expect(createdUser.id).toBeDefined();
      expect(createdUser.email).toBe('admin@example.com');
      expect(createdUser.role).toBe('admin');
      expect(createdUser.passwordHash).not.toBe('Password@123');

      const isValid = await userStore.verifyPassword(createdUser, 'Password@123');
      expect(isValid).toBe(true);

      const isInvalid = await userStore.verifyPassword(createdUser, 'WrongPassword');
      expect(isInvalid).toBe(false);
    });

    it('should reject duplicate email registration', async () => {
      await expect(
        userStore.create({
          name: 'Duplicate Admin',
          email: 'ADMIN@example.com',
          password: 'Password@123'
        })
      ).rejects.toThrow('An account with this email already exists.');
    });

    it('should create subsequent users as regular user role', async () => {
      const user2 = await userStore.create({
        name: 'Jane Doe',
        email: 'jane@example.com',
        password: 'Password@456'
      });
      expect(user2.role).toBe('user');
    });

    it('should find user by email and id', async () => {
      const foundByEmail = await userStore.findByEmail('admin@example.com');
      expect(foundByEmail.id).toBe(createdUser.id);

      const foundById = await userStore.findById(createdUser.id);
      expect(foundById.email).toBe('admin@example.com');
    });

    it('should sign and verify JWT token', () => {
      const token = signToken(createdUser);
      expect(token).toBeDefined();

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      expect(decoded.sub).toBe(createdUser.id);
      expect(decoded.email).toBe(createdUser.email);
    });
  });

  describe('TenantStore with Secret Encryption & DB Scoping', () => {
    let user;
    let tenant1;
    let tenant2;

    beforeAll(async () => {
      user = await userStore.findByEmail('admin@example.com');
    });

    it('should create tenant and encrypt clientSecret', async () => {
      tenant1 = await tenantStore.create(user.id, {
        name: 'SAP Dev CPI Tenant',
        environment: 'DEV',
        baseUrl: 'https://dev-tenant.it-cpi.cfapps.sap.hana.ondemand.com',
        tokenUrl: 'https://dev-subaccount.authentication.sap.hana.ondemand.com/oauth/token',
        clientId: 'client-id-123',
        clientSecret: 'super-secret-client-secret-999'
      });

      expect(tenant1.id).toBeDefined();
      expect(tenant1.clientSecretEnc).toBeDefined();
      expect(tenant1.clientSecretEnc).not.toBe('super-secret-client-secret-999');
      expect(tenant1.isActive).toBe(true);

      const creds = await tenantStore.getDecryptedCredentials(tenant1.id, user.id);
      expect(creds.clientSecret).toBe('super-secret-client-secret-999');
      expect(creds.baseUrl).toBe('https://dev-tenant.it-cpi.cfapps.sap.hana.ondemand.com');
    });

    it('should create second tenant and manage active tenant switching', async () => {
      tenant2 = await tenantStore.create(user.id, {
        name: 'SAP QA CPI Tenant',
        environment: 'QA',
        baseUrl: 'https://qa-tenant.it-cpi.cfapps.sap.hana.ondemand.com',
        tokenUrl: 'https://qa-subaccount.authentication.sap.hana.ondemand.com/oauth/token',
        clientId: 'client-id-qa',
        clientSecret: 'qa-secret-888'
      });

      expect(tenant2.isActive).toBe(false);

      await tenantStore.setActive(tenant2.id, user.id);

      const activeCreds = await tenantStore.getActiveTenantCredentials(user.id);
      expect(activeCreds.id).toBe(tenant2.id);
      expect(activeCreds.clientSecret).toBe('qa-secret-888');
    });

    it('should list tenants with masked secrets for public output', async () => {
      const list = await tenantStore.getAll(user.id);
      expect(list.length).toBe(2);
      expect(list[0].clientSecret).toBe('••••••••••••');
      expect(list[1].clientSecret).toBe('••••••••••••');
    });
  });

  describe('JiraStore with Secret Encryption & DB Persistence', () => {
    let user;

    beforeAll(async () => {
      user = await userStore.findByEmail('admin@example.com');
    });

    it('should save Jira configuration with encrypted API token', async () => {
      await jiraStore.save(user.id, {
        baseUrl: 'https://myorg.atlassian.net',
        email: 'jira-user@myorg.com',
        apiToken: 'jira-secret-api-token-777',
        projectKey: 'CPI'
      });

      expect(await jiraStore.isConfigured(user.id)).toBe(true);

      const creds = await jiraStore.getCredentials(user.id);
      expect(creds.apiToken).toBe('jira-secret-api-token-777');
      expect(creds.email).toBe('jira-user@myorg.com');
      expect(creds.projectKey).toBe('CPI');

      const publicConfig = await jiraStore.toPublic(user.id);
      expect(publicConfig.apiToken).toBe('••••••••••••');
    });
  });

  describe('DataStore (Tickets, Alerts, Logs) DB Persistence', () => {
    let user;
    let ticket;

    beforeAll(async () => {
      user = await userStore.findByEmail('admin@example.com');
    });

    it('should create tickets and prevent duplicates based on fingerprint', async () => {
      ticket = await dataStore.createTicket(user.id, {
        title: 'HTTP 500 in Order Processing',
        errorCode: 'HTTP_500',
        iflow: 'Order_Processing_iFlow',
        interface: 'SAP ECC',
        priority: 'HIGH',
        category: 'API_CONNECTIVITY',
        errorMessage: 'Backend 500 Internal Server Error',
        aiAnalyzed: true
      });

      expect(ticket.id).toBeDefined();
      expect(ticket.ticketNumber).toMatch(/^CPI-/);
      expect(ticket.status).toBe('OPEN');

      const dup = await dataStore.createTicket(user.id, {
        title: 'HTTP 500 in Order Processing',
        errorCode: 'HTTP_500',
        iflow: 'Order_Processing_iFlow',
        interface: 'SAP ECC',
        priority: 'HIGH',
        category: 'API_CONNECTIVITY',
        errorMessage: 'Backend 500 Internal Server Error'
      });

      expect(dup.id).toBe(ticket.id);
    });

    it('should update and query tickets from database', async () => {
      await dataStore.updateTicket(ticket.id, user.id, {
        status: 'RESOLVED',
        resolutionNotes: 'Restarted receiver adapter channel.'
      });

      const updated = await dataStore.getTicketById(ticket.id, user.id);
      expect(updated.status).toBe('RESOLVED');
      expect(updated.resolutionNotes).toBe('Restarted receiver adapter channel.');
    });

    it('should record alerts, monitoring logs, and compute statistics from DB', async () => {
      const alert = await dataStore.addAlert(user.id, {
        type: 'HTTP_500',
        severity: 'HIGH',
        message: 'High error rate detected'
      });
      expect(alert.id).toBeDefined();
      expect(alert.acknowledged).toBe(false);

      await dataStore.acknowledgeAlert(user.id, alert.id);
      const alerts = await dataStore.getAlerts(user.id);
      const ackAlert = alerts.find(a => a.id === alert.id);
      expect(ackAlert.acknowledged).toBe(true);

      await dataStore.addMonitoringLog(user.id, {
        type: 'CHECK',
        message: 'Monitoring cycle completed',
        status: 'OK'
      });

      const logs = await dataStore.getMonitoringLogs(user.id);
      expect(logs.length).toBeGreaterThan(0);

      const stats = await dataStore.getStats(user.id);
      expect(stats.total).toBeGreaterThan(0);
      expect(stats.resolved).toBeGreaterThan(0);
    });
  });
});
