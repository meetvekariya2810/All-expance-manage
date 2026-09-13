const express = require('express');
const router = express.Router();
const { getCategories, createCategory } = require('../controllers/categoryController');
const { authMiddleware, verifyAdmin } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', getCategories);
router.post('/', verifyAdmin, createCategory);

module.exports = router;
