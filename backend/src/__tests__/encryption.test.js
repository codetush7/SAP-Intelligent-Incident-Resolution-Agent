const { encrypt, decrypt, maskSecret } = require('../utils/encryption');

describe('Encryption Utility (AES-256-GCM / AES-256-CBC)', () => {
  it('should encrypt and decrypt strings correctly', () => {
    const plainText = 'my-super-secret-sap-cpi-client-secret-12345';
    const encrypted = encrypt(plainText);

    expect(encrypted).toBeDefined();
    expect(encrypted).not.toBe(plainText);
    expect(encrypted.split(':').length).toBe(3); // iv:authTag:data

    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(plainText);
  });

  it('should handle empty, null, and undefined values safely', () => {
    expect(encrypt('')).toBe('');
    expect(encrypt(null)).toBe('');
    expect(encrypt(undefined)).toBe('');

    expect(decrypt('')).toBe('');
    expect(decrypt(null)).toBe('');
    expect(decrypt(undefined)).toBe('');
  });

  it('should support legacy CBC encrypted payloads (iv:data)', () => {
    const crypto = require('crypto');
    const RAW_KEY = process.env.ENCRYPTION_KEY || process.env.TENANT_ENCRYPTION_KEY || 'dev-only-insecure-encryption-key-change-me!';
    const KEY = crypto.createHash('sha256').update(RAW_KEY).digest();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', KEY, iv);
    const testSecret = 'legacy-secret-token-777';
    const encrypted = Buffer.concat([cipher.update(testSecret, 'utf8'), cipher.final()]);
    const legacyPayload = `${iv.toString('hex')}:${encrypted.toString('hex')}`;

    const decrypted = decrypt(legacyPayload);
    expect(decrypted).toBe(testSecret);
  });

  it('should mask sensitive values with bullet points', () => {
    expect(maskSecret('secret123')).toBe('••••••••••••');
  });
});
