const express = require('express');
const router = express.Router();
const { analyze, getScenarios } = require('../controllers/analysisController');

// POST /api/analysis/analyze
router.post('/analyze', analyze);

// GET /api/analysis/scenarios
router.get('/scenarios', getScenarios);

module.exports = router;
