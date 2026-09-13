const Expense = require('../models/Expense');
const Budget = require('../models/Budget');
const User = require('../models/User');
const { getMongoStatus, memoryStore } = require('../config/db');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');

const getSummaryMetrics = async (req, res) => {
  try {
    const { role, id: userId } = req.user;
    const todayStr = new Date().toISOString().slice(0, 10);
    const currentMonthStr = new Date().toISOString().slice(0, 7);

    let expenses = [];
    if (getMongoStatus()) {
      const filter = role === 'admin' ? {} : { user_id: userId };
      expenses = await Expense.find(filter);
    } else {
      expenses = memoryStore.expenses;
      if (role !== 'admin') {
        expenses = expenses.filter(e => e.user_id === userId);
      }
    }

    const totalExpense = expenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
    const todayExpense = expenses
      .filter(e => e.expense_date === todayStr)
      .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
    const monthlyExpense = expenses
      .filter(e => e.expense_date && e.expense_date.startsWith(currentMonthStr))
      .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

    // Category breakdown
    const categoryTotals = {};
    expenses.forEach(e => {
      categoryTotals[e.category] = (categoryTotals[e.category] || 0) + (parseFloat(e.amount) || 0);
    });

    // Payment method breakdown
    const paymentTotals = {};
    expenses.forEach(e => {
      const pm = e.payment_method || 'UPI';
      paymentTotals[pm] = (paymentTotals[pm] || 0) + (parseFloat(e.amount) || 0);
    });

    // User-wise breakdown (Admin view)
    const userTotals = {};
    expenses.forEach(e => {
      const name = e.user_name || 'User';
      userTotals[name] = (userTotals[name] || 0) + (parseFloat(e.amount) || 0);
    });

    // Monthly breakdown (last 6 months)
    const monthlyTrend = {};
    expenses.forEach(e => {
      if (e.expense_date) {
        const m = e.expense_date.slice(0, 7);
        monthlyTrend[m] = (monthlyTrend[m] || 0) + (parseFloat(e.amount) || 0);
      }
    });

    // Budget information
    let budgetAmount = 50000; // Default monthly budget fallback
    if (getMongoStatus()) {
      const bgt = await Budget.findOne({ user_id: userId, month: currentMonthStr });
      if (bgt) budgetAmount = bgt.budget_amount;
    } else {
      const bgt = memoryStore.budgets.find(b => b.user_id === userId && b.month === currentMonthStr);
      if (bgt) budgetAmount = bgt.budget_amount;
    }

    const remainingBudget = Math.max(0, budgetAmount - monthlyExpense);
    const budgetUsagePercent = Math.min(100, Math.round((monthlyExpense / (budgetAmount || 1)) * 100));

    res.json({
      success: true,
      summary: {
        totalExpense,
        todayExpense,
        monthlyExpense,
        budgetAmount,
        remainingBudget,
        budgetUsagePercent,
        categoryTotals,
        paymentTotals,
        userTotals,
        monthlyTrend
      }
    });
  } catch (error) {
    console.error('Summary metrics error:', error);
    res.status(500).json({ success: false, message: 'Error calculating metrics.' });
  }
};

const exportPDF = async (req, res) => {
  try {
    const { role, id: userId } = req.user;
    let expenses = [];
    if (getMongoStatus()) {
      const filter = role === 'admin' ? {} : { user_id: userId };
      expenses = await Expense.find(filter).sort({ expense_date: -1 });
    } else {
      expenses = memoryStore.expenses;
      if (role !== 'admin') {
        expenses = expenses.filter(e => e.user_id === userId);
      }
      expenses.sort((a, b) => (b.expense_date > a.expense_date ? 1 : -1));
    }

    const doc = new PDFDocument({ margin: 40, size: 'A4' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Expense_Report_${Date.now()}.pdf`);

    doc.pipe(res);

    // Header
    doc.fillColor('#2563EB').fontSize(22).text('Smart Personal Expense Management System', { align: 'center' });
    doc.fillColor('#64748B').fontSize(12).text(`Expense Statement - Generated on ${new Date().toLocaleDateString()}`, { align: 'center' });
    doc.moveDown(1.5);

    // Summary Box
    const totalSum = expenses.reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0);
    doc.fillColor('#0F172A').fontSize(14).text(`Total Expenses: ₹${totalSum.toLocaleString()}`, { underline: true });
    doc.fontSize(10).text(`Total Transactions: ${expenses.length}`);
    doc.moveDown(1);

    // Table Headers
    doc.fillColor('#1E293B').fontSize(10).text('Date', 40, doc.y, { width: 70, bold: true });
    doc.text('Expense Title', 110, doc.y, { width: 140 });
    doc.text('Category', 250, doc.y, { width: 90 });
    doc.text('Person', 340, doc.y, { width: 80 });
    doc.text('Payment', 420, doc.y, { width: 80 });
    doc.text('Amount (₹)', 500, doc.y, { width: 60, align: 'right' });

    doc.moveDown(0.5);
    doc.strokeColor('#CBD5E1').lineWidth(1).moveTo(40, doc.y).lineTo(560, doc.y).stroke();
    doc.moveDown(0.5);

    // Rows
    expenses.forEach((item) => {
      if (doc.y > 750) doc.addPage();
      const y = doc.y;
      doc.fillColor('#334155').fontSize(9);
      doc.text(item.expense_date || '-', 40, y, { width: 70 });
      doc.text(item.title || '-', 110, y, { width: 140 });
      doc.text(item.category || '-', 250, y, { width: 90 });
      doc.text(item.user_name || '-', 340, y, { width: 80 });
      doc.text(item.payment_method || '-', 420, y, { width: 80 });
      doc.text(`₹${parseFloat(item.amount || 0).toFixed(2)}`, 500, y, { width: 60, align: 'right' });
      doc.moveDown(0.6);
    });

    doc.end();
  } catch (error) {
    console.error('PDF export error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate PDF.' });
  }
};

const exportExcel = async (req, res) => {
  try {
    const { role, id: userId } = req.user;
    let expenses = [];
    if (getMongoStatus()) {
      const filter = role === 'admin' ? {} : { user_id: userId };
      expenses = await Expense.find(filter).sort({ expense_date: -1 });
    } else {
      expenses = memoryStore.expenses;
      if (role !== 'admin') {
        expenses = expenses.filter(e => e.user_id === userId);
      }
      expenses.sort((a, b) => (b.expense_date > a.expense_date ? 1 : -1));
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Expenses');

    worksheet.columns = [
      { header: 'Expense ID', key: 'expense_id', width: 18 },
      { header: 'Date', key: 'expense_date', width: 14 },
      { header: 'Time', key: 'expense_time', width: 10 },
      { header: 'Title', key: 'title', width: 25 },
      { header: 'Person', key: 'user_name', width: 16 },
      { header: 'Category', key: 'category', width: 18 },
      { header: 'Amount (₹)', key: 'amount', width: 15 },
      { header: 'Payment Method', key: 'payment_method', width: 18 },
      { header: 'Vendor', key: 'vendor', width: 20 },
      { header: 'Location', key: 'location', width: 20 },
      { header: 'Notes', key: 'notes', width: 30 }
    ];

    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '2563EB' }
    };

    expenses.forEach(e => {
      worksheet.addRow({
        expense_id: e.expense_id,
        expense_date: e.expense_date,
        expense_time: e.expense_time || '',
        title: e.title,
        user_name: e.user_name,
        category: e.category,
        amount: parseFloat(e.amount || 0),
        payment_method: e.payment_method,
        vendor: e.vendor || '',
        location: e.location || '',
        notes: e.notes || ''
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Expense_Report_${Date.now()}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Excel export error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate Excel report.' });
  }
};

module.exports = {
  getSummaryMetrics,
  exportPDF,
  exportExcel
};
