const Category = require('../models/Category');
const { getMongoStatus, memoryStore, saveLocalStore } = require('../config/db');

const defaultCategories = [
  { category_name: 'Food', icon: 'fa-utensils', is_default: true, status: 'active' },
  { category_name: 'Grocery', icon: 'fa-shopping-basket', is_default: true, status: 'active' },
  { category_name: 'Petrol', icon: 'fa-gas-pump', is_default: true, status: 'active' },
  { category_name: 'Shopping', icon: 'fa-bag-shopping', is_default: true, status: 'active' },
  { category_name: 'Medical', icon: 'fa-user-nurse', is_default: true, status: 'active' },
  { category_name: 'Electricity Bill', icon: 'fa-bolt', is_default: true, status: 'active' },
  { category_name: 'Water Bill', icon: 'fa-faucet', is_default: true, status: 'active' },
  { category_name: 'Gas', icon: 'fa-fire', is_default: true, status: 'active' },
  { category_name: 'Internet', icon: 'fa-wifi', is_default: true, status: 'active' },
  { category_name: 'Mobile Recharge', icon: 'fa-mobile-screen', is_default: true, status: 'active' },
  { category_name: 'Entertainment', icon: 'fa-film', is_default: true, status: 'active' },
  { category_name: 'Travel', icon: 'fa-plane', is_default: true, status: 'active' },
  { category_name: 'Rent', icon: 'fa-house-user', is_default: true, status: 'active' },
  { category_name: 'Education', icon: 'fa-graduation-cap', is_default: true, status: 'active' },
  { category_name: 'EMI', icon: 'fa-credit-card', is_default: true, status: 'active' },
  { category_name: 'Investment', icon: 'fa-chart-line', is_default: true, status: 'active' },
  { category_name: 'Miscellaneous', icon: 'fa-box', is_default: true, status: 'active' }
];

const getCategories = async (req, res) => {
  try {
    const { includeInactive } = req.query;

    if (getMongoStatus()) {
      let query = {};
      if (includeInactive !== 'true' && req.user.role !== 'admin') {
        query.status = 'active';
      }
      let categories = await Category.find(query).sort({ category_name: 1 });
      if (categories.length === 0 && includeInactive !== 'true') {
        await Category.insertMany(defaultCategories).catch(() => {});
        categories = await Category.find({ status: 'active' }).sort({ category_name: 1 });
      }
      return res.json({ success: true, categories });
    } else {
      if (!memoryStore.categories || memoryStore.categories.length === 0) {
        memoryStore.categories = defaultCategories.map((c, i) => ({
          _id: 'cat_' + (i + 1),
          id: 'cat_' + (i + 1),
          ...c
        }));
        saveLocalStore();
      }

      let categories = [...(memoryStore.categories || [])];
      if (includeInactive !== 'true' && req.user.role !== 'admin') {
        categories = categories.filter(c => c.status === 'active');
      }
      categories.sort((a, b) => (a.category_name || '').localeCompare(b.category_name || ''));
      return res.json({ success: true, categories });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error retrieving categories.' });
  }
};

const createCategory = async (req, res) => {
  try {
    const { category_name, icon } = req.body;
    if (!category_name || !category_name.trim()) {
      return res.status(400).json({ success: false, message: 'Category name is required.' });
    }

    const trimmed = category_name.trim();

    if (getMongoStatus()) {
      const existing = await Category.findOne({ category_name: { $regex: `^${trimmed}$`, $options: 'i' } });
      if (existing) {
        return res.status(400).json({ success: false, message: 'Category already exists.' });
      }

      const newCategory = new Category({
        _id: 'cat_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
        category_name: trimmed,
        icon: (icon || 'fa-tag').trim(),
        status: 'active',
        is_default: false
      });

      await newCategory.save();
      return res.status(201).json({ success: true, message: 'Category created successfully.', category: newCategory });
    } else {
      const existing = (memoryStore.categories || []).find(
        c => c.category_name && c.category_name.toLowerCase() === trimmed.toLowerCase()
      );
      if (existing) {
        return res.status(400).json({ success: false, message: 'Category already exists.' });
      }

      const newCategory = {
        _id: 'cat_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
        id: 'cat_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
        category_name: trimmed,
        icon: (icon || 'fa-tag').trim(),
        status: 'active',
        is_default: false
      };

      memoryStore.categories.push(newCategory);
      saveLocalStore();
      return res.status(201).json({ success: true, message: 'Category created successfully.', category: newCategory });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error creating category.' });
  }
};

const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { category_name, icon, status } = req.body;

    if (getMongoStatus()) {
      const category = await Category.findOne({ $or: [{ _id: id }, { id: id }] });
      if (!category) {
        return res.status(404).json({ success: false, message: 'Category not found.' });
      }

      if (category_name) {
        const trimmed = category_name.trim();
        const duplicate = await Category.findOne({
          category_name: { $regex: `^${trimmed}$`, $options: 'i' },
          _id: { $ne: category._id }
        });
        if (duplicate) {
          return res.status(400).json({ success: false, message: 'Another category with this name already exists.' });
        }
        category.category_name = trimmed;
      }

      if (icon !== undefined) category.icon = icon.trim();
      if (status) category.status = status;

      await category.save();
      return res.json({ success: true, message: 'Category updated successfully.', category });
    } else {
      const idx = (memoryStore.categories || []).findIndex(c => (c._id || c.id) === id);
      if (idx === -1) {
        return res.status(404).json({ success: false, message: 'Category not found.' });
      }

      if (category_name) {
        const trimmed = category_name.trim();
        const duplicate = memoryStore.categories.find(
          c => c.category_name && c.category_name.toLowerCase() === trimmed.toLowerCase() && (c._id || c.id) !== id
        );
        if (duplicate) {
          return res.status(400).json({ success: false, message: 'Another category with this name already exists.' });
        }
        memoryStore.categories[idx].category_name = trimmed;
      }

      if (icon !== undefined) memoryStore.categories[idx].icon = icon.trim();
      if (status) memoryStore.categories[idx].status = status;

      saveLocalStore();
      return res.json({ success: true, message: 'Category updated successfully.', category: memoryStore.categories[idx] });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error updating category.' });
  }
};

const toggleCategoryStatus = async (req, res) => {
  try {
    const { id } = req.params;

    if (getMongoStatus()) {
      const category = await Category.findOne({ $or: [{ _id: id }, { id: id }] });
      if (!category) {
        return res.status(404).json({ success: false, message: 'Category not found.' });
      }

      category.status = category.status === 'active' ? 'inactive' : 'active';
      await category.save();

      return res.json({
        success: true,
        message: `Category marked as ${category.status}.`,
        status: category.status,
        category
      });
    } else {
      const idx = (memoryStore.categories || []).findIndex(c => (c._id || c.id) === id);
      if (idx === -1) {
        return res.status(404).json({ success: false, message: 'Category not found.' });
      }

      const current = memoryStore.categories[idx].status;
      memoryStore.categories[idx].status = current === 'active' ? 'inactive' : 'active';
      saveLocalStore();

      return res.json({
        success: true,
        message: `Category marked as ${memoryStore.categories[idx].status}.`,
        status: memoryStore.categories[idx].status,
        category: memoryStore.categories[idx]
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error toggling category status.' });
  }
};

module.exports = {
  getCategories,
  createCategory,
  updateCategory,
  toggleCategoryStatus
};
