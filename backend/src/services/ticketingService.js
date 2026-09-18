const axios = require('axios');
const logger = require('../utils/logger');

// ServiceNow Integration
async function createServiceNowIncident(ticketData) {
  if (!process.env.SERVICENOW_INSTANCE) {
    logger.info('[ServiceNow] Not configured - skipping external ticket creation');
    return { simulated: true, externalId: `SNOW-${Date.now()}` };
  }

  try {
    const payload = {
      short_description: ticketData.title,
      description: `${ticketData.description}\n\nRoot Cause: ${ticketData.rootCause}\n\nRecommendation: ${ticketData.recommendation}`,
      urgency: mapPriorityToServiceNow(ticketData.priority),
      impact: mapPriorityToServiceNow(ticketData.priority),
      category: 'Software',
      subcategory: 'SAP CPI',
      assignment_group: ticketData.assignedTeam,
      work_notes: `Auto-created by SAP CPI AI Ticketing Agent\nInterface: ${ticketData.interface}\niFlow: ${ticketData.iflow}\nError: ${ticketData.errorCode}`
    };

    const response = await axios.post(
      `${process.env.SERVICENOW_INSTANCE}/api/now/table/incident`,
      payload,
      {
        auth: {
          username: process.env.SERVICENOW_USERNAME,
          password: process.env.SERVICENOW_PASSWORD
        },
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        timeout: 10000
      }
    );

    const incidentId = response.data.result.sys_id;
    const incidentNumber = response.data.result.number;
    logger.info(`[ServiceNow] Incident created: ${incidentNumber}`);
    return { externalId: incidentId, externalNumber: incidentNumber, platform: 'ServiceNow' };

  } catch (err) {
    logger.error(`[ServiceNow] Failed to create incident: ${err.message}`);
    throw err;
  }
}

// Jira Integration
async function createJiraIssue(ticketData) {
  if (!process.env.JIRA_BASE_URL) {
    logger.info('[Jira] Not configured - skipping external ticket creation');
    return { simulated: true, externalId: `JIRA-${Date.now()}` };
  }

  try {
    const payload = {
      fields: {
        project: { key: process.env.JIRA_PROJECT_KEY || 'CPI' },
        summary: ticketData.title,
        description: {
          type: 'doc',
          version: 1,
          content: [
            {
              type: 'paragraph',
              content: [{
                type: 'text',
                text: `${ticketData.description}\n\nRoot Cause: ${ticketData.rootCause}\n\nRecommendation: ${ticketData.recommendation}\n\nInterface: ${ticketData.interface}\niFlow: ${ticketData.iflow}\nError: ${ticketData.errorCode}`
              }]
            }
          ]
        },
        issuetype: { name: 'Bug' },
        priority: { name: mapPriorityToJira(ticketData.priority) },
        labels: ['SAP-CPI', 'AI-Auto-Created', ticketData.category]
      }
    };

    const response = await axios.post(
      `${process.env.JIRA_BASE_URL}/rest/api/3/issue`,
      payload,
      {
        auth: {
          username: process.env.JIRA_EMAIL,
          password: process.env.JIRA_API_TOKEN
        },
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      }
    );

    logger.info(`[Jira] Issue created: ${response.data.key}`);
    return { externalId: response.data.id, externalNumber: response.data.key, platform: 'Jira' };

  } catch (err) {
    logger.error(`[Jira] Failed to create issue: ${err.message}`);
    throw err;
  }
}

function mapPriorityToServiceNow(priority) {
  const map = { CRITICAL: '1', HIGH: '2', MEDIUM: '3', LOW: '4' };
  return map[priority] || '3';
}

function mapPriorityToJira(priority) {
  const map = { CRITICAL: 'Highest', HIGH: 'High', MEDIUM: 'Medium', LOW: 'Low' };
  return map[priority] || 'Medium';
}

module.exports = { createServiceNowIncident, createJiraIssue };
