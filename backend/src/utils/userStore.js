const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const hana = require('../db/hanaClient');
const fileStore = require('./fileStore');
const logger = require('./logger');

function getLocalUsers() {
  const data = fileStore.load('users', { users: [] });
  return data.users || [];
}

function saveLocalUsers(users) {
  fileStore.save('users', { users });
}

function toPublic(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    organization: user.organization || null,
    createdAt: user.createdAt
  };
}

function rowToUser(row) {
  return {
    id: row.ID,
    name: row.NAME,
    email: row.EMAIL,
    organization: row.ORGANIZATION || null,
    passwordHash: row.PASSWORD_HASH,
    role: row.ROLE,
    createdAt: row.CREATED_AT
  };
}

async function findByEmail(email) {
  try {
    const rows = await hana.query('SELECT * FROM USERS WHERE LOWER(EMAIL) = ?', [String(email).toLowerCase()]);
    return rows[0] ? rowToUser(rows[0]) : null;
  } catch (err) {
    // Fallback to local store
    const users = getLocalUsers();
    return users.find(u => u.email.toLowerCase() === String(email).toLowerCase()) || null;
  }
}

async function findById(id) {
  try {
    const rows = await hana.query('SELECT * FROM USERS WHERE ID = ?', [id]);
    return rows[0] ? rowToUser(rows[0]) : null;
  } catch (err) {
    const users = getLocalUsers();
    return users.find(u => u.id === id) || null;
  }
}

async function getAll() {
  try {
    const rows = await hana.query('SELECT * FROM USERS');
    return rows.map((r) => toPublic(rowToUser(r)));
  } catch (err) {
    return getLocalUsers().map(toPublic);
  }
}

async function create({ name, email, password, organization }) {
  if (await findByEmail(email)) {
    throw new Error('An account with this email already exists.');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const id = uuidv4();

  try {
    const countRows = await hana.query('SELECT COUNT(*) AS CNT FROM USERS');
    const isFirstUser = countRows[0].CNT === 0;

    await hana.exec(
      'INSERT INTO USERS (ID, NAME, EMAIL, PASSWORD_HASH, ROLE, ORGANIZATION) VALUES (?, ?, ?, ?, ?, ?)',
      [id, name, email.toLowerCase(), passwordHash, isFirstUser ? 'admin' : 'user', organization || null]
    );
    logger.info(`[UserStore] User created in HANA: ${email}`);
    return findById(id);
  } catch (err) {
    // Fallback to local
    const users = getLocalUsers();
    const isFirstUser = users.length === 0;
    const user = {
      id,
      name,
      email: email.toLowerCase(),
      organization: organization || null,
      passwordHash,
      role: isFirstUser ? 'admin' : 'user',
      createdAt: new Date().toISOString()
    };
    users.push(user);
    saveLocalUsers(users);
    logger.info(`[UserStore] User created locally: ${email}`);
    return user;
  }
}

async function updateProfile(id, { name, organization }) {
  const user = await findById(id);
  if (!user) throw new Error('User not found');

  const updatedName = name !== undefined ? name : user.name;
  const updatedOrg = organization !== undefined ? organization : user.organization;

  try {
    await hana.exec(
      'UPDATE USERS SET NAME = ?, ORGANIZATION = ? WHERE ID = ?',
      [updatedName, updatedOrg, id]
    );
    return findById(id);
  } catch (err) {
    const users = getLocalUsers();
    const idx = users.findIndex(u => u.id === id);
    if (idx !== -1) {
      users[idx] = { ...users[idx], name: updatedName, organization: updatedOrg };
      saveLocalUsers(users);
    }
    return users[idx] || user;
  }
}

async function verifyPassword(user, password) {
  return bcrypt.compare(password, user.passwordHash);
}

module.exports = {
  create,
  findByEmail,
  findById,
  updateProfile,
  verifyPassword,
  toPublic,
  getAll
};