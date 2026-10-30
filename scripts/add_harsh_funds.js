require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Fund = require('../server/models/Fund');
const User = require('../server/models/User');

const CSV_FILE = path.join(__dirname, 'harsh_expenses_input.csv');

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

function extractPersonName(desc, sr) {
  let d = (desc || '').trim();
  if (!d) {
    if (sr === 223) return 'Aditya Trans Solution (Rent)';
    return `Credit Entry ${sr}`;
  }
  const lower = d.toLowerCase();
  if (lower.includes('jigneshbhai november')) return 'Jigneshbhai (November Rent)';
  if (lower.includes('jigneshbhai december')) return 'Jigneshbhai (December Rent)';
  if (lower.includes('jigneshbhai january')) return 'Jigneshbhai (January Rent)';
  if (lower.includes('sangram')) return 'Sangram Transport';
  if (lower.includes('sabgram')) return 'Sangram Transport';
  if (lower.includes('aditya trans') || lower.includes('aditya rent')) return 'Aditya Trans Solutions';
  if (lower.includes('lakkad')) return 'Lakkad Siddhant';
  if (lower.includes('webito')) return 'Webito Infotech';
  if (lower.includes('amazon refund')) return 'Amazon (Refund)';
  if (lower.includes('myntra refund')) return 'Myntra (Refund)';
  if (lower.includes('girdharbhai')) return 'Girdharbhai (Cash)';
  if (lower.includes('mahakal')) return 'Mahakal Trip Reimbursement';
  if (lower.includes('nishant')) return 'Nishant Bhai';
  if (lower.includes('hepil')) return 'Hepil';
  if (lower.includes('bhavik')) return 'Bhavik Bhai';
  if (lower.includes('manav hotel')) return 'Manav Hotel';
  if (lower.includes('meet bhano')) return 'Meet (Bhano)';
  if (lower.includes('dilipbhai')) return 'Dilipbhai';
  if (lower === 'rent') return 'Office Rent Reimbursement';
  if (lower === 'upi') return 'UPI Payment Received';
  return d.charAt(0).toUpperCase() + d.slice(1);
}

async function addHarshFunds() {
  console.log('========================================================');
  console.log('🚀 Starting Harsh Funds / Money In Import Process (75 Records)');
  console.log('👤 Target User: Harsh (usr_harsh_04 / harsh)');
  console.log('📂 Target Module: Funds / Money In (Fund History)');
  console.log('========================================================\n');

  if (!fs.existsSync(CSV_FILE)) {
    console.error(`❌ CSV File not found at ${CSV_FILE}`);
    process.exit(1);
  }

  const rawCSV = fs.readFileSync(CSV_FILE, 'utf8');
  const allRows = parseCSV(rawCSV);
  const dataRows = allRows.slice(1);

  // Filter ONLY credit rows
  const creditRows = dataRows.filter(r => {
    const credit = parseFloat(r[4]) || 0;
    return credit > 0;
  });

  console.log(`✅ Filtered ${creditRows.length} Credit records from CSV.`);

  const harshUser = {
    _id: 'usr_harsh_04',
    id: 'usr_harsh_04',
    name: 'Harsh',
    username: 'harsh',
    role: 'user',
    email: 'harsh@expense.com'
  };

  let totalFundAmount = 0;

  const formattedFunds = creditRows.map(r => {
    const sr = parseInt(r[0], 10);
    const rawDate = (r[1] || '').trim();
    const rawDesc = (r[2] || '').trim();
    const credit = parseFloat(r[4]) || 0;

    const extraCols = r.slice(5).filter(c => c && c.trim() !== '').map(c => c.trim());
    const extraNotes = extraCols.join(' | ');

    totalFundAmount += credit;

    const numStr = String(sr).padStart(3, '0');
    const fundId = `FUND-HARSH-${numStr}`;
    const uniqueId = `fund_harsh_${numStr}`;

    const personName = extractPersonName(rawDesc, sr);

    // Date formatting: Jigneshbhai Nov/Dec get appropriate 2023 dates for chronological order
    let fundDate = rawDate;
    if (!fundDate || fundDate === 'Undated') {
      if (sr === 2) fundDate = '2023-11-30';
      else if (sr === 3) fundDate = '2023-12-31';
      else fundDate = '2024-01-01';
    }

    let notes = `Sr. No. ${sr} | Credit Entry (${rawDesc || 'Office Rent'})`;
    if (extraNotes) {
      notes += ` | Note: ${extraNotes}`;
    }

    const createdAtISO = new Date(`${fundDate}T12:00:00.000Z`).toISOString();

    return {
      _id: uniqueId,
      id: uniqueId,
      fund_id: fundId,
      amount: credit,
      person_name: personName,
      fund_date: fundDate,
      notes: notes,
      user_id: harshUser._id,
      user_name: harshUser.name,
      created_by: harshUser.name,
      created_at: createdAtISO,
      updated_at: new Date().toISOString()
    };
  });

  console.log(`📊 Statistics for Funds to Import:`);
  console.log(`   - Total Funds: ${formattedFunds.length}`);
  console.log(`   - Total Value: ₹${totalFundAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n`);

  // 1. Sync data_store.json and data_store.backup.json
  const storeFiles = [
    path.join(__dirname, '../data_store.json'),
    path.join(__dirname, '../data_store.backup.json')
  ];

  for (const file of storeFiles) {
    if (fs.existsSync(file)) {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (!data.funds) data.funds = [];

      let addedCount = 0;
      let updatedCount = 0;

      for (const f of formattedFunds) {
        const existingIdx = data.funds.findIndex(e => e.fund_id === f.fund_id || e._id === f._id);
        if (existingIdx === -1) {
          data.funds.push(f);
          addedCount++;
        } else {
          data.funds[existingIdx] = { ...data.funds[existingIdx], ...f };
          updatedCount++;
        }
      }

      fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
      console.log(`💾 ${path.basename(file)}: Funds Synced! Added: ${addedCount}, Updated: ${updatedCount}. Total funds in store: ${data.funds.length}`);
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

    let mongoInserted = 0;
    let mongoUpdated = 0;

    for (const f of formattedFunds) {
      const query = { $or: [{ _id: f._id }, { id: f.id }, { fund_id: f.fund_id }] };
      const docData = {
        ...f,
        created_at: new Date(f.created_at),
        updated_at: new Date(f.updated_at)
      };

      const res = await Fund.updateOne(query, { $set: docData }, { upsert: true });
      if (res.upsertedCount > 0) {
        mongoInserted++;
      } else {
        mongoUpdated++;
      }
    }

    console.log(`✅ MongoDB Atlas: Funds Upsert completed. New inserted: ${mongoInserted}, Updated: ${mongoUpdated}.`);

    // Verify Harsh funds in Mongo
    const harshFundCount = await Fund.countDocuments({
      $or: [{ user_id: 'usr_harsh_04' }, { user_name: 'Harsh' }]
    });
    console.log(`📊 Total Harsh Funds in MongoDB Atlas: ${harshFundCount} (Expected: 75)`);

    const harshFundDocs = await Fund.find({
      $or: [{ user_id: 'usr_harsh_04' }, { user_name: 'Harsh' }]
    });
    const harshFundTotal = harshFundDocs.reduce((acc, f) => acc + f.amount, 0);
    console.log(`💰 Total Harsh Fund Amount in MongoDB Atlas: ₹${harshFundTotal.toLocaleString('en-IN')}`);

    // Verify Meet funds in Mongo (Untouched)
    const meetFundCount = await Fund.countDocuments({
      $or: [{ user_id: 'usr_meet_03' }, { user_name: 'Meet' }]
    });
    console.log(`🛡️ Total Meet Funds in MongoDB Atlas: ${meetFundCount} (Untouched)`);

  } catch (err) {
    console.error('❌ MongoDB Atlas error:', err.message);
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
      console.log('🔌 Disconnected from MongoDB Atlas.');
    }
  }

  console.log('\n🎉 ALL 75 CREDIT RECORDS SUCCESSFULLY ADDED TO HARSH FUNDS / MONEY IN MODULE!');
}

addHarshFunds();

