const express = require('express');
const router = express.Router();
const {
  getSettlements,
  getSettlementById,
  createSettlement,
  updateSettlement,
  updateSettlementStatus,
  deleteSettlement
} = require('../controllers/settlementController');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', getSettlements);
router.post('/', createSettlement);
router.get('/:id', getSettlementById);
router.put('/:id', updateSettlement);
router.patch('/:id/status', updateSettlementStatus);
router.delete('/:id', deleteSettlement);

module.exports = router;
