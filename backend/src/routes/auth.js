const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/authMiddleware');
const { signup, login, getMe, updateProfile } = require('../controllers/authController');

router.post('/signup', signup);
router.post('/login', login);
router.get('/me', requireAuth, getMe);
router.patch('/me', requireAuth, updateProfile);

module.exports = router;