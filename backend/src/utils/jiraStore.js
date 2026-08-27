const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../config/database');
const { encrypt, decrypt, maskSecret } = require('./encryption');
const logger = require('./logger');

function sanitizeBaseUrl(url) {
  return (url || '').trim().replace(/\/+$/, '').replace(/\/jira$/i, '');
}

async function toPublic(userId) {
  const db = getDb();
  const config = await db.findOne('jira_configs', { userId });
  if (!config) return null;
  return {
    baseUrl: config.baseUrl,
    email: config.email,
    apiToken: maskSecret(),
    projectKey: config.projectKey,
    status: config.status,
    lastTestedAt: config.lastTestedAt,
    lastError: config.lastError,
    connected: config.status === 'CONNECTED'
  };
}

async function save(userId, { baseUrl, email, apiToken, projectKey }) {
  const db = getDb();
  const existing = await db.findOne('jira_configs', { userId });
  const now = new Date().toISOString();

  const data = {
    userId,
    baseUrl: sanitizeBaseUrl(baseUrl),
    email: (email || '').trim(),
    apiTokenEnc: encrypt(apiToken),
    projectKey: (projectKey || 'CPI').trim(),
    status: 'UNTESTED',
    lastTestedAt: null,
    lastError: null,
    updatedAt: now
  };

  if (existing) {
    await db.update('jira_configs', { userId }, data);
  } else {
    data.id = uuidv4();
    data.createdAt = now;
    await db.insert('jira_configs', data);
  }

  logger.info(`[JiraStore] Jira config saved in DB for user ${userId}`);
  return toPublic(userId);
}

async function setStatus(userId, status, error = null) {
  const db = getDb();
  const updateData = {
    status,
    lastError: error,
    lastTestedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  await db.update('jira_configs', { userId }, updateData);
}

async function isConfigured(userId) {
  const db = getDb();
  const config = await db.findOne('jira_configs', { userId });
  return !!(config && config.baseUrl && config.email && config.apiTokenEnc);
}

async function getCredentials(userId) {
  const db = getDb();
  const config = await db.findOne('jira_configs', { userId });
  if (!config) return null;
  return {
    baseUrl: config.baseUrl,
    email: config.email,
    apiToken: decrypt(config.apiTokenEnc),
    projectKey: config.projectKey
  };
}

async function remove(userId) {
  const db = getDb();
  await db.remove('jira_configs', { userId });
  logger.info(`[JiraStore] Jira config removed from DB for user ${userId}`);
}

module.exports = {
  toPublic,
  save,
  setStatus,
  isConfigured,
  getCredentials,
  remove
};