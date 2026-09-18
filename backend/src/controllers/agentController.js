const { processIncident, runAIChat, priorityToCode } = require('../agents/cpiAgent');
const dataStore = require('../utils/dataStore');
const aiService = require('../services/ai/aiService');
const logger = require('../utils/logger');

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

async function processIncidentHandler(req, res) {
  try {
    const incidentData = req.body;
    if (!incidentData.errorCode) {
      return res.status(400).json({ error: 'errorCode is required' });
    }

    const userId = req.user.id;
    const result = await processIncident(incidentData, userId);
    if (!result.ticket) {
      // P4/LOW — logged only, no ticket created
      return res.json({ success: true, ticket: null, analysis: result.analysis, message: 'Low-priority issue logged (no ticket needed).' });
    }
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
}

// Pull an AI provider/model override out of the request body, e.g. sent by
// the AgentPage provider dropdown: { provider: 'gemini', model: 'gemini-2.0-flash' }.
// The API key itself is never sent per-request — it's only ever read from
// Settings > AI Configuration (aiConfigStore) or the .env file.
function extractAiOverride(body) {
  if (!body || (!body.provider && !body.model)) return undefined;
  return { provider: body.provider, model: body.model };
}

// Builds the REAL, live context the AI is grounded in — P1-P4 breakdown plus
// a summary of open tickets. Anything the AI says about "how many P1s" or
// "which incidents" must trace back to this, not to the model's imagination.
async function buildLiveContext(userId, latestUserMessage) {
  const stats = await dataStore.getStats(userId);
  const allTickets = await dataStore.getTickets(userId);
  const openTickets = allTickets.filter(t => String(t.status).toUpperCase() !== 'RESOLVED');

  const priorityBreakdown = {
    P1_CRITICAL: stats.critical || 0,
    P2_HIGH: stats.high || 0,
    P3_MEDIUM: stats.medium || 0,
    P4_LOW: stats.low || 0
  };

  const openTicketsSummary = openTickets.slice(0, 15).map(t => ({
    ticketNumber: t.ticketNumber,
    priorityCode: priorityToCode(t.priority),
    title: t.title,
    iflow: t.iflow || t.interface,
    status: t.status,
    category: t.category,
    assignedTeam: t.assignedTeam,
    jiraKey: t.jiraKey
  }));

  // Keyword match against the user's question so specific "why is X failing?"
  // questions get the actual ticket's root cause/evidence/recommendation,
  // not a generic answer.
  let matchedIncidents = [];
  if (latestUserMessage) {
    const q = latestUserMessage.toLowerCase();
    matchedIncidents = allTickets
      .filter(t => {
        const haystack = `${t.iflow || ''} ${t.interface || ''} ${t.title || ''} ${t.ticketNumber || ''}`.toLowerCase();
        return haystack && q.split(/\s+/).some(word => word.length > 3 && haystack.includes(word));
      })
      .slice(0, 3)
      .map(t => ({
        ticketNumber: t.ticketNumber,
        priorityCode: priorityToCode(t.priority),
        status: t.status,
        iflow: t.iflow || t.interface,
        rootCause: (t.rootCause || '').slice(0, 300),
        evidence: (t.evidence || '').slice(0, 200),
        recommendation: (t.recommendation || '').slice(0, 400),
        jiraKey: t.jiraKey
      }));
  }

  return {
    totalOpenTickets: openTickets.length,
    activeAlerts: stats.activeAlerts,
    priorityBreakdown,
    openTicketsSummary,
    matchedIncidents,
    monitoringActive: true
  };
}

async function chat(req, res) {
  try {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages array is required' });
    }

    const userId = req.user.id;
    const latestUserMessage = [...messages].reverse().find(m => m.role === 'user')?.content || '';
    const context = await buildLiveContext(userId, latestUserMessage);
    const aiOverride = extractAiOverride(req.body);

    const response = await runAIChat(messages, context, aiOverride);

    await dataStore.addAgentLog(userId, {
      action: 'CHAT_INTERACTION',
      message: `AI chat response generated (${response.length} chars)`
    });

    res.json({
      response,
      provider: aiService.getProviderInfo(aiOverride),
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    logger.error('Agent chat error:', err);
    res.status(500).json({ error: err.message });
  }
}

// GET /api/agent/ai-config — which providers are configured + the active one
async function getAiConfig(req, res) {
  try {
    res.json({
      providers: aiService.getProviderStatus(),
      active: aiService.getProviderInfo()
    });
  } catch (err) {
    logger.error('Agent getAiConfig error:', err);
    res.status(500).json({ error: err.message });
  }
}

// POST /api/agent/ai-config — Settings > AI Configuration "Save" button
async function saveAiConfig(req, res) {
  try {
    const { provider, model, apiKey } = req.body;
    if (!provider || !model) {
      return res.status(400).json({ error: 'provider and model are required' });
    }
    aiService.saveProviderConfig({ provider, model, apiKey });
    res.json({ success: true, active: aiService.getProviderInfo() });
  } catch (err) {
    logger.error('Agent saveAiConfig error:', err);
    res.status(500).json({ error: err.message });
  }
}

async function getLogs(req, res) {
  try {
    const userId = req.user.id;
    res.json((await dataStore.getAgentLogs(userId)).slice(0, 50));
  } catch (err) {
    logger.error('Agent getLogs error:', err);
    res.status(500).json({ error: err.message });
  }
}

async function simulate(req, res) {
  const { scenario } = req.body;
  const incidentData = scenarios[scenario] || scenarios['api_failure'];

  try {
    const userId = req.user.id;
    const result = await processIncident({ ...incidentData, timestamp: new Date().toISOString() }, userId);
    if (!result.ticket) {
      // Classified P4/LOW — logged only, no ticket created. Not an error.
      return res.json({
        success: true,
        ticket: null,
        analysis: result.analysis,
        scenario,
        message: 'Simulated incident classified as low-priority (P4) — logged only, no ticket needed.'
      });
    }
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
}

module.exports = { processIncidentHandler, chat, getLogs, simulate, getAiConfig, saveAiConfig };
