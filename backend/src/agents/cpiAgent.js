const { classifyError } = require('../services/classificationService');
const { sendAlertEmail } = require('../services/emailService');
const logger = require('../utils/logger');
const dataStore = require('../utils/dataStore');
const { broadcastEvent } = require('../services/websocketService');
const { normalizeFingerprint, createIssueFingerprint, createMessageFingerprint } = require('../utils/fingerprint');
const aiService = require('../services/ai/aiService');


// ─── AI Provider Configuration ─────────────────────────────────────────────────
const AI_API_KEY = process.env.GROQ_API_KEY || process.env.AI_API_KEY || process.env.XAI_API_KEY;
const AI_MODEL = process.env.GROQ_MODEL || process.env.AI_MODEL || process.env.XAI_MODEL || 'llama-3.1-8b-instant';

if (!AI_API_KEY) {
  console.warn('[AI Agent] WARNING: GROQ_API_KEY is not set in .env');
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

function normalizeErrorCode(errorCode) {
  if (!errorCode) return '';
  return String(errorCode)
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_')
    .replace(/-/g, '_')
    .replace(/[^A-Z0-9_]/g, '_');
}

// Maps the internal priority word to the P1-P4 code used across the dashboard/UI.
function priorityToCode(priority) {
  switch (String(priority || '').toUpperCase()) {
    case 'CRITICAL': return 'P1';
    case 'HIGH': return 'P2';
    case 'MEDIUM': return 'P3';
    case 'LOW': return 'P4';
    default: return 'P3';
  }
}

// ─── Knowledge Base (RAG-lite) ────────────────────────────────────────────────
// Pulls previously RESOLVED tickets that match this incident's error code /
// iFlow / interface, so the AI grounds its root cause & fix in what actually
// worked before instead of guessing from scratch each time.
async function findSimilarResolvedTickets(userId, incidentData, limit = 3) {
  if (!userId) return [];
  try {
    const allTickets = await dataStore.getTickets(userId);
    const normalizedTarget = normalizeErrorCode(incidentData.errorCode);
    const targetIflow = (incidentData.iflow || incidentData.interface || '').toLowerCase();

    const matches = allTickets.filter(t => {
      if (String(t.status).toUpperCase() !== 'RESOLVED') return false;
      const sameError = normalizeErrorCode(t.errorCode) === normalizedTarget && normalizedTarget;
      const sameFlow = targetIflow && (t.iflow || t.interface || '').toLowerCase() === targetIflow;
      return sameError || sameFlow;
    });

    // Most recently resolved first; keep only the fields relevant to grounding
    // and trim their length so we don't blow the prompt's token budget.
    return matches
      .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0))
      .slice(0, limit)
      .map(t => ({
        ticketNumber: t.ticketNumber,
        errorCode: t.errorCode,
        iflow: t.iflow || t.interface,
        rootCause: (t.rootCause || '').slice(0, 220),
        recommendation: (t.recommendation || '').slice(0, 300)
      }));
  } catch (err) {
    logger.error(`[AI Agent] Similar-incident lookup failed: ${err.message}`);
    return [];
  }
}

// ─── AI Root Cause Analysis ───────────────────────────────────────────────────
async function analyzeIncidentWithAI(incidentData, userId, aiOverride) {
  logger.info(`[AI Agent] AI analyzing: ${incidentData.errorCode}`);

  const knowledge = await findSimilarResolvedTickets(userId, incidentData);

  const systemPrompt = `You are an expert SAP Cloud Platform Integration (CPI) support engineer.
Analyze integration failures and respond ONLY with a valid JSON object.
No markdown, no backticks, no explanation — pure JSON only.
If similar past incidents are provided, prefer a fix consistent with what already worked before, and say so in "recommendation".`;

  const knowledgeBlock = knowledge.length
    ? `\n\nSIMILAR PAST INCIDENTS (already resolved — reuse this fix if it applies):\n${knowledge
      .map(k => `- [${k.ticketNumber}] ${k.errorCode} on ${k.iflow}\n  Root cause: ${k.rootCause}\n  Fix that worked: ${k.recommendation}`)
      .join('\n')}`
    : '';

  const userMessage = `Analyze this SAP CPI integration failure and return ONLY this JSON structure:
{
  "rootCause": "detailed technical root cause",
  "evidence": "specific evidence from the error data",
  "impact": "business impact on operations",
  "recommendation": "numbered step-by-step fix — say exactly where in CPI to make the change (iFlow name, step/adapter, Groovy script, mapping, or credential/connection config)",
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
Timestamp      : ${incidentData.timestamp || new Date().toISOString()}${knowledgeBlock}`;

  try {
    const analysis = await aiService.generateStructuredJSON(systemPrompt, userMessage, aiOverride);
    logger.info(`[AI Agent] Analysis complete for ${incidentData.errorCode} (provider: ${aiService.getProviderInfo(aiOverride).provider})`);
    return analysis;
  } catch (err) {
    logger.error(`[AI Agent] AI analysis failed: ${err.message}`);
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
async function processIncident(incidentData, userId, aiOverride) {
  logger.info(`[AI Agent] Processing incident: ${incidentData.errorCode}`);

  broadcastEvent('agent_activity', {
    message: `🔍 AI analyzing: ${incidentData.errorCode} in ${incidentData.iflow || incidentData.interface}`,
    type: 'ANALYZING',
    timestamp: new Date().toISOString()
  }, userId);

  // Step 1 —  AI Root Cause Analysis (grounded in similar past-resolved tickets)
  const analysis = await analyzeIncidentWithAI(incidentData, userId, aiOverride);

  // Step 2 — Classification (P1/P2/P3/P4) — this is the single source of truth
  // for priority. It MUST drive the ticket's actual priority; it used to be
  // discarded in favor of a random pick, which is why priorities shown on the
  // dashboard never matched what the AI Agent said.
  const classification = classifyError({
    ...incidentData,
    rootCause: analysis.rootCause,
    errorMessage: incidentData.errorMessage
  });

  const priority = classification.priority; // CRITICAL | HIGH | MEDIUM | LOW  →  P1 | P2 | P3 | P4
  const normalizedErrorCode = normalizeErrorCode(incidentData.errorCode);
  const category = normalizedErrorCode && ERROR_CATEGORIES[normalizedErrorCode]
    ? ERROR_CATEGORIES[normalizedErrorCode] : 'GENERAL';
  const team = TEAM_ASSIGNMENT[incidentData.interface] || TEAM_ASSIGNMENT['DEFAULT'];

  logger.info(`[AI Agent] Classification: ${classification.priorityCode} | CreateJira: ${classification.createJira} | SendEmail: ${classification.sendEmail}`);

  // P4 LOW — just log, no ticket, no Jira, no email
  if (!classification.createJira) {
    logger.info(`[AI Agent] P4/LOW issue detected — logging only, no ticket created`);
    await dataStore.addMonitoringLog(userId, {
      type: 'INFO',
      message: `P4 issue detected in ${incidentData.iflow || incidentData.interface} — logged only`,
      status: 'OK'
    });
    return { ticket: null, analysis, classification };
  }


  // Step 4.5 — Prevent duplicate tickets for the same iFlow issue
  const incidentFingerprint = normalizeFingerprint(
    createIssueFingerprint({
      iflow: incidentData.iflow || incidentData.interface,
      packageId: incidentData.packageId,
      packageName: incidentData.packageName,
      errorCode: incidentData.errorCode,
      errorMessage: incidentData.errorMessage
    })
  );

  const existingTicket = (await dataStore.getTickets(userId)).find(t => {
    const ticketIssueFingerprint = t.issueFingerprint
      ? normalizeFingerprint(t.issueFingerprint)
      : normalizeFingerprint(createIssueFingerprint({
        iflow: t.iflow || t.interface,
        packageId: t.packageId,
        packageName: t.packageName,
        errorCode: t.errorCode,
        errorMessage: t.errorMessage
      }));

    return incidentFingerprint && ticketIssueFingerprint && incidentFingerprint === ticketIssueFingerprint;
  });

  if (existingTicket) {
    logger.info(`[AI Agent] Duplicate issue detected; existing ticket ${existingTicket.ticketNumber} will be reused.`);
    broadcastEvent('ticket_duplicate', {
      ticketNumber: existingTicket.ticketNumber,
      issue: incidentData,
      message: `Duplicate issue detected for ${incidentData.iflow || incidentData.interface}. No new ticket created.`,
      timestamp: new Date().toISOString()
    }, userId);
    return existingTicket;
  }

  // Step 5 — Create internal ticket
  const ticket = await dataStore.createTicket(userId, {
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
    issueFingerprint: createIssueFingerprint({
      iflow: incidentData.iflow || incidentData.interface,
      packageId: incidentData.packageId,
      packageName: incidentData.packageName,
      errorCode: incidentData.errorCode,
      errorMessage: incidentData.errorMessage
    }),
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
  const jiraStore = require('../utils/jiraStore');
  if (await jiraStore.isConfigured(userId)) {
    try {
      const { createJiraIssue } = require('../services/jiraService');
      const creds = await jiraStore.getCredentials(userId);
      jiraResult = await createJiraIssue(creds, ticket);
      await dataStore.updateTicket(ticket.id, userId, {
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
      }, userId);
    } catch (jiraErr) {
      logger.error(`[AI Agent] Jira creation failed: ${jiraErr.message}`);
    }
  }

  if (classification.sendEmail) {
    try {
      const updatedTicket = await dataStore.getTicketById(ticket.id, userId);
      await sendAlertEmail(updatedTicket, jiraResult?.externalNumber);
    } catch (emailErr) {
      logger.error(`[Email] Alert send failed: ${emailErr.message}`);
    }
  }

  // Step 7 — Log and broadcast
  await dataStore.addAgentLog(userId, {
    action: 'TICKET_CREATED',
    ticketId: ticket.id,
    ticketNumber: ticket.ticketNumber,
    errorCode: incidentData.errorCode,
    priority,
    assignedTeam: team,
    jiraKey: jiraResult?.externalNumber,
    message: `Ticket ${ticket.ticketNumber} created${jiraResult ? ` → Jira ${jiraResult.externalNumber}` : ''}`
  });

  await dataStore.addMonitoringLog(userId, {
    type: 'TICKET',
    message: `Grok AI created ${ticket.ticketNumber}${jiraResult ? ` (Jira: ${jiraResult.externalNumber})` : ''} for ${incidentData.errorCode}`,
    status: 'TICKET_CREATED'
  });

  broadcastEvent('ticket_created', {
    ticket: await dataStore.getTicketById(ticket.id),
    analysis,
    jiraResult,
    message: `✅ ${ticket.ticketNumber} created${jiraResult ? ` + Jira ${jiraResult.externalNumber}` : ''}`,
    timestamp: new Date().toISOString()
  }, userId);

  broadcastEvent('agent_activity', {
    message: `✅ ${ticket.ticketNumber} → ${team}${jiraResult ? ` → Jira ${jiraResult.externalNumber}` : ''}`,
    type: 'COMPLETED',
    timestamp: new Date().toISOString()
  }, userId);

  return { ticket: await dataStore.getTicketById(ticket.id), analysis, jiraResult };
}

// Token-Oriented Object Notation (TOON) serializer
// Compresses verbose JSON context into dense notation, saving 80%+ prompt tokens.
function formatTOON(ctx) {
  if (!ctx) return '@SYS_STATE{open:0,alerts:0,prio:[P1:0,P2:0,P3:0,P4:0]}';
  const p = ctx.priorityBreakdown || {};
  const prio = `P1:${p.P1_CRITICAL || 0},P2:${p.P2_HIGH || 0},P3:${p.P3_MEDIUM || 0},P4:${p.P4_LOW || 0}`;
  let out = `@SYS_STATE{open:${ctx.totalOpenTickets || 0},alerts:${ctx.activeAlerts || 0},prio:[${prio}]}`;

  if (ctx.matchedIncidents && ctx.matchedIncidents.length > 0) {
    out += '\n@MATCHED_INCIDENTS[\n';
    ctx.matchedIncidents.forEach(m => {
      out += `  #${m.ticketNumber}|${m.priorityCode}|${m.iflow || ''}|${m.status || ''}|cause:${(m.rootCause || '').slice(0, 160)}|rec:${(m.recommendation || '').slice(0, 160)}\n`;
    });
    out += ']';
  }

  if (ctx.openTicketsSummary && ctx.openTicketsSummary.length > 0) {
    out += '\n@ACTIVE_TICKETS[\n';
    ctx.openTicketsSummary.slice(0, 6).forEach(t => {
      out += `  #${t.ticketNumber}|${t.priorityCode}|${t.iflow || t.title || ''}|${t.status || ''}|team:${t.assignedTeam || 'CPI'}\n`;
    });
    out += ']';
  }
  return out;
}

// ─── AI Chat ──────────────────────────────────────────────────────────────────
async function runAIChat(messages, context, aiOverride) {
  const toonContext = formatTOON(context);
  const systemPrompt = `You are an expert Enterprise Integration & SAP CPI AI Operations Copilot with deep expertise across:
- SAP CPI / Cloud Integration (iFlows, adapters, message processing logs, Groovy scripts, mappings)
- Integration troubleshooting (HTTP 401/403/500, Postman & REST/SOAP auth, OAuth 2.0, SSL certificates, JMS queues, SFTP)
- ITSM incident resolution (root cause analysis, remediation steps, Jira/ServiceNow workflows)

Query Handling Instructions:
1. TECHNICAL TROUBLESHOOTING & GENERAL KNOWLEDGE:
   - When asked technical questions (e.g. how to fix Postman authentication errors, 401 unauthorized, OAuth setup, Groovy scripts, SAP architecture, or general questions like "what is earth"):
     Provide direct, comprehensive, and actionable step-by-step guidance immediately!
     NEVER refuse general or troubleshooting questions by claiming they aren't in the system context.
2. OPERATIONAL & SYSTEM TELEMETRY QUESTIONS:
   - When asked about current system state, open incidents, ticket counts, P1-P4 breakdown, or specific tickets (e.g. "show P1 incidents", "why is Customer_Master_Sync failing"):
     Ground your answer strictly in the LIVE TELEMETRY (TOON) below. Never hallucinate fake ticket numbers or counts not present in telemetry.

Format responses cleanly using Markdown (bold headings, numbered steps, code blocks). When diagnosing issues, provide structured branches: Root Cause -> Evidence -> Resolution Steps.

LIVE TELEMETRY (Token-Oriented Object Notation):
${toonContext}`;

  // Sanitize messages — providers require alternating user/assistant, starting with user.
  // Also cap history length: keeps token usage down and avoids drifting off old context.
  const MAX_TURNS = 8;
  const sanitized = messages
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .map(m => ({ role: m.role, content: m.content.trim() }))
    .slice(-MAX_TURNS);

  while (sanitized.length > 0 && sanitized[0].role !== 'user') sanitized.shift();

  if (sanitized.length === 0) throw new Error('No valid user message found');

  try {
    const response = await aiService.chat(sanitized, systemPrompt, aiOverride);
    return response;
  } catch (err) {
    logger.error(`[AI Agent] AI chat failed: ${err.message}`);
    const category = err.category ? ` (${err.category})` : '';
    return `I was unable to reach the ${aiOverride?.provider || 'configured'} AI service right now${category}. Check the API key in Settings > AI Configuration and try again.`;
  }
}

module.exports = {
  processIncident,
  analyzeIncidentWithAI,
  runAIChat,
  findSimilarResolvedTickets,
  priorityToCode,
  PRIORITY_RULES,
  TEAM_ASSIGNMENT,
  ERROR_CATEGORIES
};