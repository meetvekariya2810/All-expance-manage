const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { connectDB } = require('../server/config/db');
const User = require('../server/models/User');
const Expense = require('../server/models/Expense');
const Category = require('../server/models/Category');
const Budget = require('../server/models/Budget');

const runMigration = async () => {
  console.log('====================================================');
  console.log('📦 Starting Data Migration: JSON -> MongoDB (Authoritative)');
  console.log('====================================================');

  await connectDB();

  // 1. Locate source JSON file with the fullest data
  const jsonPath = path.join(__dirname, '../data_store.json');
  const backupPath = path.join(__dirname, '../data_store.backup.json');

  let sourcePath = backupPath;
  if (fs.existsSync(backupPath) && fs.existsSync(jsonPath)) {
    try {
      const bData = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
      const jData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      sourcePath = (bData.expenses && bData.expenses.length >= (jData.expenses ? jData.expenses.length : 0)) ? backupPath : jsonPath;
    } catch (e) {
      sourcePath = fs.existsSync(backupPath) ? backupPath : jsonPath;
    }
  } else if (fs.existsSync(backupPath)) {
    sourcePath = backupPath;
  } else if (fs.existsSync(jsonPath)) {
    sourcePath = jsonPath;
  }

  if (!sourcePath || !fs.existsSync(sourcePath)) {
    console.error('❌ Source data file (data_store.json / data_store.backup.json) not found!');
    process.exit(1);
  }

  // Ensure backup snapshot exists
  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(sourcePath, backupPath);
    console.log('💾 Verified safe data snapshot in data_store.backup.json');
  }

  const raw = fs.readFileSync(sourcePath, 'utf8');
  const data = JSON.parse(raw);

  const rawUsers = data.users || [];
  const rawExpenses = data.expenses || [];
  const rawCategories = data.categories || [];
  const rawBudgets = data.budgets || [];

  console.log(`🔍 Detected in source: ${rawUsers.length} users, ${rawExpenses.length} expenses, ${rawCategories.length} categories, ${rawBudgets.length} budgets.`);

  let usersMigrated = 0;
  let expensesMigrated = 0;
  let categoriesMigrated = 0;
  let budgetsMigrated = 0;

  // 2. Migrate Categories
  for (const cat of rawCategories) {
    const catName = cat.category_name || cat.name;
    if (!catName) continue;

    const existing = await Category.findOne({ category_name: catName });
    if (!existing) {
      await Category.create({
        _id: cat._id || cat.id || ('cat_' + Date.now() + '_' + Math.floor(Math.random() * 1000)),
        id: cat.id || cat._id,
        category_name: catName,
        icon: cat.icon || 'fa-tags',
        status: cat.status || 'active',
        is_default: cat.is_default !== undefined ? cat.is_default : true
      });
      categoriesMigrated++;
    } else {
      categoriesMigrated++;
    }
  }

  // 3. Migrate Users
  const passwordCache = {
    admin: await bcrypt.hash('admin123', 10),
    bhavik: await bcrypt.hash('bhavik123', 10),
    meet: await bcrypt.hash('meet123', 10),
    harsh: await bcrypt.hash('harsh123', 10)
  };

  for (const u of rawUsers) {
    const existing = await User.findOne({ 
      $or: [{ _id: u._id }, { id: u.id }, { username: u.username.toLowerCase() }] 
    });

    let validPassword = u.password;
    if (!validPassword || (!validPassword.startsWith('$2a$') && !validPassword.startsWith('$2b$'))) {
      const usernameLower = (u.username || '').toLowerCase();
      validPassword = passwordCache[usernameLower] || await bcrypt.hash(validPassword || `${usernameLower}123`, 10);
    }

    if (!existing) {
      await User.create({
        _id: u._id || u.id || ('usr_' + u.username + '_' + Date.now().toString().slice(-4)),
        id: u.id || u._id,
        name: u.name,
        email: (u.email || `${u.username}@expense.com`).toLowerCase(),
        mobile: u.mobile || '',
        username: u.username.toLowerCase(),
        password: validPassword,
        role: u.role || 'user',
        profile_image: u.profile_image || '/uploads/default-avatar.png',
        status: u.status || 'active',
        created_at: u.created_at ? new Date(u.created_at) : new Date()
      });
      usersMigrated++;
    } else {
      // Ensure existing has properly formatted id
      if (!existing.id) {
        existing.id = existing._id;
        await existing.save();
      }
      usersMigrated++;
    }
  }

  // 4. Migrate Budgets
  for (const b of rawBudgets) {
    const existing = await Budget.findOne({ user_id: b.user_id, month: b.month });
    if (!existing) {
      await Budget.create({
        _id: b._id || b.id || ('bgt_' + Date.now() + '_' + Math.floor(Math.random() * 1000)),
        id: b.id || b._id,
        user_id: b.user_id,
        month: b.month,
        budget_amount: parseFloat(b.budget_amount) || 0,
        created_at: b.created_at ? new Date(b.created_at) : new Date()
      });
      budgetsMigrated++;
    } else {
      budgetsMigrated++;
    }
  }

  // 5. Migrate Expenses (Preserve all 39 records)
  for (const exp of rawExpenses) {
    const existing = await Expense.findOne({
      $or: [
        { _id: exp._id },
        { id: exp.id },
        { expense_id: exp.expense_id }
      ]
    });

    if (!existing) {
      await Expense.create({
        _id: exp._id || exp.id || ('exp_' + Date.now() + '_' + Math.floor(Math.random() * 10000)),
        id: exp.id || exp._id,
        expense_id: exp.expense_id,
        user_id: exp.user_id,
        user_name: exp.user_name || 'Member',
        title: exp.title,
        description: exp.description || '',
        category: exp.category,
        amount: parseFloat(exp.amount) || 0,
        payment_method: exp.payment_method || 'UPI',
        vendor: exp.vendor || '',
        location: exp.location || '',
        receipt: exp.receipt || '',
        notes: exp.notes || '',
        expense_date: exp.expense_date,
        expense_time: exp.expense_time || '12:00',
        created_by: exp.created_by || exp.user_name || 'Member',
        created_at: exp.created_at ? new Date(exp.created_at) : new Date(),
        updated_at: exp.updated_at ? new Date(exp.updated_at) : new Date()
      });
      expensesMigrated++;
    } else {
      if (!existing.created_by) {
        existing.created_by = existing.user_name || 'Member';
        await existing.save();
      }
      expensesMigrated++;
    }
  }

  // 6. Migrate Activity Logs if empty
  const ActivityLog = require('../server/models/ActivityLog');
  const actCount = await ActivityLog.countDocuments();
  let activitiesMigrated = actCount;
  if (actCount === 0 && rawExpenses.length > 0) {
    const recent = rawExpenses.slice(-15);
    for (const e of recent) {
      await ActivityLog.create({
        user_id: e.user_id,
        user_name: e.user_name || 'Member',
        action: 'Expense Added',
        expense_id: e.expense_id || e.id,
        amount: parseFloat(e.amount) || 0,
        category: e.category || 'General',
        title: e.title,
        details: `${e.user_name || 'Member'} added ₹${(parseFloat(e.amount) || 0).toLocaleString('en-IN')} for ${e.category || 'General'}`,
        type: 'create',
        timestamp: e.created_at ? new Date(e.created_at) : new Date()
      }).catch(() => {});
      activitiesMigrated++;
    }
  }

  console.log('\n====================================================');
  console.log('✅ DATABASE MIGRATION SUMMARY');
  console.log('====================================================');
  console.log(`Users migrated: ${usersMigrated}`);
  console.log(`Expenses migrated: ${expensesMigrated}`);
  console.log(`Categories migrated: ${categoriesMigrated}`);
  console.log(`Budgets migrated: ${budgetsMigrated}`);
  console.log('Migration completed successfully.');
  console.log('====================================================');

  process.exit(0);
};

runMigration().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
