const express = require('express');
const router = express.Router();
const { getUsers, createUser, updateUserStatus, resetPassword } = require('../controllers/userController');
const { authMiddleware, verifyAdmin } = require('../middleware/auth');

router.use(authMiddleware);
router.use(verifyAdmin); // Admin only routes

router.get('/', getUsers);
router.post('/', createUser);
router.patch('/:id/status', updateUserStatus);
router.post('/:id/reset-password', resetPassword);

module.exports = router;
