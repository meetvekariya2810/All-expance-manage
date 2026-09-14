const express = require('express');
const router = express.Router();
const { getActivities } = require('../controllers/activityController');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', getActivities);

module.exports = router;
