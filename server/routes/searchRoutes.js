const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { globalSearch } = require('../controllers/searchController');

// GET /api/search?q=query
router.get('/', authMiddleware, globalSearch);

module.exports = router;
