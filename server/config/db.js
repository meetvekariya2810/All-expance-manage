const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

try {
  require('dotenv').config({ path: path.join(__dirname, '../../.env') });
} catch (e) {}

// Disable Mongoose command buffering so queries fail fast when connection is down
mongoose.set('bufferCommands', false);

let isMongoConnected = false;
let mongoServerInstance = null;

// Global cache object for connection re-use across serverless invocations
let cached = global.mongooseCache;
if (!cached) {
  cached = global.mongooseCache = { conn: null, promise: null };
}

// Persistent tombstone tracking for deleted expenses
const TOMBSTONE_FILE = path.join(__dirname, '../../.deleted_expenses.json');

const loadDeletedIds = () => {
  try {
    if (fs.existsSync(TOMBSTONE_FILE)) {
      const raw = fs.readFileSync(TOMBSTONE_FILE, 'utf8');
      const list = JSON.parse(raw);
      if (Array.isArray(list)) return list.map(String);
    }
  } catch (e) {}
  return [];
};

const recordDeletedExpenseId = (id) => {
  if (!id) return;
  try {
    const list = loadDeletedIds();
    const idStr = String(id);
    if (!list.includes(idStr)) {
      list.push(idStr);
      fs.writeFileSync(TOMBSTONE_FILE, JSON.stringify(list, null, 2), 'utf8');
    }
  } catch (e) {
    console.warn('Tombstone save notice:', e.message);
  }
};

const isExpenseDeleted = (id) => {
  if (!id) return false;
  const list = loadDeletedIds();
  return list.includes(String(id));
};

// Safe Initial Seed: ONLY run if the database is 100% brand new (0 users)
// Never resets, overwrites, or recreates deleted expenses
const ensureInitialData = async () => {
  try {
    const User = require('../models/User');
    const Expense = require('../models/Expense');
    const Category = require('../models/Category');
    const Budget = require('../models/Budget');

    const userCount = await User.countDocuments();
    if (userCount > 0) {
      // Database already has users - DO NOT TOUCH OR OVERWRITE
      return;
    }

    console.log('🔄 First-time setup: Initializing baseline records in MongoDB...');

    // Locate baseline snapshot
    let seedData = null;
    const candidates = [
      path.join(__dirname, '../../data_store.json'),
      path.join(__dirname, '../../data_store.backup.json')
    ];

    for (const p of candidates) {
      if (fs.existsSync(p)) {
        try {
          const raw = fs.readFileSync(p, 'utf8');
          const parsed = JSON.parse(raw);
          if (parsed && parsed.users && parsed.users.length > 0) {
            seedData = parsed;
            break;
          }
        } catch (e) {}
      }
    }

    if (!seedData) return;

    // 1. Categories
    if (Array.isArray(seedData.categories) && seedData.categories.length > 0) {
      for (const c of seedData.categories) {
        const catName = c.category_name || c.name;
        if (!catName) continue;
        const exists = await Category.findOne({ category_name: catName });
        if (!exists) {
          await Category.create(c).catch(() => {});
        }
      }
    }

    // 2. Users (Bhavik Admin, Meet, Harsh)
    if (Array.isArray(seedData.users) && seedData.users.length > 0) {
      for (const u of seedData.users) {
        const exists = await User.findOne({ username: u.username.toLowerCase() });
        if (!exists) {
          await User.create(u).catch(() => {});
        }
      }
    }

    // 3. Budgets
    if (Array.isArray(seedData.budgets) && seedData.budgets.length > 0) {
      for (const b of seedData.budgets) {
        const exists = await Budget.findOne({ user_id: b.user_id, month: b.month });
        if (!exists) {
          await Budget.create(b).catch(() => {});
        }
      }
    }

    // 4. Expenses (Skip any deleted tombstones)
    const deletedList = loadDeletedIds();
    if (Array.isArray(seedData.expenses) && seedData.expenses.length > 0) {
      for (const exp of seedData.expenses) {
        const ids = [String(exp._id), String(exp.id), String(exp.expense_id)];
        if (ids.some(id => deletedList.includes(id) || isExpenseDeleted(id))) {
          continue; // Permanently skip deleted expenses
        }

        const exists = await Expense.findOne({
          $or: [{ _id: exp._id }, { id: exp.id }, { expense_id: exp.expense_id }]
        });
        if (!exists) {
          await Expense.create({
            ...exp,
            created_by: exp.created_by || exp.user_name || 'Member'
          }).catch(() => {});
        }
      }
    }

    console.log('✅ Baseline initialization complete in MongoDB.');
  } catch (err) {
    console.warn('Initial data setup notice:', err.message);
  }
};

// Wire Mongoose connection event listeners
mongoose.connection.on('connected', () => {
  isMongoConnected = true;
});

mongoose.connection.on('error', (err) => {
  isMongoConnected = false;
  console.error('⚠️ MongoDB connection error:', err.message);
});

mongoose.connection.on('disconnected', () => {
  isMongoConnected = false;
  console.warn('⚠️ MongoDB disconnected.');
});

/**
 * Connect to MongoDB (Atlas as Primary Source of Truth)
 * Reads process.env.MONGODB_URI.
 * Connects once and re-uses connection across invocations.
 */
const connectDB = async () => {
  if (cached.conn && mongoose.connection.readyState === 1) {
    isMongoConnected = true;
    return cached.conn;
  }

  const connUri = (process.env.MONGODB_URI || '').trim();
  const isRemoteUri = connUri.startsWith('mongodb+srv://') || 
    (connUri.startsWith('mongodb://') && !connUri.includes('127.0.0.1') && !connUri.includes('localhost'));

  // 1. Remote MongoDB Atlas Connection
  if (isRemoteUri) {
    try {
      if (!cached.promise) {
        cached.promise = mongoose.connect(connUri, {
          serverSelectionTimeoutMS: 5000,
          connectTimeoutMS: 5000,
          bufferCommands: false
        }).then((m) => m);
      }
      cached.conn = await cached.promise;
      isMongoConnected = true;
      const maskedUri = connUri.replace(/:([^@]+)@/, ':****@');
      console.log(`✅ MongoDB connected successfully to authoritative database [${maskedUri}]`);
      await ensureInitialData();
      return cached.conn;
    } catch (err) {
      cached.promise = null;
      isMongoConnected = false;
      console.error('❌ MongoDB Atlas connection failed.');
      console.error(`   Error details: ${err.message}`);
      console.error('   Please check MONGODB_URI, Atlas user credentials, and Network Access (IP Whitelist).');
      return null;
    }
  }

  // 2. In serverless (Vercel) or production without remote URI -> fail cleanly without crashing
  const isServerless = !!(process.env.VERCEL || process.env.NOW_BUILDER || process.env.AWS_LAMBDA_FUNCTION_NAME);
  if (isServerless || process.env.NODE_ENV === 'production') {
    isMongoConnected = false;
    console.error('❌ MONGODB_URI is required in Vercel environment variables.');
    return null;
  }

  // 3. Local Development Mode
  try {
    // If user provided a local URI, attempt connection
    if (connUri && (connUri.includes('127.0.0.1') || connUri.includes('localhost'))) {
      try {
        if (!cached.promise) {
          cached.promise = mongoose.connect(connUri, {
            serverSelectionTimeoutMS: 1500,
            bufferCommands: false
          }).then(m => m);
        }
        cached.conn = await cached.promise;
        isMongoConnected = true;
        console.log(`✅ Connected to local MongoDB instance: ${connUri}`);
        await ensureInitialData();
        return cached.conn;
      } catch (localErr) {
        cached.promise = null;
      }
    }

    // Local persistent embedded MongoDB instance for offline development
    let MongoMemoryServer;
    try {
      MongoMemoryServer = require('mongodb-memory-server').MongoMemoryServer;
    } catch (mmsErr) {
      console.warn('Development embedded MongoDB server module not loaded.');
      return null;
    }
    if (!mongoServerInstance) {
      const localDbPath = path.join(__dirname, '../../.mongo_data');
      if (!fs.existsSync(localDbPath)) fs.mkdirSync(localDbPath, { recursive: true });
      try {
        mongoServerInstance = await MongoMemoryServer.create({
          instance: { dbPath: localDbPath, dbName: 'expense_tracker' }
        });
        console.log('💾 Development MongoDB storage active at .mongo_data');
      } catch (e) {
        mongoServerInstance = await MongoMemoryServer.create({
          instance: { dbName: 'expense_tracker' }
        });
      }
    }

    const devUri = mongoServerInstance.getUri();
    if (!cached.promise) {
      cached.promise = mongoose.connect(devUri, {
        serverSelectionTimeoutMS: 5000,
        bufferCommands: false
      }).then(m => m);
    }
    cached.conn = await cached.promise;
    isMongoConnected = true;
    console.log('✅ Development MongoDB engine connected successfully.');
    await ensureInitialData();
    return cached.conn;
  } catch (devErr) {
    cached.promise = null;
    isMongoConnected = false;
    console.error('❌ Development database initialization failed:', devErr.message);
    return null;
  }
};

const getMongoStatus = () => isMongoConnected && mongoose.connection.readyState === 1;

// Legacy compatibility helpers (ensuring no memory store overwriting)
const memoryStore = { users: [], expenses: [], categories: [], budgets: [], activityLogs: [] };
const saveLocalStore = () => {};
const loadLocalStore = () => {};
const syncExpenseStore = (action, payload) => {
  if (action === 'delete' && payload) {
    recordDeletedExpenseId(payload);
  } else if (action === 'bulk_delete' && Array.isArray(payload)) {
    payload.forEach(id => recordDeletedExpenseId(id));
  }
};

module.exports = {
  connectDB,
  getMongoStatus,
  ensureInitialData,
  isExpenseDeleted,
  recordDeletedExpenseId,
  syncExpenseStore,
  memoryStore,
  saveLocalStore,
  loadLocalStore
};
