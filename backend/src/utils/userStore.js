const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../config/database');
const logger = require('./logger');

function toPublic(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role || 'user',
    createdAt: user.createdAt
  };
}

async function findByEmail(email) {
  if (!email) return null;
  const db = getDb();
  return db.findOne('users', { email: String(email).toLowerCase() });
}

async function findById(id) {
  if (!id) return null;
  const db = getDb();
  return db.findOne('users', { id });
}

async function getAll() {
  const db = getDb();
  const users = await db.find('users');
  return users.map(toPublic);
}

async function create({ name, email, password }) {
  const normalizedEmail = String(email).toLowerCase();
  const existing = await findByEmail(normalizedEmail);
  if (existing) {
    throw new Error('An account with this email already exists.');
  }

  const db = getDb();
  const totalUsers = await db.count('users');
  const passwordHash = await bcrypt.hash(password, 12);
  const now = new Date().toISOString();

  const user = {
    id: uuidv4(),
    name: name.trim(),
    email: normalizedEmail,
    passwordHash,
    role: totalUsers === 0 ? 'admin' : 'user', // First signup is admin
    createdAt: now,
    updatedAt: now
  };

  await db.insert('users', user);
  logger.info(`[UserStore] User created in DB: ${user.email} (${user.role})`);
  return user;
}

async function verifyPassword(user, password) {
  if (!user || !user.passwordHash) return false;
  return bcrypt.compare(password, user.passwordHash);
}

module.exports = {
  create,
  findByEmail,
  findById,
  verifyPassword,
  toPublic,
  getAll
};