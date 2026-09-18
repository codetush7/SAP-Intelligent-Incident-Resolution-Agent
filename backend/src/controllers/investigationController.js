const { runInvestigation } = require('../services/investigationService');
const logger = require('../utils/logger');

async function investigate(req, res) {
  try {
    const result = await runInvestigation(req.params.ticketId, req.user.id);
    res.json(result);
  } catch (err) {
    logger.error(`Investigation failed: ${err.message}`);
    const status = err.message === 'Incident not found' ? 404 : 500;
    res.status(status).json({ error: err.message });
  }
}

module.exports = { investigate };
