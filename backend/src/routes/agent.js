const express = require('express');
const router = express.Router();
const { processIncidentHandler, chat, getLogs, simulate } = require('../controllers/agentController');

// POST /api/agent/process-incident
router.post('/process-incident', processIncidentHandler);

// POST /api/agent/chat
router.post('/chat', chat);

// GET /api/agent/logs
router.get('/logs', getLogs);

// POST /api/agent/simulate
router.post('/simulate', simulate);

module.exports = router;
