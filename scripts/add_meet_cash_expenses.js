const fs = require('fs');
const path = require('path');
const dns = require('dns');
const ExcelJS = require('exceljs');

try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {}

require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const { connectDB } = require('../server/config/db');
const Expense = require('../server/models/Expense');
const User = require('../server/models/User');
const ActivityLog = require('../server/models/ActivityLog');

const rawCashExpenses = [
  { sr: 1, date: '2026-09-21', title: 'Dal makhani', amount: 1200, category: 'Food', vendor: 'Dal Makhani', location: 'Restaurant', desc: 'Dal makhani meal/dining' },
  { sr: 2, date: '2026-09-23', title: 'Rajnigandha', amount: 420, category: 'Miscellaneous', vendor: 'Local Store', location: 'Store', desc: 'Rajnigandha purchase' },
  { sr: 3, date: '2026-09-25', title: 'Frido orders', amount: 3000, category: 'Shopping', vendor: 'Frido', location: 'Online', desc: 'Frido orders purchase' },
  { sr: 4, date: '2026-09-27', title: 'Amzone', amount: 700, category: 'Shopping', vendor: 'Amazon', location: 'Online', desc: 'Amazon online shopping' },
  { sr: 5, date: '2026-09-28', title: 'Pizaa olio and', amount: 900, category: 'Food', vendor: 'Olio Pizza', location: 'Restaurant', desc: 'Pizza Olio and snacks order' },
  { sr: 6, date: '2026-09-28', title: 'Amzone pay add money', amount: 1500, category: 'Miscellaneous', vendor: 'Amazon Pay', location: 'Online', desc: 'Amazon Pay add money balance' },
  { sr: 7, date: '2026-09-30', title: 'Cash Amzone cell charger', amount: 1450, category: 'Shopping', vendor: 'Amazon', location: 'Store / Online', desc: 'Amazon cell phone charger purchase' },
  { sr: 8, date: '2026-10-01', title: 'Defender Number Plat charge', amount: 500, category: 'Travel', vendor: 'Defender RTO / Number Plate Vendor', location: 'Service Center', desc: 'Defender number plate charge' },
  { sr: 9, date: '2026-10-02', title: 'Defender', amount: 1200, category: 'Travel', vendor: 'Defender Service', location: 'Service Center', desc: 'Defender vehicle travel & maintenance expense' },
  { sr: 10, date: '2026-10-02', title: 'Mahakali dhaba', amount: 5000, category: 'Food', vendor: 'Mahakali Dhaba', location: 'Dhaba / Restaurant', desc: 'Mahakali Dhaba dinner & meal expense' },
  { sr: 11, date: '2026-10-02', title: 'Amzone cell order', amount: 1200, category: 'Shopping', vendor: 'Amazon', location: 'Online', desc: 'Amazon cell order' },
  { sr: 12, date: '2026-10-04', title: 'Bhabhi order parcel', amount: 1700, category: 'Shopping', vendor: 'Parcel Delivery / Store', location: 'Store / Online', desc: 'Bhabhi order parcel' },
  { sr: 13, date: '2026-10-04', title: 'Home shopping', amount: 500, category: 'Shopping', vendor: 'Local Store', location: 'Market', desc: 'Home shopping household essentials' },
  { sr: 14, date: '2026-10-05', title: 'Dal makhani saman', amount: 1700, category: 'Grocery', vendor: 'Grocery Store', location: 'Market', desc: 'Dal makhani grocery ingredients / saman' },
  { sr: 15, date: '2026-10-08', title: 'Home pizaa items', amount: 1800, category: 'Grocery', vendor: 'Grocery Store', location: 'Market', desc: 'Home pizza ingredients & items' },
  { sr: 16, date: '2026-10-12', title: 'Amzone home', amount: 1500, category: 'Shopping', vendor: 'Amazon', location: 'Online', desc: 'Amazon home items purchase' },
  { sr: 17, date: '2026-10-19', title: 'Blinkit', amount: 700, category: 'Grocery', vendor: 'Blinkit', location: 'Online', desc: 'Blinkit quick grocery delivery' },
  { sr: 18, date: '2026-10-19', title: 'Medicine tharmomitsr', amount: 2000, category: 'Medical', vendor: 'Pharmacy / Medical Store', location: 'Medical Store', desc: 'Medicine and thermometer medical purchase' }
];

async function main() {
  console.log('========================================================');
  console.log('🚀 Processing 18 Cash Expense Entries for Meet Account');
  console.log('💳 Payment Method: Cash (as per uploaded screenshot)');
  console.log('========================================================\n');

  await connectDB();

  // Find Meet user
  let meet = await User.findOne({ username: 'meet' });
  if (!meet) {
    meet = await User.findOne({ _id: 'usr_meet_03' });
  }

  if (!meet) {
    console.error('❌ User Meet not found in database!');
    process.exit(1);
  }

  console.log(`✅ User identified: ${meet.name} (Username: ${meet.username}, ID: ${meet._id || meet.id})`);

  const createdDocs = [];
  let insertedCount = 0;
  let skippedCount = 0;
  let totalCashAmount = 0;

  for (const item of rawCashExpenses) {
    const srPadded = String(item.sr).padStart(2, '0');
    const dateTag = item.date.replace(/-/g, '');
    const expId = `EXP-${dateTag}-MC${srPadded}`;
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const docId = `exp_meet_cash_${dateTag}_${srPadded}_${randomSuffix}`;

    // Duplicate check:
    const existing = await Expense.findOne({
      user_id: meet._id || meet.id,
      $or: [
        { expense_id: expId },
        { title: item.title, amount: item.amount, expense_date: item.date, payment_method: 'Cash' }
      ]
    });

    if (existing) {
      console.log(`⚠️ Skipped Sr. ${item.sr} (${item.title}): Already exists with ID ${existing.expense_id}`);
      skippedCount++;
      totalCashAmount += existing.amount;
      createdDocs.push(existing);
      continue;
    }

    const expenseTime = item.sr % 2 === 0 ? '14:30' : '11:15';
    const notesText = `Cash Entry Sr. No. ${item.sr} - Added for Meet`;

    const expenseDoc = new Expense({
      _id: docId,
      id: docId,
      expense_id: expId,
      user_id: meet._id || meet.id,
      user_name: meet.name,
      created_by: meet.name,
      title: item.title,
      description: item.desc || item.title,
      category: item.category,
      amount: item.amount,
      transaction_type: 'Debit',
      payment_method: 'Cash',
      vendor: item.vendor,
      location: item.location,
      receipt: '',
      notes: notesText,
      expense_date: item.date,
      expense_time: expenseTime,
      created_at: new Date(`${item.date}T${expenseTime}:00.000Z`),
      updated_at: new Date()
    });

    await expenseDoc.save();

    // Activity Log
    await ActivityLog.create({
      user_id: meet._id || meet.id,
      user_name: meet.name,
      action: 'Expense Created',
      expense_id: expId,
      amount: item.amount,
      category: item.category,
      title: item.title,
      details: `${meet.name} added cash expense ₹${item.amount.toLocaleString('en-IN')} for ${item.title} (Payment: Cash)`,
      type: 'create',
      timestamp: new Date()
    }).catch(() => {});

    createdDocs.push(expenseDoc);
    insertedCount++;
    totalCashAmount += item.amount;
    console.log(`✅ [${srPadded}/18] Added: ${expId} | ${item.date} | ${item.title} | ₹${item.amount} | Cash | Cat: ${item.category}`);
  }

  console.log(`\n========================================================`);
  console.log(`MongoDB Summary: ${insertedCount} inserted, ${skippedCount} skipped.`);
  console.log(`Total 18 Cash Expenses Sum: ₹${totalCashAmount.toLocaleString('en-IN')}`);
  console.log(`========================================================\n`);

  // 1. Sync data_store.json and data_store.backup.json
  const storeFiles = [
    path.join(__dirname, '../data_store.json'),
    path.join(__dirname, '../data_store.backup.json')
  ];

  for (const storeFile of storeFiles) {
    if (fs.existsSync(storeFile)) {
      try {
        const storeData = JSON.parse(fs.readFileSync(storeFile, 'utf8'));
        if (!storeData.expenses) storeData.expenses = [];

        let addedToStore = 0;
        for (const doc of createdDocs) {
          const docObj = doc.toObject ? doc.toObject() : doc;
          const idx = storeData.expenses.findIndex(e => e.expense_id === docObj.expense_id || e._id === docObj._id);
          if (idx === -1) {
            storeData.expenses.push(docObj);
            addedToStore++;
          } else {
            storeData.expenses[idx] = { ...storeData.expenses[idx], ...docObj };
          }
        }

        fs.writeFileSync(storeFile, JSON.stringify(storeData, null, 2), 'utf8');
        console.log(`✅ Updated ${path.basename(storeFile)}: ${addedToStore} entries added. Total expenses: ${storeData.expenses.length}`);
      } catch (err) {
        console.warn(`Warning updating ${path.basename(storeFile)}:`, err.message);
      }
    }
  }

  // 2. Update Expense_Entries_Date_Wise.xlsx
  const xlsxPath = path.join(__dirname, '../Expense_Entries_Date_Wise.xlsx');
  if (fs.existsSync(xlsxPath)) {
    try {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.readFile(xlsxPath);

      // Check if Cash Expenses sheet exists or create it, and also append to Expenses sheet
      let cashSheet = wb.getWorksheet('Meet Cash Expenses');
      if (!cashSheet) {
        cashSheet = wb.addWorksheet('Meet Cash Expenses');
        cashSheet.columns = [
          { header: 'Sr.', key: 'sr', width: 8 },
          { header: 'Date (DD/MM/YY)', key: 'date_str', width: 16 },
          { header: 'Expense Date', key: 'expense_date', width: 16 },
          { header: 'Expense ID', key: 'expense_id', width: 22 },
          { header: 'Description / Title', key: 'title', width: 30 },
          { header: 'Category', key: 'category', width: 16 },
          { header: 'Amount (INR)', key: 'amount', width: 15 },
          { header: 'Payment Method', key: 'payment_method', width: 16 },
          { header: 'User Account', key: 'user', width: 12 },
          { header: 'Vendor', key: 'vendor', width: 25 },
          { header: 'Notes', key: 'notes', width: 35 }
        ];

        // Style header
        cashSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cashSheet.getRow(1).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF1E293B' }
        };
      }

      // Populate cashSheet
      cashSheet.spliceRows(2, cashSheet.rowCount); // clear existing data rows
      rawCashExpenses.forEach((item) => {
        const srPadded = String(item.sr).padStart(2, '0');
        const expId = `EXP-${item.date.replace(/-/g, '')}-MC${srPadded}`;
        const parts = item.date.split('-'); // YYYY-MM-DD
        const ddMmYy = `${parts[2]}/${parts[1]}/${parts[0].slice(2)}`;

        const row = cashSheet.addRow({
          sr: item.sr,
          date_str: ddMmYy,
          expense_date: item.date,
          expense_id: expId,
          title: item.title,
          category: item.category,
          amount: item.amount,
          payment_method: 'Cash',
          user: 'Meet',
          vendor: item.vendor,
          notes: `Cash Entry Sr. No. ${item.sr} - Added for Meet`
        });

        row.getCell('amount').numFmt = '₹#,##0';
      });

      // Add Total Row
      const totalRow = cashSheet.addRow({
        sr: '',
        date_str: '',
        expense_date: '',
        expense_id: 'TOTAL',
        title: 'Total 18 Cash Expenses',
        category: '',
        amount: totalCashAmount,
        payment_method: 'Cash',
        user: 'Meet',
        vendor: '',
        notes: 'Sum of all 18 Cash entries'
      });
      totalRow.font = { bold: true };
      totalRow.getCell('amount').numFmt = '₹#,##0';

      // Also append to main 'Expenses' sheet if it exists
      const mainSheet = wb.getWorksheet('Expenses') || wb.worksheets[0];
      if (mainSheet) {
        // Find existing max entry id
        let maxId = 0;
        mainSheet.eachRow((r, rowNum) => {
          if (rowNum > 1) {
            const v = r.getCell(1).value || r.getCell(2).value;
            const num = parseInt(v, 10);
            if (!isNaN(num) && num > maxId) maxId = num;
          }
        });

        // Append these 18 cash rows
        rawCashExpenses.forEach((item, idx) => {
          const parts = item.date.split('-');
          const ddMm = `${parts[2]}/${parts[1]}`;
          mainSheet.addRow([
            null,
            maxId + idx + 1,
            ddMm,
            item.title,
            item.amount,
            'INR',
            `Cash Entry Sr. ${item.sr} - Added for Meet (Payment: Cash)`
          ]);
        });
      }

      await wb.xlsx.writeFile(xlsxPath);
      console.log(`✅ Updated ${path.basename(xlsxPath)} with dedicated 'Meet Cash Expenses' sheet & updated main sheet.`);
    } catch (xlErr) {
      console.warn(`Warning updating ${path.basename(xlsxPath)}:`, xlErr.message);
    }
  }

  process.exit(0);
}

main().catch(err => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});

