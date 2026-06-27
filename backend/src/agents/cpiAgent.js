const logger = require('../utils/logger');
const dataStore = require('../utils/dataStore');
const { broadcastEvent } = require('../services/websocketService');
const Groq = require('groq-sdk');

// ─── AI Provider Configuration ─────────────────────────────────────────────────
const AI_API_KEY = process.env.GROQ_API_KEY || process.env.AI_API_KEY || process.env.XAI_API_KEY;
const AI_MODEL = process.env.GROQ_MODEL || process.env.AI_MODEL || process.env.XAI_MODEL || 'llama-3.1-8b-instant';

if (!AI_API_KEY) {
  console.warn('[AI Agent] WARNING: GROQ_API_KEY is not set in .env');
}

const groqClient = new Groq({
  apiKey: AI_API_KEY
});

function formatApiError(err) {
  if (err.response) {
    return `HTTP ${err.response.status}: ${JSON.stringify(err.response.data)}`;
  }
  return err.message;
}

async function callGrok(messages, systemPrompt) {
  if (!AI_API_KEY) {
    throw new Error('GROQ_API_KEY is not configured. Please set it in backend/.env and restart the server.');
  }

  try {
    const response = await groqClient.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages
      ],
      model: AI_MODEL,
      temperature: 0.2
    });

    return response?.choices?.[0]?.message?.content || '';
  } catch (err) {
    const errorDetail = formatApiError(err);
    logger.error(`[AI Agent] AI request failed: ${errorDetail}`);
    throw new Error(`AI API request failed: ${errorDetail}`);
  }
}

const PRIORITY_RULES = {
  'QUEUE_THRESHOLD_EXCEEDED': (d) => d.queueSize > 5000 ? 'CRITICAL' : d.queueSize > 1000 ? 'HIGH' : 'MEDIUM',
  'CERT_EXPIRY_WARNING': (d) => d.daysUntilExpiry <= 7 ? 'CRITICAL' : d.daysUntilExpiry <= 14 ? 'HIGH' : 'MEDIUM',
  'HTTP_503': () => 'CRITICAL',
  'HTTP_500': () => 'HIGH',
  'HTTP_401': () => 'HIGH',
  'HTTP_403': () => 'HIGH',
  'SFTP_AUTH_FAILURE': () => 'HIGH',
  'PKIX_CERT_ERROR': () => 'HIGH',
  'OAUTH_TOKEN_EXPIRED': () => 'HIGH',
  'DATA_STORE_FAILURE': () => 'HIGH',
  'MAPPING_EXCEPTION': () => 'MEDIUM',
  'GENERAL_ERROR': () => 'MEDIUM'
};

const TEAM_ASSIGNMENT = {
  'SAP ECC': 'SAP Team',
  'Salesforce': 'CRM Team',
  'SFTP': 'Middleware Team',
  'Banking API': 'External Vendor Team',
  'S/4HANA': 'SAP Team',
  'Workday': 'HR Systems Team',
  'SAP CPI Keystore': 'Middleware Team',
  'SAP CPI JMS': 'Middleware Team',
  'DEFAULT': 'Middleware Team'
};

const ERROR_CATEGORIES = {
  'HTTP_401': 'API_CONNECTIVITY', 'HTTP_403': 'API_CONNECTIVITY',
  'HTTP_500': 'API_CONNECTIVITY', 'HTTP_503': 'API_CONNECTIVITY',
  'SFTP_AUTH_FAILURE': 'SFTP_CONNECTION', 'SFTP_HOST_UNREACHABLE': 'SFTP_CONNECTION',
  'MAPPING_EXCEPTION': 'MESSAGE_MAPPING',
  'QUEUE_THRESHOLD_EXCEEDED': 'JMS_QUEUE',
  'DATA_STORE_FAILURE': 'DATA_STORE',
  'CERT_EXPIRY_WARNING': 'CERTIFICATE_EXPIRY', 'PKIX_CERT_ERROR': 'CERTIFICATE_EXPIRY',
  'OAUTH_TOKEN_EXPIRED': 'OAUTH_TOKEN',
  'GENERAL_ERROR': 'GENERAL'
};

// ─── AI Root Cause Analysis ───────────────────────────────────────────────────
async function analyzeIncidentWithAI(incidentData) {
  logger.info(`[AI Agent] Grok analyzing: ${incidentData.errorCode}`);

  const systemPrompt = `You are an expert SAP Cloud Platform Integration (CPI) support engineer.
Analyze integration failures and respond ONLY with a valid JSON object.
No markdown, no backticks, no explanation — pure JSON only.`;

  const userMessage = `Analyze this SAP CPI integration failure and return ONLY this JSON structure:
{
  "rootCause": "detailed technical root cause",
  "evidence": "specific evidence from the error data",
  "impact": "business impact on operations",
  "recommendation": "numbered step-by-step fix instructions",
  "suggestedTitle": "concise incident title under 80 chars",
  "additionalContext": "extra technical notes or warnings"
}

INCIDENT DATA:
Error Code     : ${incidentData.errorCode}
Interface      : ${incidentData.interface || 'Unknown'}
iFlow Name     : ${incidentData.iflow || 'Unknown'}
Error Message  : ${incidentData.errorMessage || 'N/A'}
SAP Message ID : ${incidentData.sapMessageGuid || 'N/A'}
Payload        : ${JSON.stringify(incidentData.payload || {})}
Timestamp      : ${incidentData.timestamp || new Date().toISOString()}`;

  try {
    const text = await callGrok(
      [{ role: 'user', content: userMessage }],
      systemPrompt
    );

    const clean = text.trim().replace(/```json|```/g, '').trim();
    const analysis = JSON.parse(clean);
    logger.info(`[AI Agent] Grok analysis complete for ${incidentData.errorCode}`);
    return analysis;
  } catch (err) {
    logger.error(`[AI Agent] Grok analysis failed: ${err.message}`);
    return {
      rootCause: `${incidentData.errorCode} detected in ${incidentData.interface || 'unknown interface'}`,
      evidence: incidentData.errorMessage || 'See error code',
      impact: 'Integration flow disrupted — business transactions may be affected',
      recommendation: '1. Check SAP CPI message processing logs\n2. Verify system connectivity\n3. Review iFlow configuration',
      suggestedTitle: `${incidentData.errorCode} - ${incidentData.iflow || incidentData.interface || 'CPI'} Failure`,
      additionalContext: 'AI analysis unavailable or failed. Manual review required.'
    };
  }
}

// ─── Process Incident (Full Agent Flow) ──────────────────────────────────────
async function processIncident(incidentData) {
  logger.info(`[AI Agent] Processing incident: ${incidentData.errorCode}`);

  broadcastEvent('agent_activity', {
    message: `🔍 Grok AI analyzing: ${incidentData.errorCode} in ${incidentData.iflow || incidentData.interface}`,
    type: 'ANALYZING',
    timestamp: new Date().toISOString()
  });

  // Step 1 — Grok AI Root Cause Analysis
  const analysis = await analyzeIncidentWithAI(incidentData);

  // Step 2 — Smart priority
  const priorityFn = PRIORITY_RULES[incidentData.errorCode];
  const priority = priorityFn ? priorityFn(incidentData) : 'MEDIUM';

  // Step 3 — Team assignment
  const team = TEAM_ASSIGNMENT[incidentData.interface] || TEAM_ASSIGNMENT['DEFAULT'];

  // Step 4 — Category
  const category = ERROR_CATEGORIES[incidentData.errorCode] || 'GENERAL';

  // Step 4.5 — Prevent duplicate tickets for the same iFlow issue
  const existingTicket = dataStore.getTickets().find(t =>
    t.status !== 'RESOLVED' &&
    ((incidentData.sapMessageGuid && t.sapMessageGuid === incidentData.sapMessageGuid) ||
     (incidentData.issueFingerprint && t.issueFingerprint === `${incidentData.iflow || ''}|${incidentData.errorCode || ''}|${incidentData.errorMessage || ''}`))
  );

  if (existingTicket) {
    logger.info(`[AI Agent] Duplicate issue detected; existing ticket ${existingTicket.ticketNumber} will be reused.`);
    broadcastEvent('ticket_duplicate', {
      ticketNumber: existingTicket.ticketNumber,
      issue: incidentData,
      message: `Duplicate issue detected for ${incidentData.iflow || incidentData.interface}. No new ticket created.`,
      timestamp: new Date().toISOString()
    });
    return existingTicket;
  }

  // Step 5 — Create internal ticket
  const ticket = dataStore.createTicket({
    title: analysis.suggestedTitle || `${incidentData.errorCode} - ${incidentData.interface}`,
    description: `${analysis.rootCause}\n\nEvidence: ${analysis.evidence}\n\nImpact: ${analysis.impact}`,
    priority,
    status: 'OPEN',
    category,
    assignedTeam: team,
    interface: incidentData.interface,
    iflow: incidentData.iflow,
    packageName: incidentData.packageName,
    iflowId: incidentData.iflowId,
    sender: incidentData.sender,
    receiver: incidentData.receiver,
    errorId: incidentData.errorId,
    errorTimestamp: incidentData.errorTimestamp,
    adapterDetails: incidentData.adapterDetails,
    protocol: incidentData.protocol,
    errorMessage: incidentData.errorMessage,
    issueFingerprint: `${incidentData.iflow || ''}|${incidentData.errorCode || ''}|${incidentData.errorMessage || ''}`,
    rootCause: analysis.rootCause,
    recommendation: analysis.recommendation,
    evidence: analysis.evidence,
    impact: analysis.impact,
    additionalContext: analysis.additionalContext,
    systemSource: 'SAP_CPI_AI_AGENT',
    errorCode: incidentData.errorCode,
    sapMessageGuid: incidentData.sapMessageGuid,
    payload: JSON.stringify(incidentData.payload || {}),
    aiAnalyzed: true,
    certName: incidentData.certName,
    daysUntilExpiry: incidentData.daysUntilExpiry,
    queueSize: incidentData.queueSize,
    packageId: incidentData.packageId,
    packageName: incidentData.packageName,
    iflowId: incidentData.iflowId,
    sender: incidentData.sender,
    receiver: incidentData.receiver,
    correlationId: incidentData.correlationId,
    errorTimestamp: incidentData.errorTimestamp,
    monitorUrl: incidentData.monitorUrl,
  });

  // Step 6 — Auto-create Jira ticket if configured
  let jiraResult = null;
  if (process.env.FRESHDESK_API_KEY &&
    process.env.FRESHDESK_DOMAIN) {
  try {
    const { createTicket: createFreshdeskTicket } = require('../services/freshdeskService');
    jiraResult = await createFreshdeskTicket(ticket);
      dataStore.updateTicket(ticket.id, {
        jiraId: jiraResult.externalId,
        jiraKey: jiraResult.externalNumber,
        jiraUrl: jiraResult.externalUrl
      });
      logger.info(`[AI Agent] Jira issue created: ${jiraResult.externalNumber}`);
      broadcastEvent('jira_created', {
        ticketNumber: ticket.ticketNumber,
        jiraKey: jiraResult.externalNumber,
        jiraUrl: jiraResult.externalUrl,
        message: `🎫 Jira ${jiraResult.externalNumber} created`,
        timestamp: new Date().toISOString()
      });
    } catch (jiraErr) {
      logger.error(`[AI Agent] Jira creation failed: ${jiraErr.message}`);
    }
  }

  // Step 7 — Log and broadcast
  dataStore.addAgentLog({
    action: 'TICKET_CREATED',
    ticketId: ticket.id,
    ticketNumber: ticket.ticketNumber,
    errorCode: incidentData.errorCode,
    priority,
    assignedTeam: team,
    jiraKey: jiraResult?.externalNumber,
    message: `Ticket ${ticket.ticketNumber} created${jiraResult ? ` → Jira ${jiraResult.externalNumber}` : ''}`
  });

  dataStore.addMonitoringLog({
    type: 'TICKET',
    message: `Grok AI created ${ticket.ticketNumber}${jiraResult ? ` (Jira: ${jiraResult.externalNumber})` : ''} for ${incidentData.errorCode}`,
    status: 'TICKET_CREATED'
  });

  broadcastEvent('ticket_created', {
    ticket: dataStore.getTicketById(ticket.id),
    analysis,
    jiraResult,
    message: `✅ ${ticket.ticketNumber} created${jiraResult ? ` + Jira ${jiraResult.externalNumber}` : ''}`,
    timestamp: new Date().toISOString()
  });

  broadcastEvent('agent_activity', {
    message: `✅ ${ticket.ticketNumber} → ${team}${jiraResult ? ` → Jira ${jiraResult.externalNumber}` : ''}`,
    type: 'COMPLETED',
    timestamp: new Date().toISOString()
  });

  return { ticket: dataStore.getTicketById(ticket.id), analysis, jiraResult };
}

// ─── AI Chat ──────────────────────────────────────────────────────────────────
async function runAIChat(messages, context) {
  const systemPrompt = `You are an expert SAP CPI (Cloud Platform Integration) AI support agent with deep knowledge of:
- SAP CPI iFlows, adapters, message processing logs
- Integration error diagnosis and resolution steps
- JMS queues, SFTP, REST/SOAP APIs, certificates, OAuth
- Jira incident management

Current system context:
${JSON.stringify(context, null, 2)}

Be technical, precise, and actionable. Use numbered steps for recommendations.`;

  // Sanitize messages — Grok requires alternating user/assistant and must start with user
  const sanitized = messages
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .map(m => ({ role: m.role, content: m.content }));

  // Must start with user
  while (sanitized.length > 0 && sanitized[0].role !== 'user') sanitized.shift();

  if (sanitized.length === 0) throw new Error('No valid user message found');

  try {
    const response = await callGrok(sanitized, systemPrompt);
    return response;
  } catch (err) {
    logger.error(`[AI Agent] Grok chat failed: ${err.message}`);
    return `I was unable to reach the SAP CPI AI service right now. Please try again later or check the backend XAI API key and permissions.`;
  }
}

module.exports = {
  processIncident,
  analyzeIncidentWithAI,
  runAIChat,
  PRIORITY_RULES,
  TEAM_ASSIGNMENT,
  ERROR_CATEGORIES
};
