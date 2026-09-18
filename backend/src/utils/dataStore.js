const { v4: uuidv4 } = require('uuid');
const hana = require('../db/hanaClient');
const fileStore = require('./fileStore');
const { normalizeFingerprint, createIssueFingerprint } = require('./fingerprint');
const logger = require('./logger');

// Local in-memory/file fallback store
const memoryStore = {
  monitoringLogs: [],
  alerts: [],
  agentLogs: []
};

function getLocalTickets() {
  const data = fileStore.load('tickets', { tickets: [] });
  return data.tickets || [];
}

function saveLocalTickets(tickets) {
  fileStore.save('tickets', { tickets });
}

function normalizeTicketData(data = {}) {
  const normalized = { ...data };
  if (data.status !== undefined) normalized.status = String(data.status).toUpperCase();
  if (data.priority !== undefined) normalized.priority = String(data.priority).toUpperCase();
  if (data.category !== undefined) normalized.category = String(data.category).toUpperCase();
  return normalized;
}

function toCleanString(val) {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (Buffer.isBuffer(val)) return val.toString('utf-8');
  if (typeof val === 'object' && val.type === 'Buffer' && Array.isArray(val.data)) {
    return Buffer.from(val.data).toString('utf-8');
  }
  return String(val);
}

function rowToTicket(row) {
  let payload = {};
  try {
    const rawPayload = toCleanString(row.PAYLOAD_JSON);
    payload = JSON.parse(rawPayload || '{}');
  } catch (e) {
    payload = {};
  }
  for (const [k, v] of Object.entries(payload)) {
    if (Buffer.isBuffer(v)) {
      payload[k] = v.toString('utf-8');
    } else if (v && typeof v === 'object' && v.type === 'Buffer' && Array.isArray(v.data)) {
      payload[k] = Buffer.from(v.data).toString('utf-8');
    }
  }

  return {
    id: row.ID,
    userId: row.USER_ID,
    ticketNumber: row.TICKET_NUMBER,
    issueFingerprint: row.ISSUE_FINGERPRINT,
    status: row.STATUS,
    priority: row.PRIORITY,
    category: row.CATEGORY,
    title: toCleanString(row.TITLE),
    description: toCleanString(row.DESCRIPTION),
    aiAnalyzed: !!row.AI_ANALYZED,
    ...payload,
    createdAt: row.CREATED_AT,
    updatedAt: row.UPDATED_AT
  };
}

async function getTickets(userId) {
  try {
    const query = userId
      ? 'SELECT * FROM TICKETS WHERE USER_ID = ? ORDER BY CREATED_AT DESC'
      : 'SELECT * FROM TICKETS ORDER BY CREATED_AT DESC';
    const params = userId ? [userId] : [];
    const rows = await hana.query(query, params);
    return rows.map(rowToTicket);
  } catch (err) {
    const tickets = getLocalTickets();
    return userId ? tickets.filter(t => t.userId === userId) : tickets;
  }
}

async function getTicketById(id, userId) {
  try {
    const query = userId
      ? 'SELECT * FROM TICKETS WHERE (ID = ? OR TICKET_NUMBER = ?) AND USER_ID = ?'
      : 'SELECT * FROM TICKETS WHERE ID = ? OR TICKET_NUMBER = ?';
    const params = userId ? [id, id, userId] : [id, id];
    const rows = await hana.query(query, params);
    return rows[0] ? rowToTicket(rows[0]) : null;
  } catch (err) {
    const tickets = getLocalTickets();
    return tickets.find(t => (t.id === id || t.ticketNumber === id) && (!userId || t.userId === userId)) || null;
  }
}

async function findDuplicateTicket(userId, ticketData) {
  const fp = normalizeFingerprint(ticketData.issueFingerprint || createIssueFingerprint(ticketData));
  if (!fp) return null;

  try {
    const rows = await hana.query('SELECT * FROM TICKETS WHERE USER_ID = ? AND ISSUE_FINGERPRINT = ?', [userId, fp]);
    return rows[0] ? rowToTicket(rows[0]) : null;
  } catch (err) {
    const tickets = getLocalTickets();
    return tickets.find(t => {
      if (t.userId !== userId) return false;
      const existingFp = t.issueFingerprint
        ? normalizeFingerprint(t.issueFingerprint)
        : normalizeFingerprint(createIssueFingerprint(t));
      return fp && existingFp === fp;
    }) || null;
  }
}

async function createTicket(userId, data) {
  const duplicate = await findDuplicateTicket(userId, data);
  if (duplicate) return duplicate;

  const normalized = normalizeTicketData(data);
  const fp = normalizeFingerprint(data.issueFingerprint || createIssueFingerprint(data));

  try {
    const countRows = await hana.query('SELECT COUNT(*) AS CNT FROM TICKETS WHERE USER_ID = ?', [userId]);
    const userTicketCount = countRows[0].CNT;

    const id = uuidv4();
    const ticketNumber = `CPI-${1000 + userTicketCount + 1}`;
    const { status, priority, category, title, description, ...rest } = normalized;

    await hana.exec(
      `INSERT INTO TICKETS (ID, USER_ID, TICKET_NUMBER, ISSUE_FINGERPRINT, STATUS, PRIORITY, CATEGORY, TITLE, DESCRIPTION, AI_ANALYZED, PAYLOAD_JSON)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, userId, ticketNumber, fp, status || 'OPEN', priority, category, title, description, false, JSON.stringify(rest)]
    );

    return getTicketById(id, userId);
  } catch (err) {
    const tickets = getLocalTickets();
    const userTicketCount = tickets.filter(t => t.userId === userId).length;
    const ticket = {
      id: uuidv4(),
      userId,
      ticketNumber: `CPI-${1000 + userTicketCount + 1}`,
      ...normalized,
      issueFingerprint: fp,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      aiAnalyzed: false
    };
    tickets.unshift(ticket);
    saveLocalTickets(tickets);
    return ticket;
  }
}

async function updateTicket(id, userId, data) {
  const existing = await getTicketById(id, userId);
  if (!existing) return null;

  const normalized = normalizeTicketData(data);
  const merged = { ...existing, ...normalized };
  const { status, priority, category, title, description, id: _i, userId: _u, ticketNumber, issueFingerprint, aiAnalyzed, createdAt, updatedAt, ...rest } = merged;

  try {
    await hana.exec(
      `UPDATE TICKETS SET STATUS=?, PRIORITY=?, CATEGORY=?, TITLE=?, DESCRIPTION=?, AI_ANALYZED=?, PAYLOAD_JSON=?, UPDATED_AT=CURRENT_TIMESTAMP
       WHERE ID=? AND USER_ID=?`,
      [status, priority, category, title, description, !!aiAnalyzed, JSON.stringify(rest), id, userId]
    );
    return getTicketById(id, userId);
  } catch (err) {
    const tickets = getLocalTickets();
    const idx = tickets.findIndex(t => (t.id === id || t.ticketNumber === id) && t.userId === userId);
    if (idx !== -1) {
      tickets[idx] = { ...tickets[idx], ...normalized, updatedAt: new Date().toISOString() };
      saveLocalTickets(tickets);
      return tickets[idx];
    }
    return null;
  }
}

async function deleteTicket(id, userId) {
  try {
    await hana.exec('DELETE FROM TICKETS WHERE (ID = ? OR TICKET_NUMBER = ?) AND USER_ID = ?', [id, id, userId]);
    return true;
  } catch (err) {
    const tickets = getLocalTickets();
    const idx = tickets.findIndex(t => (t.id === id || t.ticketNumber === id) && t.userId === userId);
    if (idx !== -1) {
      tickets.splice(idx, 1);
      saveLocalTickets(tickets);
      return true;
    }
    return false;
  }
}

async function getStats(userId) {
  try {
    const rows = await hana.query(
      `SELECT
         COUNT(*) AS TOTAL,
         SUM(CASE WHEN STATUS='OPEN' THEN 1 ELSE 0 END) AS OPEN_CNT,
         SUM(CASE WHEN STATUS='IN_PROGRESS' THEN 1 ELSE 0 END) AS IN_PROGRESS_CNT,
         SUM(CASE WHEN STATUS='RESOLVED' THEN 1 ELSE 0 END) AS RESOLVED_CNT,
         SUM(CASE WHEN PRIORITY='CRITICAL' THEN 1 ELSE 0 END) AS CRITICAL_CNT,
         SUM(CASE WHEN PRIORITY='HIGH' THEN 1 ELSE 0 END) AS HIGH_CNT,
         SUM(CASE WHEN PRIORITY='MEDIUM' THEN 1 ELSE 0 END) AS MEDIUM_CNT,
         SUM(CASE WHEN PRIORITY='LOW' THEN 1 ELSE 0 END) AS LOW_CNT,
         SUM(CASE WHEN AI_ANALYZED=TRUE THEN 1 ELSE 0 END) AS AI_ANALYZED_CNT
       FROM TICKETS WHERE USER_ID = ?`,
      [userId]
    );
    const alertRows = await hana.query('SELECT COUNT(*) AS CNT FROM ALERTS WHERE USER_ID = ? AND ACKNOWLEDGED = FALSE', [userId]);
    const r = rows[0] || {};
    return {
      total: r.TOTAL || 0, open: r.OPEN_CNT || 0, inProgress: r.IN_PROGRESS_CNT || 0, resolved: r.RESOLVED_CNT || 0,
      critical: r.CRITICAL_CNT || 0, high: r.HIGH_CNT || 0, medium: r.MEDIUM_CNT || 0, low: r.LOW_CNT || 0,
      activeAlerts: alertRows[0]?.CNT || 0, aiAnalyzed: r.AI_ANALYZED_CNT || 0
    };
  } catch (err) {
    const tickets = (getLocalTickets()).filter(t => t.userId === userId);
    const alerts = (memoryStore.alerts || []).filter(a => a.userId === userId && !a.acknowledged);
    return {
      total: tickets.length,
      open: tickets.filter(t => String(t.status || '').toUpperCase() === 'OPEN').length,
      inProgress: tickets.filter(t => String(t.status || '').toUpperCase() === 'IN_PROGRESS').length,
      resolved: tickets.filter(t => String(t.status || '').toUpperCase() === 'RESOLVED').length,
      critical: tickets.filter(t => String(t.priority || '').toUpperCase() === 'CRITICAL').length,
      high: tickets.filter(t => String(t.priority || '').toUpperCase() === 'HIGH').length,
      medium: tickets.filter(t => String(t.priority || '').toUpperCase() === 'MEDIUM').length,
      low: tickets.filter(t => String(t.priority || '').toUpperCase() === 'LOW').length,
      activeAlerts: alerts.length,
      aiAnalyzed: tickets.filter(t => t.aiAnalyzed).length
    };
  }
}

function rowToRecord(row) {
  if (!row) return {};
  let payload = {};
  try {
    const rawPayload = toCleanString(row.PAYLOAD_JSON);
    payload = JSON.parse(rawPayload || '{}');
  } catch (e) {
    payload = {};
  }
  for (const [k, v] of Object.entries(payload)) {
    if (Buffer.isBuffer(v)) {
      payload[k] = v.toString('utf-8');
    } else if (v && typeof v === 'object' && v.type === 'Buffer' && Array.isArray(v.data)) {
      payload[k] = Buffer.from(v.data).toString('utf-8');
    }
  }
  return { id: row.ID, userId: row.USER_ID, ...payload, timestamp: row.TIMESTAMP };
}

async function getAlerts(userId) {
  try {
    const rows = await hana.query('SELECT * FROM ALERTS WHERE USER_ID = ? ORDER BY TIMESTAMP DESC', [userId]);
    return rows.map((r) => ({ ...rowToRecord(r), acknowledged: !!r.ACKNOWLEDGED }));
  } catch (err) {
    return (memoryStore.alerts || []).filter(a => a.userId === userId);
  }
}

async function addAlert(userId, alert) {
  const id = uuidv4();
  try {
    await hana.exec('INSERT INTO ALERTS (ID, USER_ID, ACKNOWLEDGED, PAYLOAD_JSON) VALUES (?, ?, FALSE, ?)', [id, userId, JSON.stringify(alert)]);
    const rows = await hana.query('SELECT * FROM ALERTS WHERE ID = ?', [id]);
    return { ...rowToRecord(rows[0]), acknowledged: false };
  } catch (err) {
    const a = { id, userId, ...alert, timestamp: new Date().toISOString(), acknowledged: false };
    memoryStore.alerts.unshift(a);
    return a;
  }
}

async function acknowledgeAlert(id, userId) {
  try {
    await hana.exec('UPDATE ALERTS SET ACKNOWLEDGED = TRUE WHERE ID = ? AND USER_ID = ?', [id, userId]);
    const rows = await hana.query('SELECT * FROM ALERTS WHERE ID = ? AND USER_ID = ?', [id, userId]);
    return rows[0] ? { ...rowToRecord(rows[0]), acknowledged: true } : null;
  } catch (err) {
    const a = (memoryStore.alerts || []).find(x => x.id === id && x.userId === userId);
    if (a) a.acknowledged = true;
    return a || null;
  }
}

async function getMonitoringLogs(userId) {
  try {
    const rows = await hana.query('SELECT * FROM MONITORING_LOGS WHERE USER_ID = ? ORDER BY TIMESTAMP DESC LIMIT 500', [userId]);
    return rows.map(rowToRecord);
  } catch (err) {
    return (memoryStore.monitoringLogs || []).filter(l => l.userId === userId);
  }
}

async function addMonitoringLog(userId, log) {
  const id = uuidv4();
  try {
    await hana.exec('INSERT INTO MONITORING_LOGS (ID, USER_ID, PAYLOAD_JSON) VALUES (?, ?, ?)', [id, userId, JSON.stringify(log)]);
    await hana.exec(
      `DELETE FROM MONITORING_LOGS WHERE USER_ID = ? AND ID NOT IN
       (SELECT ID FROM (SELECT ID FROM MONITORING_LOGS WHERE USER_ID = ? ORDER BY TIMESTAMP DESC LIMIT 500))`,
      [userId, userId]
    );
    const rows = await hana.query('SELECT * FROM MONITORING_LOGS WHERE ID = ?', [id]);
    return rowToRecord(rows[0]);
  } catch (err) {
    const l = { id, userId, ...log, timestamp: new Date().toISOString() };
    memoryStore.monitoringLogs.unshift(l);
    if (memoryStore.monitoringLogs.length > 500) memoryStore.monitoringLogs.length = 500;
    return l;
  }
}

async function addAgentLog(userId, log) {
  const id = uuidv4();
  try {
    await hana.exec('INSERT INTO AGENT_LOGS (ID, USER_ID, PAYLOAD_JSON) VALUES (?, ?, ?)', [id, userId, JSON.stringify(log)]);
    await hana.exec(
      `DELETE FROM AGENT_LOGS WHERE USER_ID = ? AND ID NOT IN
       (SELECT ID FROM (SELECT ID FROM AGENT_LOGS WHERE USER_ID = ? ORDER BY TIMESTAMP DESC LIMIT 200))`,
      [userId, userId]
    );
    const rows = await hana.query('SELECT * FROM AGENT_LOGS WHERE ID = ?', [id]);
    return rowToRecord(rows[0]);
  } catch (err) {
    const l = { id, userId, ...log, timestamp: new Date().toISOString() };
    memoryStore.agentLogs.unshift(l);
    if (memoryStore.agentLogs.length > 200) memoryStore.agentLogs.length = 200;
    return l;
  }
}

async function getAgentLogs(userId) {
  try {
    const rows = await hana.query('SELECT * FROM AGENT_LOGS WHERE USER_ID = ? ORDER BY TIMESTAMP DESC LIMIT 200', [userId]);
    return rows.map(rowToRecord);
  } catch (err) {
    return (memoryStore.agentLogs || []).filter(l => l.userId === userId);
  }
}

module.exports = {
  getTickets,
  getTicketById,
  createTicket,
  updateTicket,
  deleteTicket,
  findDuplicateTicket,
  getStats,
  getAlerts,
  addAlert,
  acknowledgeAlert,
  getMonitoringLogs,
  addMonitoringLog,
  addAgentLog,
  getAgentLogs
};