// Persists the AI provider/model/key chosen in Settings > AI Configuration
// so it survives server restarts, without touching the .env file directly.
// This is intentionally simple (single active config, not per-user) because
// AI_PROVIDER in .env is also a single global setting today.
const crypto = require('crypto');
const fileStore = require('./fileStore');
const logger = require('./logger');

const STORE_NAME = 'aiConfig';
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
    logger.error('[AIConfigStore] Failed to decrypt stored key: ' + err.message);
    return '';
  }
}

// Returns { provider, model, apiKey } with apiKey decrypted, or null if unset.
function get() {
  const raw = fileStore.load(STORE_NAME, null);
  if (!raw) return null;
  return { provider: raw.provider, model: raw.model, apiKey: raw.apiKey ? decrypt(raw.apiKey) : '' };
}

// Returns the same shape but with the key masked, safe to send to the frontend.
function getPublic() {
  const cfg = get();
  if (!cfg) return null;
  return { provider: cfg.provider, model: cfg.model, hasApiKey: !!cfg.apiKey };
}

function set({ provider, model, apiKey }) {
  const existing = get();
  fileStore.save(STORE_NAME, {
    provider,
    model,
    // Keep the previously saved key if the user didn't type a new one
    // (frontend never re-sends the real key back after masking it).
    apiKey: apiKey ? encrypt(apiKey) : (existing?.provider === provider ? encrypt(existing.apiKey) : '')
  });
}

module.exports = { get, getPublic, set };
