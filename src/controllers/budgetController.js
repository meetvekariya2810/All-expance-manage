const Budget = require('../models/Budget');
const Expense = require('../models/Expense');
const { getMongoStatus, memoryStore, saveLocalStore } = require('../config/db');

const getBudgets = async (req, res) => {
  try {
    const { role, id: userId } = req.user;
    const currentMonth = req.query.month || new Date().toISOString().slice(0, 7); // YYYY-MM

    let budgetRecords = [];
    if (getMongoStatus()) {
      const filter = role === 'admin' ? { month: currentMonth } : { user_id: userId, month: currentMonth };
      budgetRecords = await Budget.find(filter);
    } else {
      budgetRecords = memoryStore.budgets.filter(b => b.month === currentMonth);
      if (role !== 'admin') {
        budgetRecords = budgetRecords.filter(b => b.user_id === userId);
      }
    }

    res.json({ success: true, month: currentMonth, data: budgetRecords });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching budget.' });
  }
};

const setBudget = async (req, res) => {
  try {
    const { user_id, month, budget_amount } = req.body;
    const { role, id: currentUserId } = req.user;

    const targetUserId = role === 'admin' ? (user_id || currentUserId) : currentUserId;
    const targetMonth = month || new Date().toISOString().slice(0, 7);
    const amount = parseFloat(budget_amount);

    if (isNaN(amount) || amount < 0) {
      return res.status(400).json({ success: false, message: 'Invalid budget amount.' });
    }

    if (getMongoStatus()) {
      let budget = await Budget.findOne({ user_id: targetUserId, month: targetMonth });
      if (budget) {
        budget.budget_amount = amount;
        await budget.save();
      } else {
        budget = new Budget({ user_id: targetUserId, month: targetMonth, budget_amount: amount });
        await budget.save();
      }
      res.json({ success: true, message: 'Budget updated successfully.', data: budget });
    } else {
      const idx = memoryStore.budgets.findIndex(b => b.user_id === targetUserId && b.month === targetMonth);
      if (idx !== -1) {
        memoryStore.budgets[idx].budget_amount = amount;
      } else {
        memoryStore.budgets.push({
          _id: 'bgt_' + Date.now(),
          id: 'bgt_' + Date.now(),
          user_id: targetUserId,
          month: targetMonth,
          budget_amount: amount,
          created_at: new Date()
        });
      }
      saveLocalStore();
      res.json({ success: true, message: 'Budget updated successfully.' });
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
