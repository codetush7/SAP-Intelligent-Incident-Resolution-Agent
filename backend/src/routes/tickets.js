const express = require('express');
const router = express.Router();
const dataStore = require('../utils/dataStore');
const { createJiraIssue, updateJiraIssue } = require('../services/jiraService');
const { broadcastEvent } = require('../services/websocketService');
const logger = require('../utils/logger');

router.get('/', (req, res) => {
  const { status, priority, category, limit = 100 } = req.query;
  let tickets = dataStore.getTickets();
  if (status) tickets = tickets.filter(t => t.status === status.toUpperCase());
  if (priority) tickets = tickets.filter(t => t.priority === priority.toUpperCase());
  if (category) tickets = tickets.filter(t => t.category === category.toUpperCase());
  res.json(tickets.slice(0, parseInt(limit)));
});

router.get('/:id', (req, res) => {
  const ticket = dataStore.getTicketById(req.params.id);
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
  res.json(ticket);
});

router.post('/', async (req, res) => {
  try {
    const { title, description, priority, category, interface: iface, iflow, errorCode } = req.body;
    if (!title || !priority) return res.status(400).json({ error: 'title and priority required' });

    const ticket = dataStore.createTicket({
      title, description, priority, category,
      interface: iface, iflow, errorCode,
      status: 'OPEN',
      systemSource: 'MANUAL',
      assignedTeam: 'Middleware Team'
    });

    // Auto-create ServiceNow if configured
    if (process.env.JIRA_BASE_URL && process.env.JIRA_API_TOKEN && process.env.JIRA_BASE_URL !== 'https://your-org.atlassian.net') {
      try {
        const snow = await createJiraIssue(ticket);
        dataStore.updateTicket(ticket.id, {
          jiraId: snow.externalId,
          jiraKey: snow.externalNumber,
          jiraUrl: snow.externalUrl
        });
        ticket.jiraKey = snow.externalNumber;
        ticket.jiraUrl = snow.externalUrl;
      } catch (snowErr) {
        logger.warn(`ServiceNow sync failed: ${snowErr.message}`);
      }
    }

    broadcastEvent('ticket_created', { ticket, message: `Ticket ${ticket.ticketNumber} created` });
    res.status(201).json(ticket);
  } catch (err) {
    logger.error('Create ticket error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id', async (req, res) => {
  const ticket = dataStore.updateTicket(req.params.id, req.body);
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

  // Sync status to ServiceNow
  if (ticket.jiraKey && req.body.status) {
    try {
      await updateJiraIssue(ticket.jiraKey, {
        status: req.body.status,
        notes: `Status updated to ${req.body.status} via SAP CPI Agent`
      });
    } catch (err) {
      logger.warn(`ServiceNow status sync failed: ${err.message}`);
    }
  }

  broadcastEvent('ticket_updated', { ticket });
  res.json(ticket);
});

router.delete('/:id', (req, res) => {
  const deleted = dataStore.deleteTicket(req.params.id);
  if (!deleted) return res.status(404).json({ error: 'Ticket not found' });
  res.json({ message: 'Ticket deleted' });
});

router.post('/:id/sync-jira', async (req, res) => {
  const ticket = dataStore.getTicketById(req.params.id);
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
  try {
    const result = await createJiraIssue(ticket);
    dataStore.updateTicket(req.params.id, {
      serviceNowId: result.externalId,
      serviceNowNumber: result.externalNumber,
      serviceNowUrl: result.externalUrl
    });
    res.json({ message: 'Synced to ServiceNow', ...result });
  } catch (err) {
    res.status(500).json({ error: `ServiceNow sync failed: ${err.message}` });
  }
});

module.exports = router;
