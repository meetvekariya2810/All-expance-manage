const Expense = require('../models/Expense');
const { getMongoStatus, memoryStore, saveLocalStore } = require('../config/db');

// Helper to generate auto-increment / unique expense ID
const generateExpenseId = async () => {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `EXP-${dateStr}-${randomSuffix}`;
};

const getExpenses = async (req, res) => {
  try {
    const { role, id: userId } = req.user;
    const { search, category, payment_method, person, startDate, endDate, sortBy, sortOrder, page = 1, limit = 20 } = req.query;

    let filter = {};

    // Role check: User can only see their own expenses unless Admin
    if (role !== 'admin') {
      filter.user_id = userId;
    } else if (person && person !== 'all') {
      filter.user_id = person;
    }

    if (category && category !== 'all') filter.category = category;
    if (payment_method && payment_method !== 'all') filter.payment_method = payment_method;

    if (startDate && endDate) {
      filter.expense_date = { $gte: startDate, $lte: endDate };
    } else if (startDate) {
      filter.expense_date = { $gte: startDate };
    } else if (endDate) {
      filter.expense_date = { $lte: endDate };
    }

    let expenses = [];
    let totalCount = 0;

    if (getMongoStatus()) {
      let query = Expense.find(filter);

      if (search) {
        query = query.find({
          $or: [
            { title: { $regex: search, $options: 'i' } },
            { description: { $regex: search, $options: 'i' } },
            { vendor: { $regex: search, $options: 'i' } },
            { location: { $regex: search, $options: 'i' } },
            { expense_id: { $regex: search, $options: 'i' } }
          ]
        });
      }

      totalCount = await Expense.countDocuments(query.getFilter());

      const sortField = sortBy || 'expense_date';
      const order = sortOrder === 'asc' ? 1 : -1;
      query = query.sort({ [sortField]: order, created_at: -1 });

      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      query = query.skip((pageNum - 1) * limitNum).limit(limitNum);

      expenses = await query.exec();
    } else {
      // Memory Store logic
      let list = [...memoryStore.expenses];

      if (role !== 'admin') {
        list = list.filter(e => e.user_id === userId);
      } else if (person && person !== 'all') {
        list = list.filter(e => e.user_id === person);
      }

      if (category && category !== 'all') {
        list = list.filter(e => e.category === category);
      }

      if (payment_method && payment_method !== 'all') {
        list = list.filter(e => e.payment_method === payment_method);
      }

      if (startDate) {
        list = list.filter(e => e.expense_date >= startDate);
      }

      if (endDate) {
        list = list.filter(e => e.expense_date <= endDate);
      }

      if (search) {
        const q = search.toLowerCase();
        list = list.filter(e =>
          (e.title && e.title.toLowerCase().includes(q)) ||
          (e.description && e.description.toLowerCase().includes(q)) ||
          (e.vendor && e.vendor.toLowerCase().includes(q)) ||
          (e.location && e.location.toLowerCase().includes(q)) ||
          (e.expense_id && e.expense_id.toLowerCase().includes(q))
        );
      }

      totalCount = list.length;

      const sortField = sortBy || 'expense_date';
      const order = sortOrder === 'asc' ? 1 : -1;
      list.sort((a, b) => {
        if (a[sortField] < b[sortField]) return -1 * order;
        if (a[sortField] > b[sortField]) return 1 * order;
        return 0;
      });

      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const startIdx = (pageNum - 1) * limitNum;
      expenses = list.slice(startIdx, startIdx + limitNum);
    }

    res.json({
      success: true,
      data: expenses,
      pagination: {
        total: totalCount,
        page: parseInt(page),
        pages: Math.ceil(totalCount / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get expenses error:', error);
    res.status(500).json({ success: false, message: 'Error retrieving expenses.' });
  }
};

const getExpenseById = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, id: userId } = req.user;

    let expense = null;
    if (getMongoStatus()) {
      expense = await Expense.findById(id);
    } else {
      expense = memoryStore.expenses.find(e => (e._id || e.id) === id || e.expense_id === id);
    }

    if (!expense) {
      return res.status(404).json({ success: false, message: 'Expense record not found.' });
    }

    if (role !== 'admin' && expense.user_id !== userId) {
      return res.status(403).json({ success: false, message: 'Access denied to this expense.' });
    }

    res.json({ success: true, data: expense });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching expense details.' });
  }
};

const createExpense = async (req, res) => {
  try {
    const { title, description, category, amount, payment_method, vendor, location, notes, expense_date, expense_time } = req.body;
    const { id: userId, name: userName } = req.user;

    if (!title || !category || !amount || !expense_date) {
      return res.status(400).json({ success: false, message: 'Please provide Title, Category, Amount, and Date.' });
    }

    const expense_id = await generateExpenseId();
    let receiptUrl = '';
    if (req.file) {
      if (req.file.buffer) {
        const base64Data = req.file.buffer.toString('base64');
        receiptUrl = `data:${req.file.mimetype};base64,${base64Data}`;
      } else if (req.file.filename) {
        receiptUrl = `/uploads/receipts/${req.file.filename}`;
      }
    }

    const newExpenseObj = {
      expense_id,
      user_id: userId,
      user_name: userName,
      title,
      description: description || '',
      category,
      amount: parseFloat(amount),
      payment_method: payment_method || 'UPI',
      vendor: vendor || '',
      location: location || '',
      receipt: receiptUrl,
      notes: notes || '',
      expense_date: expense_date,
      expense_time: expense_time || new Date().toTimeString().slice(0, 5),
      created_at: new Date(),
      updated_at: new Date()
    };

    if (getMongoStatus()) {
      const expense = new Expense(newExpenseObj);
      await expense.save();
      return res.status(201).json({ success: true, message: 'Expense added successfully.', data: expense });
    } else {
      const mockId = 'exp_' + Date.now();
      newExpenseObj._id = mockId;
      newExpenseObj.id = mockId;
      memoryStore.expenses.unshift(newExpenseObj);
      saveLocalStore();
      return res.status(201).json({ success: true, message: 'Expense added successfully.', data: newExpenseObj });
    }
  } catch (error) {
    console.error('Create expense error:', error);
    res.status(500).json({ success: false, message: 'Error creating expense.' });
  }
};

const updateExpense = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, id: userId } = req.user;
    const updateData = { ...req.body, updated_at: new Date() };

    if (req.file) {
      if (req.file.buffer) {
        const base64Data = req.file.buffer.toString('base64');
        updateData.receipt = `data:${req.file.mimetype};base64,${base64Data}`;
      } else if (req.file.filename) {
        updateData.receipt = `/uploads/receipts/${req.file.filename}`;
      }
    }

    if (getMongoStatus()) {
      const expense = await Expense.findById(id);
      if (!expense) return res.status(404).json({ success: false, message: 'Expense not found.' });

      if (role !== 'admin' && expense.user_id !== userId) {
        return res.status(403).json({ success: false, message: 'You can only edit your own expenses.' });
      }

      Object.assign(expense, updateData);
      await expense.save();
      res.json({ success: true, message: 'Expense updated successfully.', data: expense });
    } else {
      const idx = memoryStore.expenses.findIndex(e => (e._id || e.id) === id || e.expense_id === id);
      if (idx === -1) return res.status(404).json({ success: false, message: 'Expense not found.' });

      const expense = memoryStore.expenses[idx];
      if (role !== 'admin' && expense.user_id !== userId) {
        return res.status(403).json({ success: false, message: 'You can only edit your own expenses.' });
      }

      memoryStore.expenses[idx] = { ...expense, ...updateData };
      saveLocalStore();
      res.json({ success: true, message: 'Expense updated successfully.', data: memoryStore.expenses[idx] });
    }
  } catch (error) {
    console.error('Update expense error:', error);
    res.status(500).json({ success: false, message: 'Error updating expense.' });
  }
};

const deleteExpense = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, id: userId } = req.user;

    if (getMongoStatus()) {
      const expense = await Expense.findById(id);
      if (!expense) return res.status(404).json({ success: false, message: 'Expense not found.' });

      if (role !== 'admin' && expense.user_id !== userId) {
        return res.status(403).json({ success: false, message: 'You can only delete your own expenses.' });
      }

      await Expense.findByIdAndDelete(id);
      res.json({ success: true, message: 'Expense deleted successfully.' });
    } else {
      const idx = memoryStore.expenses.findIndex(e => (e._id || e.id) === id || e.expense_id === id);
      if (idx === -1) return res.status(404).json({ success: false, message: 'Expense not found.' });

      const expense = memoryStore.expenses[idx];
      if (role !== 'admin' && expense.user_id !== userId) {
        return res.status(403).json({ success: false, message: 'You can only delete your own expenses.' });
      }

      memoryStore.expenses.splice(idx, 1);
      saveLocalStore();
      res.json({ success: true, message: 'Expense deleted successfully.' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error deleting expense.' });
  }
};

const bulkDeleteExpenses = async (req, res) => {
  try {
    const { ids } = req.body;
    const { role, id: userId } = req.user;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'No expense IDs provided for deletion.' });
    }

    if (getMongoStatus()) {
      let filter = { _id: { $in: ids } };
      if (role !== 'admin') {
        filter.user_id = userId;
      }
      const result = await Expense.deleteMany(filter);
      res.json({ success: true, message: `${result.deletedCount} expense(s) deleted successfully.` });
    } else {
      let count = 0;
      memoryStore.expenses = memoryStore.expenses.filter(e => {
        const itemMatch = ids.includes(e._id) || ids.includes(e.id) || ids.includes(e.expense_id);
        if (itemMatch) {
          if (role === 'admin' || e.user_id === userId) {
            count++;
            return false;
          }
        }
        return true;
      });
      saveLocalStore();
      res.json({ success: true, message: `${count} expense(s) deleted successfully.` });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error performing bulk deletion.' });
  }
};

const clearAllExpenses = async (req, res) => {
  try {
    const { role, id: userId } = req.user;
    let filter = {};

    if (role !== 'admin') {
      filter.user_id = userId;
    }

    if (getMongoStatus()) {
      const result = await Expense.deleteMany(filter);
      res.json({ success: true, message: `All ${result.deletedCount} expense record(s) erased successfully.` });
    } else {
      let beforeCount = memoryStore.expenses.length;
      if (role === 'admin') {
        memoryStore.expenses = [];
      } else {
        memoryStore.expenses = memoryStore.expenses.filter(e => e.user_id !== userId);
      }
      saveLocalStore();
      let erasedCount = beforeCount - memoryStore.expenses.length;
      res.json({ success: true, message: `All ${erasedCount} expense record(s) erased successfully.` });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error erasing all expenses.' });
  }
};

module.exports = {
  getExpenses,
  getExpenseById,
  createExpense,
  updateExpense,
  deleteExpense,
  bulkDeleteExpenses,
  clearAllExpenses
};

