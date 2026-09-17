const fs = require('fs');
const path = require('path');
const dns = require('dns');

try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {}

const mongoose = require('mongoose');
const Expense = require('../server/models/Expense');
const Category = require('../server/models/Category');
const User = require('../server/models/User');

const allExpensesData = [
  // Batch 1 (June 2026)
  { sr: 1, expense_date: '2026-06-05', expense_time: '12:30', amount: 350, title: 'Goloo Bhavani', description: 'Goloo Bhavani snacks/food purchase', category: 'Food', payment_method: 'UPI', vendor: 'Goloo Bhavani', location: 'Local Store' },
  { sr: 2, expense_date: '2026-06-06', expense_time: '14:15', amount: 447, title: 'Amazon Delivery', description: 'Amzone Delivery online package', category: 'Shopping', payment_method: 'UPI', vendor: 'Amazon', location: 'Online' },
  { sr: 3, expense_date: '2026-06-07', expense_time: '11:00', amount: 4500, title: 'Ghee Online', description: 'Ghee Online purchase', category: 'Grocery', payment_method: 'UPI', vendor: 'Online Store', location: 'Online' },
  { sr: 4, expense_date: '2026-06-07', expense_time: '16:45', amount: 350, title: 'Payment - 9834', description: 'Payment ref: 9834', category: 'Miscellaneous', payment_method: 'UPI', vendor: '9834', location: 'Online' },
  { sr: 5, expense_date: '2026-06-12', expense_time: '13:00', amount: 350, title: 'Goloo Bhavani', description: 'Goloo Bhavani snacks/food purchase', category: 'Food', payment_method: 'UPI', vendor: 'Goloo Bhavani', location: 'Local Store' },
  { sr: 6, expense_date: '2026-06-13', expense_time: '13:30', amount: 420, title: 'Food Online Pay', description: 'Food Online Pay order', category: 'Food', payment_method: 'UPI', vendor: 'Online Food', location: 'Online' },
  { sr: 7, expense_date: '2026-06-13', expense_time: '18:20', amount: 270, title: 'Blinkit Grocery', description: 'Blinkit quick delivery order', category: 'Grocery', payment_method: 'UPI', vendor: 'Blinkit', location: 'Online' },
  { sr: 8, expense_date: '2026-06-14', expense_time: '15:00', amount: 498, title: 'Good Expense Total', description: 'Good Expense Total items', category: 'Miscellaneous', payment_method: 'UPI', vendor: 'Store', location: 'Market' },
  { sr: 9, expense_date: '2026-06-15', expense_time: '10:45', amount: 1853, title: 'Airtel Bill Pay', description: 'Airtel Bill Pay postpaid/broadband', category: 'Mobile Recharge', payment_method: 'UPI', vendor: 'Airtel', location: 'Online' },
  { sr: 10, expense_date: '2026-06-20', expense_time: '12:00', amount: 700, title: 'Goloo Bhavani', description: 'Goloo Bhavani snacks/food purchase', category: 'Food', payment_method: 'UPI', vendor: 'Goloo Bhavani', location: 'Local Store' },
  { sr: 11, expense_date: '2026-06-20', expense_time: '20:15', amount: 2528, title: 'Shakti Food', description: 'Shakti Food restaurant & dining', category: 'Food', payment_method: 'UPI', vendor: 'Shakti Food', location: 'Restaurant' },
  { sr: 12, expense_date: '2026-06-24', expense_time: '21:00', amount: 390, title: 'Patel Pavbhaji', description: 'Patel Pavbhaji dinner & snacks', category: 'Food', payment_method: 'UPI', vendor: 'Patel Pavbhaji', location: 'Restaurant' },
  { sr: 13, expense_date: '2026-06-26', expense_time: '17:30', amount: 1725, title: 'Blinkit Grocery', description: 'Blinkit grocery essentials order', category: 'Grocery', payment_method: 'UPI', vendor: 'Blinkit', location: 'Online' },
  { sr: 14, expense_date: '2026-06-27', expense_time: '11:15', amount: 435, title: 'Blinkit Grocery', description: 'Blinkit grocery order', category: 'Grocery', payment_method: 'UPI', vendor: 'Blinkit', location: 'Online' },
  { sr: 15, expense_date: '2026-06-27', expense_time: '14:40', amount: 658, title: 'Amazon Delivery', description: 'Amzone Delivery purchase', category: 'Shopping', payment_method: 'UPI', vendor: 'Amazon', location: 'Online' },
  { sr: 16, expense_date: '2026-06-27', expense_time: '20:45', amount: 522, title: 'Zomato Food Delivery', description: 'Zomato meal delivery', category: 'Food', payment_method: 'UPI', vendor: 'Zomato', location: 'Online' },
  { sr: 17, expense_date: '2026-06-28', expense_time: '16:00', amount: 846, title: 'Blinkit Grocery', description: 'Blinkit household & snacks order', category: 'Grocery', payment_method: 'UPI', vendor: 'Blinkit', location: 'Online' },

  // Batch 2 (July 2026)
  { sr: 18, expense_date: '2026-07-10', expense_time: '14:30', amount: 2867, title: 'Nykaa Fashion – Bhabhi', description: 'Nykaa Fashion – Bhabhi apparel/fashion order', category: 'Shopping', payment_method: 'UPI', vendor: 'Nykaa Fashion', location: 'Online' },
  { sr: 19, expense_date: '2026-07-11', expense_time: '11:15', amount: 693, title: 'Blinkit Grocery', description: 'Blinkit quick delivery groceries', category: 'Grocery', payment_method: 'UPI', vendor: 'Blinkit', location: 'Online' },
  { sr: 20, expense_date: '2026-07-12', expense_time: '13:00', amount: 350, title: 'Payment - 9834', description: 'Payment ref: 9834', category: 'Miscellaneous', payment_method: 'UPI', vendor: '9834', location: 'Online' },
  { sr: 21, expense_date: '2026-07-12', expense_time: '17:45', amount: 795, title: 'Aakash Sharma', description: 'Payment to Aakash Sharma', category: 'Miscellaneous', payment_method: 'UPI', vendor: 'Aakash Sharma', location: 'Online' },
  { sr: 22, expense_date: '2026-07-13', expense_time: '10:30', amount: 290, title: 'Fruit Truck - 9834', description: '9834 Fruit Truck fresh fruits', category: 'Grocery', payment_method: 'UPI', vendor: 'Fruit Truck (9834)', location: 'Market' },
  { sr: 23, expense_date: '2026-07-22', expense_time: '15:20', amount: 600, title: 'SHARV Dava Khodal', description: 'SHARV Dava Khodal medical/medicines', category: 'Medical', payment_method: 'UPI', vendor: 'Khodal Medical', location: 'Store' },
  { sr: 24, expense_date: '2026-07-24', expense_time: '16:00', amount: 698, title: 'Blinkit Grocery', description: 'Blinkit household grocery delivery', category: 'Grocery', payment_method: 'UPI', vendor: 'Blinkit', location: 'Online' },
  { sr: 25, expense_date: '2026-07-25', expense_time: '20:10', amount: 390, title: 'Gadhiya Order', description: 'Gadhiya food order', category: 'Food', payment_method: 'UPI', vendor: 'Gadhiya', location: 'Restaurant' },
  { sr: 26, expense_date: '2026-07-27', expense_time: '12:30', amount: 800, title: 'Food Shopping', description: 'Food Shopping / groceries', category: 'Food', payment_method: 'UPI', vendor: 'Food Store', location: 'Market' },
  { sr: 27, expense_date: '2026-07-27', expense_time: '18:40', amount: 380, title: 'Fruit Truck - 9834', description: '9834 Fruit Truck fresh fruits', category: 'Grocery', payment_method: 'UPI', vendor: 'Fruit Truck (9834)', location: 'Market' },
  { sr: 28, expense_date: '2026-07-28', expense_time: '16:15', amount: 2000, title: 'Karan Online', description: 'Karan Online payment transfer', category: 'Miscellaneous', payment_method: 'UPI', vendor: 'Karan', location: 'Online' },
  { sr: 29, expense_date: '2026-07-29', expense_time: '19:00', amount: 2350, title: 'Bhabhi Order Kanani', description: 'Bhabhi Order Kanani shopping', category: 'Shopping', payment_method: 'UPI', vendor: 'Kanani', location: 'Market' },
  { sr: 30, expense_date: '2026-07-30', expense_time: '14:00', amount: 350, title: 'Payment - 9834', description: 'Payment ref: 9834', category: 'Miscellaneous', payment_method: 'UPI', vendor: '9834', location: 'Online' },
  { sr: 31, expense_date: '2026-07-31', expense_time: '21:15', amount: 560, title: 'Food Order', description: 'Food Order dinner', category: 'Food', payment_method: 'UPI', vendor: 'Restaurant', location: 'Online' },

  // Batch 3 (August 2026)
  { sr: 32, expense_date: '2026-08-01', expense_time: '11:00', amount: 1200, title: 'Blinkit Grocery', description: 'Blinkit monthly grocery order', category: 'Grocery', payment_method: 'UPI', vendor: 'Blinkit', location: 'Online' },
  { sr: 33, expense_date: '2026-08-02', expense_time: '15:30', amount: 298, title: 'Blinkit Grocery', description: 'Blinkit quick delivery item', category: 'Grocery', payment_method: 'UPI', vendor: 'Blinkit', location: 'Online' },
  { sr: 34, expense_date: '2026-08-08', expense_time: '18:20', amount: 3315, title: 'Bhabhi Order', description: 'Bhabhi Order items purchase', category: 'Shopping', payment_method: 'UPI', vendor: 'Store', location: 'Online' },
  { sr: 35, expense_date: '2026-08-09', expense_time: '10:45', amount: 550, title: 'Blinkit Grocery', description: 'Blinkit grocery supplies', category: 'Grocery', payment_method: 'UPI', vendor: 'Blinkit', location: 'Online' },
  { sr: 36, expense_date: '2026-08-09', expense_time: '13:30', amount: 1100, title: 'Food Order', description: 'Food Order lunch delivery', category: 'Food', payment_method: 'UPI', vendor: 'Restaurant', location: 'Online' },
  { sr: 37, expense_date: '2026-08-09', expense_time: '16:15', amount: 350, title: 'Bhabhi Golo', description: 'Bhabhi Golo ice dish/refreshment', category: 'Food', payment_method: 'UPI', vendor: 'Golo Vendor', location: 'Local Store' },
  { sr: 38, expense_date: '2026-08-11', expense_time: '12:00', amount: 800, title: 'GTPL TV Connection', description: 'GTPL TV Connection monthly recharge', category: 'Entertainment', payment_method: 'UPI', vendor: 'GTPL', location: 'Online' },
  { sr: 39, expense_date: '2026-08-11', expense_time: '20:45', amount: 360, title: 'Patel Pavbhaji', description: 'Patel Pavbhaji snacks & meal', category: 'Food', payment_method: 'UPI', vendor: 'Patel Pavbhaji', location: 'Restaurant' },
  { sr: 40, expense_date: '2026-08-13', expense_time: '11:30', amount: 1830, title: 'Airtel Bill Pay', description: 'Airtel Bill Pay postpaid/broadband', category: 'Mobile Recharge', payment_method: 'UPI', vendor: 'Airtel', location: 'Online' },
  { sr: 41, expense_date: '2026-08-13', expense_time: '17:00', amount: 320, title: 'Blinkit Farm', description: 'Blinkit Farm fresh fruits & greens', category: 'Grocery', payment_method: 'UPI', vendor: 'Blinkit Farm', location: 'Online' },
  { sr: 42, expense_date: '2026-08-14', expense_time: '09:30', amount: 460, title: 'Sev, Dudh & Gapaa Garden', description: 'Sev, Dudh and Gapaa Garden breakfast & dairy', category: 'Food', payment_method: 'UPI', vendor: 'Gapaa Garden / Dairy', location: 'Market' },
  { sr: 43, expense_date: '2026-08-14', expense_time: '14:20', amount: 670, title: 'Blinkit Grocery', description: 'Blinkit grocery items', category: 'Grocery', payment_method: 'UPI', vendor: 'Blinkit', location: 'Online' },
  { sr: 44, expense_date: '2026-08-14', expense_time: '19:15', amount: 800, title: 'Suman Baljit Singh', description: 'Payment to Suman Baljit Singh', category: 'Miscellaneous', payment_method: 'UPI', vendor: 'Suman Baljit Singh', location: 'Market' },
  { sr: 45, expense_date: '2026-08-16', expense_time: '16:00', amount: 712, title: 'Blinkit Grocery', description: 'Blinkit daily essentials order', category: 'Grocery', payment_method: 'UPI', vendor: 'Blinkit', location: 'Online' },
  { sr: 46, expense_date: '2026-08-17', expense_time: '11:45', amount: 39584, title: 'Insurance Premium', description: 'Insurance policy premium payment', category: 'Miscellaneous', payment_method: 'UPI', vendor: 'Insurance', location: 'Online' },
  { sr: 47, expense_date: '2026-08-18', expense_time: '20:30', amount: 420, title: 'Zomato Order', description: 'Zomato Order food delivery', category: 'Food', payment_method: 'UPI', vendor: 'Zomato', location: 'Online' },
  { sr: 48, expense_date: '2026-08-20', expense_time: '21:30', amount: 320, title: 'Royal Pan', description: 'Royal Pan snacks & refreshments', category: 'Food', payment_method: 'UPI', vendor: 'Royal Pan', location: 'Local Store' },
  { sr: 49, expense_date: '2026-08-21', expense_time: '15:00', amount: 10000, title: 'Sardar Pur Water Bottle', description: 'Sardar Pur Water Bottle supply payment', category: 'Water Bill', payment_method: 'UPI', vendor: 'Sardar Pur Water', location: 'Delivery' }
];

async function run() {
  console.log('📌 Starting Meet expense entry process (All 49 Records)...');

  const meetUser = {
    _id: 'usr_meet_03',
    id: 'usr_meet_03',
    name: 'Meet',
    username: 'meet'
  };

  const formattedExpenses = allExpensesData.map((item) => {
    const numStr = String(item.sr).padStart(2, '0');
    const expId = `EXP-${item.expense_date.replace(/-/g, '')}-M${numStr}`;
    const uniqueId = `exp_meet_${item.expense_date.replace(/-/g, '')}_${numStr}`;
    return {
      _id: uniqueId,
      id: uniqueId,
      expense_id: expId,
      user_id: meetUser._id,
      user_name: meetUser.name,
      created_by: meetUser.name,
      title: item.title,
      description: item.description,
      category: item.category,
      amount: item.amount,
      payment_method: item.payment_method,
      vendor: item.vendor,
      location: item.location,
      receipt: '',
      notes: `Sr. No. ${item.sr} - Added for Meet`,
      expense_date: item.expense_date,
      expense_time: item.expense_time,
      created_at: new Date(`${item.expense_date}T${item.expense_time}:00.000Z`).toISOString(),
      updated_at: new Date(`${item.expense_date}T${item.expense_time}:00.000Z`).toISOString()
    };
  });

  // 1. Update data_store.json and data_store.backup.json
  const storeFiles = [
    path.join(__dirname, '../data_store.json'),
    path.join(__dirname, '../data_store.backup.json')
  ];

  for (const file of storeFiles) {
    if (fs.existsSync(file)) {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (!data.expenses) data.expenses = [];

      let addedCount = 0;
      for (const exp of formattedExpenses) {
        const existingIdx = data.expenses.findIndex(e => e.expense_id === exp.expense_id || e._id === exp._id);
        if (existingIdx === -1) {
          data.expenses.push(exp);
          addedCount++;
        } else {
          // Update existing with formatted details
          data.expenses[existingIdx] = { ...data.expenses[existingIdx], ...exp };
        }
      }
      fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
      console.log(`✅ ${path.basename(file)}: Synced. Added ${addedCount} new expenses. Total expenses now: ${data.expenses.length}`);
    }
  }

  // 2. Connect to MongoDB Atlas and insert expenses
  const mongoUri = 'mongodb+srv://vekariyameet674_db_user:meet123@cluster28.bj0ygan.mongodb.net/expense_tracker?retryWrites=true&w=majority&appName=Cluster28';
  
  try {
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 8000 });
    console.log('✅ Connected to MongoDB Atlas.');

    let mongoInserted = 0;
    let mongoUpdated = 0;
    for (const exp of formattedExpenses) {
      const existing = await Expense.findOne({
        $or: [{ _id: exp._id }, { id: exp.id }, { expense_id: exp.expense_id }]
      });
      if (!existing) {
        await Expense.create({
          ...exp,
          created_at: new Date(exp.created_at),
          updated_at: new Date(exp.updated_at)
        });
        mongoInserted++;
      } else {
        await Expense.updateOne(
          { _id: existing._id },
          { $set: { ...exp, updated_at: new Date() } }
        );
        mongoUpdated++;
      }
    }
    console.log(`✅ MongoDB Atlas: Inserted ${mongoInserted} new expenses, updated ${mongoUpdated} expenses.`);

    const totalMeetMongo = await Expense.countDocuments({
      $or: [{ user_id: 'usr_meet_03' }, { user_name: 'Meet' }]
    });
    console.log(`📊 Total Meet expenses in MongoDB Atlas: ${totalMeetMongo}`);

    const allExpenses = await Expense.find({
      $or: [{ user_id: 'usr_meet_03' }, { user_name: 'Meet' }]
    }).sort({ expense_date: 1 });

    const totalSum = allExpenses.reduce((acc, e) => acc + e.amount, 0);
    console.log(`💰 Total expense amount for Meet: Rs. ${totalSum.toLocaleString('en-IN')}`);

  } catch (dbErr) {
    console.warn('⚠️ MongoDB Atlas update note:', dbErr.message);
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }

  console.log('🎉 All 49 Meet expenses processed successfully!');
}

run();
