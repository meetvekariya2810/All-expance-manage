const Expense = require('../models/Expense');
const Fund = require('../models/Fund');
const Settlement = require('../models/Settlement');
const Category = require('../models/Category');
const User = require('../models/User');

const globalSearch = async (req, res) => {
  try {
    const { role, id: userId, username } = req.user;
    const q = (req.query.q || '').trim();

    if (!q || q.length < 1) {
      return res.status(200).json({
        success: true,
        query: '',
        totalMatches: 0,
        results: {
          expenses: [],
          funds: [],
          settlements: [],
          categories: [],
          users: []
        }
      });
    }

    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'i');
    const parsedAmount = parseFloat(q);
    const hasValidAmount = !isNaN(parsedAmount) && parsedAmount > 0;

    // Role-based scope for non-admins
    const userScope = role === 'admin' ? {} : {
      $or: [{ user_id: userId }, { user_id: username }]
    };

    // 1. Expense Search Query
    const expenseSearchConditions = [
      { title: regex },
      { category: regex },
      { expense_id: regex },
      { notes: regex },
      { vendor: regex },
      { payment_method: regex }
    ];
    if (role === 'admin') {
      expenseSearchConditions.push({ user_name: regex });
      expenseSearchConditions.push({ created_by: regex });
    }
    if (hasValidAmount) {
      expenseSearchConditions.push({ amount: parsedAmount });
    }

    const expenseQuery = role === 'admin'
      ? { $or: expenseSearchConditions }
      : {
          $and: [
            userScope,
            { $or: expenseSearchConditions }
          ]
        };

    // 2. Fund Search Query
    const fundSearchConditions = [
      { person_name: regex },
      { fund_id: regex },
      { notes: regex }
    ];
    if (role === 'admin') {
      fundSearchConditions.push({ created_by: regex });
    }
    if (hasValidAmount) {
      fundSearchConditions.push({ amount: parsedAmount });
    }

    const fundQuery = role === 'admin'
      ? { $or: fundSearchConditions }
      : {
          $and: [
            userScope,
            { $or: fundSearchConditions }
          ]
        };

    // 3. Settlement Search Query
    const settlementSearchConditions = [
      { person_name: regex },
      { settlement_id: regex },
      { status: regex },
      { settlement_type: regex },
      { notes: regex }
    ];
    if (hasValidAmount) {
      settlementSearchConditions.push({ amount: parsedAmount });
    }

    const settlementQuery = role === 'admin'
      ? { $or: settlementSearchConditions }
      : {
          $and: [
            userScope,
            { $or: settlementSearchConditions }
          ]
        };

    // 4. Categories Query
    const categoryQuery = {
      $or: [
        { category_name: regex },
        { name: regex }
      ]
    };

    // 5. Users Query (Admin only)
    const userQuery = role === 'admin'
      ? {
          $or: [
            { name: regex },
            { username: regex },
            { email: regex }
          ]
        }
      : null;

    // Execute queries concurrently
    const [expenses, funds, settlements, categories, users] = await Promise.all([
      Expense.find(expenseQuery)
        .select('expense_id title category amount expense_date payment_method created_by user_name notes')
        .sort({ expense_date: -1, created_at: -1 })
        .limit(6)
        .lean(),
      Fund.find(fundQuery)
        .select('fund_id person_name amount fund_date notes created_by')
        .sort({ fund_date: -1, created_at: -1 })
        .limit(6)
        .lean(),
      Settlement.find(settlementQuery)
        .select('settlement_id person_name amount settlement_type settlement_date status notes')
        .sort({ settlement_date: -1, created_at: -1 })
        .limit(6)
        .lean(),
      Category.find(categoryQuery)
        .select('category_name name icon color')
        .limit(5)
        .lean(),
      userQuery
        ? User.find(userQuery).select('name username email role status').limit(4).lean()
        : Promise.resolve([])
    ]);

    const totalMatches = expenses.length + funds.length + settlements.length + categories.length + users.length;

    return res.status(200).json({
      success: true,
      query: q,
      totalMatches,
      results: {
        expenses,
        funds,
        settlements,
        categories,
        users
      }
    });
  } catch (err) {
    console.error('Error during global search:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to perform global search',
      error: err.message
    });
  }
};

module.exports = {
  globalSearch
};
