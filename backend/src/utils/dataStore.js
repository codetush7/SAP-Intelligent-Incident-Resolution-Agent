const { v4: uuidv4 } = require('uuid');
const { normalizeFingerprint, createIssueFingerprint, createMessageFingerprint } = require('./fingerprint');

// In-memory stores (replace with a real DB in production)
const store = {
  tickets: [],
  incidents: [],
  monitoringLogs: [],
  analysisResults: [],
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

function findDuplicateTicket(ticketData) {
  const issueFingerprint = normalizeFingerprint(
    ticketData.issueFingerprint || createIssueFingerprint(ticketData)
  );
  const messageFingerprint = createMessageFingerprint({ sapMessageGuid: ticketData.sapMessageGuid });

  return store.tickets.find(existing => {
    // const existingMessageFingerprint = createMessageFingerprint({ sapMessageGuid: existing.sapMessageGuid });
    // if (messageFingerprint && existingMessageFingerprint && messageFingerprint === existingMessageFingerprint) {
    //   return true;
    // }

    const existingIssueFingerprint = existing.issueFingerprint
      ? normalizeFingerprint(existing.issueFingerprint)
      : normalizeFingerprint(createIssueFingerprint(existing));

    return issueFingerprint && existingIssueFingerprint === issueFingerprint;
  });
}

// Seed with sample data for demonstration
function seedData() {
  const now = new Date();

  store.tickets = [];

  store.alerts = [];

  store.monitoringLogs = [
    { id: uuidv4(), timestamp: new Date(now - 5 * 60 * 1000).toISOString(), type: 'CHECK', message: 'Message processing logs scanned - 0 new failures', status: 'OK' },
    { id: uuidv4(), timestamp: new Date(now - 10 * 60 * 1000).toISOString(), type: 'ALERT', message: 'JMS queue threshold exceeded - ticket auto-created', status: 'ACTION_TAKEN' },
    { id: uuidv4(), timestamp: new Date(now - 15 * 60 * 1000).toISOString(), type: 'CHECK', message: 'Certificate scan complete - 1 expiring soon', status: 'WARNING' },
    { id: uuidv4(), timestamp: new Date(now - 20 * 60 * 1000).toISOString(), type: 'CHECK', message: 'API health checks complete - all endpoints responsive', status: 'OK' },
    { id: uuidv4(), timestamp: new Date(now - 25 * 60 * 1000).toISOString(), type: 'TICKET', message: 'Auto-created ticket CPI-1002 for Salesforce OAuth failure', status: 'TICKET_CREATED' }
  ];
}

if (process.env.SEED_MOCK_DATA === 'true') {
  seedData();
}

module.exports = {
  getTickets: () => [...store.tickets],
  getTicketById: (id) => store.tickets.find(t => t.id === id),
  createTicket: (data) => {
    const duplicate = findDuplicateTicket(data);
    if (duplicate) {
      return duplicate;
    }

    const issueFingerprint = normalizeFingerprint(
      data.issueFingerprint || createIssueFingerprint(data)
    );

    const ticket = {
      id: uuidv4(),
      ticketNumber: `CPI-${1000 + store.tickets.length + 1}`,
      ...normalizeTicketData(data),
      issueFingerprint,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      aiAnalyzed: false
    };
    store.tickets.unshift(ticket);
    return ticket;
  },
  updateTicket: (id, data) => {
    const idx = store.tickets.findIndex(t => t.id === id);
    if (idx === -1) return null;
    store.tickets[idx] = { ...store.tickets[idx], ...normalizeTicketData(data), updatedAt: new Date().toISOString() };
    return store.tickets[idx];
  },
  deleteTicket: (id) => {
    const idx = store.tickets.findIndex(t => t.id === id);
    if (idx === -1) return false;
    store.tickets.splice(idx, 1);
    return true;
  },
  getAlerts: () => [...store.alerts],
  addAlert: (alert) => {
    const a = { id: uuidv4(), ...alert, timestamp: new Date().toISOString(), acknowledged: false };
    store.alerts.unshift(a);
    return a;
  },
  acknowledgeAlert: (id) => {
    const alert = store.alerts.find(a => a.id === id);
    if (alert) alert.acknowledged = true;
    return alert;
  },
  getMonitoringLogs: () => [...store.monitoringLogs],
  addMonitoringLog: (log) => {
    const l = { id: uuidv4(), ...log, timestamp: new Date().toISOString() };
    store.monitoringLogs.unshift(l);
    if (store.monitoringLogs.length > 500) store.monitoringLogs.pop();
    return l;
  },
  addAgentLog: (log) => {
    const l = { id: uuidv4(), ...log, timestamp: new Date().toISOString() };
    store.agentLogs.unshift(l);
    if (store.agentLogs.length > 200) store.agentLogs.pop();
    return l;
  },
  getAgentLogs: () => [...store.agentLogs],
  findDuplicateTicket,
  getStats: () => {
    const tickets = store.tickets;
    return {
      total: tickets.length,
      open: tickets.filter(t => String(t.status || '').toUpperCase() === 'OPEN').length,
      inProgress: tickets.filter(t => String(t.status || '').toUpperCase() === 'IN_PROGRESS').length,
      resolved: tickets.filter(t => String(t.status || '').toUpperCase() === 'RESOLVED').length,
      critical: tickets.filter(t => String(t.priority || '').toUpperCase() === 'CRITICAL').length,
      high: tickets.filter(t => String(t.priority || '').toUpperCase() === 'HIGH').length,
      medium: tickets.filter(t => String(t.priority || '').toUpperCase() === 'MEDIUM').length,
      low: tickets.filter(t => String(t.priority || '').toUpperCase() === 'LOW').length,
      activeAlerts: store.alerts.filter(a => !a.acknowledged).length,
      aiAnalyzed: tickets.filter(t => t.aiAnalyzed).length
    };
  }
};
