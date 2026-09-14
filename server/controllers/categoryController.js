const Category = require('../models/Category');

const getCategories = async (req, res) => {
  try {
    const { includeInactive } = req.query;
    let query = {};
    if (includeInactive !== 'true' && req.user.role !== 'admin') {
      query.status = 'active';
    }
    const categories = await Category.find(query).sort({ category_name: 1 });
    res.json({ success: true, categories });
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
    res.status(201).json({ success: true, message: 'Category created successfully.', category: newCategory });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error creating category.' });
  }
};

const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { category_name, icon, status } = req.body;

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
    res.json({ success: true, message: 'Category updated successfully.', category });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error updating category.' });
  }
};

const toggleCategoryStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await Category.findOne({ $or: [{ _id: id }, { id: id }] });
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found.' });
    }

    category.status = category.status === 'active' ? 'inactive' : 'active';
    await category.save();

    res.json({
      success: true,
      message: `Category marked as ${category.status}.`,
      status: category.status,
      category
    });
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
