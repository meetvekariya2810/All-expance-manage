const Expense = require('../models/Expense');
const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');
const { syncExpenseStore, recordDeletedExpenseId } = require('../config/db');
const fs = require('fs');
const path = require('path');

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
    const { role, id: userId, username } = req.user;
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
      limit = 15
    } = req.query;

    let filter = {};

    // 1. Role Authorization Enforcement: Non-admins can ONLY access their own expenses
    if (role !== 'admin') {
      filter.$or = [{ user_id: userId }, { user_id: username }];
    } else if (person && person !== 'all') {
      // Find matching user by id or username
      const targetUser = await User.findOne({
        $or: [{ _id: person }, { id: person }, { username: person }]
      });
      if (targetUser) {
        filter.$or = [{ user_id: targetUser._id }, { user_id: targetUser.username }];
      } else {
        filter.user_id = person;
      }
    }

    // 2. Category & Payment Filter
    if (category && category !== 'all') filter.category = category;
    if (payment_method && payment_method !== 'all') filter.payment_method = payment_method;

    // 3. Date Filtering
    if (startDate && endDate) {
      filter.expense_date = { $gte: startDate, $lte: endDate };
    } else if (startDate) {
      filter.expense_date = { $gte: startDate };
    } else if (endDate) {
      filter.expense_date = { $lte: endDate };
    }

    // 4. Amount Filtering
    const min = parseFloat(minAmount);
    const max = parseFloat(maxAmount);
    if (!isNaN(min) && !isNaN(max)) {
      filter.amount = { $gte: min, $lte: max };
    } else if (!isNaN(min)) {
      filter.amount = { $gte: min };
    } else if (!isNaN(max)) {
      filter.amount = { $lte: max };
    }

    // 5. Global Search
    if (search && search.trim()) {
      const q = search.trim();
      const searchRegex = { $regex: q, $options: 'i' };
      const searchConditions = [
        { title: searchRegex },
        { description: searchRegex },
        { vendor: searchRegex },
        { location: searchRegex },
        { expense_id: searchRegex },
        { category: searchRegex },
        { notes: searchRegex },
        { user_name: searchRegex }
      ];

      if (filter.$or) {
        // Combine ownership condition with search conditions
        filter = {
          $and: [
            { $or: filter.$or },
            { $or: searchConditions },
            ...Object.keys(filter)
              .filter(k => k !== '$or')
              .map(k => ({ [k]: filter[k] }))
          ]
        };
      } else {
        filter.$or = searchConditions;
      }
    }

    const totalCount = await Expense.countDocuments(filter);

    // Calculate sum of all matching expenses
    const sumResult = await Expense.aggregate([
      { $match: filter },
      { $group: { _id: null, totalSum: { $sum: '$amount' } } }
    ]);
    const totalSum = sumResult.length > 0 ? sumResult[0].totalSum : 0;

    // Sorting & Pagination
    const order = sortOrder === 'asc' ? 1 : -1;
    const sortObj = {};
    sortObj[sortBy] = order;
    if (sortBy !== 'created_at') sortObj.created_at = -1;

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.max(1, parseInt(limit) || 15);

    const expenses = await Expense.find(filter)
      .sort(sortObj)
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);

    const totalPages = Math.ceil(totalCount / limitNum) || 1;

    res.json({
      success: true,
      expenses,
      total: totalCount,
      totalPages,
      page: pageNum,
      limit: limitNum,
      sum: totalSum
    });
  } catch (error) {
    console.error('Error fetching expenses:', error);
    res.status(500).json({ success: false, message: 'Server error retrieving expense records.' });
  }
};

const getExpenseById = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, id: userId, username } = req.user;

    const expense = await findExpenseDoc(id);
    if (!expense) {
      return res.status(404).json({ success: false, message: 'Expense record not found.' });
    }

    // Ownership check for non-admin
    if (role !== 'admin' && expense.user_id !== userId && expense.user_id !== username) {
      return res.status(403).json({ success: false, message: 'Unauthorized. You cannot view this expense.' });
    }

    res.json({ success: true, expense });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error retrieving expense details.' });
  }
};

const createExpense = async (req, res) => {
  try {
    const { role, id: userId, name: userName } = req.user;
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
      expense_time,
      assigned_user
    } = req.body;

    if (!title || !category || !amount || !expense_date) {
      return res.status(400).json({
        success: false,
        message: 'Title, category, amount, and expense date are required fields.'
      });
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Amount must be a positive number.' });
    }

    let targetUserId = userId;
    let targetUserName = userName;

    // Admin can attribute an expense to a specific user if assigned_user is provided
    if (role === 'admin' && assigned_user && assigned_user !== 'self') {
      const foundUser = await User.findOne({
        $or: [{ _id: assigned_user }, { id: assigned_user }, { username: assigned_user }]
      });
      if (foundUser) {
        targetUserId = foundUser._id || foundUser.id;
        targetUserName = foundUser.name;
      }
    }

    let receiptPath = '';
    if (req.file) {
      receiptPath = `/uploads/receipts/${req.file.filename}`;
    }

    const expenseIdStr = await generateExpenseId();
    const uniqueDocId = 'exp_' + Date.now() + '_' + Math.floor(Math.random() * 10000);

    const newExpense = new Expense({
      _id: uniqueDocId,
      id: uniqueDocId,
      expense_id: expenseIdStr,
      user_id: targetUserId,
      user_name: targetUserName,
      created_by: targetUserName,
      title: title.trim(),
      description: (description || '').trim(),
      category: category.trim(),
      amount: parsedAmount,
      payment_method: payment_method || 'UPI',
      vendor: (vendor || '').trim(),
      location: (location || '').trim(),
      receipt: receiptPath,
      notes: (notes || '').trim(),
      expense_date: expense_date,
      expense_time: expense_time || new Date().toTimeString().slice(0, 5),
      created_at: new Date(),
      updated_at: new Date()
    });

    await newExpense.save();

    // Synchronize disk and memory snapshot
    syncExpenseStore('create', newExpense);

    // Log user activity
    await ActivityLog.create({
      user_id: targetUserId,
      user_name: targetUserName,
      action: 'Expense Added',
      expense_id: expenseIdStr,
      amount: parsedAmount,
      category: category.trim(),
      title: title.trim(),
      details: `${targetUserName} added ₹${parsedAmount.toLocaleString('en-IN')} for ${category.trim()}`,
      type: 'create',
      timestamp: new Date()
    }).catch(err => console.warn('ActivityLog create notice:', err.message));

    res.status(201).json({
      success: true,
      message: 'Expense created successfully.',
      expense: newExpense
    });
  } catch (error) {
    console.error('Create expense error:', error);
    res.status(500).json({ success: false, message: 'Server error while saving expense.' });
  }
};

const updateExpense = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, id: userId, username } = req.user;

    const expense = await findExpenseDoc(id);
    if (!expense) {
      return res.status(404).json({ success: false, message: 'Expense record not found.' });
    }

    // Ownership check for non-admin
    if (role !== 'admin' && expense.user_id !== userId && expense.user_id !== username) {
      return res.status(403).json({ success: false, message: 'Unauthorized. You cannot modify this record.' });
    }

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

    if (title) expense.title = title.trim();
    if (description !== undefined) expense.description = description.trim();
    if (category) expense.category = category.trim();
    if (amount) {
      const parsed = parseFloat(amount);
      if (isNaN(parsed) || parsed <= 0) {
        return res.status(400).json({ success: false, message: 'Amount must be a positive number.' });
      }
      expense.amount = parsed;
    }
    if (payment_method) expense.payment_method = payment_method;
    if (vendor !== undefined) expense.vendor = vendor.trim();
    if (location !== undefined) expense.location = location.trim();
    if (notes !== undefined) expense.notes = notes.trim();
    if (expense_date) expense.expense_date = expense_date;
    if (expense_time) expense.expense_time = expense_time;

    if (req.file) {
      expense.receipt = `/uploads/receipts/${req.file.filename}`;
    }

    expense.updated_at = new Date();
    await expense.save();

    // Synchronize disk and memory snapshot
    syncExpenseStore('update', expense);

    // Log update activity
    await ActivityLog.create({
      user_id: req.user.id,
      user_name: req.user.name,
      action: 'Expense Updated',
      expense_id: expense.expense_id,
      amount: expense.amount,
      category: expense.category,
      title: expense.title,
      details: `${req.user.name} updated ₹${expense.amount.toLocaleString('en-IN')} (${expense.title})`,
      type: 'update',
      timestamp: new Date()
    }).catch(err => console.warn('ActivityLog update notice:', err.message));

    res.json({
      success: true,
      message: 'Expense updated successfully.',
      expense
    });
  } catch (error) {
    console.error('Update expense error:', error);
    res.status(500).json({ success: false, message: 'Error updating expense record.' });
  }
};

const deleteExpense = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, id: userId, username } = req.user;

    const expense = await findExpenseDoc(id);
    if (!expense) {
      return res.status(404).json({ success: false, message: 'Expense record not found.' });
    }

    // Role check: Only admin or the owner can delete
    if (role !== 'admin' && expense.user_id !== userId && expense.user_id !== username) {
      return res.status(403).json({ success: false, message: 'Unauthorized to delete this record.' });
    }

    // Attempt to remove attached receipt file if it exists locally
    if (expense.receipt && expense.receipt.startsWith('/uploads/')) {
      const localFilePath = path.join(__dirname, '..', expense.receipt);
      if (fs.existsSync(localFilePath)) {
        try { fs.unlinkSync(localFilePath); } catch (e) { /* ignore */ }
      }
    }

    const expMongoId = expense._id;
    const expCustomId = expense.id;
    const expCode = expense.expense_id;

    // Permanent delete from MongoDB
    await Expense.deleteOne({
      $or: [
        { _id: expMongoId },
        { id: expCustomId || expMongoId },
        { expense_id: expCode || expMongoId }
      ]
    });

    // Permanent delete from snapshot store + record tombstones
    syncExpenseStore('delete', expMongoId);
    if (expCustomId) recordDeletedExpenseId(expCustomId);
    if (expCode) recordDeletedExpenseId(expCode);

    // Log delete activity in ActivityLog (never brings back the deleted expense)
    await ActivityLog.create({
      user_id: req.user.id,
      user_name: req.user.name,
      action: 'Expense Deleted',
      expense_id: expense.expense_id || String(expMongoId),
      amount: expense.amount,
      category: expense.category,
      title: expense.title,
      details: `${req.user.name} permanently deleted expense '${expense.title}' (₹${(parseFloat(expense.amount) || 0).toLocaleString('en-IN')})`,
      type: 'delete',
      timestamp: new Date()
    }).catch(err => console.warn('ActivityLog delete notice:', err.message));

    return res.json({ success: true, message: 'Expense deleted successfully.' });
  } catch (error) {
    console.error('Delete expense error:', error);
    return res.status(500).json({ success: false, message: 'Error deleting expense.' });
  }
};

const bulkDeleteExpenses = async (req, res) => {
  try {
    const { ids } = req.body;
    const { role, id: userId, username } = req.user;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'Please provide a valid list of IDs to delete.' });
    }

    let deleteFilter = {
      $or: [{ _id: { $in: ids } }, { id: { $in: ids } }, { expense_id: { $in: ids } }]
    };

    // Strict non-admin scoping: only delete their own records
    if (role !== 'admin') {
      deleteFilter = {
        $and: [
          deleteFilter,
          { $or: [{ user_id: userId }, { user_id: username }] }
        ]
      };
    }

    // Identify docs to be removed to capture all identifiers for tombstone tracking
    const docsToDelete = await Expense.find(deleteFilter).select('_id id expense_id');
    const allIdsToDelete = [];
    docsToDelete.forEach(d => {
      if (d._id) allIdsToDelete.push(String(d._id));
      if (d.id) allIdsToDelete.push(String(d.id));
      if (d.expense_id) allIdsToDelete.push(String(d.expense_id));
    });

    const result = await Expense.deleteMany(deleteFilter);

    // Sync snapshot store
    syncExpenseStore('bulk_delete', allIdsToDelete.length ? allIdsToDelete : ids);

    // Log bulk delete activity
    await ActivityLog.create({
      user_id: req.user.id,
      user_name: req.user.name,
      action: 'Bulk Expenses Deleted',
      details: `${req.user.name} permanently bulk deleted ${result.deletedCount} expense records`,
      type: 'delete',
      timestamp: new Date()
    }).catch(err => console.warn('ActivityLog bulk delete notice:', err.message));

    return res.json({
      success: true,
      message: `Successfully deleted ${result.deletedCount} expense records.`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('Bulk delete error:', error);
    return res.status(500).json({ success: false, message: 'Error executing bulk deletion.' });
  }
};

const clearAllExpenses = async (req, res) => {
  try {
    const { role, id: userId, username } = req.user;
    const { person } = req.query;

    let filter = {};

    if (role !== 'admin') {
      filter.$or = [{ user_id: userId }, { user_id: username }];
    } else if (person && person !== 'all') {
      const targetUser = await User.findOne({
        $or: [{ _id: person }, { id: person }, { username: person }]
      });
      if (targetUser) {
        filter.$or = [{ user_id: targetUser._id }, { user_id: targetUser.username }];
      } else {
        filter.user_id = person;
      }
    }

    const docs = await Expense.find(filter).select('_id id expense_id');
    const result = await Expense.deleteMany(filter);

    syncExpenseStore('clear', docs);

    await ActivityLog.create({
      user_id: req.user.id,
      user_name: req.user.name,
      action: 'Expenses Cleared',
      details: `${req.user.name} permanently cleared ${result.deletedCount} expense records`,
      type: 'delete',
      timestamp: new Date()
    }).catch(err => console.warn('ActivityLog clear notice:', err.message));

    return res.json({
      success: true,
      message: `Cleared all matching expense records (${result.deletedCount} items).`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('Clear expenses error:', error);
    return res.status(500).json({ success: false, message: 'Error clearing expenses.' });
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
