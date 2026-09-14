const express = require('express');
const router = express.Router();
const { 
  getCategories, 
  createCategory, 
  updateCategory, 
  toggleCategoryStatus 
} = require('../controllers/categoryController');
const { authMiddleware, verifyAdmin } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', getCategories);
router.post('/', verifyAdmin, createCategory);
router.put('/:id', verifyAdmin, updateCategory);
router.patch('/:id/status', verifyAdmin, toggleCategoryStatus);

module.exports = router;

