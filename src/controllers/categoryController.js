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
    let categories = [];
    if (getMongoStatus()) {
      categories = await Category.find().sort({ category_name: 1 });
      if (categories.length === 0) {
        await Category.insertMany(defaultCategories);
        categories = await Category.find().sort({ category_name: 1 });
      }
    } else {
      if (memoryStore.categories.length === 0) {
        memoryStore.categories = defaultCategories.map((c, i) => ({
          _id: 'cat_' + (i + 1),
          id: 'cat_' + (i + 1),
          ...c
        }));
        saveLocalStore();
      }
      categories = memoryStore.categories;
    }
    res.json({ success: true, data: categories });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching categories.' });
  }
};

const createCategory = async (req, res) => {
  try {
    const { category_name, icon } = req.body;
    if (!category_name) {
      return res.status(400).json({ success: false, message: 'Category name is required.' });
    }

    if (getMongoStatus()) {
      const existing = await Category.findOne({ category_name: new RegExp(`^${category_name}$`, 'i') });
      if (existing) {
        return res.status(400).json({ success: false, message: 'Category already exists.' });
      }
      const category = new Category({
        category_name: category_name.trim(),
        icon: icon || 'fa-tag',
        is_default: false,
        status: 'active'
      });
      await category.save();
      res.status(201).json({ success: true, message: 'Category created successfully.', data: category });
    } else {
      const existing = memoryStore.categories.find(c => c.category_name.toLowerCase() === category_name.toLowerCase());
      if (existing) {
        return res.status(400).json({ success: false, message: 'Category already exists.' });
      }
      const newCat = {
        _id: 'cat_' + Date.now(),
        id: 'cat_' + Date.now(),
        category_name: category_name.trim(),
        icon: icon || 'fa-tag',
        is_default: false,
        status: 'active'
      };
      memoryStore.categories.push(newCat);
      saveLocalStore();
      res.status(201).json({ success: true, message: 'Category created successfully.', data: newCat });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error creating category.' });
  }
};

module.exports = {
  getCategories,
  createCategory
};
