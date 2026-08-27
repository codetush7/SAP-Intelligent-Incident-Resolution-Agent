const logger = require('../utils/logger');
const DatabaseAdapter = require('./DatabaseAdapter');

const TABLE_NAMES = {
  users: 'USERS',
  tenants: 'TENANTS',
  jira_configs: 'JIRA_CONFIGS',
  jiraconfigs: 'JIRA_CONFIGS',
  jira: 'JIRA_CONFIGS',
  tickets: 'TICKETS',
  alerts: 'ALERTS',
  monitoring_logs: 'MONITORING_LOGS',
  monitoringlogs: 'MONITORING_LOGS',
  agent_logs: 'AGENT_LOGS',
  agentlogs: 'AGENT_LOGS'
};

const JSON_FIELDS = new Set(['payload', 'details', 'lastError']);
const BOOLEAN_FIELDS = new Set(['isActive', 'acknowledged', 'aiAnalyzed', 'fixApplied']);

function toSnakeCase(str) {
  return str
    .replace(/([A-Z])/g, '_$1')
    .toUpperCase()
    .replace(/^_/, '');
}

function toCamelCase(str) {
  return str
    .toLowerCase()
    .replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

class HanaAdapter extends DatabaseAdapter {
  constructor(config = {}) {
    super('HANA');
    this.config = this._resolveConfig(config);
    this.client = null;
    this.connected = false;
    this.hanaClientModule = null;
  }

  _resolveConfig(customConfig = {}) {
    let btpCredentials = {};
    if (process.env.VCAP_SERVICES) {
      try {
        const vcap = JSON.parse(process.env.VCAP_SERVICES);
        const hanaService = vcap['hanatrial'] || vcap['hana'] || vcap['hana-cloud'];
        if (hanaService && hanaService[0]?.credentials) {
          btpCredentials = hanaService[0].credentials;
        }
      } catch (e) {
        logger.warn('[HanaAdapter] Could not parse VCAP_SERVICES: ' + e.message);
      }
    }

    return {
      serverNode: customConfig.serverNode || process.env.HANA_HOST
        ? `${process.env.HANA_HOST}:${process.env.HANA_PORT || 443}`
        : btpCredentials.host ? `${btpCredentials.host}:${btpCredentials.port || 443}` : null,
      host: customConfig.host || process.env.HANA_HOST || btpCredentials.host || null,
      port: customConfig.port || parseInt(process.env.HANA_PORT, 10) || btpCredentials.port || 443,
      uid: customConfig.user || process.env.HANA_USER || btpCredentials.user || 'DBADMIN',
      pwd: customConfig.password || process.env.HANA_PASSWORD || btpCredentials.password || '',
      currentSchema: customConfig.schema || process.env.HANA_SCHEMA || btpCredentials.schema || 'SAP_CPI_AGENT',
      encrypt: customConfig.encrypt !== undefined ? customConfig.encrypt : (process.env.HANA_ENCRYPT !== 'false'),
      sslValidateCertificate: customConfig.sslValidateCertificate !== undefined
        ? customConfig.sslValidateCertificate
        : (process.env.HANA_SSL_VALIDATE_CERTIFICATE === 'true'),
      sslHostNameInCertificate: customConfig.sslHostNameInCertificate || process.env.HANA_SSL_HOSTNAME_IN_CERTIFICATE || '*.hanacloud.ondemand.com',
      pooling: true,
      maxPoolSize: 20
    };
  }

  async connect() {
    if (this.connected && this.client) return;

    try {
      this.hanaClientModule = require('@sap/hana-client');
    } catch (err) {
      logger.error(`[HanaAdapter] @sap/hana-client module could not be loaded: ${err.message}`);
      throw new Error(`@sap/hana-client module not available: ${err.message}`);
    }

    const connParams = {
      serverNode: this.config.serverNode || `${this.config.host}:${this.config.port}`,
      uid: this.config.uid,
      pwd: this.config.pwd,
      encrypt: this.config.encrypt ? 'TRUE' : 'FALSE',
      sslValidateCertificate: this.config.sslValidateCertificate ? 'TRUE' : 'FALSE',
      sslHostNameInCertificate: this.config.sslHostNameInCertificate || '*.hanacloud.ondemand.com'
    };

    if (this.config.currentSchema) {
      connParams.currentSchema = this.config.currentSchema;
    }

    logger.info(`[HanaAdapter] Connecting to SAP HANA Cloud at ${connParams.serverNode}...`);

    return new Promise((resolve, reject) => {
      const client = this.hanaClientModule.createConnection();
      client.connect(connParams, (err) => {
        if (err) {
          logger.error(`[HanaAdapter] Connection to SAP HANA Cloud failed: ${err.message}`);
          this.connected = false;
          this.client = null;
          return reject(err);
        }
        this.client = client;
        this.connected = true;
        logger.info(`[HanaAdapter] Successfully connected to SAP HANA Cloud (${connParams.serverNode})`);
        resolve();
      });
    });
  }

  async disconnect() {
    if (!this.client || !this.connected) return;
    return new Promise((resolve) => {
      this.client.disconnect(() => {
        this.connected = false;
        this.client = null;
        logger.info('[HanaAdapter] Disconnected from SAP HANA Cloud');
        resolve();
      });
    });
  }

  isConnected() {
    return this.connected && this.client !== null;
  }

  async rawQuery(sql, params = [], options = {}) {
    if (!this.isConnected()) {
      await this.connect();
    }

    return new Promise((resolve, reject) => {
      this.client.exec(sql, params, (err, rows) => {
        if (err) {
          if (!options.silent) {
            logger.error(`[HanaAdapter] Query Error: ${err.message} | SQL: ${sql}`);
          }
          return reject(err);
        }
        resolve(rows || []);
      });
    });
  }

  _getTableName(table) {
    const key = String(table).toLowerCase();
    const resolved = TABLE_NAMES[key] || TABLE_NAMES[table] || String(table).toUpperCase();
    if (this.config.currentSchema) {
      return `"${this.config.currentSchema}"."${resolved}"`;
    }
    return `"${resolved}"`;
  }

  _recordToDb(data) {
    const dbRow = {};
    for (const [key, value] of Object.entries(data)) {
      const col = toSnakeCase(key);
      if (value === undefined) continue;

      if (JSON_FIELDS.has(key) && value !== null && typeof value === 'object') {
        dbRow[col] = JSON.stringify(value);
      } else if (BOOLEAN_FIELDS.has(key) && value !== null) {
        dbRow[col] = Boolean(value);
      } else {
        dbRow[col] = value;
      }
    }
    return dbRow;
  }

  _dbToRecord(row) {
    if (!row) return null;
    const record = {};
    for (const [col, val] of Object.entries(row)) {
      const key = toCamelCase(col);
      if (JSON_FIELDS.has(key) && typeof val === 'string') {
        try {
          record[key] = JSON.parse(val);
        } catch {
          record[key] = val;
        }
      } else if (BOOLEAN_FIELDS.has(key)) {
        record[key] = Boolean(val);
      } else {
        record[key] = val;
      }
    }
    return record;
  }

  async initSchema() {
    logger.info('[HanaAdapter] Initializing SAP HANA database schema and tables...');
    const schema = this.config.currentSchema || 'SAP_CPI_AGENT';

    // 1. Create Schema if needed
    try {
      await this.rawQuery(`CREATE SCHEMA "${schema}"`, [], { silent: true });
      logger.info(`[HanaAdapter] Schema "${schema}" created`);
    } catch {
      // Schema already exists
    }

    // 2. Create Tables
    const ddlStatements = [
      // USERS Table
      `CREATE TABLE "${schema}"."USERS" (
        "ID" VARCHAR(64) PRIMARY KEY,
        "NAME" NVARCHAR(255) NOT NULL,
        "EMAIL" NVARCHAR(255) NOT NULL UNIQUE,
        "PASSWORD_HASH" NVARCHAR(255) NOT NULL,
        "ROLE" NVARCHAR(50) DEFAULT 'user',
        "CREATED_AT" VARCHAR(64),
        "UPDATED_AT" VARCHAR(64)
      )`,

      // TENANTS Table
      `CREATE TABLE "${schema}"."TENANTS" (
        "ID" VARCHAR(64) PRIMARY KEY,
        "USER_ID" VARCHAR(64) NOT NULL,
        "NAME" NVARCHAR(255) NOT NULL,
        "ENVIRONMENT" VARCHAR(50) DEFAULT 'DEV',
        "BASE_URL" NVARCHAR(1000) NOT NULL,
        "TOKEN_URL" NVARCHAR(1000) NOT NULL,
        "CLIENT_ID" NVARCHAR(255) NOT NULL,
        "CLIENT_SECRET_ENC" NCLOB NOT NULL,
        "STATUS" VARCHAR(50) DEFAULT 'UNTESTED',
        "LAST_TESTED_AT" VARCHAR(64),
        "LAST_ERROR" NCLOB,
        "IS_ACTIVE" BOOLEAN DEFAULT FALSE,
        "CREATED_AT" VARCHAR(64),
        "UPDATED_AT" VARCHAR(64)
      )`,

      // JIRA_CONFIGS Table
      `CREATE TABLE "${schema}"."JIRA_CONFIGS" (
        "ID" VARCHAR(64) PRIMARY KEY,
        "USER_ID" VARCHAR(64) NOT NULL UNIQUE,
        "BASE_URL" NVARCHAR(1000) NOT NULL,
        "EMAIL" NVARCHAR(255) NOT NULL,
        "API_TOKEN_ENC" NCLOB NOT NULL,
        "PROJECT_KEY" VARCHAR(50) DEFAULT 'CPI',
        "STATUS" VARCHAR(50) DEFAULT 'UNTESTED',
        "LAST_TESTED_AT" VARCHAR(64),
        "LAST_ERROR" NCLOB,
        "CREATED_AT" VARCHAR(64),
        "UPDATED_AT" VARCHAR(64)
      )`,

      // TICKETS Table
      `CREATE TABLE "${schema}"."TICKETS" (
        "ID" VARCHAR(64) PRIMARY KEY,
        "USER_ID" VARCHAR(64) NOT NULL,
        "TICKET_NUMBER" VARCHAR(100) NOT NULL,
        "TITLE" NVARCHAR(500) NOT NULL,
        "DESCRIPTION" NCLOB,
        "INTERFACE" NVARCHAR(255),
        "IFLOW" NVARCHAR(255),
        "IFLOW_ID" NVARCHAR(255),
        "PACKAGE_ID" NVARCHAR(255),
        "PACKAGE_NAME" NVARCHAR(255),
        "SENDER" NVARCHAR(255),
        "RECEIVER" NVARCHAR(255),
        "CORRELATION_ID" NVARCHAR(255),
        "STATUS" VARCHAR(50) DEFAULT 'OPEN',
        "PRIORITY" VARCHAR(50) DEFAULT 'MEDIUM',
        "CATEGORY" VARCHAR(50) DEFAULT 'GENERAL',
        "ERROR_CODE" VARCHAR(100),
        "ERROR_ID" VARCHAR(255),
        "ERROR_MESSAGE" NCLOB,
        "ISSUE_FINGERPRINT" VARCHAR(255),
        "AI_ANALYZED" BOOLEAN DEFAULT FALSE,
        "AI_SUMMARY" NCLOB,
        "ROOT_CAUSE" NCLOB,
        "SUGGESTED_FIX" NCLOB,
        "RESOLUTION_NOTES" NCLOB,
        "SYSTEM_SOURCE" VARCHAR(100),
        "ASSIGNED_TEAM" NVARCHAR(255),
        "FIX_APPLIED" BOOLEAN DEFAULT FALSE,
        "FIX_REQUESTED_AT" VARCHAR(64),
        "FIX_RESULT_MESSAGE" NCLOB,
        "JIRA_ID" VARCHAR(255),
        "JIRA_KEY" VARCHAR(255),
        "JIRA_URL" NVARCHAR(1000),
        "PAYLOAD" NCLOB,
        "CREATED_AT" VARCHAR(64),
        "UPDATED_AT" VARCHAR(64)
      )`,

      // ALERTS Table
      `CREATE TABLE "${schema}"."ALERTS" (
        "ID" VARCHAR(64) PRIMARY KEY,
        "USER_ID" VARCHAR(64) NOT NULL,
        "TYPE" VARCHAR(100),
        "SEVERITY" VARCHAR(50),
        "MESSAGE" NCLOB,
        "DETAILS" NCLOB,
        "ACKNOWLEDGED" BOOLEAN DEFAULT FALSE,
        "TIMESTAMP" VARCHAR(64)
      )`,

      // MONITORING_LOGS Table
      `CREATE TABLE "${schema}"."MONITORING_LOGS" (
        "ID" VARCHAR(64) PRIMARY KEY,
        "USER_ID" VARCHAR(64) NOT NULL,
        "TYPE" VARCHAR(100),
        "MESSAGE" NCLOB,
        "MESSAGE_ID" VARCHAR(255),
        "IFLOW" NVARCHAR(255),
        "STATUS" VARCHAR(50),
        "ERROR" NCLOB,
        "DETAILS" NCLOB,
        "TIMESTAMP" VARCHAR(64)
      )`,

      // AGENT_LOGS Table
      `CREATE TABLE "${schema}"."AGENT_LOGS" (
        "ID" VARCHAR(64) PRIMARY KEY,
        "USER_ID" VARCHAR(64) NOT NULL,
        "ACTION" VARCHAR(100),
        "TICKET_ID" VARCHAR(64),
        "TICKET_NUMBER" VARCHAR(100),
        "ERROR_CODE" VARCHAR(100),
        "MESSAGE" NCLOB,
        "DETAILS" NCLOB,
        "TIMESTAMP" VARCHAR(64)
      )`
    ];

    for (const ddl of ddlStatements) {
      try {
        await this.rawQuery(ddl, [], { silent: true });
      } catch {
        // Table already exists
      }
    }

    // 3. Automatic Column Migrations (adds missing columns if tables were created previously)
    const migrations = [
      `ALTER TABLE "${schema}"."MONITORING_LOGS" ADD ("TYPE" VARCHAR(100))`,
      `ALTER TABLE "${schema}"."MONITORING_LOGS" ADD ("MESSAGE" NCLOB)`,
      `ALTER TABLE "${schema}"."TICKETS" ADD ("ISSUE_FINGERPRINT" VARCHAR(255))`,
      `ALTER TABLE "${schema}"."TICKETS" ADD ("PAYLOAD" NCLOB)`
    ];

    for (const mig of migrations) {
      try {
        await this.rawQuery(mig, [], { silent: true });
      } catch {
        // Column already present
      }
    }

    logger.info('[HanaAdapter] Schema and tables initialized successfully');
  }

  async insert(table, data) {
    const tableName = this._getTableName(table);
    const dbRow = this._recordToDb(data);
    const columns = Object.keys(dbRow);
    const placeholders = columns.map(() => '?').join(', ');
    const sql = `INSERT INTO ${tableName} (${columns.map(c => `"${c}"`).join(', ')}) VALUES (${placeholders})`;
    const params = Object.values(dbRow);

    await this.rawQuery(sql, params);
    return data;
  }

  async findOne(table, filter = {}) {
    const results = await this.find(table, filter, { limit: 1 });
    return results.length > 0 ? results[0] : null;
  }

  async find(table, filter = {}, options = {}) {
    const tableName = this._getTableName(table);
    const whereClauses = [];
    const params = [];

    for (const [key, val] of Object.entries(filter)) {
      if (val === undefined) continue;
      const col = toSnakeCase(key);
      if (val === null) {
        whereClauses.push(`"${col}" IS NULL`);
      } else {
        if (key.toLowerCase() === 'email') {
          whereClauses.push(`LOWER("${col}") = LOWER(?)`);
        } else {
          whereClauses.push(`"${col}" = ?`);
        }
        params.push(BOOLEAN_FIELDS.has(key) ? Boolean(val) : val);
      }
    }

    let sql = `SELECT * FROM ${tableName}`;
    if (whereClauses.length > 0) {
      sql += ` WHERE ${whereClauses.join(' AND ')}`;
    }

    if (options.sort) {
      const sortParts = Object.entries(options.sort).map(([field, dir]) => {
        const col = toSnakeCase(field);
        return `"${col}" ${dir === -1 ? 'DESC' : 'ASC'}`;
      });
      sql += ` ORDER BY ${sortParts.join(', ')}`;
    }

    if (options.limit) {
      sql += ` LIMIT ${parseInt(options.limit, 10)}`;
    }

    const rows = await this.rawQuery(sql, params);
    return rows.map(r => this._dbToRecord(r));
  }

  async update(table, filter, data) {
    const tableName = this._getTableName(table);
    const dbRow = this._recordToDb(data);
    const updateClauses = [];
    const params = [];

    for (const [col, val] of Object.entries(dbRow)) {
      updateClauses.push(`"${col}" = ?`);
      params.push(val);
    }

    if (updateClauses.length === 0) return this.findOne(table, filter);

    const whereClauses = [];
    for (const [key, val] of Object.entries(filter)) {
      const col = toSnakeCase(key);
      whereClauses.push(`"${col}" = ?`);
      params.push(BOOLEAN_FIELDS.has(key) ? Boolean(val) : val);
    }

    const sql = `UPDATE ${tableName} SET ${updateClauses.join(', ')} WHERE ${whereClauses.join(' AND ')}`;
    await this.rawQuery(sql, params);
    return this.findOne(table, filter);
  }

  async remove(table, filter) {
    const tableName = this._getTableName(table);
    const whereClauses = [];
    const params = [];

    for (const [key, val] of Object.entries(filter)) {
      const col = toSnakeCase(key);
      whereClauses.push(`"${col}" = ?`);
      params.push(BOOLEAN_FIELDS.has(key) ? Boolean(val) : val);
    }

    if (whereClauses.length === 0) return false;

    const sql = `DELETE FROM ${tableName} WHERE ${whereClauses.join(' AND ')}`;
    await this.rawQuery(sql, params);
    return true;
  }

  async count(table, filter = {}) {
    const tableName = this._getTableName(table);
    const whereClauses = [];
    const params = [];

    for (const [key, val] of Object.entries(filter)) {
      if (val === undefined) continue;
      const col = toSnakeCase(key);
      if (val === null) {
        whereClauses.push(`"${col}" IS NULL`);
      } else {
        whereClauses.push(`"${col}" = ?`);
        params.push(BOOLEAN_FIELDS.has(key) ? Boolean(val) : val);
      }
    }

    let sql = `SELECT COUNT(*) AS "TOTAL" FROM ${tableName}`;
    if (whereClauses.length > 0) {
      sql += ` WHERE ${whereClauses.join(' AND ')}`;
    }

    const rows = await this.rawQuery(sql, params);
    if (rows && rows.length > 0) {
      return parseInt(rows[0].TOTAL || rows[0].total || 0, 10);
    }
    return 0;
  }
}

module.exports = HanaAdapter;
