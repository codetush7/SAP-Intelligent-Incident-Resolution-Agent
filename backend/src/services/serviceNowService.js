const axios = require('axios');
const logger = require('../utils/logger');

function snowClient() {
  return axios.create({
    baseURL: `${process.env.SERVICENOW_INSTANCE}/api/now`,
    auth: {
      username: process.env.SERVICENOW_USERNAME,
      password: process.env.SERVICENOW_PASSWORD
    },
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    timeout: 20000
  });
}

// ─── Priority mapping ─────────────────────────────────────────────────────────
function toSnowPriority(priority) {
  // ServiceNow: 1=Critical, 2=High, 3=Moderate, 4=Low
  const map = { CRITICAL: '1', HIGH: '2', MEDIUM: '3', LOW: '4' };
  return map[priority] || '3';
}

function toSnowUrgency(priority) {
  const map = { CRITICAL: '1', HIGH: '1', MEDIUM: '2', LOW: '3' };
  return map[priority] || '2';
}

function toSnowImpact(priority) {
  const map = { CRITICAL: '1', HIGH: '2', MEDIUM: '2', LOW: '3' };
  return map[priority] || '2';
}

// ─── Create Incident ──────────────────────────────────────────────────────────
async function createIncident(ticketData) {
  if (!process.env.SERVICENOW_INSTANCE || !process.env.SERVICENOW_USERNAME) {
    throw new Error('ServiceNow not configured in .env');
  }

  logger.info(`[ServiceNow] Creating incident for: ${ticketData.ticketNumber}`);

  const description = [
    `== SAP CPI AI Ticketing Agent - Auto Created Incident ==`,
    ``,
    `CPI Ticket Ref : ${ticketData.ticketNumber}`,
    `Interface      : ${ticketData.interface || 'N/A'}`,
    `iFlow          : ${ticketData.iflow || 'N/A'}`,
    `Error Code     : ${ticketData.errorCode || 'N/A'}`,
    `Category       : ${ticketData.category || 'N/A'}`,
    ``,
    `== ROOT CAUSE ==`,
    ticketData.rootCause || 'Under investigation',
    ``,
    `== EVIDENCE ==`,
    ticketData.evidence || ticketData.description || 'N/A',
    ``,
    `== BUSINESS IMPACT ==`,
    ticketData.impact || 'Integration flow disrupted',
    ``,
    `== RECOMMENDATION ==`,
    ticketData.recommendation || 'Review CPI logs',
    ``,
    `== PAYLOAD ==`,
    ticketData.payload || '{}',
    ``,
    `Created by: SAP CPI AI Agent (Powered by Gemini AI)`,
    `Created at: ${new Date().toISOString()}`
  ].join('\n');

  const body = {
    short_description: ticketData.title,
    description,
    category: 'software',
    subcategory: 'sap_cpi',
    priority: toSnowPriority(ticketData.priority),
    urgency: toSnowUrgency(ticketData.priority),
    impact: toSnowImpact(ticketData.priority),
    assignment_group: mapTeamToSnowGroup(ticketData.assignedTeam),
    caller_id: process.env.SERVICENOW_USERNAME,
    work_notes: `Auto-created by SAP CPI AI Agent\nInterface: ${ticketData.interface}\niFlow: ${ticketData.iflow}\nError: ${ticketData.errorCode}\nAI Analyzed: ${ticketData.aiAnalyzed ? 'Yes' : 'No'}`,
    u_source_system: 'SAP_CPI',
    u_cpi_ticket_ref: ticketData.ticketNumber
  };

  const client = snowClient();
  const response = await client.post('/table/incident', body);
  const result = response.data.result;

  logger.info(`[ServiceNow] Incident created: ${result.number} (sys_id: ${result.sys_id})`);

  return {
    externalId: result.sys_id,
    externalNumber: result.number,
    externalUrl: `${process.env.SERVICENOW_INSTANCE}/nav_to.do?uri=incident.do?sys_id=${result.sys_id}`,
    platform: 'ServiceNow',
    state: result.state
  };
}

// ─── Update Incident ──────────────────────────────────────────────────────────
async function updateIncident(sysId, updates) {
  if (!process.env.SERVICENOW_INSTANCE) return null;

  logger.info(`[ServiceNow] Updating incident: ${sysId}`);

  const stateMap = {
    'OPEN': '1',
    'IN_PROGRESS': '2',
    'RESOLVED': '6',
    'CLOSED': '7'
  };

  const body = {};
  if (updates.status) body.state = stateMap[updates.status] || '1';
  if (updates.notes) body.work_notes = updates.notes;
  if (updates.resolution) {
    body.close_notes = updates.resolution;
    body.close_code = 'Solved (Permanently)';
  }

  const client = snowClient();
  const response = await client.patch(`/table/incident/${sysId}`, body);
  return response.data.result;
}

// ─── Get Incident ─────────────────────────────────────────────────────────────
async function getIncident(sysId) {
  if (!process.env.SERVICENOW_INSTANCE) return null;

  const client = snowClient();
  const response = await client.get(`/table/incident/${sysId}`);
  return response.data.result;
}

// ─── Health Check ─────────────────────────────────────────────────────────────
async function healthCheck() {
  try {
    const client = snowClient();
    await client.get('/table/incident?sysparm_limit=1');
    return { connected: true, instance: process.env.SERVICENOW_INSTANCE };
  } catch (err) {
    return { connected: false, error: err.message };
  }
}

function mapTeamToSnowGroup(team) {
  const map = {
    'SAP Team': 'SAP Support',
    'CRM Team': 'CRM Support',
    'Middleware Team': 'Integration Team',
    'External Vendor Team': 'Vendor Management',
    'HR Systems Team': 'HR IT Support'
  };
  return map[team] || 'Integration Team';
}

module.exports = {
  createIncident,
  updateIncident,
  getIncident,
  healthCheck
};
