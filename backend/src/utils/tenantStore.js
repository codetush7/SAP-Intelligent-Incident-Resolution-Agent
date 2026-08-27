const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../config/database');
const { encrypt, decrypt, maskSecret } = require('./encryption');
const logger = require('./logger');

function toPublic(tenant) {
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
    active: Boolean(tenant.isActive),
    createdAt: tenant.createdAt,
    updatedAt: tenant.updatedAt
  };
}

async function getAll(userId) {
  const db = getDb();
  const tenants = await db.find('tenants', { userId });
  return tenants.map(toPublic);
}

async function getById(id, userId) {
  const db = getDb();
  return db.findOne('tenants', { id, userId });
}

async function getByIdPublic(id, userId) {
  const tenant = await getById(id, userId);
  return toPublic(tenant);
}

async function create(userId, { name, environment, baseUrl, tokenUrl, clientId, clientSecret }) {
  const db = getDb();
  const existingCount = await db.count('tenants', { userId });
  const now = new Date().toISOString();

  const tenant = {
    id: uuidv4(),
    userId,
    name: name.trim(),
    environment: environment || 'DEV',
    baseUrl: (baseUrl || '').trim().replace(/\/+$/, ''),
    tokenUrl: (tokenUrl || '').trim(),
    clientId: (clientId || '').trim(),
    clientSecretEnc: encrypt(clientSecret),
    status: 'UNTESTED',
    lastTestedAt: null,
    lastError: null,
    isActive: existingCount === 0, // First tenant is active by default
    createdAt: now,
    updatedAt: now
  };

  await db.insert('tenants', tenant);
  logger.info(`[TenantStore] Tenant created in DB for user ${userId}: ${tenant.name}`);
  return tenant;
}

async function update(id, userId, data) {
  const db = getDb();
  const tenant = await getById(id, userId);
  if (!tenant) return null;

  const updateData = {};
  ['name', 'environment', 'clientId'].forEach(field => {
    if (data[field] !== undefined) updateData[field] = data[field];
  });

  if (data.baseUrl !== undefined) updateData.baseUrl = data.baseUrl.trim().replace(/\/+$/, '');
  if (data.tokenUrl !== undefined) updateData.tokenUrl = data.tokenUrl.trim();
  if (data.clientSecret) updateData.clientSecretEnc = encrypt(data.clientSecret);
  updateData.updatedAt = new Date().toISOString();

  await db.update('tenants', { id, userId }, updateData);
  return getById(id, userId);
}

async function remove(id, userId) {
  const db = getDb();
  const tenant = await getById(id, userId);
  if (!tenant) return false;

  const wasActive = Boolean(tenant.isActive);
  const deleted = await db.remove('tenants', { id, userId });

  if (deleted && wasActive) {
    const remaining = await db.find('tenants', { userId });
    if (remaining.length > 0) {
      await db.update('tenants', { id: remaining[0].id }, { isActive: true });
    }
  }

  return deleted;
}

async function setStatus(id, userId, status, error = null) {
  const db = getDb();
  const filter = userId ? { id, userId } : { id };
  const tenant = await db.findOne('tenants', filter);
  if (!tenant) return null;

  const updateData = {
    status,
    lastError: error,
    lastTestedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  await db.update('tenants', filter, updateData);
  return db.findOne('tenants', filter);
}

async function setActive(id, userId) {
  const db = getDb();
  const tenant = await getById(id, userId);
  if (!tenant) return false;

  // Deactivate all user's tenants
  const allTenants = await db.find('tenants', { userId });
  for (const t of allTenants) {
    if (t.isActive) {
      await db.update('tenants', { id: t.id }, { isActive: false });
    }
  }

  // Activate selected tenant
  await db.update('tenants', { id, userId }, { isActive: true });
  return true;
}

async function getActiveTenant(userId) {
  const db = getDb();
  let tenant = await db.findOne('tenants', { userId, isActive: true });
  if (!tenant) {
    // Fallback to the first tenant if none is marked active
    const list = await db.find('tenants', { userId }, { limit: 1 });
    tenant = list.length > 0 ? list[0] : null;
  }
  return tenant;
}

async function getActiveTenantCredentials(userId) {
  const tenant = await getActiveTenant(userId);
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

async function getDecryptedCredentials(id, userId) {
  const tenant = await getById(id, userId);
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
  getAll,
  getById,
  getByIdPublic,
  create,
  update,
  remove,
  setStatus,
  setActive,
  getActiveTenant,
  getActiveTenantCredentials,
  getDecryptedCredentials,
  toPublic
};