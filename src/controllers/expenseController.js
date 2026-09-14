const Expense = require('../models/Expense');
const { getMongoStatus, memoryStore, saveLocalStore } = require('../config/db');

// Helper to generate unique human-readable expense ID
const generateExpenseId = async () => {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `EXP-${dateStr}-${randomSuffix}`;
};

// Safe lookup helper for MongoDB
const findExpenseDoc = async (id) => {
  return await Expense.findOne({
    $or: [{ _id: id }, { id: id }, { expense_id: id }]
  });
};

const getExpenses = async (req, res) => {
  try {
    const { role, id: userId } = req.user;
    const {
      search,
      category,
      payment_method,
      person,
      startDate,
      endDate,
      minAmount,
      maxAmount,
      sortBy = 'expense_date',
      sortOrder = 'desc',
      page = 1,
      limit = 20
    } = req.query;

    let filter = {};

    // Role check: Normal users can only see their own expenses
    if (role !== 'admin') {
      filter.user_id = userId;
    } else if (person && person !== 'all') {
      filter.user_id = person;
    }

    if (category && category !== 'all') filter.category = category;
    if (payment_method && payment_method !== 'all') filter.payment_method = payment_method;

    // Date filtering
    if (startDate && endDate) {
      filter.expense_date = { $gte: startDate, $lte: endDate };
    } else if (startDate) {
      filter.expense_date = { $gte: startDate };
    } else if (endDate) {
      filter.expense_date = { $lte: endDate };
    }

    // Amount filtering
    const min = parseFloat(minAmount);
    const max = parseFloat(maxAmount);
    if (!isNaN(min) && !isNaN(max)) {
      filter.amount = { $gte: min, $lte: max };
    } else if (!isNaN(min)) {
      filter.amount = { $gte: min };
    } else if (!isNaN(max)) {
      filter.amount = { $lte: max };
    }

    let expenses = [];
    let totalCount = 0;

    if (getMongoStatus()) {
      let query = Expense.find(filter);

      if (search && search.trim()) {
        const q = search.trim();
        query = query.find({
          $or: [
            { title: { $regex: q, $options: 'i' } },
            { description: { $regex: q, $options: 'i' } },
            { vendor: { $regex: q, $options: 'i' } },
            { location: { $regex: q, $options: 'i' } },
            { expense_id: { $regex: q, $options: 'i' } },
            { category: { $regex: q, $options: 'i' } },
            { notes: { $regex: q, $options: 'i' } },
            { user_name: { $regex: q, $options: 'i' } }
          ]
        });
      }

      totalCount = await Expense.countDocuments(query.getFilter());

      const order = sortOrder === 'asc' ? 1 : -1;
      const sortObj = {};
      sortObj[sortBy] = order;
      if (sortBy !== 'created_at') sortObj.created_at = -1;

      const pageNum = Math.max(1, parseInt(page) || 1);
      const limitNum = Math.max(1, parseInt(limit) || 20);
      query = query.sort(sortObj).skip((pageNum - 1) * limitNum).limit(limitNum);

      expenses = await query.exec();
    } else {
      // Memory Store logic
      let list = [...(memoryStore.expenses || [])];

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

      if (!isNaN(min)) {
        list = list.filter(e => parseFloat(e.amount) >= min);
      }

      if (!isNaN(max)) {
        list = list.filter(e => parseFloat(e.amount) <= max);
      }

      if (search && search.trim()) {
        const q = search.trim().toLowerCase();
        list = list.filter(e =>
          (e.title && e.title.toLowerCase().includes(q)) ||
          (e.description && e.description.toLowerCase().includes(q)) ||
          (e.vendor && e.vendor.toLowerCase().includes(q)) ||
          (e.location && e.location.toLowerCase().includes(q)) ||
          (e.expense_id && e.expense_id.toLowerCase().includes(q)) ||
          (e.category && e.category.toLowerCase().includes(q)) ||
          (e.notes && e.notes.toLowerCase().includes(q)) ||
          (e.user_name && e.user_name.toLowerCase().includes(q))
        );
      }

      totalCount = list.length;

      const order = sortOrder === 'asc' ? 1 : -1;
      list.sort((a, b) => {
        let valA = a[sortBy] !== undefined ? a[sortBy] : '';
        let valB = b[sortBy] !== undefined ? b[sortBy] : '';
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();
        if (valA < valB) return -1 * order;
        if (valA > valB) return 1 * order;
        return 0;
      });

      const pageNum = Math.max(1, parseInt(page) || 1);
      const limitNum = Math.max(1, parseInt(limit) || 20);
      const startIdx = (pageNum - 1) * limitNum;
      expenses = list.slice(startIdx, startIdx + limitNum);
    }

    res.json({
      success: true,
      data: expenses,
      pagination: {
        total: totalCount,
        page: parseInt(page) || 1,
        pages: Math.ceil(totalCount / (parseInt(limit) || 20)) || 1
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
      expense = await findExpenseDoc(id);
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
    console.error('Get expense details error:', error);
    res.status(500).json({ success: false, message: 'Error fetching expense details.' });
  }
};

const createExpense = async (req, res) => {
  try {
    const {
      title,
      description,
      category,
      amount,
      payment_method,
      vendor,
      location,
      notes,
      expense_date,
      expense_time
    } = req.body;
    const { id: userId, name: userName } = req.user;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Expense title is required.' });
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Amount must be a valid number greater than 0.' });
    }

    if (!category || !category.trim()) {
      return res.status(400).json({ success: false, message: 'Category is required.' });
    }

    if (!expense_date) {
      return res.status(400).json({ success: false, message: 'Expense date is required.' });
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

    const uniqueDocId = 'exp_' + Date.now() + Math.floor(Math.random() * 1000);

    const newExpenseObj = {
      _id: uniqueDocId,
      id: uniqueDocId,
      expense_id,
      user_id: userId,
      user_name: userName,
      title: title.trim(),
      description: (description || '').trim(),
      category: category.trim(),
      amount: parsedAmount,
      payment_method: payment_method || 'UPI',
      vendor: (vendor || '').trim(),
      location: (location || '').trim(),
      receipt: receiptUrl,
      notes: (notes || '').trim(),
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
      memoryStore.expenses.unshift(newExpenseObj);
      saveLocalStore();
      return res.status(201).json({ success: true, message: 'Expense added successfully.', data: newExpenseObj });
    }
  } catch (error) {
    console.error('Create expense error:', error);
    res.status(500).json({ success: false, message: 'Error creating expense: ' + error.message });
  }
};

const updateExpense = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, id: userId } = req.user;
    const body = req.body;

    let updateData = { updated_at: new Date() };

    if (body.title !== undefined) {
      if (!body.title.trim()) return res.status(400).json({ success: false, message: 'Title cannot be empty.' });
      updateData.title = body.title.trim();
    }

    if (body.amount !== undefined) {
      const parsedAmount = parseFloat(body.amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ success: false, message: 'Amount must be greater than 0.' });
      }
      updateData.amount = parsedAmount;
    }

    if (body.category !== undefined) updateData.category = body.category.trim();
    if (body.payment_method !== undefined) updateData.payment_method = body.payment_method;
    if (body.vendor !== undefined) updateData.vendor = body.vendor.trim();
    if (body.location !== undefined) updateData.location = body.location.trim();
    if (body.description !== undefined) updateData.description = body.description.trim();
    if (body.notes !== undefined) updateData.notes = body.notes.trim();
    if (body.expense_date !== undefined) updateData.expense_date = body.expense_date;
    if (body.expense_time !== undefined) updateData.expense_time = body.expense_time;

    if (req.file) {
      if (req.file.buffer) {
        const base64Data = req.file.buffer.toString('base64');
        updateData.receipt = `data:${req.file.mimetype};base64,${base64Data}`;
      } else if (req.file.filename) {
        updateData.receipt = `/uploads/receipts/${req.file.filename}`;
      }
    }

    if (getMongoStatus()) {
      const expense = await findExpenseDoc(id);
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
      const expense = await findExpenseDoc(id);
      if (!expense) return res.status(404).json({ success: false, message: 'Expense not found.' });

      if (role !== 'admin' && expense.user_id !== userId) {
        return res.status(403).json({ success: false, message: 'You can only delete your own expenses.' });
      }

      await Expense.deleteOne({ $or: [{ _id: expense._id }, { id: expense.id }, { expense_id: expense.expense_id }] });
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
    console.error('Delete expense error:', error);
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
      let filter = {
        $or: [
          { _id: { $in: ids } },
          { id: { $in: ids } },
          { expense_id: { $in: ids } }
        ]
      };
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
    console.error('Bulk delete error:', error);
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
    console.error('Clear all error:', error);
    res.status(500).json({ success: false, message: 'Error erasing expenses.' });
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
