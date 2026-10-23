const express = require('express');
const router = express.Router();
const {
  getExpenses,
  getExpenseById,
  createExpense,
  updateExpense,
  deleteExpense,
  bulkDeleteExpenses,
  clearAllExpenses,
  importExpenses
} = require('../controllers/expenseController');
const {
  getTemplateExcel,
  getTemplateCSV,
  validateImport,
  confirmImport,
  getImportHistory,
  getImportBatchDetails,
  exportExpensesExcel,
  exportExpensesCSV
} = require('../controllers/bulkImportExportController');
const { authMiddleware } = require('../middleware/auth');
const upload = require('../middleware/upload');
const excelUpload = require('../middleware/excelUpload');

router.use(authMiddleware);

// --- Bulk Data Import & Export Endpoints ---
router.get('/import/template', getTemplateExcel);
router.get('/import/template.csv', getTemplateCSV);
router.post('/import/validate', excelUpload.single('file'), validateImport);
router.post('/import/confirm', confirmImport);
router.get('/import/history', getImportHistory);
router.get('/import/history/:batchId', getImportBatchDetails);
router.get('/export/excel', exportExpensesExcel);
router.get('/export/csv', exportExpensesCSV);

// Standard Expense Endpoints
router.get('/', getExpenses);
router.post('/import', excelUpload.single('file'), importExpenses);
router.delete('/bulk', bulkDeleteExpenses);
router.delete('/clear-all', clearAllExpenses);
router.delete('/erase-all', clearAllExpenses);
router.get('/:id', getExpenseById);
router.post('/', upload.single('receipt'), createExpense);
router.put('/:id', upload.single('receipt'), updateExpense);
router.delete('/:id', deleteExpense);

module.exports = router;
