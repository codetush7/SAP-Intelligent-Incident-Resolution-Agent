const crypto = require('crypto');
const hana = require('../db/hanaClient');
const logger = require('./logger');

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
    logger.error('[JiraStore] Failed to decrypt: ' + err.message);
    return '';
  }
}

function sanitizeBaseUrl(url) {
  return (url || '').trim().replace(/\/+$/, '').replace(/\/jira$/i, '');
}

function rowToPublic(row) {
  if (!row) return null;
  return {
    baseUrl: row.BASE_URL, email: row.EMAIL, apiToken: '••••••••••••',
    projectKey: row.PROJECT_KEY, status: row.STATUS,
    lastTestedAt: row.LAST_TESTED_AT, lastError: row.LAST_ERROR,
    connected: row.STATUS === 'CONNECTED'
  };
}

async function toPublic(userId) {
  const rows = await hana.query('SELECT * FROM JIRA_CONFIGS WHERE USER_ID = ?', [userId]);
  return rowToPublic(rows[0]);
}

async function save(userId, { baseUrl, email, apiToken, projectKey }) {
  const exists = await hana.query('SELECT USER_ID FROM JIRA_CONFIGS WHERE USER_ID = ?', [userId]);
  const sql = exists.length
    ? `UPDATE JIRA_CONFIGS SET BASE_URL=?, EMAIL=?, API_TOKEN_ENC=?, PROJECT_KEY=?, STATUS='UNTESTED', LAST_ERROR=NULL WHERE USER_ID=?`
    : `INSERT INTO JIRA_CONFIGS (BASE_URL, EMAIL, API_TOKEN_ENC, PROJECT_KEY, STATUS, USER_ID) VALUES (?, ?, ?, ?, 'UNTESTED', ?)`;

  await hana.exec(sql, [sanitizeBaseUrl(baseUrl), email, encrypt(apiToken), projectKey || 'CPI', userId]);
  return toPublic(userId);
}

async function setStatus(userId, status, error = null) {
  await hana.exec(
    'UPDATE JIRA_CONFIGS SET STATUS=?, LAST_ERROR=?, LAST_TESTED_AT=CURRENT_TIMESTAMP WHERE USER_ID=?',
    [status, error, userId]
  );
}

async function isConfigured(userId) {
  const rows = await hana.query(
    'SELECT BASE_URL, EMAIL, API_TOKEN_ENC FROM JIRA_CONFIGS WHERE USER_ID = ?', [userId]
  );
  const c = rows[0];
  return !!(c && c.BASE_URL && c.EMAIL && c.API_TOKEN_ENC);
}

async function getCredentials(userId) {
  const rows = await hana.query('SELECT * FROM JIRA_CONFIGS WHERE USER_ID = ?', [userId]);
  const c = rows[0];
  if (!c) return null;
  return { baseUrl: c.BASE_URL, email: c.EMAIL, apiToken: decrypt(c.API_TOKEN_ENC), projectKey: c.PROJECT_KEY };
}

async function remove(userId) {
  await hana.exec('DELETE FROM JIRA_CONFIGS WHERE USER_ID = ?', [userId]);
}

module.exports = { toPublic, save, setStatus, isConfigured, getCredentials, remove };