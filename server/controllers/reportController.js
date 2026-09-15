const Expense = require('../models/Expense');
const Budget = require('../models/Budget');
const User = require('../models/User');
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

const getSummaryMetrics = async (req, res) => {
  try {
    const { role, id: userId, username } = req.user;
    const { person, month } = req.query;

    const todayStr = new Date().toISOString().slice(0, 10);
    const currentMonthStr = month || todayStr.slice(0, 7);

    // Build base filter for user scope
    let baseFilter = {};
    let targetScope = 'global';

    if (role !== 'admin') {
      baseFilter.$or = [{ user_id: userId }, { user_id: username }];
      targetScope = userId;
    } else if (person && person !== 'all') {
      const targetUser = await User.findOne({
        $or: [{ _id: person }, { id: person }, { username: person }]
      });
      if (targetUser) {
        baseFilter.$or = [{ user_id: targetUser._id }, { user_id: targetUser.username }];
        targetScope = targetUser._id;
      } else {
        baseFilter.user_id = person;
        targetScope = person;
      }
    }

    const allExpenses = await Expense.find(baseFilter).sort({ expense_date: -1, created_at: -1 });

    const totalSpending = allExpenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
    const totalTransactions = allExpenses.length;

    // Monthly expenses
    const monthlyExpenses = allExpenses.filter(e => e.expense_date && e.expense_date.startsWith(currentMonthStr));
    const monthlySpending = monthlyExpenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

    // Today's expenses
    const todayExpenses = allExpenses.filter(e => e.expense_date === todayStr);
    const todaySpending = todayExpenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

    // Average, Max, Min
    const averageSpending = totalTransactions > 0 ? (totalSpending / totalTransactions) : 0;
    const highestExpense = totalTransactions > 0 ? Math.max(...allExpenses.map(e => parseFloat(e.amount) || 0)) : 0;
    const lowestExpense = totalTransactions > 0 ? Math.min(...allExpenses.map(e => parseFloat(e.amount) || 0)) : 0;

    // Category breakdown
    const categoryBreakdown = {};
    allExpenses.forEach(e => {
      const cat = e.category || 'Miscellaneous';
      categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + (parseFloat(e.amount) || 0);
    });

    // Monthly trend (last 12 months)
    const monthlyTrend = {};
    allExpenses.forEach(e => {
      if (e.expense_date && e.expense_date.length >= 7) {
        const m = e.expense_date.slice(0, 7);
        monthlyTrend[m] = (monthlyTrend[m] || 0) + (parseFloat(e.amount) || 0);
      }
    });

    // Payment method breakdown
    const paymentMethodBreakdown = {};
    allExpenses.forEach(e => {
      const p = e.payment_method || 'Other';
      paymentMethodBreakdown[p] = (paymentMethodBreakdown[p] || 0) + (parseFloat(e.amount) || 0);
    });

    // Daily spending (last 14 days of current month)
    const dailySpending = {};
    monthlyExpenses.forEach(e => {
      if (e.expense_date) {
        dailySpending[e.expense_date] = (dailySpending[e.expense_date] || 0) + (parseFloat(e.amount) || 0);
      }
    });

    // User comparison (Admin only)
    const userComparison = {};
    if (role === 'admin') {
      const allUsers = await User.find({});
      allUsers.forEach(u => {
        userComparison[u.name] = 0;
      });
      // Sum per user
      allExpenses.forEach(e => {
        const name = e.user_name || 'Other';
        userComparison[name] = (userComparison[name] || 0) + (parseFloat(e.amount) || 0);
      });
    }

    // Budget data for current month
    let budgetDoc = await Budget.findOne({ user_id: targetScope, month: currentMonthStr });
    if (!budgetDoc && targetScope !== 'global') {
      budgetDoc = await Budget.findOne({ user_id: username, month: currentMonthStr });
    }
    if (!budgetDoc && role === 'admin' && targetScope === 'global') {
      budgetDoc = await Budget.findOne({ user_id: 'global', month: currentMonthStr });
    }

    const monthlyBudget = budgetDoc ? budgetDoc.budget_amount : 0;
    const remainingBudget = Math.max(0, monthlyBudget - monthlySpending);
    const budgetPercent = monthlyBudget > 0 ? Math.min(100, Math.round((monthlySpending / monthlyBudget) * 100)) : 0;

    // Recent transactions for dashboard preview
    const recentTransactions = allExpenses.slice(0, 10);

    // User summaries for admin table
    const userSummaries = [];
    if (role === 'admin') {
      const allUsers = await User.find({});
      allUsers.forEach(u => {
        const uExpenses = allExpenses.filter(e => e.user_id === u._id || e.user_id === u.id || e.user_id === u.username);
        const uTotal = uExpenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
        const uMonthly = uExpenses.filter(e => e.expense_date && e.expense_date.startsWith(currentMonthStr))
                                  .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
        const uAvg = uExpenses.length > 0 ? (uTotal / uExpenses.length) : 0;
        const uHigh = uExpenses.length > 0 ? Math.max(...uExpenses.map(e => parseFloat(e.amount) || 0)) : 0;
        const lastExp = uExpenses.length > 0 ? uExpenses[0].expense_date : 'N/A';
        userSummaries.push({
          user_id: u._id || u.id,
          name: u.name,
          username: u.username,
          totalTransactions: uExpenses.length,
          currentMonthAmount: uMonthly,
          totalAmount: uTotal,
          averageExpense: uAvg,
          highestExpense: uHigh,
          lastExpenseDate: lastExp
        });
      });
    }

    const budgetStatus = monthlyBudget > 0 
      ? (monthlySpending > monthlyBudget ? 'Over Budget' : (monthlySpending >= monthlyBudget * 0.9 ? 'Near Limit' : 'Within Budget'))
      : 'Not Set';

    const summaryData = {
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
      budgetAmount: monthlyBudget,
      monthlyBudget,
      remainingBudget,
      budgetUsagePercent: budgetPercent,
      budgetPercent,
      budgetStatus,
      isBudgetExceeded: monthlyBudget > 0 && monthlySpending > monthlyBudget,
      isBudgetWarning: monthlyBudget > 0 && monthlySpending >= monthlyBudget * 0.9,
      categoryTotals: categoryBreakdown,
      categoryBreakdown,
      monthlyTrend,
      paymentTotals: paymentMethodBreakdown,
      paymentMethodBreakdown,
      dailyTrend: dailySpending,
      dailySpending,
      userTotals: userComparison,
      userComparison,
      userSummaries,
      recentTransactions
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

const exportPDF = async (req, res) => {
  try {
    const expenses = await getFilteredExpenses(req);
    const doc = new PDFDocument({ margin: 30, size: 'A4' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Expense_Statement_${Date.now()}.pdf`);

    doc.pipe(res);

    // Title & Header Banner
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

    // Summary Box
    doc.rect(30, doc.y, 535, 45).fillAndStroke('#eff6ff', '#bfdbfe');
    const boxY = doc.y + 12;
    doc.fillColor('#1e3a8a').fontSize(11).font('Helvetica-Bold')
      .text(`Total Records: ${expenses.length}`, 45, boxY)
      .text(`Total Expenditure: Rs. ${totalAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 320, boxY);
    doc.moveDown(3);

    // Table Header
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

const exportExcel = async (req, res) => {
  try {
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

    // Header styling
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E40AF' }
    };
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

const exportCSV = async (req, res) => {
  try {
    const expenses = await getFilteredExpenses(req);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=Expense_Statement_${Date.now()}.csv`);

    const headers = ['Expense ID', 'Date', 'Time', 'Title', 'Category', 'Amount', 'Payment Method', 'Member', 'Vendor', 'Location', 'Notes'];
    let csvContent = headers.join(',') + '\n';

    expenses.forEach(exp => {
      const escapeVal = (val) => {
        const str = String(val || '');
        return `"${str.replace(/"/g, '""')}"`;
      };

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
