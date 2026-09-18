const express = require('express');
const router = express.Router();
const { cpiAlert, serviceNowUpdate } = require('../controllers/webhookController');

// POST /api/webhooks/cpi-alert
router.post('/cpi-alert', cpiAlert);

// POST /api/webhooks/servicenow-update
router.post('/servicenow-update', serviceNowUpdate);

module.exports = router;
