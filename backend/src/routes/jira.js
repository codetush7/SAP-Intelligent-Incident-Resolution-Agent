const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/authMiddleware');
const { getJiraStatus, saveJira, retestJira, disconnectJira } = require('../controllers/jiraController');

router.use(requireAuth);

// GET /api/jira
router.get('/', getJiraStatus);

// POST /api/jira
router.post('/', saveJira);

// POST /api/jira/test
router.post('/test', retestJira);

// DELETE /api/jira
router.delete('/', disconnectJira);

module.exports = router;