const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const hana = require('../db/hanaClient');
const fileStore = require('./fileStore');
const logger = require('./logger');

const RAW_KEY = process.env.TENANT_ENCRYPTION_KEY || 'dev-only-insecure-key-change-me!';
const KEY = crypto.createHash('sha256').update(RAW_KEY).digest();
const IV_LENGTH = 16;

if (!process.env.TENANT_ENCRYPTION_KEY) {
  logger.warn('[TenantStore] TENANT_ENCRYPTION_KEY not set — using an insecure default.');
}

function getLocalData() {
  return fileStore.load('tenants', { tenants: [], activeTenantIdByUser: {} });
}

function saveLocalData(data) {
  fileStore.save('tenants', data);
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
    logger.error('[TenantStore] Failed to decrypt: ' + err.message);
    return '';
  }
}

function rowToTenant(row) {
  return {
    id: row.ID, userId: row.USER_ID, name: row.NAME, environment: row.ENVIRONMENT,
    baseUrl: row.BASE_URL, tokenUrl: row.TOKEN_URL, clientId: row.CLIENT_ID,
    clientSecretEnc: row.CLIENT_SECRET_ENC, status: row.STATUS,
    lastTestedAt: row.LAST_TESTED_AT, lastError: row.LAST_ERROR,
    isActive: !!row.IS_ACTIVE, createdAt: row.CREATED_AT, updatedAt: row.UPDATED_AT
  };
}

function toPublic(tenant) {
  if (!tenant) return null;
  return {
    id: tenant.id, name: tenant.name, environment: tenant.environment,
    baseUrl: tenant.baseUrl, tokenUrl: tenant.tokenUrl, clientId: tenant.clientId,
    clientSecret: '••••••••••••', status: tenant.status,
    lastTestedAt: tenant.lastTestedAt, lastError: tenant.lastError,
    active: tenant.isActive, createdAt: tenant.createdAt, updatedAt: tenant.updatedAt
  };
}

async function getAll(userId) {
  try {
    const rows = await hana.query('SELECT * FROM TENANTS WHERE USER_ID = ?', [userId]);
    return rows.map((r) => toPublic(rowToTenant(r)));
  } catch (err) {
    const data = getLocalData();
    const activeId = data.activeTenantIdByUser?.[userId];
    return (data.tenants || [])
      .filter(t => t.userId === userId)
      .map(t => toPublic({ ...t, isActive: t.id === activeId }));
  }
}

async function getById(id, userId) {
  try {
    const rows = await hana.query('SELECT * FROM TENANTS WHERE ID = ? AND USER_ID = ?', [id, userId]);
    return rows[0] ? rowToTenant(rows[0]) : null;
  } catch (err) {
    const data = getLocalData();
    const activeId = data.activeTenantIdByUser?.[userId];
    const t = (data.tenants || []).find(x => x.id === id && x.userId === userId);
    return t ? { ...t, isActive: t.id === activeId } : null;
  }
}

async function getByIdPublic(id, userId) {
  return toPublic(await getById(id, userId));
}

async function create(userId, { name, environment, baseUrl, tokenUrl, clientId, clientSecret }) {
  const id = uuidv4();
  const encSecret = encrypt(clientSecret);

  try {
    const countRows = await hana.query('SELECT COUNT(*) AS CNT FROM TENANTS WHERE USER_ID = ?', [userId]);
    const isFirst = countRows[0].CNT === 0;

    await hana.exec(
      `INSERT INTO TENANTS (ID, USER_ID, NAME, ENVIRONMENT, BASE_URL, TOKEN_URL, CLIENT_ID, CLIENT_SECRET_ENC, STATUS, IS_ACTIVE)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'UNTESTED', ?)`,
      [id, userId, name, environment || 'DEV', (baseUrl || '').trim().replace(/\/+$/, ''),
       (tokenUrl || '').trim(), clientId, encSecret, isFirst]
    );
    return getById(id, userId);
  } catch (err) {
    const data = getLocalData();
    const isFirst = !data.tenants.some(t => t.userId === userId);
    const tenant = {
      id,
      userId,
      name,
      environment: environment || 'DEV',
      baseUrl: (baseUrl || '').trim().replace(/\/+$/, ''),
      tokenUrl: (tokenUrl || '').trim(),
      clientId,
      clientSecretEnc: encSecret,
      status: 'UNTESTED',
      lastTestedAt: null,
      lastError: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    data.tenants.push(tenant);
    if (isFirst) {
      if (!data.activeTenantIdByUser) data.activeTenantIdByUser = {};
      data.activeTenantIdByUser[userId] = id;
    }
    saveLocalData(data);
    return { ...tenant, isActive: isFirst };
  }
}

async function update(id, userId, updateData) {
  const tenant = await getById(id, userId);
  if (!tenant) return null;

  const name = updateData.name !== undefined ? updateData.name : tenant.name;
  const environment = updateData.environment !== undefined ? updateData.environment : tenant.environment;
  const clientId = updateData.clientId !== undefined ? updateData.clientId : tenant.clientId;
  const baseUrl = updateData.baseUrl !== undefined ? updateData.baseUrl.trim().replace(/\/+$/, '') : tenant.baseUrl;
  const tokenUrl = updateData.tokenUrl !== undefined ? updateData.tokenUrl.trim() : tenant.tokenUrl;
  const clientSecretEnc = updateData.clientSecret ? encrypt(updateData.clientSecret) : tenant.clientSecretEnc;

  try {
    await hana.exec(
      `UPDATE TENANTS SET NAME=?, ENVIRONMENT=?, CLIENT_ID=?, BASE_URL=?, TOKEN_URL=?, CLIENT_SECRET_ENC=?, UPDATED_AT=CURRENT_TIMESTAMP
       WHERE ID=? AND USER_ID=?`,
      [name, environment, clientId, baseUrl, tokenUrl, clientSecretEnc, id, userId]
    );
    return getById(id, userId);
  } catch (err) {
    const data = getLocalData();
    const idx = data.tenants.findIndex(t => t.id === id && t.userId === userId);
    if (idx !== -1) {
      data.tenants[idx] = {
        ...data.tenants[idx],
        name, environment, clientId, baseUrl, tokenUrl, clientSecretEnc,
        updatedAt: new Date().toISOString()
      };
      saveLocalData(data);
      return data.tenants[idx];
    }
    return null;
  }
}

async function remove(id, userId) {
  try {
    const rows = await hana.query('SELECT ID FROM TENANTS WHERE ID = ? AND USER_ID = ?', [id, userId]);
    if (!rows.length) return false;

    await hana.exec('DELETE FROM TENANTS WHERE ID = ? AND USER_ID = ?', [id, userId]);
    const remaining = await hana.query(
      'SELECT ID FROM TENANTS WHERE USER_ID = ? ORDER BY CREATED_AT ASC LIMIT 1', [userId]
    );
    if (remaining.length) {
      await hana.exec('UPDATE TENANTS SET IS_ACTIVE = TRUE WHERE ID = ?', [remaining[0].ID]);
    }
    return true;
  } catch (err) {
    const data = getLocalData();
    const idx = data.tenants.findIndex(t => t.id === id && t.userId === userId);
    if (idx === -1) return false;
    data.tenants.splice(idx, 1);
    if (data.activeTenantIdByUser?.[userId] === id) {
      const next = data.tenants.find(t => t.userId === userId);
      data.activeTenantIdByUser[userId] = next ? next.id : null;
    }
    saveLocalData(data);
    return true;
  }
}

async function setStatus(id, userId, status, error = null) {
  try {
    await hana.exec(
      'UPDATE TENANTS SET STATUS=?, LAST_ERROR=?, LAST_TESTED_AT=CURRENT_TIMESTAMP WHERE ID=? AND USER_ID=?',
      [status, error, id, userId]
    );
    return getById(id, userId);
  } catch (err) {
    const data = getLocalData();
    const t = data.tenants.find(x => x.id === id && x.userId === userId);
    if (t) {
      t.status = status;
      t.lastError = error;
      t.lastTestedAt = new Date().toISOString();
      saveLocalData(data);
      return t;
    }
    return null;
  }
}

async function setActive(id, userId) {
  try {
    const tenant = await getById(id, userId);
    if (!tenant) return false;
    await hana.exec('UPDATE TENANTS SET IS_ACTIVE = FALSE WHERE USER_ID = ?', [userId]);
    await hana.exec('UPDATE TENANTS SET IS_ACTIVE = TRUE WHERE ID = ? AND USER_ID = ?', [id, userId]);
    return true;
  } catch (err) {
    const data = getLocalData();
    if (!data.activeTenantIdByUser) data.activeTenantIdByUser = {};
    data.activeTenantIdByUser[userId] = id;
    saveLocalData(data);
    return true;
  }
}

async function getActiveTenant(userId) {
  try {
    const rows = await hana.query('SELECT * FROM TENANTS WHERE USER_ID = ? AND IS_ACTIVE = TRUE', [userId]);
    return rows[0] ? rowToTenant(rows[0]) : null;
  } catch (err) {
    const data = getLocalData();
    const activeId = data.activeTenantIdByUser?.[userId];
    const t = (data.tenants || []).find(x => (x.id === activeId || (!activeId && x.userId === userId)) && x.userId === userId);
    return t ? { ...t, isActive: true } : null;
  }
}

async function getActiveTenantCredentials(userId) {
  const tenant = await getActiveTenant(userId);
  if (!tenant) return null;
  return {
    id: tenant.id, name: tenant.name, baseUrl: tenant.baseUrl, tokenUrl: tenant.tokenUrl,
    clientId: tenant.clientId, clientSecret: decrypt(tenant.clientSecretEnc)
  };
}

async function getDecryptedCredentials(id, userId) {
  const tenant = await getById(id, userId);
  if (!tenant) return null;
  return {
    id: tenant.id, name: tenant.name, baseUrl: tenant.baseUrl, tokenUrl: tenant.tokenUrl,
    clientId: tenant.clientId, clientSecret: decrypt(tenant.clientSecretEnc)
  };
}

module.exports = {
  getAll, getById, getByIdPublic, create, update, remove,
  setStatus, setActive, getActiveTenant, getActiveTenantCredentials,
  getDecryptedCredentials, toPublic
};