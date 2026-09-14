const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const { connectDB, getMongoStatus, memoryStore, saveLocalStore } = require('../config/db');
const User = require('../models/User');
const Expense = require('../models/Expense');
const Category = require('../models/Category');
const Budget = require('../models/Budget');

const defaultCategories = [
  { category_name: 'Food', icon: 'fa-utensils', is_default: true, status: 'active' },
  { category_name: 'Grocery', icon: 'fa-shopping-basket', is_default: true, status: 'active' },
  { category_name: 'Petrol', icon: 'fa-gas-pump', is_default: true, status: 'active' },
  { category_name: 'Shopping', icon: 'fa-bag-shopping', is_default: true, status: 'active' },
  { category_name: 'Medical', icon: 'fa-user-nurse', is_default: true, status: 'active' },
  { category_name: 'Electricity Bill', icon: 'fa-bolt', is_default: true, status: 'active' },
  { category_name: 'Water Bill', icon: 'fa-faucet', is_default: true, status: 'active' },
  { category_name: 'Gas', icon: 'fa-fire', is_default: true, status: 'active' },
  { category_name: 'Internet', icon: 'fa-wifi', is_default: true, status: 'active' },
  { category_name: 'Mobile Recharge', icon: 'fa-mobile-screen', is_default: true, status: 'active' },
  { category_name: 'Entertainment', icon: 'fa-film', is_default: true, status: 'active' },
  { category_name: 'Travel', icon: 'fa-plane', is_default: true, status: 'active' },
  { category_name: 'Rent', icon: 'fa-house-user', is_default: true, status: 'active' },
  { category_name: 'Education', icon: 'fa-graduation-cap', is_default: true, status: 'active' },
  { category_name: 'EMI', icon: 'fa-credit-card', is_default: true, status: 'active' },
  { category_name: 'Investment', icon: 'fa-chart-line', is_default: true, status: 'active' },
  { category_name: 'Miscellaneous', icon: 'fa-box', is_default: true, status: 'active' }
];

const seedData = async () => {
  console.log('🌱 Starting database seeding & data migration...');
  await connectDB();

  // Load bundled data_store.json if exists
  let seedStore = { users: [], expenses: [], categories: [], budgets: [] };
  const storePath = path.join(__dirname, '../../data_store.json');
  if (fs.existsSync(storePath)) {
    try {
      const raw = fs.readFileSync(storePath, 'utf8');
      seedStore = JSON.parse(raw);
    } catch (err) {
      console.warn('Could not load data_store.json for seeding:', err.message);
    }
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  const currentMonthStr = todayStr.slice(0, 7);

  const adminPassword = await bcrypt.hash('admin123', 10);
  const bhavikPassword = await bcrypt.hash('bhavik123', 10);
  const meetPassword = await bcrypt.hash('meet123', 10);
  const harshPassword = await bcrypt.hash('harsh123', 10);

  const initialUsers = [
    {
      _id: 'usr_admin_01',
      id: 'usr_admin_01',
      name: 'Main Admin',
      email: 'admin@expense.com',
      mobile: '+91 98765 43210',
      username: 'admin',
      password: adminPassword,
      role: 'admin',
      profile_image: '/uploads/default-avatar.png',
      status: 'active',
      created_at: new Date()
    },
    {
      _id: 'usr_bhavik_02',
      id: 'usr_bhavik_02',
      name: 'Bhavik Bhai',
      email: 'bhavik@expense.com',
      mobile: '+91 91234 56789',
      username: 'bhavik',
      password: bhavikPassword,
      role: 'admin',
      profile_image: '/uploads/default-avatar.png',
      status: 'active',
      created_at: new Date()
    },
    {
      _id: 'usr_meet_03',
      id: 'usr_meet_03',
      name: 'Meet',
      email: 'meet@expense.com',
      mobile: '+91 98765 12345',
      username: 'meet',
      password: meetPassword,
      role: 'user',
      profile_image: '/uploads/default-avatar.png',
      status: 'active',
      created_at: new Date()
    },
    {
      _id: 'usr_harsh_04',
      id: 'usr_harsh_04',
      name: 'Harsh',
      email: 'harsh@expense.com',
      mobile: '+91 98765 67890',
      username: 'harsh',
      password: harshPassword,
      role: 'user',
      profile_image: '/uploads/default-avatar.png',
      status: 'active',
      created_at: new Date()
    }
  ];

  const initialBudgets = [
    { _id: 'bgt_001', id: 'bgt_001', user_id: 'usr_admin_01', month: currentMonthStr, budget_amount: 60000, created_at: new Date() },
    { _id: 'bgt_002', id: 'bgt_002', user_id: 'usr_bhavik_02', month: currentMonthStr, budget_amount: 40000, created_at: new Date() }
  ];

  const expensesToSeed = (seedStore.expenses && seedStore.expenses.length > 0) ? seedStore.expenses : [];

  if (getMongoStatus()) {
    try {
      // 1. Seed Categories idempotently
      for (const cat of defaultCategories) {
        await Category.updateOne(
          { category_name: cat.category_name },
          { $setOnInsert: cat },
          { upsert: true }
        );
      }
      console.log('✅ Categories seeded idempotently in MongoDB.');

      // 2. Seed Users idempotently
      for (const u of (seedStore.users && seedStore.users.length ? seedStore.users : initialUsers)) {
        const found = await User.findOne({ username: u.username });
        if (!found) {
          await User.collection.insertOne({ ...u, created_at: new Date(u.created_at || Date.now()) });
          console.log(`✅ Inserted user into MongoDB: ${u.username}`);
        } else {
          // Enforce role consistency
          const targetRole = u.username === 'bhavik' || u.username === 'admin' ? 'admin' : 'user';
          if (found.role !== targetRole) {
            await User.updateOne({ _id: found._id }, { role: targetRole });
            console.log(`Updated user ${u.username} role to ${targetRole}`);
          }
        }
      }

      // 3. Seed Expenses idempotently
      let seededExpCount = 0;
      for (const exp of expensesToSeed) {
        const expId = exp.expense_id || exp._id;
        const exists = await Expense.findOne({ $or: [{ expense_id: expId }, { _id: exp._id }] });
        if (!exists) {
          const doc = {
            _id: exp._id || exp.id || `exp_${Date.now()}_${Math.floor(Math.random()*1000)}`,
            id: exp.id || exp._id || `exp_${Date.now()}_${Math.floor(Math.random()*1000)}`,
            expense_id: exp.expense_id || `EXP-${Date.now()}`,
            user_id: exp.user_id,
            user_name: exp.user_name || 'User',
            title: exp.title,
            description: exp.description || '',
            category: exp.category,
            amount: parseFloat(exp.amount),
            payment_method: exp.payment_method || 'UPI',
            vendor: exp.vendor || '',
            location: exp.location || '',
            receipt: exp.receipt || '',
            notes: exp.notes || '',
            expense_date: exp.expense_date,
            expense_time: exp.expense_time || '12:00',
            created_at: exp.created_at ? new Date(exp.created_at) : new Date(),
            updated_at: new Date()
          };
          await Expense.collection.insertOne(doc);
          seededExpCount++;
        }
      }
      console.log(`✅ Seeded ${seededExpCount} new expense records into MongoDB.`);

      // 4. Seed Budgets idempotently
      for (const bgt of initialBudgets) {
        await Budget.updateOne(
          { user_id: bgt.user_id, month: bgt.month },
          { $setOnInsert: bgt },
          { upsert: true }
        );
      }
      console.log('✅ Budgets seeded idempotently in MongoDB.');
    } catch (err) {
      console.error('Error seeding MongoDB:', err);
    }
  } else {
    // Memory store fallback seeding
    if (!memoryStore.users || memoryStore.users.length === 0) {
      memoryStore.users = seedStore.users || initialUsers;
    }
    // Verify roles in memory store
    memoryStore.users.forEach(u => {
      if (u.username === 'bhavik' || u.username === 'admin') u.role = 'admin';
      else if (u.username === 'meet' || u.username === 'harsh') u.role = 'user';
    });

    if (!memoryStore.expenses || memoryStore.expenses.length === 0) {
      memoryStore.expenses = expensesToSeed;
    }
    if (!memoryStore.categories || memoryStore.categories.length === 0) {
      memoryStore.categories = defaultCategories.map((c, idx) => ({ _id: 'cat_' + (idx + 1), id: 'cat_' + (idx + 1), ...c }));
    }
    if (!memoryStore.budgets || memoryStore.budgets.length === 0) {
      memoryStore.budgets = initialBudgets;
    }
    saveLocalStore();
    console.log('✅ Memory Data Store initialized!');
  }

};

if (require.main === module) {
  seedData().then(() => {
    console.log('🎉 Seeding script execution complete.');
    process.exit(0);
  });
}

module.exports = seedData;
