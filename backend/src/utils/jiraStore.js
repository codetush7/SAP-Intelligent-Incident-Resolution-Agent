const crypto = require('crypto');
const logger = require('./logger');
const fileStore = require('./fileStore');

const RAW_KEY = process.env.TENANT_ENCRYPTION_KEY || 'dev-only-insecure-key-change-me!';
const KEY = crypto.createHash('sha256').update(RAW_KEY).digest();
const IV_LENGTH = 16;

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
    logger.error('[JiraStore] Failed to decrypt API token: ' + err.message);
    return '';
  }
}

// Shape: { configs: { [userId]: { baseUrl, email, apiTokenEnc, projectKey, status, lastTestedAt, lastError } } }
const persisted = fileStore.load('jira', { configs: {} });
const configs = persisted.configs;

function persist() { fileStore.save('jira', { configs }); }

function sanitizeBaseUrl(url) {
  return (url || '').trim().replace(/\/+$/, '').replace(/\/jira$/i, '');
}

function toPublic(userId) {
  const config = configs[userId];
  if (!config) return null;
  return {
    baseUrl: config.baseUrl,
    email: config.email,
    apiToken: '••••••••••••',
    projectKey: config.projectKey,
    status: config.status,
    lastTestedAt: config.lastTestedAt,
    lastError: config.lastError,
    connected: config.status === 'CONNECTED'
  };
}

function save(userId, { baseUrl, email, apiToken, projectKey }) {
  configs[userId] = {
    baseUrl: sanitizeBaseUrl(baseUrl),
    email,
    apiTokenEnc: encrypt(apiToken),
    projectKey: projectKey || 'CPI',
    status: 'UNTESTED',
    lastTestedAt: null,
    lastError: null
  };
  persist();
  return configs[userId];
}

function setStatus(userId, status, error = null) {
  if (!configs[userId]) return;
  configs[userId].status = status;
  configs[userId].lastError = error;
  configs[userId].lastTestedAt = new Date().toISOString();
  persist();
}

function isConfigured(userId) {
  const c = configs[userId];
  return !!(c && c.baseUrl && c.email && c.apiTokenEnc);
}

function getCredentials(userId) {
  const c = configs[userId];
  if (!c) return null;
  return { baseUrl: c.baseUrl, email: c.email, apiToken: decrypt(c.apiTokenEnc), projectKey: c.projectKey };
}

function remove(userId) {
  delete configs[userId];
  persist();
}

module.exports = { toPublic, save, setStatus, isConfigured, getCredentials, remove };