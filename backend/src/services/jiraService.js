const axios = require('axios');
const logger = require('../utils/logger');


function jiraClient(creds) {
  if (!creds) {
    throw new Error('Jira not connected. Add your Jira connection in Tenant Connect.');
  }
  return axios.create({
    baseURL: `${creds.baseUrl}/rest/api/3`,
    auth: { username: creds.email, password: creds.apiToken },
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    timeout: 20000
  });
}


function mapPriority(priority) {
  const map = { CRITICAL: 'Highest', HIGH: 'High', MEDIUM: 'Medium', LOW: 'Low' };
  return map[priority] || 'Medium';
}

async function createJiraIssue(creds,ticketData) {
  if (!creds) {
    throw new Error('Jira not connected. Add your Jira connection in Tenant Connect.');
  }

  logger.info(`[Jira] Creating issue for: ${ticketData.ticketNumber}`);

  const descriptionText = [
    `CPI Ticket Ref: ${ticketData.ticketNumber}`,
    `Interface: ${ticketData.interface || 'N/A'}`,
    `iFlow: ${ticketData.iflow || 'N/A'}`,
    `Error Code: ${ticketData.errorCode || 'N/A'}`,
    ``,
    `ROOT CAUSE:`,
    ticketData.rootCause || 'Under investigation',
    ``,
    `EVIDENCE:`,
    ticketData.evidence || ticketData.description || 'N/A',
    ``,
    `BUSINESS IMPACT:`,
    ticketData.impact || 'Integration flow disrupted',
    ``,
    `RECOMMENDATION:`,
    ticketData.recommendation || 'Review CPI logs',
    ``,
    `Created by: SAP CPI AI Agent (Powered by Grok AI)`
  ].join('\n');

  const body = {
    fields: {
      project: { key: creds.projectKey },
      summary: ticketData.title,
      description: {
        type: 'doc',
        version: 1,
        content: [{
          type: 'paragraph',
          content: [{ type: 'text', text: descriptionText }]
        }]
      },
      issuetype: { name: 'Story' },
      priority: { name: mapPriority(ticketData.priority) },
      labels: ['SAP-CPI', 'AI-Auto-Created', ticketData.category || 'GENERAL']
    }
  };

  const client = jiraClient(creds);
  // logger.info(`[Jira Debug] Payload: ${JSON.stringify(body, null, 2)}`);
  let response;
try {
      response = await client.post('/issue', body);
    } catch (err) {
      const detail = err.response?.data ? JSON.stringify(err.response.data) : err.message;
      logger.error(`[Jira] 400 detail: ${detail}`);
      throw new Error(detail);
    }

  logger.info(`[Jira] Issue created: ${response.data.key}`);

  return {
    externalId: response.data.id,
    externalNumber: response.data.key,
    externalUrl: `${creds.baseUrl}/browse/${response.data.key}`,
    platform: 'Jira'
  };
}

async function updateJiraIssue(creds, issueKey, updates) {
  if (!jiraStore.isConfigured()) return null;

  const transitionMap = {
    'IN_PROGRESS': 'In Progress',
    'RESOLVED': 'Done',
    'OPEN': 'To Do'
  };

  try {
    const client = jiraClient(creds);

    // Add comment if notes provided
    if (updates.notes) {
      await client.post(`/issue/${issueKey}/comment`, {
        body: {
          type: 'doc',
          version: 1,
          content: [{ type: 'paragraph', content: [{ type: 'text', text: updates.notes }] }]
        }
      });
    }

    // Transition status
    if (updates.status && transitionMap[updates.status]) {
      const transRes = await client.get(`/issue/${issueKey}/transitions`);
      const transition = transRes.data.transitions.find(t =>
        t.name === transitionMap[updates.status]
      );
      if (transition) {
        await client.post(`/issue/${issueKey}/transitions`, {
          transition: { id: transition.id }
        });
      }
    }

    return { updated: true, issueKey };
  } catch (err) {
    logger.error(`[Jira] Update failed: ${err.message}`);
    return null;
  }
}

async function healthCheck(creds) {
  try {
    const client = jiraClient(creds);
    const res = await client.get('/myself');
    return { connected: true, user: res.data.displayName, instance: creds.baseUrl };
  } catch (err) {
    return { connected: false, error: err.message };
  }
}

module.exports = { createJiraIssue, updateJiraIssue, healthCheck };