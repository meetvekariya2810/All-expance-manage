const express = require('express');
const router = express.Router();
const { getSummaryMetrics, exportPDF, exportExcel, exportCSV } = require('../controllers/reportController');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/metrics', getSummaryMetrics);
router.get('/export/pdf', exportPDF);
router.get('/export/excel', exportExcel);
router.get('/export/csv', exportCSV);

module.exports = router;

