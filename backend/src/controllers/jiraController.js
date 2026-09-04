const Joi = require('joi');
const jiraStore = require('../utils/jiraStore');
const { healthCheck } = require('../services/jiraService');
const logger = require('../utils/logger');

const jiraSchema = Joi.object({
  baseUrl: Joi.string().uri().required(),
  email: Joi.string().email().required(),
  apiToken: Joi.string().trim().min(1).required(),
  projectKey: Joi.string().trim().min(1).max(20).default('CPI')
});

function getJiraStatus(req, res) {
  res.json({ jira: jiraStore.toPublic(req.user.id) });
}

async function saveJira(req, res) {
  const { error, value } = jiraSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.details[0].message });

  jiraStore.save(req.user.id, value);

  try {
    const creds = jiraStore.getCredentials(req.user.id);
    const result = await healthCheck(creds);
    if (!result.connected) throw new Error(result.error);
    jiraStore.setStatus(req.user.id, 'CONNECTED', null);
    logger.info(`[Jira] User ${req.user.id} connected as ${result.user} to ${value.baseUrl}`);
    return res.status(201).json({ jira: jiraStore.toPublic(req.user.id), test: result });
  } catch (err) {
    jiraStore.setStatus(req.user.id, 'FAILED', err.message);
    logger.warn(`[Jira] Connection test failed for user ${req.user.id}: ${err.message}`);
    return res.status(201).json({ jira: jiraStore.toPublic(req.user.id), test: { connected: false, error: err.message } });
  }
}

async function retestJira(req, res) {
  if (!jiraStore.isConfigured(req.user.id)) {
    return res.status(404).json({ error: 'Jira is not connected yet' });
  }

  try {
    const creds = jiraStore.getCredentials(req.user.id);
    const result = await healthCheck(creds);
    if (!result.connected) throw new Error(result.error);
    jiraStore.setStatus(req.user.id, 'CONNECTED', null);
    return res.json({ jira: jiraStore.toPublic(req.user.id), test: result });
  } catch (err) {
    jiraStore.setStatus(req.user.id, 'FAILED', err.message);
    logger.warn(`[Jira] Re-test failed for user ${req.user.id}: ${err.message}`);
    return res.json({ jira: jiraStore.toPublic(req.user.id), test: { connected: false, error: err.message } });
  }
}

function disconnectJira(req, res) {
  jiraStore.remove(req.user.id);
  logger.info(`[Jira] User ${req.user.id} disconnected Jira`);
  res.json({ jira: null });
}

module.exports = { getJiraStatus, saveJira, retestJira, disconnectJira };
