const dataStore = require('../utils/dataStore');
const requestContext = require('../utils/requestContext');
const aiService = require('./ai/aiService');
const logger = require('../utils/logger');

// ─── Step 1: Incident context (already on the ticket — no invention needed) ──
function collectIncidentContext(ticket) {
  return {
    ticketNumber: ticket.ticketNumber,
    iflow: ticket.iflow || 'N/A',
    errorCode: ticket.errorCode || 'N/A',
    errorMessage: ticket.errorMessage || 'N/A',
    adapter: ticket.adapterDetails || 'N/A',
    environment: ticket.environment || 'N/A',
    timestamp: ticket.errorTimestamp || ticket.createdAt,
    sapMessageId: ticket.sapMessageGuid || null,
    correlationId: ticket.correlationId || null,
    interface: ticket.interface || 'N/A',
    sender: ticket.sender || 'N/A',
    receiver: ticket.receiver || 'N/A',
    status: ticket.status,
    priority: ticket.priority
  };
}

// ─── Step 2: Evidence — real system data only, explicitly marked unavailable otherwise ──
async function collectEvidence(ticket, userId) {
  const evidence = [];

  evidence.push({
    label: 'Error Code',
    value: ticket.errorCode || 'N/A',
    source: 'RETRIEVED',
    detail: 'Captured at incident detection time'
  });
  evidence.push({
    label: 'Error Message',
    value: ticket.errorMessage || 'N/A',
    source: ticket.errorMessage ? 'RETRIEVED' : 'UNAVAILABLE'
  });
  evidence.push({
    label: 'SAP Message ID',
    value: ticket.sapMessageGuid || 'N/A',
    source: ticket.sapMessageGuid ? 'RETRIEVED' : 'UNAVAILABLE'
  });
  evidence.push({
    label: 'Adapter / Protocol',
    value: [ticket.adapterDetails, ticket.protocol].filter(Boolean).join(' · ') || 'N/A',
    source: ticket.adapterDetails ? 'RETRIEVED' : 'UNAVAILABLE'
  });

  // Real execution history — only if this user has a connected tenant AND the
  // ticket carries a real SAP message GUID. No fabrication if either is missing.
  let executionHistory = { source: 'UNAVAILABLE', reason: 'No SAP CPI tenant connected or no message ID on this ticket', runs: [] };
  if (ticket.sapMessageGuid) {
    try {
      const runs = await requestContext.runForUser(userId, async () => {
        const { getMessageRuns } = require('./sapCpiService');
        return getMessageRuns(ticket.sapMessageGuid);
      });
      executionHistory = { source: 'RETRIEVED', reason: null, runs: runs || [] };
      evidence.push({
        label: 'Execution History',
        value: `${(runs || []).length} run(s) retrieved from SAP CPI`,
        source: 'RETRIEVED'
      });
    } catch (err) {
      executionHistory = { source: 'UNAVAILABLE', reason: err.message, runs: [] };
      evidence.push({ label: 'Execution History', value: 'Could not be retrieved', source: 'UNAVAILABLE' });
    }
  } else {
    evidence.push({ label: 'Execution History', value: 'Not available — no SAP Message ID on this ticket', source: 'UNAVAILABLE' });
  }

  // Recent successful executions — honestly unavailable; sapCpiService has no
  // "successful messages" query today. Do not invent this.
  evidence.push({
    label: 'Recent Successful Executions',
    value: 'Not available — this data source is not currently integrated',
    source: 'UNAVAILABLE'
  });

  return { items: evidence, executionHistory };
}

// ─── Step 3: Change analysis — honest "no data" unless real signal exists ────
function getChangeContext(ticket) {
  // No system-of-record for credential/certificate/deployment changes is
  // wired into this app yet. Rather than guess, report that plainly — this
  // is exactly what the spec requires when no change data is available.
  return {
    changes: [],
    message: 'No relevant change detected from available data.'
  };
}

// ─── Step 4: Similar incidents — real comparison against this user's own tickets ──
function findSimilarIncidents(ticket, userId) {
  const allTickets = dataStore.getTickets(userId).filter(t => t.id !== ticket.id);

  const similar = allTickets
    .map(t => {
      let score = 0;
      const reasons = [];
      if (t.errorCode && t.errorCode === ticket.errorCode) { score += 40; reasons.push('same error code'); }
      if (t.iflow && t.iflow === ticket.iflow) { score += 30; reasons.push('same iFlow'); }
      if (t.category && t.category === ticket.category) { score += 20; reasons.push('same category'); }
      if (t.adapterDetails && ticket.adapterDetails && t.adapterDetails === ticket.adapterDetails) { score += 10; reasons.push('same adapter'); }
      return { ticket: t, score, reasons };
    })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return similar.map(x => ({
    ticketNumber: x.ticket.ticketNumber,
    similarity: x.score >= 60 ? 'HIGH' : x.score >= 30 ? 'MEDIUM' : 'LOW',
    matchedOn: x.reasons,
    previousRootCause: x.ticket.rootCause || 'Not recorded',
    previousResolution: x.ticket.resolutionNotes || (x.ticket.status === 'RESOLVED' ? 'Marked resolved (no notes recorded)' : null),
    outcome: x.ticket.status
  }));
}

// ─── Step 5: AI Root Cause Analysis — provider-agnostic via aiService ─────────
async function analyzeIncidentWithAI(context, evidence, changeContext, similarIncidents) {
  const systemPrompt = `You are an SAP Cloud Platform Integration (CPI) Incident Investigator.

Your job is to analyze the evidence you are given and produce a root cause analysis.
Rules you must follow strictly:
1. Base your root cause ONLY on the evidence provided below — never invent logs, metrics, SAP data, or configuration changes.
2. Every claim in your root cause must be traceable to an item in the evidence list.
3. If evidence is marked UNAVAILABLE, do not treat it as if it were retrieved.
4. State your confidence honestly (0-100). If evidence is thin, confidence must be low.
5. Never claim you executed, deployed, restarted, or modified anything — you only investigate and recommend.
6. Return ONLY valid JSON matching the exact schema below. No markdown, no commentary, no backticks.

Schema:
{
  "rootCause": "string",
  "confidence": 0,
  "evidence": ["string", "..."],
  "technicalExplanation": "string",
  "businessImpact": "string",
  "changeAnalysis": "string",
  "affectedComponents": ["string", "..."],
  "recommendedRemediation": ["string", "..."],
  "risk": "string",
  "additionalObservations": "string"
}`;

  const userPrompt = `INCIDENT CONTEXT:
${JSON.stringify(context, null, 2)}

EVIDENCE (source: RETRIEVED = real system data, UNAVAILABLE = not retrievable, do not treat as fact):
${JSON.stringify(evidence.items, null, 2)}

CHANGE CONTEXT:
${JSON.stringify(changeContext, null, 2)}

SIMILAR HISTORICAL INCIDENTS (this user's own past tickets):
${JSON.stringify(similarIncidents, null, 2)}

Produce your root cause analysis now, following the schema and rules exactly.`;

  try {
    const result = await aiService.generateStructuredJSON(systemPrompt, userPrompt);
    return { ...result, aiAvailable: true };
  } catch (err) {
    logger.error(`[Investigation] AI analysis failed: ${err.message}`);
    return {
      rootCause: 'AI analysis unavailable — unable to reach the AI provider.',
      confidence: 0,
      evidence: [],
      technicalExplanation: err.message,
      businessImpact: 'Unknown — manual investigation recommended.',
      changeAnalysis: changeContext.message,
      affectedComponents: [],
      recommendedRemediation: ['AI provider is unavailable. Escalate to manual investigation.'],
      risk: 'UNKNOWN',
      additionalObservations: '',
      aiAvailable: false
    };
  }
}

// ─── Orchestration ─────────────────────────────────────────────────────────
async function runInvestigation(ticketId, userId) {
  const timeline = [];
  const stamp = (step) => timeline.push({ step, timestamp: new Date().toISOString() });

  stamp('Incident Detected');

  const ticket = dataStore.getTicketById(ticketId, userId);
  if (!ticket) {
    throw new Error('Incident not found');
  }

  const context = collectIncidentContext(ticket);
  stamp('Evidence Collection');

  const evidence = await collectEvidence(ticket, userId);
  const changeContext = getChangeContext(ticket);
  const similarIncidents = findSimilarIncidents(ticket, userId);
  stamp('AI Analysis Started');

  stamp('Evidence Correlated');
  const rca = await analyzeIncidentWithAI(context, evidence, changeContext, similarIncidents);
  stamp('RCA Completed');

  stamp('Impact Assessed');
  stamp('Recommendation Generated');

  const confidenceLevel = rca.confidence >= 75 ? 'HIGH' : rca.confidence >= 40 ? 'MEDIUM' : 'LOW';

  return {
    incident: context,
    timeline,
    evidence: evidence.items,
    rca: {
      rootCause: rca.rootCause,
      confidence: rca.confidence,
      confidenceLevel,
      humanReviewRecommended: confidenceLevel === 'LOW',
      technicalExplanation: rca.technicalExplanation,
      supportingEvidence: rca.evidence || [],
      aiAvailable: rca.aiAvailable,
      provider: aiService.getProviderInfo()
    },
    changeAnalysis: changeContext,
    businessImpact: {
      summary: rca.businessImpact,
      affectedComponents: rca.affectedComponents || []
    },
    similarIncidents,
    recommendedRemediation: rca.recommendedRemediation || [],
    risk: rca.risk,
    additionalObservations: rca.additionalObservations
  };
}

module.exports = { runInvestigation };