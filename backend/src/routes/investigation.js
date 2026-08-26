const express = require('express');
const router = express.Router();
const { runInvestigation } = require('../services/investigationService');
const { requireAuth } = require('../middleware/authMiddleware');
const logger = require('../utils/logger');

router.use(requireAuth);

// GET /api/investigation/:ticketId
router.get('/:ticketId', async (req, res) => {
  try {
    const result = await runInvestigation(req.params.ticketId, req.user.id);
    res.json(result);
  } catch (err) {
    logger.error(`Investigation failed: ${err.message}`);
    const status = err.message === 'Incident not found' ? 404 : 500;
    res.status(status).json({ error: err.message });
  }
});

module.exports = router;