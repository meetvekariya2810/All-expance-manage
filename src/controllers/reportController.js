const Expense = require('../models/Expense');
const Budget = require('../models/Budget');
const User = require('../models/User');
const { getMongoStatus, memoryStore } = require('../config/db');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');

// Shared filter helper for metrics and exports
const getFilteredExpenses = async (req) => {
  const { role, id: userId } = req.user;
  const { search, category, payment_method, person, startDate, endDate, month } = req.query;

  let filter = {};

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
  } else if (month) {
    filter.expense_date = { $regex: `^${month}` };
  }

  let expenses = [];

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

    expenses = await query.sort({ expense_date: -1, created_at: -1 }).exec();
  } else {
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

    if (startDate) list = list.filter(e => e.expense_date >= startDate);
    if (endDate) list = list.filter(e => e.expense_date <= endDate);
    if (month) list = list.filter(e => e.expense_date && e.expense_date.startsWith(month));

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

    list.sort((a, b) => (b.expense_date > a.expense_date ? 1 : (b.expense_date < a.expense_date ? -1 : 0)));
    expenses = list;
  }

  return expenses;
};

const getSummaryMetrics = async (req, res) => {
  try {
    const { role, id: userId } = req.user;
    const { person, month } = req.query;

    const todayStr = new Date().toISOString().slice(0, 10);
    const currentMonthStr = month || todayStr.slice(0, 7);

    // Get filtered expenses based on person if selected
    let filter = {};
    if (role !== 'admin') {
      filter.user_id = userId;
    } else if (person && person !== 'all') {
      filter.user_id = person;
    }

    let allExpenses = [];
    if (getMongoStatus()) {
      allExpenses = await Expense.find(filter).sort({ expense_date: -1 });
    } else {
      allExpenses = memoryStore.expenses || [];
      if (role !== 'admin') {
        allExpenses = allExpenses.filter(e => e.user_id === userId);
      } else if (person && person !== 'all') {
        allExpenses = allExpenses.filter(e => e.user_id === person);
      }
    }

    const totalCount = allExpenses.length;
    const totalExpense = allExpenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
    const averageExpense = totalCount > 0 ? Math.round(totalExpense / totalCount) : 0;

    let highestExpense = 0;
    let lowestExpense = totalCount > 0 ? (parseFloat(allExpenses[0].amount) || 0) : 0;
    allExpenses.forEach(e => {
      const amt = parseFloat(e.amount) || 0;
      if (amt > highestExpense) highestExpense = amt;
      if (amt < lowestExpense) lowestExpense = amt;
    });

    const todayExpense = allExpenses
      .filter(e => e.expense_date === todayStr)
      .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

    const monthlyExpense = allExpenses
      .filter(e => e.expense_date && e.expense_date.startsWith(currentMonthStr))
      .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

    // Category breakdown
    const categoryTotals = {};
    allExpenses.forEach(e => {
      const cat = e.category || 'Other';
      categoryTotals[cat] = (categoryTotals[cat] || 0) + (parseFloat(e.amount) || 0);
    });

    // Payment method breakdown
    const paymentTotals = {
      'UPI': 0,
      'Cash': 0,
      'Credit Card': 0,
      'Debit Card': 0,
      'Net Banking': 0,
      'Other': 0
    };
    allExpenses.forEach(e => {
      const pm = e.payment_method || 'UPI';
      paymentTotals[pm] = (paymentTotals[pm] || 0) + (parseFloat(e.amount) || 0);
    });

    // User-wise breakdown for Admin
    const userTotals = {};
    const userSummaryMap = {};

    if (role === 'admin') {
      // Get all known users
      let allUsers = [];
      if (getMongoStatus()) {
        allUsers = await User.find({}, 'name username _id id');
      } else {
        allUsers = memoryStore.users || [];
      }

      allUsers.forEach(u => {
        const uid = u._id || u.id;
        userTotals[u.name] = 0;
        userSummaryMap[uid] = {
          user_id: uid,
          name: u.name,
          username: u.username,
          totalTransactions: 0,
          totalAmount: 0,
          currentMonthAmount: 0,
          highestExpense: 0,
          averageExpense: 0,
          lastExpenseDate: '-',
          categoryDistribution: {}
        };
      });

      allExpenses.forEach(e => {
        const uName = e.user_name || 'User';
        const uid = e.user_id;
        userTotals[uName] = (userTotals[uName] || 0) + (parseFloat(e.amount) || 0);

        if (userSummaryMap[uid]) {
          const s = userSummaryMap[uid];
          const amt = parseFloat(e.amount) || 0;
          s.totalTransactions += 1;
          s.totalAmount += amt;
          if (e.expense_date && e.expense_date.startsWith(currentMonthStr)) {
            s.currentMonthAmount += amt;
          }
          if (amt > s.highestExpense) s.highestExpense = amt;
          if (s.lastExpenseDate === '-' || (e.expense_date && e.expense_date > s.lastExpenseDate)) {
            s.lastExpenseDate = e.expense_date;
          }
          const cat = e.category || 'Other';
          s.categoryDistribution[cat] = (s.categoryDistribution[cat] || 0) + amt;
        }
      });

      // Compute averages
      Object.values(userSummaryMap).forEach(s => {
        s.averageExpense = s.totalTransactions > 0 ? Math.round(s.totalAmount / s.totalTransactions) : 0;
      });
    }

    // Monthly breakdown (last 12 months)
    const monthlyTrend = {};
    allExpenses.forEach(e => {
      if (e.expense_date) {
        const m = e.expense_date.slice(0, 7);
        monthlyTrend[m] = (monthlyTrend[m] || 0) + (parseFloat(e.amount) || 0);
      }
    });

    // Daily breakdown for current selected month
    const dailyTrend = {};
    allExpenses.forEach(e => {
      if (e.expense_date && e.expense_date.startsWith(currentMonthStr)) {
        const day = e.expense_date.slice(8, 10);
        dailyTrend[day] = (dailyTrend[day] || 0) + (parseFloat(e.amount) || 0);
      }
    });

    // Budget information for the current month
    let budgetAmount = 50000;
    const targetBgtUser = (role === 'admin' && person && person !== 'all') ? person : (role === 'admin' ? 'global' : userId);

    if (getMongoStatus()) {
      const bgt = await Budget.findOne({ 
        $or: [
          { user_id: targetBgtUser, month: currentMonthStr },
          { user_id: userId, month: currentMonthStr },
          { user_id: 'global', month: currentMonthStr }
        ]
      });
      if (bgt) budgetAmount = bgt.budget_amount;
    } else {
      const bgtList = memoryStore.budgets || [];
      const found = bgtList.find(b => 
        (b.user_id === targetBgtUser || b.user_id === userId || b.user_id === 'global') && b.month === currentMonthStr
      );
      if (found) budgetAmount = parseFloat(found.budget_amount) || 50000;
    }

    const remainingBudget = Math.max(0, budgetAmount - monthlyExpense);
    const budgetUsagePercent = budgetAmount > 0 ? Math.round((monthlyExpense / budgetAmount) * 100) : 0;

    let budgetStatus = 'Safe';
    if (budgetUsagePercent > 100) budgetStatus = 'Over Budget';
    else if (budgetUsagePercent >= 90) budgetStatus = 'Near Limit';
    else if (budgetUsagePercent >= 75) budgetStatus = 'Warning';

    res.json({
      success: true,
      summary: {
        totalExpense,
        totalTransactions: totalCount,
        averageExpense,
        highestExpense,
        lowestExpense,
        todayExpense,
        monthlyExpense,
        currentMonth: currentMonthStr,
        budgetAmount,
        remainingBudget,
        budgetUsagePercent,
        budgetStatus,
        categoryTotals,
        paymentTotals,
        userTotals,
        userSummaries: Object.values(userSummaryMap),
        monthlyTrend,
        dailyTrend
      }
    });
  } catch (error) {
    console.error('Summary metrics error:', error);
    res.status(500).json({ success: false, message: 'Error calculating metrics.' });
  }
};

const exportPDF = async (req, res) => {
  try {
    const expenses = await getFilteredExpenses(req);
    const user = req.user;

    const doc = new PDFDocument({ margin: 40, size: 'A4' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Expense_Statement_${Date.now()}.pdf`);

    doc.pipe(res);

    // Title & Branding
    doc.fillColor('#1E3A8A').fontSize(20).text('Smart Personal Expense Management System', { align: 'center' });
    doc.fillColor('#64748B').fontSize(10).text(`Expense Statement | Generated on ${new Date().toLocaleString()}`, { align: 'center' });
    doc.moveDown(1);

    // Summary Box
    const totalAmount = expenses.reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0);
    const avgAmount = expenses.length > 0 ? Math.round(totalAmount / expenses.length) : 0;

    doc.rect(40, doc.y, 515, 55).fillAndStroke('#F1F5F9', '#CBD5E1');
    const boxY = doc.y + 10;
    doc.fillColor('#0F172A').fontSize(10);
    doc.text(`Account: ${user.name} (${user.role.toUpperCase()})`, 55, boxY);
    doc.text(`Total Transactions: ${expenses.length}`, 55, boxY + 16);
    doc.text(`Total Spending: ₹${totalAmount.toLocaleString('en-IN')}`, 300, boxY);
    doc.text(`Average Transaction: ₹${avgAmount.toLocaleString('en-IN')}`, 300, boxY + 16);

    doc.y = boxY + 45;
    doc.moveDown(1);

    // Table Header
    const yStart = doc.y;
    doc.rect(40, yStart, 515, 20).fill('#2563EB');
    doc.fillColor('#FFFFFF').fontSize(9).font('Helvetica-Bold');
    doc.text('Date', 45, yStart + 5, { width: 65 });
    doc.text('Expense Title', 115, yStart + 5, { width: 130 });
    doc.text('Category', 250, yStart + 5, { width: 85 });
    doc.text('User', 340, yStart + 5, { width: 75 });
    doc.text('Payment', 420, yStart + 5, { width: 65 });
    doc.text('Amount (₹)', 490, yStart + 5, { width: 60, align: 'right' });

    doc.font('Helvetica');
    doc.y = yStart + 25;

    // Rows
    expenses.forEach((item, idx) => {
      if (doc.y > 750) {
        doc.addPage();
        doc.y = 40;
      }
      const y = doc.y;
      if (idx % 2 === 1) {
        doc.rect(40, y - 2, 515, 18).fill('#F8FAFC');
      }

      doc.fillColor('#334155').fontSize(8.5);
      doc.text(item.expense_date || '-', 45, y, { width: 65 });
      doc.text(item.title || '-', 115, y, { width: 130 });
      doc.text(item.category || '-', 250, y, { width: 85 });
      doc.text(item.user_name || '-', 340, y, { width: 75 });
      doc.text(item.payment_method || '-', 420, y, { width: 65 });
      doc.text(`₹${(parseFloat(item.amount) || 0).toLocaleString('en-IN')}`, 490, y, { width: 60, align: 'right' });
      doc.moveDown(0.5);
    });

    doc.end();
  } catch (error) {
    console.error('PDF export error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate PDF statement.' });
  }
};

const exportExcel = async (req, res) => {
  try {
    const expenses = await getFilteredExpenses(req);
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Expenses');

    worksheet.columns = [
      { header: 'Expense ID', key: 'expense_id', width: 20 },
      { header: 'User', key: 'user_name', width: 16 },
      { header: 'Date', key: 'expense_date', width: 14 },
      { header: 'Time', key: 'expense_time', width: 10 },
      { header: 'Title', key: 'title', width: 25 },
      { header: 'Category', key: 'category', width: 18 },
      { header: 'Amount (₹)', key: 'amount', width: 16 },
      { header: 'Payment Method', key: 'payment_method', width: 18 },
      { header: 'Vendor', key: 'vendor', width: 20 },
      { header: 'Location', key: 'location', width: 20 },
      { header: 'Description', key: 'description', width: 28 },
      { header: 'Notes', key: 'notes', width: 28 }
    ];

    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '1E40AF' }
    };

    expenses.forEach(e => {
      worksheet.addRow({
        expense_id: e.expense_id,
        user_name: e.user_name || '',
        expense_date: e.expense_date,
        expense_time: e.expense_time || '',
        title: e.title,
        category: e.category,
        amount: parseFloat(e.amount) || 0,
        payment_method: e.payment_method || '',
        vendor: e.vendor || '',
        location: e.location || '',
        description: e.description || '',
        notes: e.notes || ''
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Expense_Statement_${Date.now()}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Excel export error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate Excel report.' });
  }
};

const exportCSV = async (req, res) => {
  try {
    const expenses = await getFilteredExpenses(req);

    const headers = [
      'Expense ID',
      'User',
      'Date',
      'Time',
      'Title',
      'Category',
      'Amount (INR)',
      'Payment Method',
      'Vendor',
      'Location',
      'Description',
      'Notes'
    ];

    let csvContent = headers.join(',') + '\n';

    expenses.forEach(e => {
      const row = [
        `"${e.expense_id}"`,
        `"${(e.user_name || '').replace(/"/g, '""')}"`,
        `"${e.expense_date}"`,
        `"${e.expense_time || ''}"`,
        `"${(e.title || '').replace(/"/g, '""')}"`,
        `"${(e.category || '').replace(/"/g, '""')}"`,
        parseFloat(e.amount) || 0,
        `"${e.payment_method || ''}"`,
        `"${(e.vendor || '').replace(/"/g, '""')}"`,
        `"${(e.location || '').replace(/"/g, '""')}"`,
        `"${(e.description || '').replace(/"/g, '""')}"`,
        `"${(e.notes || '').replace(/"/g, '""')}"`
      ];
      csvContent += row.join(',') + '\n';
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=Expense_Statement_${Date.now()}.csv`);
    res.send(csvContent);
  } catch (error) {
    console.error('CSV export error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate CSV export.' });
  }
};

module.exports = {
  getSummaryMetrics,
  exportPDF,
  exportExcel,
  exportCSV
};
