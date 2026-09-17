const Expense = require('../models/Expense');
const Budget = require('../models/Budget');
const User = require('../models/User');
const Fund = require('../models/Fund');
const Settlement = require('../models/Settlement');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');

// Shared filter helper for metrics and exports
const getFilteredExpenses = async (req) => {
  const { role, id: userId, username } = req.user;
  const { search, category, payment_method, person, startDate, endDate, month } = req.query;

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

  if (category && category !== 'all') filter.category = category;
  if (payment_method && payment_method !== 'all') filter.payment_method = payment_method;

  if (startDate && endDate) {
    filter.expense_date = { $gte: startDate, $lte: endDate };
  } else if (startDate) {
    filter.expense_date = { $gte: startDate };
  } else if (endDate) {
    filter.expense_date = { $lte: endDate };
  } else if (month) {
    filter.expense_date = { $regex: `^${month}` };
  }

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
      filter = {
        $and: [
          { $or: filter.$or },
          { $or: searchConditions },
          ...Object.keys(filter).filter(k => k !== '$or').map(k => ({ [k]: filter[k] }))
        ]
      };
    } else {
      filter.$or = searchConditions;
    }
  }

  return await Expense.find(filter).sort({ expense_date: -1, created_at: -1 }).exec();
};

// Filter helper for Funds
const getFilteredFunds = async (req) => {
  const { role, id: userId, username } = req.user;
  const { search, person, startDate, endDate, month } = req.query;

  let filter = {};

  if (role !== 'admin') {
    filter.$or = [{ user_id: userId }, { user_id: username }];
  } else if (person && person !== 'all') {
    const targetUser = await User.findOne({
      $or: [{ _id: person }, { id: person }, { username: person }]
    });
    if (targetUser) {
      filter.$or = [
        { user_id: targetUser._id },
        { user_id: targetUser.username },
        { person_name: { $regex: targetUser.name, $options: 'i' } }
      ];
    } else {
      filter.$or = [
        { user_id: person },
        { person_name: { $regex: person, $options: 'i' } }
      ];
    }
  }

  if (startDate && endDate) {
    filter.fund_date = { $gte: startDate, $lte: endDate };
  } else if (startDate) {
    filter.fund_date = { $gte: startDate };
  } else if (endDate) {
    filter.fund_date = { $lte: endDate };
  } else if (month) {
    filter.fund_date = { $regex: `^${month}` };
  }

  if (search && search.trim()) {
    const q = search.trim();
    const searchRegex = { $regex: q, $options: 'i' };
    const searchConditions = [
      { fund_id: searchRegex },
      { person_name: searchRegex },
      { notes: searchRegex },
      { user_name: searchRegex },
      { created_by: searchRegex }
    ];

    if (filter.$or) {
      filter = {
        $and: [
          { $or: filter.$or },
          { $or: searchConditions }
        ]
      };
    } else {
      filter.$or = searchConditions;
    }
  }

  return await Fund.find(filter).sort({ fund_date: -1, created_at: -1 }).exec();
};

// Filter helper for Settlements
const getFilteredSettlements = async (req) => {
  const { role, id: userId, username } = req.user;
  const { search, person, status, settlement_type, startDate, endDate } = req.query;

  let filter = {};

  if (role !== 'admin') {
    filter.$or = [{ user_id: userId }, { user_id: username }];
  } else if (person && person !== 'all') {
    const targetUser = await User.findOne({
      $or: [{ _id: person }, { id: person }, { username: person }]
    });
    if (targetUser) {
      filter.$or = [
        { user_id: targetUser._id },
        { user_id: targetUser.username },
        { person_name: { $regex: targetUser.name, $options: 'i' } }
      ];
    } else {
      filter.$or = [
        { user_id: person },
        { person_name: { $regex: person, $options: 'i' } }
      ];
    }
  }

  if (status && status !== 'all') filter.status = status;
  if (settlement_type && settlement_type !== 'all') filter.settlement_type = settlement_type;

  if (startDate && endDate) {
    filter.settlement_date = { $gte: startDate, $lte: endDate };
  } else if (startDate) {
    filter.settlement_date = { $gte: startDate };
  } else if (endDate) {
    filter.settlement_date = { $lte: endDate };
  }

  if (search && search.trim()) {
    const q = search.trim();
    const searchRegex = { $regex: q, $options: 'i' };
    const searchConditions = [
      { settlement_id: searchRegex },
      { person_name: searchRegex },
      { notes: searchRegex },
      { user_name: searchRegex },
      { created_by: searchRegex }
    ];

    if (filter.$or) {
      filter = {
        $and: [
          { $or: filter.$or },
          { $or: searchConditions }
        ]
      };
    } else {
      filter.$or = searchConditions;
    }
  }

  return await Settlement.find(filter).sort({ settlement_date: -1, created_at: -1 }).exec();
};

const getSummaryMetrics = async (req, res) => {
  try {
    const { role, id: userId, username } = req.user;
    const { person, month } = req.query;

    const todayStr = new Date().toISOString().slice(0, 10);
    const currentMonthStr = month || todayStr.slice(0, 7);

    // Build base filter for user scope
    let baseExpenseFilter = {};
    let baseFundFilter = {};
    let baseSettlementFilter = {};
    let targetScope = 'global';

    if (role !== 'admin') {
      baseExpenseFilter.$or = [{ user_id: userId }, { user_id: username }];
      baseFundFilter.$or = [{ user_id: userId }, { user_id: username }];
      baseSettlementFilter.$or = [{ user_id: userId }, { user_id: username }];
      targetScope = userId;
    } else if (person && person !== 'all') {
      const targetUser = await User.findOne({
        $or: [{ _id: person }, { id: person }, { username: person }]
      });
      if (targetUser) {
        baseExpenseFilter.$or = [{ user_id: targetUser._id }, { user_id: targetUser.username }];
        baseFundFilter.$or = [
          { user_id: targetUser._id },
          { user_id: targetUser.username },
          { person_name: { $regex: targetUser.name, $options: 'i' } }
        ];
        baseSettlementFilter.$or = [
          { user_id: targetUser._id },
          { user_id: targetUser.username },
          { person_name: { $regex: targetUser.name, $options: 'i' } }
        ];
        targetScope = targetUser._id;
      } else {
        baseExpenseFilter.user_id = person;
        baseFundFilter.$or = [
          { user_id: person },
          { person_name: { $regex: person, $options: 'i' } }
        ];
        baseSettlementFilter.$or = [
          { user_id: person },
          { person_name: { $regex: person, $options: 'i' } }
        ];
        targetScope = person;
      }
    }

    // 1. Fetch Expenses
    const allExpenses = await Expense.find(baseExpenseFilter).sort({ expense_date: -1, created_at: -1 });
    const totalSpending = allExpenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
    const totalTransactions = allExpenses.length;

    const monthlyExpenses = allExpenses.filter(e => e.expense_date && e.expense_date.startsWith(currentMonthStr));
    const monthlySpending = monthlyExpenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

    const todayExpenses = allExpenses.filter(e => e.expense_date === todayStr);
    const todaySpending = todayExpenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

    // 2. Fetch Funds (MongoDB Atlas source of truth)
    const allFunds = await Fund.find(baseFundFilter).sort({ fund_date: -1, created_at: -1 });
    const totalFunds = allFunds.reduce((sum, f) => sum + (parseFloat(f.amount) || 0), 0);
    const totalFundTransactions = allFunds.length;

    const monthlyFundsList = allFunds.filter(f => f.fund_date && f.fund_date.startsWith(currentMonthStr));
    const monthlyFunds = monthlyFundsList.reduce((sum, f) => sum + (parseFloat(f.amount) || 0), 0);

    const todayFundsList = allFunds.filter(f => f.fund_date === todayStr);
    const todayFunds = todayFundsList.reduce((sum, f) => sum + (parseFloat(f.amount) || 0), 0);

    // Core Formula: Available Balance = Total Funds - Total Expenses
    const availableBalance = totalFunds - totalSpending;
    const monthlyAvailableBalance = monthlyFunds - monthlySpending;

    // 3. Fetch Settlements (Settle Up)
    const allSettlements = await Settlement.find(baseSettlementFilter).sort({ settlement_date: -1, created_at: -1 });
    let totalSettlementsPaid = 0;
    let totalSettlementsReceived = 0;
    let pendingSettlementsCount = 0;
    let pendingSettlementsAmount = 0;
    let settledSettlementsCount = 0;
    let settledSettlementsAmount = 0;

    allSettlements.forEach((s) => {
      const amt = parseFloat(s.amount) || 0;
      if (s.settlement_type === 'Paid') {
        totalSettlementsPaid += amt;
      } else if (s.settlement_type === 'Received') {
        totalSettlementsReceived += amt;
      }
      if (s.status === 'Pending') {
        pendingSettlementsCount++;
        pendingSettlementsAmount += amt;
      } else {
        settledSettlementsCount++;
        settledSettlementsAmount += amt;
      }
    });

    // Average, Max, Min Expenses
    const averageSpending = totalTransactions > 0 ? (totalSpending / totalTransactions) : 0;
    const highestExpense = totalTransactions > 0 ? Math.max(...allExpenses.map(e => parseFloat(e.amount) || 0)) : 0;
    const lowestExpense = totalTransactions > 0 ? Math.min(...allExpenses.map(e => parseFloat(e.amount) || 0)) : 0;

    // Category breakdown
    const categoryBreakdown = {};
    allExpenses.forEach(e => {
      const cat = e.category || 'Miscellaneous';
      categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + (parseFloat(e.amount) || 0);
    });

    // Funds by Person breakdown
    const fundsByPerson = {};
    allFunds.forEach(f => {
      const p = f.person_name || 'Other';
      fundsByPerson[p] = (fundsByPerson[p] || 0) + (parseFloat(f.amount) || 0);
    });

    // Monthly trend for expenses & funds (last 12 months)
    const monthlyTrend = {};
    allExpenses.forEach(e => {
      if (e.expense_date && e.expense_date.length >= 7) {
        const m = e.expense_date.slice(0, 7);
        monthlyTrend[m] = (monthlyTrend[m] || 0) + (parseFloat(e.amount) || 0);
      }
    });

    const monthlyFundsTrend = {};
    allFunds.forEach(f => {
      if (f.fund_date && f.fund_date.length >= 7) {
        const m = f.fund_date.slice(0, 7);
        monthlyFundsTrend[m] = (monthlyFundsTrend[m] || 0) + (parseFloat(f.amount) || 0);
      }
    });

    // Payment method breakdown
    const paymentMethodBreakdown = {};
    allExpenses.forEach(e => {
      const p = e.payment_method || 'Other';
      paymentMethodBreakdown[p] = (paymentMethodBreakdown[p] || 0) + (parseFloat(e.amount) || 0);
    });

    // Daily spending (current month)
    const dailySpending = {};
    monthlyExpenses.forEach(e => {
      if (e.expense_date) {
        dailySpending[e.expense_date] = (dailySpending[e.expense_date] || 0) + (parseFloat(e.amount) || 0);
      }
    });

    // User comparison (Admin only)
    const userComparison = {};
    const userFundComparison = {};
    let userSummaries = [];

    if (role === 'admin') {
      const allUsers = await User.find({});
      allUsers.forEach(u => {
        userComparison[u.name] = 0;
        userFundComparison[u.name] = 0;
      });

      allExpenses.forEach(e => {
        const name = e.user_name || 'Other';
        userComparison[name] = (userComparison[name] || 0) + (parseFloat(e.amount) || 0);
      });

      allFunds.forEach(f => {
        const name = f.user_name || 'Other';
        userFundComparison[name] = (userFundComparison[name] || 0) + (parseFloat(f.amount) || 0);
      });

      userSummaries = allUsers.map(u => ({
        _id: u._id,
        name: u.name,
        username: u.username,
        role: u.role,
        totalSpent: userComparison[u.name] || 0,
        totalFunds: userFundComparison[u.name] || 0,
        balance: (userFundComparison[u.name] || 0) - (userComparison[u.name] || 0)
      }));
    }

    // Fetch Budget Data
    let monthlyBudget = 0;
    try {
      const budgetQuery = targetScope === 'global' ? { user_id: 'global', month: currentMonthStr } : { user_id: targetScope, month: currentMonthStr };
      const budgetDoc = await Budget.findOne(budgetQuery);
      if (budgetDoc) {
        monthlyBudget = parseFloat(budgetDoc.monthly_limit) || 0;
      }
    } catch (bErr) {}

    const remainingBudget = monthlyBudget > 0 ? Math.max(0, monthlyBudget - monthlySpending) : 0;
    const budgetPercent = monthlyBudget > 0 ? Math.min(100, Math.round((monthlySpending / monthlyBudget) * 100)) : 0;
    const budgetStatus = monthlyBudget > 0 
      ? (monthlySpending > monthlyBudget ? 'Over Budget' : (monthlySpending >= monthlyBudget * 0.9 ? 'Near Limit' : 'Within Budget'))
      : 'Not Set';

    // Interleave Unified Recent Transactions (combining Funds and Expenses)
    const normalizedExpenses = allExpenses.slice(0, 15).map(e => ({
      _id: e._id || e.id,
      id: e.expense_id || e.id,
      txn_type: 'expense',
      direction: 'out',
      title: e.title,
      person: e.user_name || 'Member',
      amount: parseFloat(e.amount) || 0,
      date: e.expense_date,
      time: e.expense_time || '12:00',
      category: e.category,
      payment_method: e.payment_method,
      vendor: e.vendor || '',
      notes: e.notes || e.description || '',
      created_at: e.created_at
    }));

    const normalizedFunds = allFunds.slice(0, 15).map(f => ({
      _id: f._id || f.id,
      id: f.fund_id || f.id,
      txn_type: 'fund',
      direction: 'in',
      title: `Fund from ${f.person_name}`,
      person: f.person_name,
      amount: parseFloat(f.amount) || 0,
      date: f.fund_date,
      time: '10:00',
      category: 'Fund / Money In',
      payment_method: 'Transfer / Cash',
      vendor: f.person_name,
      notes: f.notes || '',
      created_at: f.created_at
    }));

    const unifiedTransactions = [...normalizedExpenses, ...normalizedFunds]
      .sort((a, b) => new Date(`${b.date}T${b.time || '00:00'}`) - new Date(`${a.date}T${a.time || '00:00'}`))
      .slice(0, 15);

    const summaryData = {
      // Primary Funds & Balance
      totalFunds,
      totalFundTransactions,
      monthlyFunds,
      todayFunds,
      fundsByPerson,
      monthlyFundsTrend,

      // Primary Expense Metrics
      totalExpense: totalSpending,
      totalSpending,
      totalTransactions,
      monthlyExpense: monthlySpending,
      monthlySpending,
      todayExpense: todaySpending,
      todaySpending,
      averageExpense: averageSpending,
      averageSpending,
      highestExpense,
      lowestExpense,

      // Core Financial Balance
      availableBalance,
      monthlyAvailableBalance,

      // Settlements (Settle Up)
      settlements: {
        totalPaid: totalSettlementsPaid,
        totalReceived: totalSettlementsReceived,
        net: totalSettlementsReceived - totalSettlementsPaid,
        pendingCount: pendingSettlementsCount,
        pendingAmount: pendingSettlementsAmount,
        settledCount: settledSettlementsCount,
        settledAmount: settledSettlementsAmount
      },

      // Budget
      budgetAmount: monthlyBudget,
      monthlyBudget,
      remainingBudget,
      budgetUsagePercent: budgetPercent,
      budgetPercent,
      budgetStatus,
      isBudgetExceeded: monthlyBudget > 0 && monthlySpending > monthlyBudget,
      isBudgetWarning: monthlyBudget > 0 && monthlySpending >= monthlyBudget * 0.9,

      // Breakdowns & Trends
      categoryTotals: categoryBreakdown,
      categoryBreakdown,
      monthlyTrend,
      paymentTotals: paymentMethodBreakdown,
      paymentMethodBreakdown,
      dailyTrend: dailySpending,
      dailySpending,
      userTotals: userComparison,
      userComparison,
      userFundComparison,
      userSummaries,
      recentTransactions: unifiedTransactions
    };

    res.json({
      success: true,
      summary: summaryData,
      metrics: summaryData
    });
  } catch (error) {
    console.error('Error in getSummaryMetrics:', error);
    res.status(500).json({ success: false, message: 'Server error compiling financial analytics.' });
  }
};

// Export to PDF
const exportPDF = async (req, res) => {
  try {
    const entity = req.query.entity || 'expenses';

    if (entity === 'funds') {
      const funds = await getFilteredFunds(req);
      const doc = new PDFDocument({ margin: 30, size: 'A4' });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=Funds_Statement_${Date.now()}.pdf`);
      doc.pipe(res);

      doc.fontSize(20).fillColor('#059669').text('Smart Personal Expense Management', { align: 'center' });
      doc.fontSize(12).fillColor('#64748b').text('Funds / Money In Statement', { align: 'center' });
      doc.moveDown(0.5);

      const generatedOn = new Date().toLocaleDateString('en-IN', {
        year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
      });
      doc.fontSize(9).fillColor('#475569')
        .text(`Generated On: ${generatedOn} | Requested By: ${req.user.name} (${req.user.role.toUpperCase()})`, { align: 'center' });
      doc.moveDown(1);

      const totalAmt = funds.reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0);

      // Summary Box
      doc.rect(30, doc.y, 535, 45).fillAndStroke('#ecfdf5', '#a7f3d0');
      const boxY = doc.y + 12;
      doc.fillColor('#065f46').fontSize(11).font('Helvetica-Bold')
        .text(`Total Records: ${funds.length}`, 45, boxY)
        .text(`Total Funds Added: +Rs. ${totalAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 300, boxY);
      doc.moveDown(3);

      const tableTop = doc.y;
      doc.rect(30, tableTop, 535, 20).fill('#059669');
      doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold');
      doc.text('Fund ID', 35, tableTop + 5, { width: 90 });
      doc.text('Date', 130, tableTop + 5, { width: 65 });
      doc.text('Person Name', 200, tableTop + 5, { width: 120 });
      doc.text('Notes', 325, tableTop + 5, { width: 140 });
      doc.text('Amount (Rs)', 470, tableTop + 5, { width: 90, align: 'right' });

      let y = tableTop + 24;
      doc.font('Helvetica').fontSize(8).fillColor('#1e293b');

      funds.forEach((item, index) => {
        if (y > 750) {
          doc.addPage();
          y = 40;
        }
        if (index % 2 === 1) {
          doc.rect(30, y - 2, 535, 18).fill('#f8fafc');
          doc.fillColor('#1e293b');
        }

        doc.text(item.fund_id || item.id || '-', 35, y, { width: 90 });
        doc.text(item.fund_date || '-', 130, y, { width: 65 });
        doc.text(item.person_name || '-', 200, y, { width: 120, ellipsis: true });
        doc.text(item.notes || '-', 325, y, { width: 140, ellipsis: true });
        doc.fillColor('#059669').text(`+${(parseFloat(item.amount) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 470, y, { width: 90, align: 'right' });
        doc.fillColor('#1e293b');

        y += 18;
      });

      doc.end();
      return;
    }

    if (entity === 'settlements') {
      const settlements = await getFilteredSettlements(req);
      const doc = new PDFDocument({ margin: 30, size: 'A4' });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=Settlements_Statement_${Date.now()}.pdf`);
      doc.pipe(res);

      doc.fontSize(20).fillColor('#4f46e5').text('Smart Personal Expense Management', { align: 'center' });
      doc.fontSize(12).fillColor('#64748b').text('Settle Up Statement', { align: 'center' });
      doc.moveDown(0.5);

      const generatedOn = new Date().toLocaleDateString('en-IN', {
        year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
      });
      doc.fontSize(9).fillColor('#475569')
        .text(`Generated On: ${generatedOn} | Requested By: ${req.user.name} (${req.user.role.toUpperCase()})`, { align: 'center' });
      doc.moveDown(1);

      let totalPaid = 0;
      let totalReceived = 0;
      settlements.forEach(s => {
        const amt = parseFloat(s.amount) || 0;
        if (s.settlement_type === 'Paid') totalPaid += amt;
        else totalReceived += amt;
      });

      doc.rect(30, doc.y, 535, 45).fillAndStroke('#eef2ff', '#c7d2fe');
      const boxY = doc.y + 12;
      doc.fillColor('#3730a3').fontSize(10).font('Helvetica-Bold')
        .text(`Records: ${settlements.length}`, 45, boxY)
        .text(`Paid: Rs. ${totalPaid.toLocaleString('en-IN')}`, 170, boxY)
        .text(`Received: Rs. ${totalReceived.toLocaleString('en-IN')}`, 320, boxY)
        .text(`Net: Rs. ${(totalReceived - totalPaid).toLocaleString('en-IN')}`, 440, boxY);
      doc.moveDown(3);

      const tableTop = doc.y;
      doc.rect(30, tableTop, 535, 20).fill('#4f46e5');
      doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold');
      doc.text('ID', 35, tableTop + 5, { width: 85 });
      doc.text('Date', 125, tableTop + 5, { width: 55 });
      doc.text('Person Name', 185, tableTop + 5, { width: 110 });
      doc.text('Type', 300, tableTop + 5, { width: 60 });
      doc.text('Status', 365, tableTop + 5, { width: 55 });
      doc.text('Amount (Rs)', 470, tableTop + 5, { width: 90, align: 'right' });

      let y = tableTop + 24;
      doc.font('Helvetica').fontSize(8).fillColor('#1e293b');

      settlements.forEach((item, index) => {
        if (y > 750) {
          doc.addPage();
          y = 40;
        }
        if (index % 2 === 1) {
          doc.rect(30, y - 2, 535, 18).fill('#f8fafc');
          doc.fillColor('#1e293b');
        }

        doc.text(item.settlement_id || item.id || '-', 35, y, { width: 85 });
        doc.text(item.settlement_date || '-', 125, y, { width: 55 });
        doc.text(item.person_name || '-', 185, y, { width: 110, ellipsis: true });
        doc.text(item.settlement_type || '-', 300, y, { width: 60 });
        doc.text(item.status || '-', 365, y, { width: 55 });
        doc.text((parseFloat(item.amount) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }), 470, y, { width: 90, align: 'right' });

        y += 18;
      });

      doc.end();
      return;
    }

    // Default: Expenses PDF
    const expenses = await getFilteredExpenses(req);
    const doc = new PDFDocument({ margin: 30, size: 'A4' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Expense_Statement_${Date.now()}.pdf`);

    doc.pipe(res);

    doc.fontSize(20).fillColor('#1e40af').text('Smart Personal Expense Management', { align: 'center' });
    doc.fontSize(12).fillColor('#64748b').text('Financial Statement Report', { align: 'center' });
    doc.moveDown(0.5);

    const generatedOn = new Date().toLocaleDateString('en-IN', {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    doc.fontSize(9).fillColor('#475569')
      .text(`Generated On: ${generatedOn} | Requested By: ${req.user.name} (${req.user.role.toUpperCase()})`, { align: 'center' });
    doc.moveDown(1);

    const totalAmt = expenses.reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0);

    doc.rect(30, doc.y, 535, 45).fillAndStroke('#eff6ff', '#bfdbfe');
    const boxY = doc.y + 12;
    doc.fillColor('#1e3a8a').fontSize(11).font('Helvetica-Bold')
      .text(`Total Records: ${expenses.length}`, 45, boxY)
      .text(`Total Expenditure: Rs. ${totalAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 320, boxY);
    doc.moveDown(3);

    const tableTop = doc.y;
    doc.rect(30, tableTop, 535, 20).fill('#1e40af');
    doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold');
    doc.text('ID', 35, tableTop + 5, { width: 85 });
    doc.text('Date', 125, tableTop + 5, { width: 55 });
    doc.text('Title & Vendor', 185, tableTop + 5, { width: 140 });
    doc.text('Member', 330, tableTop + 5, { width: 65 });
    doc.text('Category', 400, tableTop + 5, { width: 75 });
    doc.text('Amount (Rs)', 480, tableTop + 5, { width: 80, align: 'right' });

    let y = tableTop + 24;
    doc.font('Helvetica').fontSize(8).fillColor('#1e293b');

    expenses.forEach((item, index) => {
      if (y > 750) {
        doc.addPage();
        y = 40;
      }

      if (index % 2 === 1) {
        doc.rect(30, y - 2, 535, 18).fill('#f8fafc');
        doc.fillColor('#1e293b');
      }

      doc.text(item.expense_id || item.id || '-', 35, y, { width: 85 });
      doc.text(item.expense_date || '-', 125, y, { width: 55 });
      const titleVendor = item.vendor ? `${item.title} (${item.vendor})` : item.title;
      doc.text(titleVendor, 185, y, { width: 140, ellipsis: true });
      doc.text(item.user_name || '-', 330, y, { width: 65, ellipsis: true });
      doc.text(item.category || '-', 400, y, { width: 75 });
      doc.text((parseFloat(item.amount) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }), 480, y, { width: 80, align: 'right' });

      y += 18;
    });

    doc.end();
  } catch (error) {
    console.error('PDF export error:', error);
    res.status(500).json({ success: false, message: 'Error generating PDF statement.' });
  }
};

// Export to Excel
const exportExcel = async (req, res) => {
  try {
    const entity = req.query.entity || 'expenses';

    if (entity === 'funds') {
      const funds = await getFilteredFunds(req);
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Funds Records');

      worksheet.columns = [
        { header: 'Fund ID', key: 'fund_id', width: 22 },
        { header: 'Date', key: 'fund_date', width: 14 },
        { header: 'Person Name', key: 'person_name', width: 25 },
        { header: 'Amount (INR)', key: 'amount', width: 18 },
        { header: 'Created By', key: 'user_name', width: 20 },
        { header: 'Notes', key: 'notes', width: 35 }
      ];

      worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } };
      worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

      funds.forEach(f => {
        worksheet.addRow({
          fund_id: f.fund_id || f.id,
          fund_date: f.fund_date,
          person_name: f.person_name,
          amount: parseFloat(f.amount) || 0,
          user_name: f.user_name || f.created_by,
          notes: f.notes
        });
      });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=Funds_Statement_${Date.now()}.xlsx`);
      await workbook.xlsx.write(res);
      return res.end();
    }

    if (entity === 'settlements') {
      const settlements = await getFilteredSettlements(req);
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Settlement Records');

      worksheet.columns = [
        { header: 'Settlement ID', key: 'settlement_id', width: 22 },
        { header: 'Date', key: 'settlement_date', width: 14 },
        { header: 'Person Name', key: 'person_name', width: 25 },
        { header: 'Type', key: 'settlement_type', width: 14 },
        { header: 'Status', key: 'status', width: 14 },
        { header: 'Amount (INR)', key: 'amount', width: 18 },
        { header: 'Created By', key: 'user_name', width: 20 },
        { header: 'Notes', key: 'notes', width: 35 }
      ];

      worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
      worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

      settlements.forEach(s => {
        worksheet.addRow({
          settlement_id: s.settlement_id || s.id,
          settlement_date: s.settlement_date,
          person_name: s.person_name,
          settlement_type: s.settlement_type,
          status: s.status,
          amount: parseFloat(s.amount) || 0,
          user_name: s.user_name || s.created_by,
          notes: s.notes
        });
      });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=Settlements_Statement_${Date.now()}.xlsx`);
      await workbook.xlsx.write(res);
      return res.end();
    }

    // Default: Expenses Excel
    const expenses = await getFilteredExpenses(req);
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Expense Records');

    worksheet.columns = [
      { header: 'Expense ID', key: 'expense_id', width: 22 },
      { header: 'Date', key: 'expense_date', width: 14 },
      { header: 'Time', key: 'expense_time', width: 10 },
      { header: 'Title', key: 'title', width: 28 },
      { header: 'Description', key: 'description', width: 30 },
      { header: 'Category', key: 'category', width: 18 },
      { header: 'Amount (INR)', key: 'amount', width: 16 },
      { header: 'Payment Method', key: 'payment_method', width: 18 },
      { header: 'Member Name', key: 'user_name', width: 18 },
      { header: 'Vendor', key: 'vendor', width: 22 },
      { header: 'Location', key: 'location', width: 18 },
      { header: 'Notes', key: 'notes', width: 24 }
    ];

    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };
    worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

    expenses.forEach(exp => {
      worksheet.addRow({
        expense_id: exp.expense_id || exp.id,
        expense_date: exp.expense_date,
        expense_time: exp.expense_time,
        title: exp.title,
        description: exp.description,
        category: exp.category,
        amount: parseFloat(exp.amount) || 0,
        payment_method: exp.payment_method,
        user_name: exp.user_name,
        vendor: exp.vendor,
        location: exp.location,
        notes: exp.notes
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Expense_Statement_${Date.now()}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Excel export error:', error);
    res.status(500).json({ success: false, message: 'Error generating Excel export.' });
  }
};

// Export to CSV
const exportCSV = async (req, res) => {
  try {
    const entity = req.query.entity || 'expenses';

    const escapeVal = (val) => {
      const str = String(val || '');
      return `"${str.replace(/"/g, '""')}"`;
    };

    if (entity === 'funds') {
      const funds = await getFilteredFunds(req);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=Funds_Statement_${Date.now()}.csv`);

      const headers = ['Fund ID', 'Date', 'Person Name', 'Amount', 'Created By', 'Notes'];
      let csvContent = headers.join(',') + '\n';

      funds.forEach(f => {
        const row = [
          escapeVal(f.fund_id || f.id),
          escapeVal(f.fund_date),
          escapeVal(f.person_name),
          parseFloat(f.amount) || 0,
          escapeVal(f.user_name || f.created_by),
          escapeVal(f.notes)
        ];
        csvContent += row.join(',') + '\n';
      });

      return res.send(csvContent);
    }

    if (entity === 'settlements') {
      const settlements = await getFilteredSettlements(req);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=Settlements_Statement_${Date.now()}.csv`);

      const headers = ['Settlement ID', 'Date', 'Person Name', 'Type', 'Status', 'Amount', 'Created By', 'Notes'];
      let csvContent = headers.join(',') + '\n';

      settlements.forEach(s => {
        const row = [
          escapeVal(s.settlement_id || s.id),
          escapeVal(s.settlement_date),
          escapeVal(s.person_name),
          escapeVal(s.settlement_type),
          escapeVal(s.status),
          parseFloat(s.amount) || 0,
          escapeVal(s.user_name || s.created_by),
          escapeVal(s.notes)
        ];
        csvContent += row.join(',') + '\n';
      });

      return res.send(csvContent);
    }

    // Default: Expenses CSV
    const expenses = await getFilteredExpenses(req);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=Expense_Statement_${Date.now()}.csv`);

    const headers = ['Expense ID', 'Date', 'Time', 'Title', 'Category', 'Amount', 'Payment Method', 'Member', 'Vendor', 'Location', 'Notes'];
    let csvContent = headers.join(',') + '\n';

    expenses.forEach(exp => {
      const row = [
        escapeVal(exp.expense_id || exp.id),
        escapeVal(exp.expense_date),
        escapeVal(exp.expense_time),
        escapeVal(exp.title),
        escapeVal(exp.category),
        parseFloat(exp.amount) || 0,
        escapeVal(exp.payment_method),
        escapeVal(exp.user_name),
        escapeVal(exp.vendor),
        escapeVal(exp.location),
        escapeVal(exp.notes)
      ];
      csvContent += row.join(',') + '\n';
    });

    res.send(csvContent);
  } catch (error) {
    console.error('CSV export error:', error);
    res.status(500).json({ success: false, message: 'Error generating CSV export.' });
  }
};

module.exports = {
  getSummaryMetrics,
  exportPDF,
  exportExcel,
  exportCSV
};
