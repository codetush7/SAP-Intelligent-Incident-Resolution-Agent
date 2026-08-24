const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const fileStore = require('./fileStore');
const logger = require('./logger');

const persisted = fileStore.load('users', { users: [] });
const users = persisted.users;

function persist() { fileStore.save('users', { users }); }


function toPublic(user) {
  if (!user) return null;
  return { id: user.id, name: user.name, email: user.email, role: user.role, createdAt: user.createdAt };
}

function findByEmail(email) {
  return users.find(u => u.email.toLowerCase() === String(email).toLowerCase());
}

function getAll() {
  return users.map(toPublic);
}
function findById(id) {
  return users.find(u => u.id === id);
}

async function create({ name, email, password }) {
  if (findByEmail(email)) {
    throw new Error('An account with this email already exists.');
  }
  const passwordHash = await bcrypt.hash(password, 12);
  const user = {
    id: uuidv4(),
    name,
    email: email.toLowerCase(),
    passwordHash,
    role: users.length === 0 ? 'admin' : 'user', // first signup becomes admin
    createdAt: new Date().toISOString()
  };
  users.push(user);
  persist();
  logger.info(`[UserStore] User created: ${user.email}`);
  return user;
}

async function verifyPassword(user, password) {
  return bcrypt.compare(password, user.passwordHash);
}

module.exports = { create, findByEmail, findById, verifyPassword, toPublic, getAll };