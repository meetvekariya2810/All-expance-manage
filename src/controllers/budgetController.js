const Budget = require('../models/Budget');
const Expense = require('../models/Expense');
const { getMongoStatus, memoryStore, saveLocalStore } = require('../config/db');

const getBudgets = async (req, res) => {
  try {
    const { role, id: userId } = req.user;
    const targetMonth = req.query.month || new Date().toISOString().slice(0, 7); // YYYY-MM
    const targetPerson = (role === 'admin' && req.query.person && req.query.person !== 'all') 
      ? req.query.person 
      : (role === 'admin' && req.query.user_id ? req.query.user_id : (role === 'admin' ? 'global' : userId));

    let budgetAmount = 50000; // default fallback
    let budgetDoc = null;

    if (getMongoStatus()) {
      // Find budget for specific user or global
      budgetDoc = await Budget.findOne({ 
        $or: [
          { user_id: targetPerson, month: targetMonth },
          { user_id: userId, month: targetMonth },
          { user_id: 'global', month: targetMonth }
        ]
      });
      if (budgetDoc) budgetAmount = budgetDoc.budget_amount;

      // Also get all budgets for this month if admin
      let allBudgets = [];
      if (role === 'admin') {
        allBudgets = await Budget.find({ month: targetMonth });
      }

      // Calculate actual spending for this target in targetMonth
      let expenseFilter = { expense_date: { $regex: `^${targetMonth}` } };
      if (role !== 'admin' || (targetPerson && targetPerson !== 'global')) {
        expenseFilter.user_id = targetPerson === 'global' ? userId : targetPerson;
      }
      const expenses = await Expense.find(expenseFilter);
      const totalSpent = expenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
      const remaining = Math.max(0, budgetAmount - totalSpent);
      const usagePercent = budgetAmount > 0 ? Math.round((totalSpent / budgetAmount) * 100) : 0;

      let status = 'Safe';
      if (usagePercent > 100) status = 'Over Budget';
      else if (usagePercent >= 90) status = 'Near Limit';
      else if (usagePercent >= 75) status = 'Warning';

      return res.json({
        success: true,
        month: targetMonth,
        budget_amount: budgetAmount,
        total_spent: totalSpent,
        remaining_budget: remaining,
        budget_usage_percent: usagePercent,
        status,
        data: allBudgets.length ? allBudgets : (budgetDoc ? [budgetDoc] : [])
      });
    } else {
      const bgtList = memoryStore.budgets || [];
      const found = bgtList.find(b => 
        (b.user_id === targetPerson || b.user_id === userId || b.user_id === 'global') && b.month === targetMonth
      );
      if (found) budgetAmount = parseFloat(found.budget_amount) || 50000;

      let expenses = (memoryStore.expenses || []).filter(e => e.expense_date && e.expense_date.startsWith(targetMonth));
      if (role !== 'admin' || (targetPerson && targetPerson !== 'global')) {
        expenses = expenses.filter(e => e.user_id === (targetPerson === 'global' ? userId : targetPerson));
      }
      const totalSpent = expenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
      const remaining = Math.max(0, budgetAmount - totalSpent);
      const usagePercent = budgetAmount > 0 ? Math.round((totalSpent / budgetAmount) * 100) : 0;

      let status = 'Safe';
      if (usagePercent > 100) status = 'Over Budget';
      else if (usagePercent >= 90) status = 'Near Limit';
      else if (usagePercent >= 75) status = 'Warning';

      const filteredBudgets = role === 'admin' 
        ? bgtList.filter(b => b.month === targetMonth) 
        : (found ? [found] : []);

      return res.json({
        success: true,
        month: targetMonth,
        budget_amount: budgetAmount,
        total_spent: totalSpent,
        remaining_budget: remaining,
        budget_usage_percent: usagePercent,
        status,
        data: filteredBudgets
      });
    }
  } catch (error) {
    console.error('Get budget error:', error);
    res.status(500).json({ success: false, message: 'Error fetching budget.' });
  }
};

const setBudget = async (req, res) => {
  try {
    const { user_id, month, budget_amount } = req.body;
    const { role, id: currentUserId } = req.user;

    const targetUserId = role === 'admin' ? (user_id || 'global') : currentUserId;
    const targetMonth = month || new Date().toISOString().slice(0, 7);
    const amount = parseFloat(budget_amount);

    if (isNaN(amount) || amount < 0) {
      return res.status(400).json({ success: false, message: 'Invalid budget amount. Must be 0 or greater.' });
    }

    if (getMongoStatus()) {
      let budget = await Budget.findOne({ user_id: targetUserId, month: targetMonth });
      if (budget) {
        budget.budget_amount = amount;
        await budget.save();
      } else {
        const bgtId = 'bgt_' + Date.now();
        budget = new Budget({ _id: bgtId, id: bgtId, user_id: targetUserId, month: targetMonth, budget_amount: amount });
        await budget.save();
      }
      res.json({ success: true, message: `Budget for ${targetMonth} set to ₹${amount.toLocaleString()}.`, data: budget });
    } else {
      if (!memoryStore.budgets) memoryStore.budgets = [];
      const idx = memoryStore.budgets.findIndex(b => b.user_id === targetUserId && b.month === targetMonth);
      if (idx !== -1) {
        memoryStore.budgets[idx].budget_amount = amount;
      } else {
        const bgtId = 'bgt_' + Date.now();
        memoryStore.budgets.push({
          _id: bgtId,
          id: bgtId,
          user_id: targetUserId,
          month: targetMonth,
          budget_amount: amount,
          created_at: new Date()
        });
      }
      saveLocalStore();
      res.json({ success: true, message: `Budget for ${targetMonth} set to ₹${amount.toLocaleString()}.` });
    }
  } catch (error) {
    console.error('Set budget error:', error);
    res.status(500).json({ success: false, message: 'Error saving budget.' });
  }
};

module.exports = {
  getBudgets,
  setBudget
};
