/**
 * Abstract DatabaseAdapter
 * Any database implementation (SAP HANA Cloud, PostgreSQL, MongoDB, SQLite, etc.)
 * must inherit from this class and implement its asynchronous contract.
 */
class DatabaseAdapter {
  constructor(name = 'Generic') {
    this.name = name;
  }

  /**
   * Establish connection to the database
   * @returns {Promise<void>}
   */
  async connect() {
    throw new Error(`[${this.name}Adapter] connect() not implemented`);
  }

  /**
   * Close connection to the database
   * @returns {Promise<void>}
   */
  async disconnect() {
    throw new Error(`[${this.name}Adapter] disconnect() not implemented`);
  }

  /**
   * Check if database is currently connected
   * @returns {boolean}
   */
  isConnected() {
    throw new Error(`[${this.name}Adapter] isConnected() not implemented`);
  }

  /**
   * Initialize schemas, tables, and indices if they do not exist
   * @returns {Promise<void>}
   */
  async initSchema() {
    throw new Error(`[${this.name}Adapter] initSchema() not implemented`);
  }

  /**
   * Insert a new record into a table
   * @param {string} table Table name (e.g. 'users', 'tenants', 'tickets')
   * @param {Object} data Record object
   * @returns {Promise<Object>} Inserted record
   */
  async insert(table, data) {
    throw new Error(`[${this.name}Adapter] insert() not implemented`);
  }

  /**
   * Find a single record matching the filter
   * @param {string} table Table name
   * @param {Object} filter Key-value filter criteria
   * @returns {Promise<Object|null>} Found record or null
   */
  async findOne(table, filter) {
    throw new Error(`[${this.name}Adapter] findOne() not implemented`);
  }

  /**
   * Find records matching the filter with optional sorting, limit, and offset
   * @param {string} table Table name
   * @param {Object} [filter={}] Key-value filter criteria
   * @param {Object} [options={}] Options: { sort: { field: 1|-1 }, limit: number, offset: number }
   * @returns {Promise<Array<Object>>} Matching records
   */
  async find(table, filter = {}, options = {}) {
    throw new Error(`[${this.name}Adapter] find() not implemented`);
  }

  /**
   * Update records matching the filter with new data
   * @param {string} table Table name
   * @param {Object} filter Key-value filter criteria
   * @param {Object} data Fields to update
   * @returns {Promise<Object|null>} Updated record or null
   */
  async update(table, filter, data) {
    throw new Error(`[${this.name}Adapter] update() not implemented`);
  }

  /**
   * Remove records matching the filter
   * @param {string} table Table name
   * @param {Object} filter Key-value filter criteria
   * @returns {Promise<boolean>} True if removed, false otherwise
   */
  async remove(table, filter) {
    throw new Error(`[${this.name}Adapter] remove() not implemented`);
  }

  /**
   * Count records matching the filter
   * @param {string} table Table name
   * @param {Object} [filter={}] Key-value filter criteria
   * @returns {Promise<number>} Count of records
   */
  async count(table, filter = {}) {
    throw new Error(`[${this.name}Adapter] count() not implemented`);
  }

  /**
   * Execute raw query (database-specific)
   * @param {string} query SQL query string
   * @param {Array<any>} [params=[]] Query parameters
   * @returns {Promise<any>}
   */
  async rawQuery(query, params = []) {
    throw new Error(`[${this.name}Adapter] rawQuery() not implemented`);
  }
}

module.exports = DatabaseAdapter;