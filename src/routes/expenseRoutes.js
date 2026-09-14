const express = require('express');
const router = express.Router();
const { getExpenses, getExpenseById, createExpense, updateExpense, deleteExpense, bulkDeleteExpenses, clearAllExpenses } = require('../controllers/expenseController');
const { authMiddleware } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.use(authMiddleware);

router.get('/', getExpenses);
router.get('/:id', getExpenseById);
router.post('/', upload.single('receipt'), createExpense);
router.put('/:id', upload.single('receipt'), updateExpense);
router.delete('/clear-all', clearAllExpenses);
router.delete('/erase-all', clearAllExpenses);
router.delete('/bulk', bulkDeleteExpenses);
router.delete('/:id', deleteExpense);

module.exports = router;

