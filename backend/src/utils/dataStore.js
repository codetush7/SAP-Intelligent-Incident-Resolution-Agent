const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../config/database');
const { normalizeFingerprint, createIssueFingerprint } = require('./fingerprint');
const logger = require('./logger');

function normalizeTicketData(data = {}) {
  const normalized = { ...data };
  normalized.status = data.status ? String(data.status).toUpperCase() : 'OPEN';
  if (data.priority !== undefined) normalized.priority = String(data.priority).toUpperCase();
  if (data.category !== undefined) normalized.category = String(data.category).toUpperCase();
  return normalized;
}

async function findDuplicateTicket(userId, ticketData) {
  const db = getDb();
  const issueFingerprint = normalizeFingerprint(
    ticketData.issueFingerprint || createIssueFingerprint(ticketData)
  );
  if (!issueFingerprint) return null;

  const tickets = await db.find('tickets', { userId });
  return tickets.find(existing => {
    const existingIssueFingerprint = existing.issueFingerprint
      ? normalizeFingerprint(existing.issueFingerprint)
      : normalizeFingerprint(createIssueFingerprint(existing));
    return existingIssueFingerprint === issueFingerprint;
  }) || null;
}

async function getTickets(userId) {
  const db = getDb();
  const filter = userId ? { userId } : {};
  return db.find('tickets', filter, { sort: { createdAt: -1 } });
}

async function getTicketById(id, userId) {
  const db = getDb();
  const filter = userId ? { id, userId } : { id };
  return db.findOne('tickets', filter);
}

async function createTicket(userId, data) {
  const duplicate = await findDuplicateTicket(userId, data);
  if (duplicate) return duplicate;

  const db = getDb();
  const issueFingerprint = normalizeFingerprint(
    data.issueFingerprint || createIssueFingerprint(data)
  );

  const userTicketCount = await db.count('tickets', { userId });
  const now = new Date().toISOString();

  const ticket = {
    id: uuidv4(),
    userId,
    ticketNumber: `CPI-${1000 + userTicketCount + 1}`,
    ...normalizeTicketData(data),
    issueFingerprint: issueFingerprint || null,
    createdAt: now,
    updatedAt: now,
    aiAnalyzed: Boolean(data.aiAnalyzed)
  };

  await db.insert('tickets', ticket);
  logger.info(`[DataStore] Ticket ${ticket.ticketNumber} created in DB for user ${userId}`);
  return ticket;
}

async function updateTicket(id, userId, data) {
  const db = getDb();
  const filter = userId ? { id, userId } : { id };
  const existing = await db.findOne('tickets', filter);
  if (!existing) return null;

  const normalized = normalizeTicketData(data);
  normalized.updatedAt = new Date().toISOString();

  await db.update('tickets', filter, normalized);
  return db.findOne('tickets', filter);
}

async function deleteTicket(id, userId) {
  const db = getDb();
  const filter = userId ? { id, userId } : { id };
  return db.remove('tickets', filter);
}

async function getAlerts(userId) {
  const db = getDb();
  const filter = userId ? { userId } : {};
  return db.find('alerts', filter, { sort: { timestamp: -1 } });
}

async function addAlert(userId, alert) {
  const db = getDb();
  const now = new Date().toISOString();
  const alertDoc = {
    id: uuidv4(),
    userId,
    ...alert,
    timestamp: alert.timestamp || now,
    acknowledged: false
  };
  await db.insert('alerts', alertDoc);
  return alertDoc;
}

async function acknowledgeAlert(param1, param2) {
  const db = getDb();
  let filter = {};
  if (param1 && param2) {
    filter = { id: param2, userId: param1 };
    let found = await db.findOne('alerts', filter);
    if (!found) {
      filter = { id: param1, userId: param2 };
      found = await db.findOne('alerts', filter);
    }
    if (!found) return null;
    await db.update('alerts', filter, { acknowledged: true });
    return db.findOne('alerts', filter);
  } else if (param1) {
    filter = { id: param1 };
    await db.update('alerts', filter, { acknowledged: true });
    return db.findOne('alerts', filter);
  }
  return null;
}

async function getMonitoringLogs(userId) {
  const db = getDb();
  const filter = userId ? { userId } : {};
  return db.find('monitoring_logs', filter, { sort: { timestamp: -1 } });
}

async function addMonitoringLog(userId, log) {
  const db = getDb();
  const now = new Date().toISOString();
  const logDoc = {
    id: uuidv4(),
    userId,
    ...log,
    timestamp: log.timestamp || now
  };
  await db.insert('monitoring_logs', logDoc);
  return logDoc;
}

async function getAgentLogs(userId) {
  const db = getDb();
  const filter = userId ? { userId } : {};
  return db.find('agent_logs', filter, { sort: { timestamp: -1 } });
}

async function addAgentLog(userId, log) {
  const db = getDb();
  const now = new Date().toISOString();
  const actualUserId = typeof userId === 'string' ? userId : (log?.userId || 'system');
  const actualLog = typeof userId === 'object' && userId !== null ? userId : log;

  const logDoc = {
    id: uuidv4(),
    userId: actualUserId,
    ...actualLog,
    timestamp: actualLog.timestamp || now
  };
  await db.insert('agent_logs', logDoc);
  return logDoc;
}

async function getStats(userId) {
  const db = getDb();
  const tickets = await db.find('tickets', userId ? { userId } : {});
  const alerts = await db.find('alerts', userId ? { userId } : {});

  return {
    total: tickets.length,
    open: tickets.filter(t => String(t.status || '').toUpperCase() === 'OPEN').length,
    inProgress: tickets.filter(t => String(t.status || '').toUpperCase() === 'IN_PROGRESS').length,
    resolved: tickets.filter(t => String(t.status || '').toUpperCase() === 'RESOLVED').length,
    critical: tickets.filter(t => String(t.priority || '').toUpperCase() === 'CRITICAL').length,
    high: tickets.filter(t => String(t.priority || '').toUpperCase() === 'HIGH').length,
    medium: tickets.filter(t => String(t.priority || '').toUpperCase() === 'MEDIUM').length,
    low: tickets.filter(t => String(t.priority || '').toUpperCase() === 'LOW').length,
    activeAlerts: alerts.filter(a => !a.acknowledged).length,
    aiAnalyzed: tickets.filter(t => Boolean(t.aiAnalyzed)).length
  };
}

module.exports = {
  getTickets,
  getTicketById,
  createTicket,
  updateTicket,
  deleteTicket,
  getAlerts,
  addAlert,
  acknowledgeAlert,
  getMonitoringLogs,
  addMonitoringLog,
  getAgentLogs,
  addAgentLog,
  findDuplicateTicket,
  getStats
};