const Budget = require('../models/Budget');
const Expense = require('../models/Expense');
const User = require('../models/User');

const getBudgets = async (req, res) => {
  try {
    const { role, id: userId, username } = req.user;
    const { month, targetUser } = req.query;

    const currentMonth = month || new Date().toISOString().slice(0, 7); // Format: YYYY-MM

    // Determine target budget key
    let targetScope = 'global';
    if (role !== 'admin') {
      targetScope = userId;
    } else if (targetUser && targetUser !== 'all' && targetUser !== 'global') {
      targetScope = targetUser;
    }

    // Lookup budget for targetScope and month (or fallback to global if user-specific not set)
    let budgetDoc = await Budget.findOne({ user_id: targetScope, month: currentMonth });
    if (!budgetDoc && targetScope !== 'global') {
      budgetDoc = await Budget.findOne({ user_id: username, month: currentMonth });
    }
    if (!budgetDoc && role === 'admin' && targetScope === 'global') {
      budgetDoc = await Budget.findOne({ user_id: 'global', month: currentMonth });
    }

    const budgetAmount = budgetDoc ? budgetDoc.budget_amount : 0;

    // Calculate actual expenses spent for this scope and month
    let expenseFilter = {
      expense_date: { $regex: `^${currentMonth}` }
    };

    if (role !== 'admin') {
      expenseFilter.$or = [{ user_id: userId }, { user_id: username }];
    } else if (targetScope !== 'global') {
      const user = await User.findOne({
        $or: [{ _id: targetScope }, { id: targetScope }, { username: targetScope }]
      });
      if (user) {
        expenseFilter.$or = [{ user_id: user._id }, { user_id: user.username }];
      } else {
        expenseFilter.user_id = targetScope;
      }
    }

    const expenses = await Expense.find(expenseFilter);
    const spentAmount = expenses.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    const remainingAmount = Math.max(0, budgetAmount - spentAmount);
    const percentage = budgetAmount > 0 ? Math.min(100, Math.round((spentAmount / budgetAmount) * 100)) : 0;
    const isExceeded = budgetAmount > 0 && spentAmount > budgetAmount;
    const isWarning = budgetAmount > 0 && spentAmount >= budgetAmount * 0.9;

    res.json({
      success: true,
      month: currentMonth,
      targetScope,
      budget: budgetAmount,
      spent: spentAmount,
      remaining: remainingAmount,
      percentage,
      isExceeded,
      isWarning,
      status: isExceeded ? 'exceeded' : (isWarning ? 'warning' : 'safe')
    });
  } catch (error) {
    console.error('Error fetching budget:', error);
    res.status(500).json({ success: false, message: 'Error retrieving budget data.' });
  }
};

const setBudget = async (req, res) => {
  try {
    const { role, id: userId } = req.user;
    const { month, budget_amount, targetUser } = req.body;

    if (!month || budget_amount === undefined) {
      return res.status(400).json({ success: false, message: 'Month and budget amount are required.' });
    }

    const parsedAmount = parseFloat(budget_amount);
    if (isNaN(parsedAmount) || parsedAmount < 0) {
      return res.status(400).json({ success: false, message: 'Budget amount must be a positive number.' });
    }

    let targetScope = 'global';
    if (role !== 'admin') {
      targetScope = userId;
    } else if (targetUser) {
      targetScope = targetUser;
    }

    let budget = await Budget.findOne({ user_id: targetScope, month });
    if (budget) {
      budget.budget_amount = parsedAmount;
      await budget.save();
    } else {
      budget = new Budget({
        _id: 'bgt_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
        user_id: targetScope,
        month,
        budget_amount: parsedAmount,
        created_at: new Date()
      });
      await budget.save();
    }

    res.json({
      success: true,
      message: 'Monthly budget limit saved successfully.',
      budget
    });
  } catch (error) {
    console.error('Error saving budget:', error);
    res.status(500).json({ success: false, message: 'Error saving budget data.' });
  }
};

module.exports = {
  getBudgets,
  setBudget
};
