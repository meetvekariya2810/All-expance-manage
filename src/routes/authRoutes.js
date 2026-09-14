const express = require('express');
const router = express.Router();
const { login, changePassword, getProfile, updateProfile } = require('../controllers/authController');
const { authMiddleware } = require('../middleware/auth');

router.post('/login', login);
router.post('/change-password', authMiddleware, changePassword);
router.get('/me', authMiddleware, getProfile);
router.put('/profile', authMiddleware, updateProfile);

module.exports = router;

