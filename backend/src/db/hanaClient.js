const hdb = require('hdb');
const genericPool = require('generic-pool');
const hanaConfig = require('../config/hanaConfig');
const logger = require('../utils/logger');

// Circuit breaker state
let isHanaOnline = true;
let lastFailureTimestamp = 0;
const RETRY_INTERVAL_MS = 30000; // Retry HANA connection every 30s when offline

function shouldAttemptHana() {
  if (isHanaOnline) return true;
  if (Date.now() - lastFailureTimestamp > RETRY_INTERVAL_MS) {
    logger.info('[HANA] Circuit breaker half-open: attempting reconnection to HANA Cloud...');
    return true;
  }
  return false;
}

function recordHanaFailure(err) {
  isHanaOnline = false;
  lastFailureTimestamp = Date.now();
  logger.warn(`[HANA] HANA Cloud unavailable (${err.message}). Circuit breaker active for 30s.`);
}

function createConnection() {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error('HANA connection timeout (2500ms exceeded)'));
      }
    }, 2500);

    const client = hdb.createClient({
      host: hanaConfig.host,
      port: hanaConfig.port,
      user: hanaConfig.user,
      password: hanaConfig.password,
      encrypt: hanaConfig.encrypt,
      sslValidateCertificate: hanaConfig.sslValidateCertificate
    });

    client.on('error', (err) => {
      logger.error(`[HANA] Socket error: ${err.message}`);
    });

    client.connect((err) => {
      clearTimeout(timeout);
      if (settled) return;
      settled = true;
      if (err) {
        return reject(err);
      }
      isHanaOnline = true;
      resolve(client);
    });
  });
}

const pool = genericPool.createPool(
  {
    create: createConnection,
    destroy: (client) => new Promise((resolve) => client.end(resolve))
  },
  {
    min: 0, // Never keep idle connections open if server drops sockets
    max: hanaConfig.pool.max || 5,
    acquireTimeoutMillis: 2500,
    fifo: true
  }
);

async function query(sql, params = []) {
  if (!shouldAttemptHana()) {
    const err = new Error('HANA Cloud is offline (circuit breaker open)');
    err.code = 'HANA_OFFLINE';
    throw err;
  }

  let client;
  try {
    client = await pool.acquire();
  } catch (err) {
    recordHanaFailure(err);
    throw err;
  }

  try {
    if (!params || params.length === 0) {
      return await new Promise((resolve, reject) => {
        client.exec(sql, (err, rows) => (err ? reject(err) : resolve(rows)));
      });
    }

    return await new Promise((resolve, reject) => {
      client.prepare(sql, (err, statement) => {
        if (err) return reject(err);
        statement.exec(params, (err2, rows) => {
          if (err2) return reject(err2);
          resolve(rows);
        });
      });
    });
  } catch (err) {
    recordHanaFailure(err);
    throw err;
  } finally {
    if (client) {
      pool.release(client).catch(() => {});
    }
  }
}

async function exec(sql, params = []) {
  return query(sql, params);
}

async function transaction(fn) {
  if (!shouldAttemptHana()) {
    const err = new Error('HANA Cloud is offline (circuit breaker open)');
    err.code = 'HANA_OFFLINE';
    throw err;
  }

  const client = await pool.acquire();
  try {
    await new Promise((res, rej) => client.setAutoCommit(false, (err) => (err ? rej(err) : res())));

    const runStatement = (sql, params = []) => {
      if (!params || params.length === 0) {
        return new Promise((resolve, reject) => {
          client.exec(sql, (err, rows) => (err ? reject(err) : resolve(rows)));
        });
      }
      return new Promise((resolve, reject) => {
        client.prepare(sql, (err, statement) => {
          if (err) return reject(err);
          statement.exec(params, (err2, rows) => (err2 ? reject(err2) : resolve(rows)));
        });
      });
    };

    const result = await fn({ exec: runStatement });
    await new Promise((res, rej) => client.commit((err) => (err ? rej(err) : res())));
    return result;
  } catch (err) {
    recordHanaFailure(err);
    await new Promise((res) => client.rollback(() => res())).catch(() => {});
    throw err;
  } finally {
    await new Promise((res) => client.setAutoCommit(true, (err) => (err ? rej(err) : res()))).catch(() => {});
    pool.release(client).catch(() => {});
  }
}

function isAvailable() {
  return isHanaOnline && (Date.now() - lastFailureTimestamp > RETRY_INTERVAL_MS);
}

module.exports = { query, exec, transaction, pool, isAvailable };