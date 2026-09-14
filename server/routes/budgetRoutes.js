const express = require('express');
const router = express.Router();
const { getBudgets, setBudget } = require('../controllers/budgetController');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', getBudgets);
router.post('/', setBudget);

module.exports = router;
