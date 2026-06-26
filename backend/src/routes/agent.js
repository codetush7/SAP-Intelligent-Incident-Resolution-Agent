const express = require('express');
const router = express.Router();
const { processIncident, runAIChat } = require('../agents/cpiAgent');
const dataStore = require('../utils/dataStore');
const logger = require('../utils/logger');

// POST /api/agent/process-incident
router.post('/process-incident', async (req, res) => {
  try {
    const incidentData = req.body;
    if (!incidentData.errorCode) {
      return res.status(400).json({ error: 'errorCode is required' });
    }

    const result = await processIncident(incidentData);
    res.json({
      success: true,
      ticket: result.ticket,
      analysis: result.analysis,
      message: `Ticket ${result.ticket.ticketNumber} created successfully`
    });
  } catch (err) {
    logger.error('Agent process-incident error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/agent/chat
router.post('/chat', async (req, res) => {
  try {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages array is required' });
    }

    // Build context from current system state
    const context = {
      openTickets: dataStore.getStats().open,
      activeAlerts: dataStore.getStats().activeAlerts,
      recentTickets: dataStore.getTickets().slice(0, 3).map(t => ({
        ticketNumber: t.ticketNumber,
        title: t.title,
        priority: t.priority,
        status: t.status,
        category: t.category
      })),
      monitoringActive: true
    };

    const response = await runAIChat(messages, context);
    
    dataStore.addAgentLog({
      action: 'CHAT_INTERACTION',
      message: `AI chat response generated (${response.length} chars)`
    });

    res.json({ response, timestamp: new Date().toISOString() });
  } catch (err) {
    logger.error('Agent chat error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/agent/logs
router.get('/logs', (req, res) => {
  res.json(dataStore.getAgentLogs().slice(0, 50));
});

// POST /api/agent/simulate - Trigger a simulated incident for demo
router.post('/simulate', async (req, res) => {
  const { scenario } = req.body;
  
  const scenarios = {
    api_failure: {
      errorCode: 'HTTP_401',
      interface: 'Salesforce',
      iflow: 'SF_Order_Sync_v2',
      errorMessage: '401 Unauthorized - Bearer token expired',
      payload: { endpoint: 'https://api.salesforce.com/v58.0/orders', statusCode: 401 }
    },
    queue_buildup: {
      errorCode: 'QUEUE_THRESHOLD_EXCEEDED',
      interface: 'SAP ECC',
      iflow: 'ECC_Order_Processing',
      queueName: 'OrderProcessingQueue',
      queueSize: 6500,
      errorMessage: 'JMS queue exceeded 5000 message threshold'
    },
    cert_expiry: {
      errorCode: 'CERT_EXPIRY_WARNING',
      interface: 'Banking API',
      iflow: 'Banking_Payment_Gateway',
      certName: 'banking-ssl-cert',
      daysUntilExpiry: 5,
      errorMessage: 'SSL Certificate expiring in 5 days'
    },
    sftp_failure: {
      errorCode: 'SFTP_AUTH_FAILURE',
      interface: 'SFTP',
      iflow: 'Finance_File_Transfer_v1',
      sftpHost: 'sftp.finance.com',
      errorMessage: 'SSH key authentication failed'
    },
    mapping_error: {
      errorCode: 'MAPPING_EXCEPTION',
      interface: 'SAP ECC',
      iflow: 'Customer_Data_Sync_v3',
      failedField: 'CustomerID',
      errorMessage: 'NullPointerException: Required field CustomerID is null'
    }
  };

  const incidentData = scenarios[scenario] || scenarios['api_failure'];

  try {
    const result = await processIncident({ ...incidentData, timestamp: new Date().toISOString() });
    res.json({
      success: true,
      ticket: result.ticket,
      analysis: result.analysis,
      scenario,
      message: `Simulated incident processed. Ticket ${result.ticket.ticketNumber} created.`
    });
  } catch (err) {
    logger.error('Simulate error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
