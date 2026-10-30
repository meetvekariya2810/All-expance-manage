require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Expense = require('../server/models/Expense');
const Fund = require('../server/models/Fund');

const creditSrNos = [
  2, 3, 4, 5, 17, 18, 20, 28, 31, 32, 37, 43, 47, 48, 64, 65, 71, 72, 73, 78,
  82, 83, 86, 95, 96, 100, 113, 118, 119, 126, 130, 138, 140, 141, 149, 150,
  151, 152, 158, 159, 160, 161, 171, 187, 188, 189, 191, 194, 195, 196, 205,
  213, 214, 216, 222, 223, 225, 226, 227, 228, 229, 247, 250, 251, 252, 253,
  255, 269, 276, 279, 280, 288, 289, 290, 294
];

console.log('Total credit Sr numbers to delete from Harsh expenses:', creditSrNos.length);

const targetExpenseIds = creditSrNos.map(sr => `EXP-HARSH-${String(sr).padStart(3, '0')}`);
const targetDocIds = creditSrNos.map(sr => `exp_harsh_${String(sr).padStart(3, '0')}`);

async function deleteCreditExpenses() {
  console.log('========================================================');
  console.log('🗑️ Deleting 75 Credit Entries from Harsh Expense History');
  console.log('👤 Target User: Harsh (usr_harsh_04 / harsh)');
  console.log('⚠️ Funds / Money In module will RETAIN all 75 credit funds');
  console.log('========================================================\n');

  // 1. Remove from data_store.json and data_store.backup.json
  const storeFiles = [
    path.join(__dirname, '../data_store.json'),
    path.join(__dirname, '../data_store.backup.json')
  ];

  for (const file of storeFiles) {
    if (fs.existsSync(file)) {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (Array.isArray(data.expenses)) {
        const initialCount = data.expenses.length;
        data.expenses = data.expenses.filter(e => {
          const isHarsh = e.user_id === 'usr_harsh_04' || e.user_name === 'Harsh';
          if (!isHarsh) return true; // keep other users' expenses
          const isTargetCredit = targetExpenseIds.includes(e.expense_id) || targetDocIds.includes(e._id) || e.transaction_type === 'Credit';
          return !isTargetCredit;
        });
        const removedCount = initialCount - data.expenses.length;
        fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
        console.log(`💾 ${path.basename(file)}: Removed ${removedCount} credit expenses. Remaining total: ${data.expenses.length}`);
      }
    }
  }

  // 2. Remove from MongoDB Atlas Expense Collection
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('❌ MONGODB_URI missing in .env');
    return;
  }

  try {
    console.log('\n🌐 Connecting to MongoDB Atlas...');
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10000 });
    console.log('✅ Connected to MongoDB Atlas.');

    // Query to delete
    const deleteQuery = {
      $and: [
        { $or: [{ user_id: 'usr_harsh_04' }, { user_name: 'Harsh' }] },
        {
          $or: [
            { expense_id: { $in: targetExpenseIds } },
            { _id: { $in: targetDocIds } },
            { id: { $in: targetDocIds } },
            { transaction_type: 'Credit' }
          ]
        }
      ]
    };

    const deleteResult = await Expense.deleteMany(deleteQuery);
    console.log(`🗑️ MongoDB Atlas: Deleted ${deleteResult.deletedCount} credit expense records.`);

    // Verification: Remaining Harsh Expenses (Should be 219 Debits)
    const remainingHarshExpenses = await Expense.find({
      $or: [{ user_id: 'usr_harsh_04' }, { user_name: 'Harsh' }]
    });
    console.log(`📊 Remaining Harsh Expenses in MongoDB Atlas: ${remainingHarshExpenses.length} (Expected: 219 Debits)`);

    const totalDebitSum = remainingHarshExpenses.reduce((acc, e) => acc + (e.amount || 0), 0);
    console.log(`💰 Total Harsh Debit Expense Amount: ₹${totalDebitSum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);

    // Verification: Harsh Funds (Should still be 75 Credits)
    const harshFunds = await Fund.find({
      $or: [{ user_id: 'usr_harsh_04' }, { user_name: 'Harsh' }]
    });
    console.log(`🏦 Harsh Funds / Money In Count: ${harshFunds.length} (Expected: 75 Credits)`);
    const totalFundSum = harshFunds.reduce((acc, f) => acc + (f.amount || 0), 0);
    console.log(`💰 Total Harsh Funds / Money In Amount: ₹${totalFundSum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);

    // Verification: Meet Expenses (Should be untouched)
    const meetExpenses = await Expense.find({
      $or: [{ user_id: 'usr_meet_03' }, { user_name: 'Meet' }]
    });
    console.log(`🛡️ Meet Expenses in MongoDB Atlas: ${meetExpenses.length} (Untouched)`);

  } catch (err) {
    console.error('❌ MongoDB Atlas error:', err.message);
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
      console.log('🔌 Disconnected from MongoDB Atlas.');
    }
  }

  console.log('\n🎉 CREDIT EXPENSES REMOVED FROM EXPENSE HISTORY SUCCESSFULLY!');
}

deleteCreditExpenses();

