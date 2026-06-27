const axios = require('axios');
const logger = require('../utils/logger');

function freshdeskClient() {
  return axios.create({
    baseURL: `https://${process.env.FRESHDESK_DOMAIN}/api/v2`,
    auth: {
      username: process.env.FRESHDESK_API_KEY,
      password: 'X'
    },
    headers: {
      'Content-Type': 'application/json'
    },
    timeout: 20000
  });
}

function mapPriority(priority) {
  // Freshdesk: 1=Low, 2=Medium, 3=High, 4=Urgent
  const map = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };
  return map[priority] || 2;
}

function mapStatus(status) {
  // Freshdesk: 2=Open, 3=Pending, 4=Resolved, 5=Closed
  const map = { OPEN: 2, IN_PROGRESS: 3, RESOLVED: 4 };
  return map[status] || 2;
}

async function createTicket(ticketData) {
  if (!process.env.FRESHDESK_API_KEY) {
    throw new Error('Freshdesk not configured in .env');
  }

  logger.info(`[Freshdesk] Creating ticket for: ${ticketData.ticketNumber}`);

  const description = [
    `<b>SAP CPI AI Ticketing Agent — Auto Created</b>`,
    `<br><br>`,
    `<b>CPI Ticket Ref:</b> ${ticketData.ticketNumber}`,
    `<br><b>Interface:</b> ${ticketData.interface || 'N/A'}`,
    `<br><b>iFlow:</b> ${ticketData.iflow || 'N/A'}`,
    `<br><b>Package:</b> ${ticketData.packageName || 'N/A'}`,
    `<br><b>Error Code:</b> ${ticketData.errorCode || 'N/A'}`,
    `<br><b>Category:</b> ${ticketData.category || 'N/A'}`,
    `<br><br><b>ROOT CAUSE:</b><br>${ticketData.rootCause || 'Under investigation'}`,
    `<br><br><b>EVIDENCE:</b><br>${ticketData.evidence || 'N/A'}`,
    `<br><br><b>BUSINESS IMPACT:</b><br>${ticketData.impact || 'N/A'}`,
    `<br><br><b>RECOMMENDATION:</b><br>${ticketData.recommendation || 'N/A'}`,
    `<br><br><b>SAP Message GUID:</b> ${ticketData.sapMessageGuid || 'N/A'}`,
    `<br><b>Correlation ID:</b> ${ticketData.correlationId || 'N/A'}`,
    `<br><br><i>Created by SAP CPI AI Agent powered by Grok AI</i>`
  ].join('');

  const body = {
    subject: ticketData.title,
    description,
    email: process.env.FRESHDESK_EMAIL,
    priority: mapPriority(ticketData.priority),
    status: 2, // Open
    tags: ['SAP-CPI', 'AI-Auto-Created', ticketData.category || 'GENERAL'],
    custom_fields: {
      cf_cpi_ticket_ref: ticketData.ticketNumber,
      cf_iflow: ticketData.iflow || '',
      cf_error_code: ticketData.errorCode || ''
    }
  };

  const client = freshdeskClient();
  const response = await client.post('/tickets', body);

  logger.info(`[Freshdesk] Ticket created: #${response.data.id}`);

  return {
    externalId: response.data.id,
    externalNumber: `#${response.data.id}`,
    externalUrl: `https://${process.env.FRESHDESK_DOMAIN}/a/tickets/${response.data.id}`,
    platform: 'Freshdesk'
  };
}

async function updateTicket(ticketId, updates) {
  if (!process.env.FRESHDESK_API_KEY) return null;

  logger.info(`[Freshdesk] Updating ticket: ${ticketId}`);

  const body = {};
  if (updates.status) body.status = mapStatus(updates.status);
  if (updates.notes) {
    // Add a note
    const client = freshdeskClient();
    await client.post(`/tickets/${ticketId}/notes`, {
      body: updates.notes,
      private: false
    });
  }

  if (Object.keys(body).length > 0) {
    const client = freshdeskClient();
    await client.put(`/tickets/${ticketId}`, body);
  }

  return { updated: true, ticketId };
}

async function healthCheck() {
  try {
    const client = freshdeskClient();
    const res = await client.get('/tickets?per_page=1');
    return { connected: true, domain: process.env.FRESHDESK_DOMAIN };
  } catch (err) {
    return { connected: false, error: err.message };
  }
}

module.exports = { createTicket, updateTicket, healthCheck };