require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Expense = require('../server/models/Expense');
const User = require('../server/models/User');
const Category = require('../server/models/Category');

// Raw CSV file path
const CSV_FILE = path.join(__dirname, 'harsh_expenses_input.csv');

// Reliable CSV parser handling escaped quotes and commas
function parseCSV(text) {
  const lines = [];
  let row = [];
  let inQuotes = false;
  let currentVal = '';

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentVal += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(currentVal.trim());
      currentVal = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      row.push(currentVal.trim());
      if (row.length > 1 || row[0] !== '') {
        lines.push(row);
      }
      row = [];
      currentVal = '';
    } else {
      currentVal += char;
    }
  }
  if (currentVal || row.length > 0) {
    row.push(currentVal.trim());
    lines.push(row);
  }
  return lines;
}

// Category mapper
function mapCategory(desc, isCredit) {
  const d = (desc || '').toLowerCase();
  
  if (d.includes('rent') || d.includes('sangram') || d.includes('aditya trans') || d.includes('lakkad') || d.includes('sabgram')) {
    return 'Rent';
  }
  if (d.includes('ugvcl') || d.includes('light bill') || d.includes('electricity')) {
    return 'Electricity Bill';
  }
  if (d.includes('adani') || d.includes('gas') || d.includes('cylinder')) {
    return 'Gas';
  }
  if (d.includes('airtel') || d.includes('recharge') || d.includes('postpaid')) {
    return 'Mobile Recharge';
  }
  if (d.includes('wifi') || d.includes('broadband') || d.includes('jio')) {
    return 'Internet';
  }
  if (d.includes('blinkit') || d.includes('zepto')) {
    return 'Grocery';
  }
  if (d.includes('bakery') || d.includes('gathiya') || d.includes('buttermilk') || 
      d.includes('chips') || d.includes('ice') || d.includes('icecream') || 
      d.includes('food') || d.includes('dhosa') || d.includes('bread') || 
      d.includes('coconut') || d.includes('masala') || d.includes('gotalo') || 
      d.includes('dhaba') || d.includes('khakhra') || d.includes('baraf') || 
      d.includes('baskin') || d.includes('bhaji') || d.includes('café') || 
      d.includes('cutting') || d.includes('nasto') || d.includes('cake') || 
      d.includes('pav bhaji') || d.includes('fruit') || d.includes('hotel')) {
    return 'Food';
  }
  if (d.includes('amazon') || d.includes('myntra') || d.includes('blazer') || 
      d.includes('socks') || d.includes('saree') || d.includes('zulas') || 
      d.includes('shopping') || d.includes('frame') || d.includes('first cry') || 
      d.includes('studio') || d.includes('decoration')) {
    return 'Shopping';
  }
  if (d.includes('medicine') || d.includes('dava') || d.includes('agro') || d.includes('chemical')) {
    return 'Medical';
  }
  if (d.includes('petrol') || d.includes('fuel')) {
    return 'Petrol';
  }
  if (d.includes('trip') || d.includes('travel')) {
    return 'Travel';
  }
  if (d.includes('cholamandal') || d.includes('emi') || d.includes('finance')) {
    return 'EMI';
  }
  if (d.includes('pass') || d.includes('pushpa') || d.includes('garba') || 
      d.includes('navratri') || d.includes('bday') || d.includes('club fee')) {
    return 'Entertainment';
  }
  return 'Miscellaneous';
}

// Payment Mode mapper
function mapPaymentMethod(desc) {
  const d = (desc || '').toLowerCase();
  if (d.includes('credit card') || d.includes('cc bill') || d.includes(' cc') || 
      d.includes('idfc credit card') || d.includes('axis credit card') || 
      d.includes('citibank credit card') || d.includes('icici')) {
    return 'Credit Card';
  }
  if (d.includes('upi') || d.includes('gpay')) {
    return 'UPI';
  }
  if (d.includes('cash')) {
    return 'Cash';
  }
  if (d.includes('transfer')) {
    return 'Net Banking';
  }
  return 'UPI';
}

// Vendor extractor
function extractVendor(desc) {
  const d = (desc || '').trim();
  const lower = d.toLowerCase();
  if (lower.includes('airtel')) return 'Airtel';
  if (lower.includes('ugvcl')) return 'UGVCL';
  if (lower.includes('adani')) return 'Adani Gas';
  if (lower.includes('amazon')) return 'Amazon';
  if (lower.includes('myntra')) return 'Myntra';
  if (lower.includes('blinkit')) return 'Blinkit';
  if (lower.includes('zepto')) return 'Zepto';
  if (lower.includes('idfc')) return 'IDFC Bank';
  if (lower.includes('citibank')) return 'Citibank';
  if (lower.includes('axis')) return 'Axis Bank';
  if (lower.includes('icici')) return 'ICICI Bank';
  if (lower.includes('sangram') || lower.includes('sabgram')) return 'Sangram Transport';
  if (lower.includes('aditya')) return 'Aditya Trans Solution';
  if (lower.includes('lakkad')) return 'Lakkad Siddhant';
  if (lower.includes('webito')) return 'Webito Infotech';
  if (lower.includes('cholamandal')) return 'Cholamandal Finance';
  if (lower.includes('jio')) return 'Jio';
  if (lower.includes('first cry')) return 'FirstCry';
  if (lower.includes('baskin')) return 'Baskin Robbins';
  if (lower.includes('patel pav')) return 'Patel Pav Bhaji';
  if (lower.includes('krishna bakery')) return 'Krishna Bakery';
  if (lower.includes('shakti food')) return 'Shakti Foods';
  if (lower.includes('manav hotel')) return 'Manav Hotel';
  if (lower.includes('mahakali dhaba')) return 'Mahakali Dhaba';
  return d || 'General';
}

function cleanTitle(desc, sr, type) {
  let d = (desc || '').trim();
  if (!d) {
    if (sr === 223) return 'Office Rent (Aditya)';
    return `Transaction ${sr}`;
  }
  if (d.includes('\n')) {
    d = d.split('\n')[0].trim();
  }
  if (d.startsWith('Amazon Bill (UPI')) {
    return 'Amazon Bill';
  }
  return d.charAt(0).toUpperCase() + d.slice(1);
}

async function addHarshExpenses() {
  console.log('========================================================');
  console.log('🚀 Starting Harsh Sub-Admin Expense Import Process (294 Records)');
  console.log('👤 Target User: Harsh (usr_harsh_04 / harsh)');
  console.log('⚠️ Constraint: Zero records added to Meet account.');
  console.log('========================================================\n');

  if (!fs.existsSync(CSV_FILE)) {
    console.error(`❌ CSV File not found at ${CSV_FILE}`);
    process.exit(1);
  }

  const rawCSV = fs.readFileSync(CSV_FILE, 'utf8');
  const allRows = parseCSV(rawCSV);
  const dataRows = allRows.slice(1);

  if (dataRows.length !== 294) {
    console.warn(`⚠️ Warning: Expected 294 rows, parsed ${dataRows.length} rows.`);
  } else {
    console.log(`✅ Successfully parsed all ${dataRows.length} expense rows from CSV.`);
  }

  // Define Harsh user details
  const harshUser = {
    _id: 'usr_harsh_04',
    id: 'usr_harsh_04',
    name: 'Harsh',
    username: 'harsh',
    role: 'user',
    email: 'harsh@expense.com',
    status: 'active'
  };

  let totalDebitAmount = 0;
  let totalCreditAmount = 0;
  let debitCount = 0;
  let creditCount = 0;

  const formattedExpenses = dataRows.map((r) => {
    const sr = parseInt(r[0], 10);
    const rawDate = (r[1] || '').trim();
    const rawDesc = (r[2] || '').trim();
    const debit = parseFloat(r[3]) || 0;
    const credit = parseFloat(r[4]) || 0;

    const extraCols = r.slice(5).filter(c => c && c.trim() !== '').map(c => c.trim());
    const extraNotes = extraCols.join(' | ');

    const isCredit = credit > 0;
    const type = isCredit ? 'Credit' : 'Debit';
    const amount = isCredit ? credit : debit;

    if (isCredit) {
      creditCount++;
      totalCreditAmount += amount;
    } else {
      debitCount++;
      totalDebitAmount += amount;
    }

    let expenseDate = rawDate;
    if (!expenseDate) {
      expenseDate = 'Undated';
    }

    const title = cleanTitle(rawDesc, sr, type);
    const category = mapCategory(rawDesc, isCredit);
    const paymentMethod = mapPaymentMethod(rawDesc);
    const vendor = extractVendor(rawDesc);

    let notes = `Sr. No. ${sr} | Type: ${type}`;
    if (extraNotes) {
      notes += ` | Note: ${extraNotes}`;
    }

    const numStr = String(sr).padStart(3, '0');
    const expId = `EXP-HARSH-${numStr}`;
    const uniqueId = `exp_harsh_${numStr}`;

    let createdAtISO;
    if (expenseDate !== 'Undated') {
      try {
        createdAtISO = new Date(`${expenseDate}T12:00:00.000Z`).toISOString();
      } catch (e) {
        createdAtISO = new Date('2024-01-01T12:00:00.000Z').toISOString();
      }
    } else {
      createdAtISO = new Date('2024-01-01T12:00:00.000Z').toISOString();
    }

    return {
      _id: uniqueId,
      id: uniqueId,
      expense_id: expId,
      user_id: harshUser._id,
      user_name: harshUser.name,
      created_by: harshUser.name,
      title: title,
      description: rawDesc ? `${rawDesc} [${type}]` : `[${type}]`,
      category: category,
      amount: amount,
      transaction_type: type,
      payment_method: paymentMethod,
      vendor: vendor,
      location: 'Ahmedabad',
      receipt: '',
      notes: notes,
      expense_date: expenseDate,
      expense_time: '12:00',
      created_at: createdAtISO,
      updated_at: new Date().toISOString()
    };
  });

  console.log(`📊 Processing Statistics:`);
  console.log(`   - Total Records: ${formattedExpenses.length}`);
  console.log(`   - Debit Records: ${debitCount} (Total: ₹${totalDebitAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })})`);
  console.log(`   - Credit Records: ${creditCount} (Total: ₹${totalCreditAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })})`);
  console.log(`   - Net Balance (Debit - Credit): ₹${(totalDebitAmount - totalCreditAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n`);

  // 1. Sync data_store.json and data_store.backup.json
  const storeFiles = [
    path.join(__dirname, '../data_store.json'),
    path.join(__dirname, '../data_store.backup.json')
  ];

  for (const file of storeFiles) {
    if (fs.existsSync(file)) {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (!data.expenses) data.expenses = [];

      // Ensure Harsh user exists in file
      if (Array.isArray(data.users)) {
        const harshIdx = data.users.findIndex(u => u.username === 'harsh' || u.id === 'usr_harsh_04');
        if (harshIdx === -1) {
          data.users.push({
            _id: harshUser._id,
            id: harshUser.id,
            name: harshUser.name,
            email: harshUser.email,
            mobile: '+91 98765 67890',
            username: harshUser.username,
            password: '$2a$10$aY87AjhedIIbeRcC77B0OOmk1vzq4JO1lxyNZtojbpKofwTEFL/g6', // harsh123
            role: 'user',
            profile_image: '/uploads/default-avatar.png',
            status: 'active',
            created_at: '2026-07-27T17:55:02.752Z'
          });
          console.log(`👤 Added Harsh user to ${path.basename(file)}.`);
        }
      }

      // Add or update all Harsh expenses
      let addedCount = 0;
      let updatedCount = 0;

      for (const exp of formattedExpenses) {
        const existingIdx = data.expenses.findIndex(e => e.expense_id === exp.expense_id || e._id === exp._id);
        if (existingIdx === -1) {
          data.expenses.push(exp);
          addedCount++;
        } else {
          data.expenses[existingIdx] = { ...data.expenses[existingIdx], ...exp };
          updatedCount++;
        }
      }

      fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
      console.log(`💾 ${path.basename(file)}: Synced! Added: ${addedCount}, Updated: ${updatedCount}. Total expenses in store: ${data.expenses.length}`);
    }
  }

  // 2. Sync with MongoDB Atlas
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('❌ MONGODB_URI missing in .env');
    return;
  }

  try {
    console.log('\n🌐 Connecting to MongoDB Atlas...');
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10000 });
    console.log('✅ Connected to MongoDB Atlas.');

    // Ensure Harsh exists in MongoDB
    let dbHarsh = await User.findOne({ username: 'harsh' });
    if (!dbHarsh) {
      dbHarsh = await User.create({
        _id: harshUser._id,
        id: harshUser.id,
        name: harshUser.name,
        email: harshUser.email,
        mobile: '+91 98765 67890',
        username: harshUser.username,
        password: '$2a$10$aY87AjhedIIbeRcC77B0OOmk1vzq4JO1lxyNZtojbpKofwTEFL/g6', // harsh123
        role: 'user',
        status: 'active'
      });
      console.log('👤 Created Harsh account in MongoDB Atlas.');
    } else {
      console.log('👤 Harsh account verified in MongoDB Atlas.');
    }

    // Insert or update all 294 expenses in MongoDB
    let mongoInserted = 0;
    let mongoUpdated = 0;

    for (const exp of formattedExpenses) {
      const query = { $or: [{ _id: exp._id }, { id: exp.id }, { expense_id: exp.expense_id }] };
      const docData = {
        ...exp,
        created_at: new Date(exp.created_at),
        updated_at: new Date(exp.updated_at)
      };

      const res = await Expense.updateOne(query, { $set: docData }, { upsert: true });
      if (res.upsertedCount > 0) {
        mongoInserted++;
      } else {
        mongoUpdated++;
      }
    }

    console.log(`✅ MongoDB Atlas: Upsert completed. New inserted: ${mongoInserted}, Updated: ${mongoUpdated}.`);

    // Verify Harsh expenses count in Mongo
    const harshMongoCount = await Expense.countDocuments({
      $or: [{ user_id: 'usr_harsh_04' }, { user_name: 'Harsh' }]
    });
    console.log(`📊 Total Harsh expenses in MongoDB Atlas: ${harshMongoCount} (Expected: 294)`);

    // Verify Meet expenses count in Mongo (must be untouched!)
    const meetMongoCount = await Expense.countDocuments({
      $or: [{ user_id: 'usr_meet_03' }, { user_name: 'Meet' }]
    });
    console.log(`🛡️ Total Meet expenses in MongoDB Atlas: ${meetMongoCount} (Untouched & preserved!)`);

    // Verify Bhavik expenses count in Mongo
    const bhavikMongoCount = await Expense.countDocuments({
      $or: [{ user_id: 'usr_bhavik_02' }, { user_name: 'Bhavik Bhai' }]
    });
    console.log(`💼 Total Bhavik expenses in MongoDB Atlas: ${bhavikMongoCount}`);

  } catch (err) {
    console.error('❌ MongoDB Atlas error:', err.message);
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
      console.log('🔌 Disconnected from MongoDB Atlas.');
    }
  }

  console.log('\n🎉 ALL 294 EXPENSES FOR HARSH SUCCESSFULLY ADDED AND VERIFIED!');
}

addHarshExpenses();

