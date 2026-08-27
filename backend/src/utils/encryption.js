const crypto = require('crypto');
const logger = require('./logger');

const RAW_KEY = process.env.ENCRYPTION_KEY || process.env.TENANT_ENCRYPTION_KEY || 'dev-only-insecure-encryption-key-change-me!';
const KEY = crypto.createHash('sha256').update(RAW_KEY).digest(); // 32 bytes for AES-256
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

if (!process.env.ENCRYPTION_KEY && !process.env.TENANT_ENCRYPTION_KEY) {
  logger.warn('[Encryption] ENCRYPTION_KEY not set — using an insecure default key. Set ENCRYPTION_KEY in backend/.env for production.');
}

/**
 * Encrypts plain text using AES-256-GCM (authenticated encryption)
 * Format: iv_hex:auth_tag_hex:encrypted_data_hex
 * @param {string} text Plain text to encrypt
 * @returns {string} Encrypted string
 */
function encrypt(text) {
  if (text === null || text === undefined || text === '') return '';
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
    const encrypted = Buffer.concat([cipher.update(String(text), 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
  } catch (err) {
    logger.error(`[Encryption] Failed to encrypt data: ${err.message}`);
    throw err;
  }
}

/**
 * Decrypts payload. Supports both new AES-256-GCM (3 parts) and legacy AES-256-CBC (2 parts)
 * @param {string} payload Encrypted payload string
 * @returns {string} Decrypted plain text
 */
function decrypt(payload) {
  if (!payload || typeof payload !== 'string') return '';
  try {
    const parts = payload.split(':');
    if (parts.length === 3) {
      // AES-256-GCM: iv:authTag:data
      const [ivHex, authTagHex, dataHex] = parts;
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');
      const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, iv);
      decipher.setAuthTag(authTag);
      const decrypted = Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]);
      return decrypted.toString('utf8');
    } else if (parts.length === 2) {
      // Legacy AES-256-CBC: iv:data
      const [ivHex, dataHex] = parts;
      const iv = Buffer.from(ivHex, 'hex');
      const decipher = crypto.createDecipheriv('aes-256-cbc', KEY, iv);
      const decrypted = Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]);
      return decrypted.toString('utf8');
    }
    return '';
  } catch (err) {
    logger.error(`[Encryption] Failed to decrypt payload: ${err.message}`);
    return '';
  }
}

/**
 * Mask sensitive values for public API responses
 * @param {string} val 
 * @returns {string}
 */
function maskSecret(val) {
  return '••••••••••••';
}

module.exports = {
  encrypt,
  decrypt,
  maskSecret
};
