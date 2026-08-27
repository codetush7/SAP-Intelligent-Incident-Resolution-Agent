const jwt = require('jsonwebtoken');
const userStore = require('../utils/userStore');
const logger = require('../utils/logger');

function getJwtSecret() {
  return process.env.JWT_SECRET || 'dev-only-insecure-jwt-secret-change-me';
}

if (!process.env.JWT_SECRET) {
  logger.warn('[Auth] JWT_SECRET not set — using an insecure default. Set JWT_SECRET in backend/.env for production.');
}

/**
 * Sign a JWT token for an authenticated user
 * @param {Object} user User entity
 * @returns {string} Signed JWT token
 */
function signToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role || 'user'
    },
    getJwtSecret(),
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

/**
 * Express middleware to authenticate requests using Bearer JWT tokens
 */
async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;

  if (!token) {
    return res.status(401).json({ error: 'Not authenticated. Missing Authorization header.' });
  }

  try {
    const payload = jwt.verify(token, getJwtSecret());
    const user = await userStore.findById(payload.sub);

    if (!user) {
      return res.status(401).json({ error: 'User not found or account deactivated.' });
    }

    req.user = userStore.toPublic(user);
    next();
  } catch (err) {
    logger.debug(`[Auth] JWT verification failed: ${err.message}`);
    return res.status(401).json({ error: 'Session expired or invalid token, please log in again.' });
  }
}

module.exports = {
  signToken,
  requireAuth,
  getJwtSecret,
  get JWT_SECRET() {
    return getJwtSecret();
  }
};