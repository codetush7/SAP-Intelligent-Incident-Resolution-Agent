const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/authMiddleware');
const { getStats, getTrends } = require('../controllers/dashboardController');

router.use(requireAuth);

// GET /api/dashboard/stats
router.get('/stats', getStats);

// GET /api/dashboard/trends
router.get('/trends', getTrends);

module.exports = router;