const jwt = require('jsonwebtoken');
const userStore = require('../utils/userStore');
const logger = require('../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-insecure-jwt-secret-change-me';

if (!process.env.JWT_SECRET) {
  logger.warn('[Auth] JWT_SECRET not set — using an insecure default. Set it in backend/.env for production.');
}

function signToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = userStore.findById(payload.sub);
    if (!user) return res.status(401).json({ error: 'Not authenticated' });
    req.user = userStore.toPublic(user);
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Session expired, please log in again' });
  }
}

module.exports = { signToken, requireAuth, JWT_SECRET };