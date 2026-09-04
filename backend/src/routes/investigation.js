const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/authMiddleware');
const { investigate } = require('../controllers/investigationController');

router.use(requireAuth);

// GET /api/investigation/:ticketId
router.get('/:ticketId', investigate);

module.exports = router;