const { AsyncLocalStorage } = require('async_hooks');
const storage = new AsyncLocalStorage();

function run(context, callback) {
  return storage.run(context, callback);
}

// Convenience: resolve a user's active tenant creds and run callback inside
// that context in one step — used by routes that call sapCpiService directly.
async function runForUser(userId, callback) {
  const tenantStore = require('./tenantStore');
  const creds = await tenantStore.getActiveTenantCredentials(userId);
  return storage.run({ userId, creds }, callback);
}

function getContext() {
  return storage.getStore();
}

module.exports = { run, runForUser, getContext };