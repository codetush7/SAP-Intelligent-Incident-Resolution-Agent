const dataStore = require('../utils/dataStore');
const { createJiraIssue, updateJiraIssue } = require('../services/jiraService');
const jiraStore = require('../utils/jiraStore');
const { broadcastEvent } = require('../services/websocketService');
const requestContext = require('../utils/requestContext');
const logger = require('../utils/logger');

function listTickets(req, res) {
  const { status, priority, category, limit = 100 } = req.query;
  let tickets = dataStore.getTickets(req.user.id);
  if (status) tickets = tickets.filter(t => t.status === status.toUpperCase());
  if (priority) tickets = tickets.filter(t => t.priority === priority.toUpperCase());
  if (category) tickets = tickets.filter(t => t.category === category.toUpperCase());
  res.json(tickets.slice(0, parseInt(limit)));
}

function getTicketById(req, res) {
  const ticket = dataStore.getTicketById(req.params.id, req.user.id);
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
  res.json(ticket);
}

async function createTicket(req, res) {
  try {
    const { title, description, priority, category, interface: iface, iflow, errorCode } = req.body;
    if (!title || !priority) return res.status(400).json({ error: 'title and priority required' });

    const ticket = dataStore.createTicket(req.user.id, {
      title, description, priority, category,
      interface: iface, iflow, errorCode,
      status: 'OPEN',
      systemSource: 'MANUAL',
      assignedTeam: 'Middleware Team'
    });

    if (jiraStore.isConfigured(req.user.id)) {
      try {
        const creds = jiraStore.getCredentials(req.user.id);
        const result = await createJiraIssue(creds, ticket);
        dataStore.updateTicket(ticket.id, req.user.id, {
          jiraId: result.externalId,
          jiraKey: result.externalNumber,
          jiraUrl: result.externalUrl
        });
        ticket.jiraKey = result.externalNumber;
        ticket.jiraUrl = result.externalUrl;
      } catch (jiraErr) {
        logger.warn(`Jira sync failed: ${jiraErr.message}`);
      }
    }

    broadcastEvent('ticket_created', { ticket, message: `Ticket ${ticket.ticketNumber} created` }, req.user.id);
    res.status(201).json(ticket);
  } catch (err) {
    logger.error('Create ticket error:', err);
    res.status(500).json({ error: err.message });
  }
}

async function updateTicket(req, res) {
  const ticket = dataStore.updateTicket(req.params.id, req.user.id, req.body);
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

  if (ticket.jiraKey && req.body.status && jiraStore.isConfigured(req.user.id)) {
    try {
      const creds = jiraStore.getCredentials(req.user.id);
      await updateJiraIssue(creds, ticket.jiraKey, {
        status: req.body.status,
        notes: `Status updated to ${req.body.status} via SAP CPI Agent`
      });
    } catch (err) {
      logger.warn(`Jira status sync failed: ${err.message}`);
    }
  }

  broadcastEvent('ticket_updated', { ticket }, req.user.id);
  res.json(ticket);
}

async function applyFix(req, res) {
  try {
    const ticket = dataStore.getTicketById(req.params.id, req.user.id);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    const { fixAction } = req.body;
    let fixResult;
    let updatedTicket = ticket;

    try {
      const result = await requestContext.runForUser(req.user.id, async () => {
        const { fixIntegrationFlow } = require('../services/sapCpiService');
        return fixIntegrationFlow(ticket.iflowId || ticket.iflow || ticket.packageId || ticket.packageName);
      });
      fixResult = { applied: true, message: `SAP CPI fix action executed: ${result.action}` };
      updatedTicket = dataStore.updateTicket(req.params.id, req.user.id, {
        status: 'IN_PROGRESS',
        fixApplied: true,
        fixRequestedAt: new Date().toISOString(),
        fixResultMessage: fixResult.message,
        resolutionNotes: `${ticket.resolutionNotes || ''}\n${fixResult.message}`.trim()
      });
    } catch (err) {
      const message = err.message || 'SAP CPI fix failed';
      if (message.includes('disabled')) {
        fixResult = { applied: false, message };
        updatedTicket = dataStore.updateTicket(req.params.id, req.user.id, {
          fixApplied: false,
          fixRequestedAt: new Date().toISOString(),
          fixResultMessage: message
        });
      } else {
        logger.error(`Ticket fix failed: ${err.message}`);
        return res.status(500).json({ error: message });
      }
    }

    broadcastEvent('ticket_updated', { ticket: updatedTicket }, req.user.id);
    res.json({ ticket: updatedTicket, ...fixResult, fixAction });
  } catch (err) {
    logger.error('Ticket fix error:', err);
    res.status(500).json({ error: err.message });
  }
}

function deleteTicket(req, res) {
  const deleted = dataStore.deleteTicket(req.params.id, req.user.id);
  if (!deleted) return res.status(404).json({ error: 'Ticket not found' });
  res.json({ message: 'Ticket deleted' });
}

async function syncJira(req, res) {
  const ticket = dataStore.getTicketById(req.params.id, req.user.id);
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
  if (!jiraStore.isConfigured(req.user.id)) {
    return res.status(400).json({ error: 'Jira is not connected. Connect it in Tenant Connect.' });
  }
  try {
    const creds = jiraStore.getCredentials(req.user.id);
    const result = await createJiraIssue(creds, ticket);
    dataStore.updateTicket(req.params.id, req.user.id, {
      jiraId: result.externalId,
      jiraKey: result.externalNumber,
      jiraUrl: result.externalUrl
    });
    res.json({ message: `Synced to Jira: ${result.externalNumber}`, ...result });
  } catch (err) {
    res.status(500).json({ error: `Jira sync failed: ${err.message}` });
  }
}

module.exports = { listTickets, getTicketById, createTicket, updateTicket, applyFix, deleteTicket, syncJira };
