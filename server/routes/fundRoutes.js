const express = require('express');
const router = express.Router();
const {
  getFunds,
  getFundById,
  createFund,
  updateFund,
  deleteFund
} = require('../controllers/fundController');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', getFunds);
router.post('/', createFund);
router.get('/:id', getFundById);
router.put('/:id', updateFund);
router.delete('/:id', deleteFund);

module.exports = router;
