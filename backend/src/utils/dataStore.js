const { v4: uuidv4 } = require('uuid');

// In-memory stores (replace with a real DB in production)
const store = {
  tickets: [],
  incidents: [],
  monitoringLogs: [],
  analysisResults: [],
  alerts: [],
  agentLogs: []
};

// Seed with sample data for demonstration
function seedData() {
  const now = new Date();

  store.tickets = [
    {
      id: uuidv4(),
      ticketNumber: 'CPI-1001',
      title: 'API Connectivity Failure - Salesforce Integration',
      description: 'SAP CPI iFlow failed to connect to Salesforce REST API. HTTP 401 Unauthorized response received.',
      priority: 'HIGH',
      status: 'OPEN',
      category: 'API_CONNECTIVITY',
      assignedTeam: 'CRM Team',
      interface: 'Salesforce',
      iflow: 'SF_Order_Sync_v2',
      rootCause: 'OAuth token expired. Client credentials grant failed due to rotated client secret.',
      recommendation: 'Rotate OAuth credentials in SAP CPI Security Material. Update client_secret for Salesforce OAuth configuration.',
      createdAt: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(now - 30 * 60 * 1000).toISOString(),
      systemSource: 'SAP_CPI_MONITOR',
      errorCode: 'HTTP_401',
      payload: '{"error":"invalid_client","error_description":"AADSTS7000215: Invalid client secret provided."}',
      aiAnalyzed: true
    },
    {
      id: uuidv4(),
      ticketNumber: 'CPI-1002',
      title: 'JMS Queue Buildup - Order Processing Queue',
      description: 'JMS queue "OrderProcessingQueue" has exceeded threshold with 5,847 messages pending.',
      priority: 'CRITICAL',
      status: 'IN_PROGRESS',
      category: 'JMS_QUEUE',
      assignedTeam: 'SAP Team',
      interface: 'SAP ECC',
      iflow: 'ECC_Order_Processing',
      rootCause: 'Downstream SAP ECC system experiencing slow response times causing message backlog.',
      recommendation: 'Increase JMS consumers from 5 to 20. Investigate ECC performance. Consider temporary batch processing pause.',
      createdAt: new Date(now - 4 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(now - 15 * 60 * 1000).toISOString(),
      systemSource: 'SAP_CPI_MONITOR',
      errorCode: 'QUEUE_THRESHOLD_EXCEEDED',
      queueSize: 5847,
      aiAnalyzed: true
    },
    {
      id: uuidv4(),
      ticketNumber: 'CPI-1003',
      title: 'Certificate Expiry Warning - SSL Certificate',
      description: 'SSL certificate for external-banking-api.com expiring in 7 days.',
      priority: 'HIGH',
      status: 'OPEN',
      category: 'CERTIFICATE_EXPIRY',
      assignedTeam: 'External Vendor Team',
      interface: 'Banking API',
      iflow: 'Banking_Payment_Gateway',
      rootCause: 'SSL certificate approaching expiry date. Certificate expires on ' + new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toDateString(),
      recommendation: 'Renew SSL certificate immediately. Update keystore in SAP CPI Security Material. Test connectivity post-renewal.',
      createdAt: new Date(now - 1 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(now - 1 * 60 * 60 * 1000).toISOString(),
      systemSource: 'SAP_CPI_PROACTIVE',
      errorCode: 'CERT_EXPIRY_WARNING',
      daysUntilExpiry: 7,
      aiAnalyzed: true
    },
    {
      id: uuidv4(),
      ticketNumber: 'CPI-1004',
      title: 'SFTP Connection Failure - Finance File Transfer',
      description: 'CPI unable to connect to SFTP server sftp.finance-partner.com. SSH key authentication failed.',
      priority: 'HIGH',
      status: 'RESOLVED',
      category: 'SFTP_CONNECTION',
      assignedTeam: 'Middleware Team',
      interface: 'SFTP',
      iflow: 'Finance_File_Transfer_v1',
      rootCause: 'SSH private key mismatch. Server public key fingerprint changed after server migration.',
      recommendation: 'Update SSH known_hosts in CPI. Re-exchange public keys with SFTP server administrator.',
      createdAt: new Date(now - 8 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
      systemSource: 'SAP_CPI_MONITOR',
      errorCode: 'SFTP_AUTH_FAILURE',
      aiAnalyzed: true
    },
    {
      id: uuidv4(),
      ticketNumber: 'CPI-1005',
      title: 'Message Mapping Error - Customer Data Sync',
      description: 'Mapping exception in CustomerID field. Required field missing from source payload.',
      priority: 'MEDIUM',
      status: 'OPEN',
      category: 'MESSAGE_MAPPING',
      assignedTeam: 'SAP Team',
      interface: 'SAP ECC',
      iflow: 'Customer_Data_Sync_v3',
      rootCause: 'Source system sending incomplete payload. CustomerID field null for B2B partner customers.',
      recommendation: 'Add null check in mapping. Coordinate with source system team to ensure mandatory fields populated.',
      createdAt: new Date(now - 30 * 60 * 1000).toISOString(),
      updatedAt: new Date(now - 30 * 60 * 1000).toISOString(),
      systemSource: 'SAP_CPI_MONITOR',
      errorCode: 'MAPPING_EXCEPTION',
      failedField: 'CustomerID',
      aiAnalyzed: true
    }
  ];

  store.alerts = [
    {
      id: uuidv4(),
      type: 'QUEUE_BUILDUP',
      severity: 'CRITICAL',
      message: 'JMS Queue "OrderProcessingQueue" exceeded 5000 messages',
      timestamp: new Date(now - 4 * 60 * 60 * 1000).toISOString(),
      acknowledged: true
    },
    {
      id: uuidv4(),
      type: 'CERT_EXPIRY',
      severity: 'WARNING',
      message: 'Certificate for external-banking-api.com expires in 7 days',
      timestamp: new Date(now - 1 * 60 * 60 * 1000).toISOString(),
      acknowledged: false
    },
    {
      id: uuidv4(),
      type: 'API_FAILURE',
      severity: 'HIGH',
      message: 'Salesforce API returning HTTP 401 - Authentication failure',
      timestamp: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
      acknowledged: false
    }
  ];

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
    const ticket = {
      id: uuidv4(),
      ticketNumber: `CPI-${1000 + store.tickets.length + 1}`,
      ...data,
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
    store.tickets[idx] = { ...store.tickets[idx], ...data, updatedAt: new Date().toISOString() };
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
  getStats: () => {
    const tickets = store.tickets;
    return {
      total: tickets.length,
      open: tickets.filter(t => t.status === 'OPEN').length,
      inProgress: tickets.filter(t => t.status === 'IN_PROGRESS').length,
      resolved: tickets.filter(t => t.status === 'RESOLVED').length,
      critical: tickets.filter(t => t.priority === 'CRITICAL').length,
      high: tickets.filter(t => t.priority === 'HIGH').length,
      medium: tickets.filter(t => t.priority === 'MEDIUM').length,
      low: tickets.filter(t => t.priority === 'LOW').length,
      activeAlerts: store.alerts.filter(a => !a.acknowledged).length,
      aiAnalyzed: tickets.filter(t => t.aiAnalyzed).length
    };
  }
};
