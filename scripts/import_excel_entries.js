const ExcelJS = require('exceljs');
const path = require('path');
const dns = require('dns');

try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {}

const { connectDB, syncExpenseStore } = require('../server/config/db');
const Expense = require('../server/models/Expense');
const User = require('../server/models/User');
const ActivityLog = require('../server/models/ActivityLog');

// Category auto-mapping helper based on existing categories in DB
function mapCategory(desc) {
  const d = (desc || '').toLowerCase();
  if (d.includes('blinkit') || d.includes('fruit') || d.includes('ghee') || d.includes('grocery')) {
    return 'Grocery';
  }
  if (d.includes('dhosa') || d.includes('zomato') || d.includes('food') || d.includes('sev usal') || 
      d.includes('anjoy') || d.includes('dhaba') || d.includes('restaurant')) {
    return 'Food';
  }
  if (d.includes('ugvcl') || d.includes('farm') || d.includes('electricity')) {
    return 'Electricity Bill';
  }
  if (d.includes('shopping') || d.includes('cosmetic') || d.includes('amazon') || 
      d.includes('nykaa') || d.includes('kroft') || d.includes('silvani')) {
    return 'Shopping';
  }
  return 'Miscellaneous';
}

// Vendor extraction helper
function extractVendor(desc) {
  const d = (desc || '').trim();
  const lower = d.toLowerCase();
  if (lower.includes('blinkit')) return 'Blinkit';
  if (lower.includes('zomato')) return 'Zomato';
  if (lower.includes('amazon')) return 'Amazon';
  if (lower.includes('ugvcl')) return 'UGVCL';
  if (lower.includes('anjoy')) return 'Anjoy';
  if (lower.includes('blue dart')) return 'Blue Dart';
  if (lower.includes('fruit truck')) return 'Fruit Truck';
  if (lower.includes('mahakali dhaba')) return 'Mahakali Dhaba';
  return d;
}

async function runImport(filePath, year = '2026') {
  console.log(`========================================================`);
  console.log(`🚀 Starting Excel Import Process from: ${filePath}`);
  console.log(`📅 Target Year for DD/MM dates: ${year}`);
  console.log(`👤 Target User: Meet (usr_meet_03)`);
  console.log(`========================================================\n`);

  await connectDB();

  // Ensure Meet user exists
  let meetUser = await User.findOne({ username: 'meet' });
  if (!meetUser) {
    meetUser = await User.findOne({ _id: 'usr_meet_03' });
  }
  if (!meetUser) {
    console.error('❌ User Meet not found in database!');
    process.exit(1);
  }
  console.log(`✅ Attributing expenses to User: ${meetUser.name} (${meetUser.username}, ID: ${meetUser._id || meetUser.id})`);

  // Load workbook
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  let worksheet = workbook.getWorksheet('Expenses');
  if (!worksheet) {
    worksheet = workbook.worksheets[0];
    console.log(`ℹ️ 'Expenses' sheet not found, using first sheet: '${worksheet.name}'`);
  } else {
    console.log(`✅ Found worksheet: 'Expenses'`);
  }

  // Parse header and rows
  const rawRows = [];
  let headerFound = false;
  let colMap = { id: 1, date: 2, description: 3, amount: 4, currency: 5, notes: 6 };

  worksheet.eachRow((row, rowNumber) => {
    const values = row.values;
    // Row 1 or find header
    if (!headerFound) {
      const headerStr = values.map(v => String(v || '').toLowerCase()).join(' ');
      if (headerStr.includes('date') || headerStr.includes('description') || headerStr.includes('amount')) {
        headerFound = true;
        values.forEach((v, idx) => {
          const val = String(v || '').toLowerCase();
          if (val.includes('entry') || val.includes('id') || val === 'sr') colMap.id = idx;
          else if (val.includes('date')) colMap.date = idx;
          else if (val.includes('description') || val.includes('title')) colMap.description = idx;
          else if (val.includes('amount')) colMap.amount = idx;
          else if (val.includes('currency')) colMap.currency = idx;
          else if (val.includes('notes') || val.includes('remark')) colMap.notes = idx;
        });
        return;
      }
    }

    const rawId = values[colMap.id];
    const rawDate = values[colMap.date];
    const rawDesc = values[colMap.description];
    const rawAmount = values[colMap.amount];
    const rawCurrency = values[colMap.currency] || 'INR';
    const rawNotes = values[colMap.notes] || '';

    if (rawDesc || rawAmount !== undefined) {
      rawRows.push({
        rowNumber,
        rawId: rawId ? String(rawId).trim() : '',
        rawDate: rawDate ? String(rawDate).trim() : '',
        rawDesc: rawDesc ? String(rawDesc).trim() : '',
        rawAmount: rawAmount,
        rawCurrency: String(rawCurrency).trim(),
        rawNotes: rawNotes ? String(rawNotes).trim() : ''
      });
    }
  });

  console.log(`📋 Read ${rawRows.length} raw data rows from worksheet.`);

  // Parse, validate, and standardize
  const parsedRecords = [];
  let calculatedFileTotal = 0;

  for (const item of rawRows) {
    let cleanAmount = 0;
    if (typeof item.rawAmount === 'number') {
      cleanAmount = item.rawAmount;
    } else {
      const cleanStr = String(item.rawAmount || '').replace(/[^\d.-]/g, '');
      cleanAmount = parseFloat(cleanStr) || 0;
    }
    calculatedFileTotal += cleanAmount;

    let formattedDate = 'Undated';
    let sortKey = '9999-99-99'; // undated sort to the end

    if (item.rawDate && item.rawDate !== '-' && !item.rawDate.toLowerCase().includes('not provided')) {
      const parts = item.rawDate.split(/[\/\-]/);
      if (parts.length >= 2) {
        const day = parts[0].padStart(2, '0');
        const month = parts[1].padStart(2, '0');
        formattedDate = `${year}-${month}-${day}`;
        sortKey = formattedDate;
      } else {
        formattedDate = item.rawDate;
        sortKey = item.rawDate;
      }
    }

    parsedRecords.push({
      entryId: item.rawId,
      originalDate: item.rawDate,
      expense_date: formattedDate,
      sortKey: sortKey,
      title: item.rawDesc,
      description: item.rawDesc,
      amount: cleanAmount,
      currency: item.rawCurrency,
      originalNotes: item.rawNotes,
      category: mapCategory(item.rawDesc),
      vendor: extractVendor(item.rawDesc)
    });
  }

  console.log(`💰 Verified Raw Total Amount: ₹${calculatedFileTotal.toLocaleString('en-IN')}`);

  // Sort chronologically by date (Requirement 3)
  parsedRecords.sort((a, b) => {
    if (a.sortKey !== b.sortKey) {
      return a.sortKey.localeCompare(b.sortKey);
    }
    return (parseInt(a.entryId) || 0) - (parseInt(b.entryId) || 0);
  });

  // Track import results
  const report = {
    totalRows: parsedRecords.length,
    importedCount: 0,
    skippedCount: 0,
    errorCount: 0,
    importedTotal: 0,
    records: []
  };

  const targetUserId = meetUser._id || meetUser.id;
  const targetUserName = meetUser.name;

  for (const rec of parsedRecords) {
    if (rec.amount <= 0 || !rec.title) {
      report.errorCount++;
      report.records.push({
        entryId: rec.entryId,
        title: rec.title,
        amount: rec.amount,
        status: 'error',
        reason: 'Invalid amount or description'
      });
      continue;
    }

    // Check duplicate (Requirement 5):
    // Match by:
    // 1. Same user AND notes containing "Excel Entry ID: <id>" OR
    // 2. Same user AND exact same amount, title, and expense_date
    const duplicateQuery = {
      user_id: targetUserId,
      $or: [
        { notes: { $regex: `Excel Entry ID: ${rec.entryId}\\b` } },
        {
          title: rec.title,
          amount: rec.amount,
          expense_date: rec.expense_date
        }
      ]
    };

    const existingExpense = await Expense.findOne(duplicateQuery);
    if (existingExpense) {
      report.skippedCount++;
      report.records.push({
        entryId: rec.entryId,
        date: rec.expense_date,
        title: rec.title,
        amount: rec.amount,
        status: 'skipped',
        reason: `Duplicate detected (Existing expense ID: ${existingExpense.expense_id})`
      });
      continue;
    }

    // Construct unique IDs
    const entryIdPadded = String(rec.entryId).padStart(2, '0');
    const dateTag = rec.expense_date === 'Undated' ? 'UNDATED' : rec.expense_date.replace(/-/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const expenseIdStr = `EXP-${dateTag}-M${entryIdPadded}`;
    const uniqueDocId = `exp_meet_${dateTag.toLowerCase()}_${entryIdPadded}_${randomSuffix}`;

    let combinedNotes = `Excel Entry ID: ${rec.entryId}`;
    if (rec.originalNotes) {
      combinedNotes += ` | ${rec.originalNotes}`;
    }
    if (rec.expense_date === 'Undated') {
      combinedNotes += ` | (Original entry had no date; kept marked as undated)`;
    }

    const newExpense = new Expense({
      _id: uniqueDocId,
      id: uniqueDocId,
      expense_id: expenseIdStr,
      user_id: targetUserId,
      user_name: targetUserName,
      created_by: targetUserName,
      title: rec.title,
      description: rec.description,
      category: rec.category,
      amount: rec.amount,
      payment_method: 'UPI',
      vendor: rec.vendor,
      location: 'Store / Online',
      receipt: '',
      notes: combinedNotes,
      expense_date: rec.expense_date,
      expense_time: '12:00',
      created_at: rec.expense_date !== 'Undated' ? new Date(`${rec.expense_date}T12:00:00.000Z`) : new Date(),
      updated_at: new Date()
    });

    await newExpense.save();
    syncExpenseStore('create', newExpense);

    report.importedCount++;
    report.importedTotal += rec.amount;
    report.records.push({
      entryId: rec.entryId,
      expense_id: expenseIdStr,
      date: rec.expense_date,
      title: rec.title,
      category: rec.category,
      amount: rec.amount,
      status: 'imported'
    });

    // Activity log entry
    await ActivityLog.create({
      user_id: targetUserId,
      user_name: targetUserName,
      action: 'Expense Imported',
      expense_id: expenseIdStr,
      amount: rec.amount,
      category: rec.category,
      title: rec.title,
      details: `${targetUserName} imported ₹${rec.amount.toLocaleString('en-IN')} for ${rec.title} (Excel Entry ${rec.entryId})`,
      type: 'create',
      timestamp: new Date()
    }).catch(() => {});
  }

  console.log(`\n========================================================`);
  console.log(`📊 IMPORT SUMMARY REPORT:`);
  console.log(`   Total Rows Read:        ${report.totalRows}`);
  console.log(`   Successfully Imported:  ${report.importedCount}`);
  console.log(`   Skipped Duplicates:     ${report.skippedCount}`);
  console.log(`   Errors / Invalid:       ${report.errorCount}`);
  console.log(`   Total Amount Imported:  ₹${report.importedTotal.toLocaleString('en-IN')}`);
  console.log(`========================================================\n`);

  return report;
}

if (require.main === module) {
  const file = path.join(__dirname, '../Expense_Entries_Date_Wise.xlsx');
  runImport(file, '2026')
    .then((report) => {
      console.log('✅ Import execution completed successfully.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Import failed:', err);
      process.exit(1);
    });
}

module.exports = { runImport };
