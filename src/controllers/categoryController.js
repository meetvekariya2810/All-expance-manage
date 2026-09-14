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
    const includeInactive = req.query.includeInactive === 'true';
    let categories = [];

    if (getMongoStatus()) {
      const query = includeInactive ? {} : { status: 'active' };
      categories = await Category.find(query).sort({ category_name: 1 });
      if (categories.length === 0 && !includeInactive) {
        await Category.insertMany(defaultCategories);
        categories = await Category.find({ status: 'active' }).sort({ category_name: 1 });
      }
    } else {
      if (!memoryStore.categories || memoryStore.categories.length === 0) {
        memoryStore.categories = defaultCategories.map((c, i) => ({
          _id: 'cat_' + (i + 1),
          id: 'cat_' + (i + 1),
          ...c
        }));
        saveLocalStore();
      }
      categories = includeInactive 
        ? memoryStore.categories 
        : memoryStore.categories.filter(c => c.status !== 'inactive');
    }
    res.json({ success: true, data: categories });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ success: false, message: 'Error fetching categories.' });
  }
};

const createCategory = async (req, res) => {
  try {
    const { category_name, icon } = req.body;
    if (!category_name || !category_name.trim()) {
      return res.status(400).json({ success: false, message: 'Category name is required.' });
    }

    const trimmedName = category_name.trim();

    if (getMongoStatus()) {
      const existing = await Category.findOne({ category_name: new RegExp(`^${trimmedName}$`, 'i') });
      if (existing) {
        return res.status(400).json({ success: false, message: 'Category already exists.' });
      }
      const catId = 'cat_' + Date.now();
      const category = new Category({
        _id: catId,
        id: catId,
        category_name: trimmedName,
        icon: icon || 'fa-tag',
        is_default: false,
        status: 'active'
      });
      await category.save();
      res.status(201).json({ success: true, message: 'Category created successfully.', data: category });
    } else {
      const existing = (memoryStore.categories || []).find(c => c.category_name.toLowerCase() === trimmedName.toLowerCase());
      if (existing) {
        return res.status(400).json({ success: false, message: 'Category already exists.' });
      }
      const newCat = {
        _id: 'cat_' + Date.now(),
        id: 'cat_' + Date.now(),
        category_name: trimmedName,
        icon: icon || 'fa-tag',
        is_default: false,
        status: 'active'
      };
      if (!memoryStore.categories) memoryStore.categories = [];
      memoryStore.categories.push(newCat);
      saveLocalStore();
      res.status(201).json({ success: true, message: 'Category created successfully.', data: newCat });
    }
  } catch (error) {
    console.error('Create category error:', error);
    res.status(500).json({ success: false, message: 'Error creating category.' });
  }
};

const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { category_name, icon, status } = req.body;

    if (!category_name || !category_name.trim()) {
      return res.status(400).json({ success: false, message: 'Category name is required.' });
    }

    const trimmedName = category_name.trim();

    if (getMongoStatus()) {
      const cat = await Category.findOne({ $or: [{ _id: id }, { id: id }] });
      if (!cat) return res.status(404).json({ success: false, message: 'Category not found.' });

      // Check if duplicate name
      const duplicate = await Category.findOne({
        category_name: new RegExp(`^${trimmedName}$`, 'i'),
        _id: { $ne: cat._id }
      });
      if (duplicate) return res.status(400).json({ success: false, message: 'Category name already in use.' });

      cat.category_name = trimmedName;
      if (icon) cat.icon = icon;
      if (status) cat.status = status;
      await cat.save();

      res.json({ success: true, message: 'Category updated successfully.', data: cat });
    } else {
      const idx = (memoryStore.categories || []).findIndex(c => (c._id || c.id) === id);
      if (idx === -1) return res.status(404).json({ success: false, message: 'Category not found.' });

      const duplicate = memoryStore.categories.find(c => 
        c.category_name.toLowerCase() === trimmedName.toLowerCase() && (c._id || c.id) !== id
      );
      if (duplicate) return res.status(400).json({ success: false, message: 'Category name already in use.' });

      memoryStore.categories[idx].category_name = trimmedName;
      if (icon) memoryStore.categories[idx].icon = icon;
      if (status) memoryStore.categories[idx].status = status;
      saveLocalStore();

      res.json({ success: true, message: 'Category updated successfully.', data: memoryStore.categories[idx] });
    }
  } catch (error) {
    console.error('Update category error:', error);
    res.status(500).json({ success: false, message: 'Error updating category.' });
  }
};

const toggleCategoryStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // 'active' or 'inactive'

    if (!['active', 'inactive'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status. Must be active or inactive.' });
    }

    if (getMongoStatus()) {
      const cat = await Category.findOne({ $or: [{ _id: id }, { id: id }] });
      if (!cat) return res.status(404).json({ success: false, message: 'Category not found.' });

      cat.status = status;
      await cat.save();
      res.json({ success: true, message: `Category is now ${status}.`, data: cat });
    } else {
      const idx = (memoryStore.categories || []).findIndex(c => (c._id || c.id) === id);
      if (idx === -1) return res.status(404).json({ success: false, message: 'Category not found.' });

      memoryStore.categories[idx].status = status;
      saveLocalStore();
      res.json({ success: true, message: `Category is now ${status}.`, data: memoryStore.categories[idx] });
    }
  } catch (error) {
    console.error('Toggle category status error:', error);
    res.status(500).json({ success: false, message: 'Error changing category status.' });
  }
};

module.exports = {
  getCategories,
  createCategory,
  updateCategory,
  toggleCategoryStatus
};
