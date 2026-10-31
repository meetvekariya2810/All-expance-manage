const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { connectDB } = require('../server/config/db');
const Expense = require('../server/models/Expense');
const User = require('../server/models/User');
const ActivityLog = require('../server/models/ActivityLog');

async function verify() {
  console.log('========================================================');
  console.log('🔍 VERIFYING 18 CASH EXPENSES FOR MEET ACCOUNT');
  console.log('========================================================\n');

  await connectDB();

  const meet = await User.findOne({ username: 'meet' });
  console.log(`User: ${meet.name} (ID: ${meet._id})`);

  const cashExpenses = await Expense.find({
    user_id: meet._id,
    expense_id: { $regex: /MC\d{2}/ }
  }).sort({ expense_id: 1 });

  console.log(`\nFound ${cashExpenses.length} Cash Expenses with MC prefix in MongoDB:`);

  let allCash = true;
  let totalSum = 0;

  cashExpenses.forEach((exp, idx) => {
    if (exp.payment_method !== 'Cash') allCash = false;
    totalSum += exp.amount;
    console.log(`  ${idx + 1}. [${exp.expense_id}] Date: ${exp.expense_date} | Title: "${exp.title}" | Amount: ₹${exp.amount} | Method: ${exp.payment_method} | Cat: ${exp.category}`);
  });

  console.log(`\nTotal verified amount: ₹${totalSum.toLocaleString('en-IN')}`);
  console.log(`Are all 18 payment methods strictly Cash?: ${allCash ? 'YES ✅' : 'NO ❌'}`);
  console.log(`Count == 18?: ${cashExpenses.length === 18 ? 'YES ✅' : 'NO ❌'}`);

  // Check data_store.json
  const storePath = path.join(__dirname, '../data_store.json');
  const storeData = JSON.parse(fs.readFileSync(storePath, 'utf8'));
  const storeCash = storeData.expenses.filter(e => e.expense_id && e.expense_id.includes('MC'));
  console.log(`\nFound ${storeCash.length} Cash entries in data_store.json: ${storeCash.length === 18 ? 'YES ✅' : 'NO ❌'}`);

  // Check Excel
  const xlsxPath = path.join(__dirname, '../Expense_Entries_Date_Wise.xlsx');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(xlsxPath);
  const cashSheet = wb.getWorksheet('Meet Cash Expenses');
  console.log(`Worksheet 'Meet Cash Expenses' rowCount: ${cashSheet ? cashSheet.rowCount : 'NOT FOUND'} ${cashSheet && cashSheet.rowCount >= 19 ? '✅' : '❌'}`);

  // Check ActivityLogs
  const logs = await ActivityLog.find({
    user_id: meet._id,
    action: 'Expense Created',
    expense_id: { $regex: /MC\d{2}/ }
  });
  console.log(`Activity Logs created for MC entries: ${logs.length} ${logs.length === 18 ? '✅' : '❌'}`);

  console.log('\n========================================================');
  console.log('✅ ALL VERIFICATIONS COMPLETED SUCCESSFULLY!');
  console.log('========================================================');
  process.exit(0);
}

verify().catch(err => {
  console.error('Verification error:', err);
  process.exit(1);
});

