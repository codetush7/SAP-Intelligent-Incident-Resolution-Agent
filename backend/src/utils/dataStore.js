const { v4: uuidv4 } = require('uuid');
const { normalizeFingerprint, createIssueFingerprint, createMessageFingerprint } = require('./fingerprint');

// In-memory, per-user scoped stores (replace with a real DB in production)
const store = {
  tickets: [],
  monitoringLogs: [],
  alerts: [],
  agentLogs: []
};

function normalizeTicketData(data = {}) {
  const normalized = { ...data };
  if (data.status !== undefined) normalized.status = String(data.status).toUpperCase();
  if (data.priority !== undefined) normalized.priority = String(data.priority).toUpperCase();
  if (data.category !== undefined) normalized.category = String(data.category).toUpperCase();
  return normalized;
}

function findDuplicateTicket(userId, ticketData) {
  const issueFingerprint = normalizeFingerprint(
    ticketData.issueFingerprint || createIssueFingerprint(ticketData)
  );
  return store.tickets.find(existing => {
    if (existing.userId !== userId) return false;
    const existingIssueFingerprint = existing.issueFingerprint
      ? normalizeFingerprint(existing.issueFingerprint)
      : normalizeFingerprint(createIssueFingerprint(existing));
    return issueFingerprint && existingIssueFingerprint === issueFingerprint;
  });
}

module.exports = {
  getTickets: (userId) => store.tickets.filter(t => t.userId === userId),
  getTicketById: (id, userId) => store.tickets.find(t => t.id === id && t.userId === userId),

  createTicket: (userId, data) => {
    const duplicate = findDuplicateTicket(userId, data);
    if (duplicate) return duplicate;

    const issueFingerprint = normalizeFingerprint(
      data.issueFingerprint || createIssueFingerprint(data)
    );

    const userTicketCount = store.tickets.filter(t => t.userId === userId).length;
    const ticket = {
      id: uuidv4(),
      userId,
      ticketNumber: `CPI-${1000 + userTicketCount + 1}`,
      ...normalizeTicketData(data),
      issueFingerprint,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      aiAnalyzed: false
    };
    store.tickets.unshift(ticket);
    return ticket;
  },

  updateTicket: (id, userId, data) => {
    const idx = store.tickets.findIndex(t => t.id === id && t.userId === userId);
    if (idx === -1) return null;
    store.tickets[idx] = { ...store.tickets[idx], ...normalizeTicketData(data), updatedAt: new Date().toISOString() };
    return store.tickets[idx];
  },

  deleteTicket: (id, userId) => {
    const idx = store.tickets.findIndex(t => t.id === id && t.userId === userId);
    if (idx === -1) return false;
    store.tickets.splice(idx, 1);
    return true;
  },

  getAlerts: (userId) => store.alerts.filter(a => a.userId === userId),
  addAlert: (userId, alert) => {
    const a = { id: uuidv4(), userId, ...alert, timestamp: new Date().toISOString(), acknowledged: false };
    store.alerts.unshift(a);
    return a;
  },
  acknowledgeAlert: (id, userId) => {
    const alert = store.alerts.find(a => a.id === id && a.userId === userId);
    if (alert) alert.acknowledged = true;
    return alert;
  },

  getMonitoringLogs: (userId) => store.monitoringLogs.filter(l => l.userId === userId),
  addMonitoringLog: (userId, log) => {
    const l = { id: uuidv4(), userId, ...log, timestamp: new Date().toISOString() };
    store.monitoringLogs.unshift(l);
    // Trim per-user rather than globally so one busy user can't starve others' log history
    const userLogs = store.monitoringLogs.filter(x => x.userId === userId);
    if (userLogs.length > 500) {
      const overflowIds = new Set(userLogs.slice(500).map(x => x.id));
      store.monitoringLogs = store.monitoringLogs.filter(x => !overflowIds.has(x.id));
    }
    return l;
  },

  addAgentLog: (userId, log) => {
    const l = { id: uuidv4(), userId, ...log, timestamp: new Date().toISOString() };
    store.agentLogs.unshift(l);
    const userLogs = store.agentLogs.filter(x => x.userId === userId);
    if (userLogs.length > 200) {
      const overflowIds = new Set(userLogs.slice(200).map(x => x.id));
      store.agentLogs = store.agentLogs.filter(x => !overflowIds.has(x.id));
    }
    return l;
  },
  getAgentLogs: (userId) => store.agentLogs.filter(l => l.userId === userId),

  findDuplicateTicket,

  getStats: (userId) => {
    const tickets = store.tickets.filter(t => t.userId === userId);
    return {
      total: tickets.length,
      open: tickets.filter(t => String(t.status || '').toUpperCase() === 'OPEN').length,
      inProgress: tickets.filter(t => String(t.status || '').toUpperCase() === 'IN_PROGRESS').length,
      resolved: tickets.filter(t => String(t.status || '').toUpperCase() === 'RESOLVED').length,
      critical: tickets.filter(t => String(t.priority || '').toUpperCase() === 'CRITICAL').length,
      high: tickets.filter(t => String(t.priority || '').toUpperCase() === 'HIGH').length,
      medium: tickets.filter(t => String(t.priority || '').toUpperCase() === 'MEDIUM').length,
      low: tickets.filter(t => String(t.priority || '').toUpperCase() === 'LOW').length,
      activeAlerts: store.alerts.filter(a => a.userId === userId && !a.acknowledged).length,
      aiAnalyzed: tickets.filter(t => t.aiAnalyzed).length
    };
  }
};