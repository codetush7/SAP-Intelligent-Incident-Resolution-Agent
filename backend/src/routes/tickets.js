const express = require('express');
const router = express.Router();
const dataStore = require('../utils/dataStore');
const { createJiraIssue, updateJiraIssue } = require('../services/jiraService');
const jiraStore = require('../utils/jiraStore');
const { broadcastEvent } = require('../services/websocketService');
const requestContext = require('../utils/requestContext');
const logger = require('../utils/logger');
const { requireAuth } = require('../middleware/authMiddleware');

router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const { status, priority, category, limit = 100 } = req.query;
    let tickets = await dataStore.getTickets(req.user.id);
    if (status) tickets = tickets.filter(t => t.status === status.toUpperCase());
    if (priority) tickets = tickets.filter(t => t.priority === priority.toUpperCase());
    if (category) tickets = tickets.filter(t => t.category === category.toUpperCase());
    res.json(tickets.slice(0, parseInt(limit, 10)));
  } catch (err) {
    logger.error(`[Tickets] Get tickets error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const ticket = await dataStore.getTicketById(req.params.id, req.user.id);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    res.json(ticket);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { title, description, priority, category, interface: iface, iflow, errorCode } = req.body;
    if (!title || !priority) return res.status(400).json({ error: 'title and priority required' });

    const ticket = await dataStore.createTicket(req.user.id, {
      title, description, priority, category,
      interface: iface, iflow, errorCode,
      status: 'OPEN',
      systemSource: 'MANUAL',
      assignedTeam: 'Middleware Team'
    });

    if (await jiraStore.isConfigured(req.user.id)) {
      try {
        const creds = await jiraStore.getCredentials(req.user.id);
        const result = await createJiraIssue(creds, ticket);
        await dataStore.updateTicket(ticket.id, req.user.id, {
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
});

router.patch('/:id', async (req, res) => {
  try {
    const ticket = await dataStore.updateTicket(req.params.id, req.user.id, req.body);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    if (ticket.jiraKey && req.body.status && (await jiraStore.isConfigured(req.user.id))) {
      try {
        const creds = await jiraStore.getCredentials(req.user.id);
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
  } catch (err) {
    logger.error('Update ticket error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/fix', async (req, res) => {
  try {
    const ticket = await dataStore.getTicketById(req.params.id, req.user.id);
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
      updatedTicket = await dataStore.updateTicket(req.params.id, req.user.id, {
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
        updatedTicket = await dataStore.updateTicket(req.params.id, req.user.id, {
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
});

router.delete('/:id', async (req, res) => {
  try {
    const deleted = await dataStore.deleteTicket(req.params.id, req.user.id);
    if (!deleted) return res.status(404).json({ error: 'Ticket not found' });
    res.json({ message: 'Ticket deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/sync-jira', async (req, res) => {
  try {
    const ticket = await dataStore.getTicketById(req.params.id, req.user.id);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    if (!(await jiraStore.isConfigured(req.user.id))) {
      return res.status(400).json({ error: 'Jira is not connected. Connect it in Tenant Connect.' });
    }
    const creds = await jiraStore.getCredentials(req.user.id);
    const result = await createJiraIssue(creds, ticket);
    await dataStore.updateTicket(req.params.id, req.user.id, {
      jiraId: result.externalId,
      jiraKey: result.externalNumber,
      jiraUrl: result.externalUrl
    });
    res.json({ message: `Synced to Jira: ${result.externalNumber}`, ...result });
  } catch (err) {
    res.status(500).json({ error: `Jira sync failed: ${err.message}` });
  }
});

module.exports = router;