const logger = require('../utils/logger');
const HanaAdapter = require('../db/HanaAdapter');

let activeAdapter = null;

/**
 * Instantiate and configure the database adapter
 */
function createAdapter() {
  const dbType = (process.env.DB_TYPE || 'hana').toLowerCase();

  if (dbType === 'hana') {
    logger.info('[Database] Initializing SAP HANA Cloud Adapter');
    return new HanaAdapter();
  }

  logger.info(`[Database] Initializing Database Adapter: ${dbType}`);
  return new HanaAdapter();
}

/**
 * Initialize database connection and schemas
 */
async function initDatabase() {
  if (!activeAdapter) {
    activeAdapter = createAdapter();
  }

  try {
    await activeAdapter.connect();
    await activeAdapter.initSchema();
    logger.info(`[Database] Database ready using adapter: ${activeAdapter.name}`);
    return activeAdapter;
  } catch (err) {
    logger.error(`[Database] Database initialization failed: ${err.message}`);
    throw err;
  }
}

/**
 * Returns the currently active database adapter instance
 */
function getDb() {
  if (!activeAdapter) {
    activeAdapter = createAdapter();
  }
  return activeAdapter;
}

/**
 * Set active adapter instance (e.g. for testing)
 */
function setDb(adapter) {
  activeAdapter = adapter;
}

/**
 * Disconnect and cleanup database connection
 */
async function closeDatabase() {
  if (activeAdapter) {
    await activeAdapter.disconnect();
    activeAdapter = null;
  }
}

module.exports = {
  initDatabase,
  getDb,
  setDb,
  closeDatabase,
  HanaAdapter
};
