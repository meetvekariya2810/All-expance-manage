const fs = require('fs');
const path = require('path');
const dns = require('dns');

try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {}

const mongoose = require('mongoose');
const Expense = require('../server/models/Expense');
const User = require('../server/models/User');

const expensesData = [
  {
    sr: 1,
    expense_date: '2026-06-05',
    expense_time: '12:30',
    amount: 350,
    title: 'Goloo Bhavani',
    description: 'Goloo Bhavani snacks/food purchase',
    category: 'Food',
    payment_method: 'UPI',
    vendor: 'Goloo Bhavani',
    location: 'Local Store'
  },
  {
    sr: 2,
    expense_date: '2026-06-06',
    expense_time: '14:15',
    amount: 447,
    title: 'Amazon Delivery',
    description: 'Amzone Delivery online package',
    category: 'Shopping',
    payment_method: 'UPI',
    vendor: 'Amazon',
    location: 'Online'
  },
  {
    sr: 3,
    expense_date: '2026-06-07',
    expense_time: '11:00',
    amount: 4500,
    title: 'Ghee Online',
    description: 'Ghee Online purchase',
    category: 'Grocery',
    payment_method: 'UPI',
    vendor: 'Online Store',
    location: 'Online'
  },
  {
    sr: 4,
    expense_date: '2026-06-07',
    expense_time: '16:45',
    amount: 350,
    title: 'Payment - 9834',
    description: 'Payment ref: 9834',
    category: 'Miscellaneous',
    payment_method: 'UPI',
    vendor: '9834',
    location: 'Online'
  },
  {
    sr: 5,
    expense_date: '2026-06-12',
    expense_time: '13:00',
    amount: 350,
    title: 'Goloo Bhavani',
    description: 'Goloo Bhavani snacks/food purchase',
    category: 'Food',
    payment_method: 'UPI',
    vendor: 'Goloo Bhavani',
    location: 'Local Store'
  },
  {
    sr: 6,
    expense_date: '2026-06-13',
    expense_time: '13:30',
    amount: 420,
    title: 'Food Online Pay',
    description: 'Food Online Pay order',
    category: 'Food',
    payment_method: 'UPI',
    vendor: 'Online Food',
    location: 'Online'
  },
  {
    sr: 7,
    expense_date: '2026-06-13',
    expense_time: '18:20',
    amount: 270,
    title: 'Blinkit Grocery',
    description: 'Blinkit quick delivery order',
    category: 'Grocery',
    payment_method: 'UPI',
    vendor: 'Blinkit',
    location: 'Online'
  },
  {
    sr: 8,
    expense_date: '2026-06-14',
    expense_time: '15:00',
    amount: 498,
    title: 'Good Expense Total',
    description: 'Good Expense Total items',
    category: 'Miscellaneous',
    payment_method: 'UPI',
    vendor: 'Store',
    location: 'Market'
  },
  {
    sr: 9,
    expense_date: '2026-06-15',
    expense_time: '10:45',
    amount: 1853,
    title: 'Airtel Bill Pay',
    description: 'Airtel Bill Pay postpaid/broadband',
    category: 'Mobile Recharge',
    payment_method: 'UPI',
    vendor: 'Airtel',
    location: 'Online'
  },
  {
    sr: 10,
    expense_date: '2026-06-20',
    expense_time: '12:00',
    amount: 700,
    title: 'Goloo Bhavani',
    description: 'Goloo Bhavani snacks/food purchase',
    category: 'Food',
    payment_method: 'UPI',
    vendor: 'Goloo Bhavani',
    location: 'Local Store'
  },
  {
    sr: 11,
    expense_date: '2026-06-20',
    expense_time: '20:15',
    amount: 2528,
    title: 'Shakti Food',
    description: 'Shakti Food restaurant & dining',
    category: 'Food',
    payment_method: 'UPI',
    vendor: 'Shakti Food',
    location: 'Restaurant'
  },
  {
    sr: 12,
    expense_date: '2026-06-24',
    expense_time: '21:00',
    amount: 390,
    title: 'Patel Pavbhaji',
    description: 'Patel Pavbhaji dinner & snacks',
    category: 'Food',
    payment_method: 'UPI',
    vendor: 'Patel Pavbhaji',
    location: 'Restaurant'
  },
  {
    sr: 13,
    expense_date: '2026-06-26',
    expense_time: '17:30',
    amount: 1725,
    title: 'Blinkit Grocery',
    description: 'Blinkit grocery essentials order',
    category: 'Grocery',
    payment_method: 'UPI',
    vendor: 'Blinkit',
    location: 'Online'
  },
  {
    sr: 14,
    expense_date: '2026-06-27',
    expense_time: '11:15',
    amount: 435,
    title: 'Blinkit Grocery',
    description: 'Blinkit grocery order',
    category: 'Grocery',
    payment_method: 'UPI',
    vendor: 'Blinkit',
    location: 'Online'
  },
  {
    sr: 15,
    expense_date: '2026-06-27',
    expense_time: '14:40',
    amount: 658,
    title: 'Amazon Delivery',
    description: 'Amzone Delivery purchase',
    category: 'Shopping',
    payment_method: 'UPI',
    vendor: 'Amazon',
    location: 'Online'
  },
  {
    sr: 16,
    expense_date: '2026-06-27',
    expense_time: '20:45',
    amount: 522,
    title: 'Zomato Food Delivery',
    description: 'Zomato meal delivery',
    category: 'Food',
    payment_method: 'UPI',
    vendor: 'Zomato',
    location: 'Online'
  },
  {
    sr: 17,
    expense_date: '2026-06-28',
    expense_time: '16:00',
    amount: 846,
    title: 'Blinkit Grocery',
    description: 'Blinkit household & snacks order',
    category: 'Grocery',
    payment_method: 'UPI',
    vendor: 'Blinkit',
    location: 'Online'
  }
];

async function run() {
  console.log('📌 Starting Meet expense entry process...');

  const meetUser = {
    _id: 'usr_meet_03',
    id: 'usr_meet_03',
    name: 'Meet',
    username: 'meet'
  };

  // 1. Prepare formatted expense objects
  const formattedExpenses = expensesData.map((item, idx) => {
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

  // 2. Update data_store.json and data_store.backup.json
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
        const exists = data.expenses.some(e => e.expense_id === exp.expense_id || e._id === exp._id);
        if (!exists) {
          data.expenses.push(exp);
          addedCount++;
        }
      }
      fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
      console.log(`✅ ${path.basename(file)}: Added ${addedCount} expenses. Total expenses now: ${data.expenses.length}`);
    }
  }

  // 3. Connect to MongoDB Atlas and insert expenses
  const mongoUri = 'mongodb+srv://vekariyameet674_db_user:meet123@cluster28.bj0ygan.mongodb.net/expense_tracker?retryWrites=true&w=majority&appName=Cluster28';
  
  try {
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
    console.log('✅ Connected to MongoDB Atlas.');

    let mongoInserted = 0;
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
      }
    }
    console.log(`✅ MongoDB Atlas: Inserted ${mongoInserted} new expenses for Meet.`);

    const totalMeetMongo = await Expense.countDocuments({
      $or: [{ user_id: 'usr_meet_03' }, { user_name: 'Meet' }]
    });
    console.log(`📊 Total Meet expenses in MongoDB Atlas: ${totalMeetMongo}`);

    // If MongoDB Atlas had 0 total expenses, also migrate baseline data so Bhavik's data is also there!
    const totalAllMongo = await Expense.countDocuments();
    console.log(`📊 Total all expenses in MongoDB Atlas: ${totalAllMongo}`);
    if (totalAllMongo <= formattedExpenses.length) {
      console.log('🔄 Syncing full authoritative dataset to MongoDB Atlas...');
      const migrateScript = require('./migrate');
    }

  } catch (dbErr) {
    console.warn('⚠️ Notice regarding MongoDB Atlas sync:', dbErr.message);
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }

  console.log('🎉 Expense insertion completed successfully!');
}

run();
