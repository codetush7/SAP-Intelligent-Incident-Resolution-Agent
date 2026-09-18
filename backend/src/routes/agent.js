const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/authMiddleware');
const { processIncidentHandler, chat, getLogs, simulate, getAiConfig, saveAiConfig } = require('../controllers/agentController');

router.use(requireAuth);

// POST /api/agent/process-incident
router.post('/process-incident', processIncidentHandler);

// POST /api/agent/chat
router.post('/chat', chat);

// GET /api/agent/logs
router.get('/logs', getLogs);

// POST /api/agent/simulate
router.post('/simulate', simulate);

// GET /api/agent/ai-config — list providers + which one is active (for Settings & AgentPage dropdowns)
router.get('/ai-config', getAiConfig);

// POST /api/agent/ai-config — save provider/model/apiKey from Settings > AI Configuration
router.post('/ai-config', saveAiConfig);

module.exports = router;
