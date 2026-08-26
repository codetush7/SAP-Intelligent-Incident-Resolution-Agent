const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const logger = require('./logger');
const fileStore = require('./fileStore');

const RAW_KEY = process.env.TENANT_ENCRYPTION_KEY || 'dev-only-insecure-key-change-me!';
const KEY = crypto.createHash('sha256').update(RAW_KEY).digest();
const IV_LENGTH = 16;

if (!process.env.TENANT_ENCRYPTION_KEY) {
  logger.warn('[TenantStore] TENANT_ENCRYPTION_KEY not set — using an insecure default. Set it in backend/.env for production.');
}

function encrypt(text) {
  if (!text) return '';
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', KEY, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
}

function decrypt(payload) {
  if (!payload) return '';
  try {
    const [ivHex, dataHex] = payload.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', KEY, iv);
    const decrypted = Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]);
    return decrypted.toString('utf8');
  } catch (err) {
    logger.error('[TenantStore] Failed to decrypt client secret: ' + err.message);
    return '';
  }
}

// ─── Persisted, per-user store ────────────────────────────────────────────────
// Shape: { tenants: [...], activeTenantIdByUser: { [userId]: tenantId } }
const persisted = fileStore.load('tenants', { tenants: [], activeTenantIdByUser: {} });
const tenants = persisted.tenants;
const activeTenantIdByUser = persisted.activeTenantIdByUser;

function persist() { fileStore.save('tenants', { tenants, activeTenantIdByUser }); }

function maskSecret() { return '••••••••••••'; }

function toPublic(tenant, userId) {
  if (!tenant) return null;
  return {
    id: tenant.id,
    name: tenant.name,
    environment: tenant.environment,
    baseUrl: tenant.baseUrl,
    tokenUrl: tenant.tokenUrl,
    clientId: tenant.clientId,
    clientSecret: maskSecret(),
    status: tenant.status,
    lastTestedAt: tenant.lastTestedAt,
    lastError: tenant.lastError,
    active: tenant.id === activeTenantIdByUser[userId],
    createdAt: tenant.createdAt,
    updatedAt: tenant.updatedAt
  };
}

// Every function below is scoped to userId — never returns another user's data.
function getAll(userId) {
  return tenants.filter(t => t.userId === userId).map(t => toPublic(t, userId));
}

function getById(id, userId) {
  return tenants.find(t => t.id === id && t.userId === userId);
}

function getByIdPublic(id, userId) {
  return toPublic(getById(id, userId), userId);
}

function create(userId, { name, environment, baseUrl, tokenUrl, clientId, clientSecret }) {
  const now = new Date().toISOString();
  const tenant = {
    id: uuidv4(),
    userId,
    name,
    environment: environment || 'DEV',
    baseUrl: (baseUrl || '').trim().replace(/\/+$/, ''),
    tokenUrl: (tokenUrl || '').trim(),
    clientId,
    clientSecretEnc: encrypt(clientSecret),
    status: 'UNTESTED',
    lastTestedAt: null,
    lastError: null,
    createdAt: now,
    updatedAt: now
  };
  tenants.push(tenant);
  if (!activeTenantIdByUser[userId]) activeTenantIdByUser[userId] = tenant.id;
  persist();
  return tenant;
}

function update(id, userId, data) {
  const tenant = getById(id, userId);
  if (!tenant) return null;
  ['name', 'environment', 'clientId'].forEach(f => {
    if (data[f] !== undefined) tenant[f] = data[f];
  });
  if (data.baseUrl !== undefined) tenant.baseUrl = data.baseUrl.trim().replace(/\/+$/, '');
  if (data.tokenUrl !== undefined) tenant.tokenUrl = data.tokenUrl.trim();
  if (data.clientSecret) tenant.clientSecretEnc = encrypt(data.clientSecret);
  tenant.updatedAt = new Date().toISOString();
  persist();
  return tenant;
}

function remove(id, userId) {
  const idx = tenants.findIndex(t => t.id === id && t.userId === userId);
  if (idx === -1) return false;
  tenants.splice(idx, 1);
  if (activeTenantIdByUser[userId] === id) {
    const remaining = tenants.filter(t => t.userId === userId);
    activeTenantIdByUser[userId] = remaining.length > 0 ? remaining[0].id : null;
  }
  persist();
  return true;
}

function setStatus(id, userId, status, error = null) {
  const tenant = getById(id, userId);
  if (!tenant) return null;
  tenant.status = status;
  tenant.lastError = error;
  tenant.lastTestedAt = new Date().toISOString();
  persist();
  return tenant;
}

function setActive(id, userId) {
  const tenant = getById(id, userId);
  if (!tenant) return false;
  activeTenantIdByUser[userId] = id;
  persist();
  return true;
}

function getActiveTenant(userId) {
  return getById(activeTenantIdByUser[userId], userId) || null;
}

// Internal use only — never expose over the API.
function getActiveTenantCredentials(userId) {
  const tenant = getActiveTenant(userId);
  if (tenant) {
    return {
      id: tenant.id,
      name: tenant.name,
      baseUrl: tenant.baseUrl,
      tokenUrl: tenant.tokenUrl,
      clientId: tenant.clientId,
      clientSecret: decrypt(tenant.clientSecretEnc)
    };
  }
  return null;
}

function getDecryptedCredentials(id, userId) {
  const tenant = getById(id, userId);
  if (!tenant) return null;
  return {
    id: tenant.id,
    name: tenant.name,
    baseUrl: tenant.baseUrl,
    tokenUrl: tenant.tokenUrl,
    clientId: tenant.clientId,
    clientSecret: decrypt(tenant.clientSecretEnc)
  };
}

module.exports = {
  getAll, getById, getByIdPublic, create, update, remove,
  setStatus, setActive, getActiveTenant, getActiveTenantCredentials,
  getDecryptedCredentials, toPublic
};