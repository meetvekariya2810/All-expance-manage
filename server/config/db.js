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

// Persistent tombstone tracking for deleted expenses (safely handles serverless read-only filesystems)
const TOMBSTONE_FILE = path.join(__dirname, '../../.deleted_expenses.json');
const inMemoryDeletedIds = new Set();

const loadDeletedIds = () => {
  const ids = new Set(inMemoryDeletedIds);
  try {
    if (fs.existsSync(TOMBSTONE_FILE)) {
      const raw = fs.readFileSync(TOMBSTONE_FILE, 'utf8');
      const list = JSON.parse(raw);
      if (Array.isArray(list)) list.forEach(id => ids.add(String(id)));
    }
  } catch (e) {}
  return Array.from(ids);
};

const recordDeletedExpenseId = (id) => {
  if (!id) return;
  const idStr = String(id);
  inMemoryDeletedIds.add(idStr);
  try {
    const list = loadDeletedIds();
    if (!list.includes(idStr)) {
      list.push(idStr);
    }
    fs.writeFileSync(TOMBSTONE_FILE, JSON.stringify(list, null, 2), 'utf8');
  } catch (e) {
    // Read-only filesystem in serverless environments is expected; in-memory set will retain tombstones
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

const sanitizeUri = (raw) => {
  if (!raw || typeof raw !== 'string') return '';
  let uri = raw.trim();
  // Strip enclosing double or single quotes
  if ((uri.startsWith('"') && uri.endsWith('"')) || (uri.startsWith("'") && uri.endsWith("'"))) {
    uri = uri.slice(1, -1).trim();
  }
  return uri;
};

const maskUri = (uri) => {
  if (!uri || typeof uri !== 'string') return '';
  return uri.replace(/:([^@]+)@/, ':****@');
};

let connectionDiagnostic = {
  configured: false,
  uriType: 'none',
  status: 'disconnected',
  reason: '',
  lastChecked: null
};

const getDiagnosticInfo = () => ({
  ...connectionDiagnostic,
  isConnected: isMongoConnected && mongoose.connection.readyState === 1,
  readyState: mongoose.connection.readyState
});

/**
 * Connect to MongoDB (Atlas as Primary Source of Truth)
 * Reads process.env.MONGODB_URI.
 * Connects once and re-uses connection across invocations.
 */
const connectDB = async () => {
  connectionDiagnostic.lastChecked = new Date();

  if (cached.conn && mongoose.connection.readyState === 1) {
    isMongoConnected = true;
    connectionDiagnostic.status = 'connected';
    return cached.conn;
  }

  const isServerless = !!(process.env.VERCEL || process.env.NOW_BUILDER || process.env.AWS_LAMBDA_FUNCTION_NAME);
  const rawUri = process.env.MONGODB_URI;
  const connUri = sanitizeUri(rawUri);

  // 1. Missing URI check
  if (!connUri) {
    connectionDiagnostic = {
      configured: false,
      uriType: 'none',
      status: 'missing_uri',
      reason: 'MONGODB_URI is not defined in environment variables',
      lastChecked: new Date()
    };
    if (isServerless || process.env.NODE_ENV === 'production') {
      isMongoConnected = false;
      console.error('❌ MONGODB_URI is missing or empty in Vercel environment variables.');
      console.error('👉 Please configure MONGODB_URI in Vercel Dashboard -> Settings -> Environment Variables.');
      return null;
    }
  }

  // 2. Unreplaced placeholder check (<...> brackets)
  if (connUri && (connUri.includes('<') || connUri.includes('>'))) {
    connectionDiagnostic = {
      configured: true,
      uriType: 'placeholder',
      status: 'placeholder_detected',
      reason: 'MONGODB_URI contains unreplaced placeholder brackets (< or >)',
      lastChecked: new Date()
    };
    isMongoConnected = false;
    console.error('❌ MONGODB_URI contains unreplaced placeholder brackets (< or >).');
    console.error('👉 Please replace placeholder brackets like <password> with your real MongoDB Atlas credentials in Vercel.');
    return null;
  }

  // 3. Local URI check in production / serverless
  const isLocalUri = connUri && (connUri.includes('127.0.0.1') || connUri.includes('localhost'));
  if (isLocalUri && (isServerless || process.env.NODE_ENV === 'production')) {
    connectionDiagnostic = {
      configured: true,
      uriType: 'localhost',
      status: 'local_in_production',
      reason: 'Local MongoDB URI (127.0.0.1/localhost) configured in production Vercel deployment',
      lastChecked: new Date()
    };
    isMongoConnected = false;
    console.error('❌ Invalid MONGODB_URI in Vercel production: local URI (127.0.0.1/localhost) detected.');
    console.error('👉 Vercel serverless functions cannot connect to localhost. Please use a MongoDB Atlas connection string (mongodb+srv://...).');
    return null;
  }

  const isRemoteUri = connUri && (connUri.startsWith('mongodb+srv://') || connUri.startsWith('mongodb://')) && !isLocalUri;

  // 4. Remote MongoDB Atlas Connection
  if (isRemoteUri) {
    connectionDiagnostic.configured = true;
    connectionDiagnostic.uriType = connUri.startsWith('mongodb+srv://') ? 'mongodb+srv' : 'mongodb';

    try {
      if (!cached.promise) {
        cached.promise = mongoose.connect(connUri, {
          serverSelectionTimeoutMS: 8000,
          connectTimeoutMS: 8000,
          bufferCommands: false
        }).then((m) => m);
      }
      cached.conn = await cached.promise;
      isMongoConnected = true;
      connectionDiagnostic.status = 'connected';
      connectionDiagnostic.reason = 'Connected successfully';
      const maskedUri = maskUri(connUri);
      console.log(`✅ MongoDB connected successfully to authoritative database [${maskedUri}]`);
      await ensureInitialData();
      return cached.conn;
    } catch (err) {
      cached.promise = null;
      isMongoConnected = false;
      connectionDiagnostic.status = 'connection_failed';
      connectionDiagnostic.reason = err.message;

      console.error('❌ MongoDB Atlas connection failed.');
      console.error(`   Error Name: ${err.name}`);
      console.error(`   Error Message: ${err.message}`);
      const maskedUri = maskUri(connUri);
      console.error(`   Target URI: ${maskedUri}`);

      if (err.message.includes('bad auth') || err.message.includes('Authentication failed')) {
        console.error('   👉 Diagnostic Hint: Authentication failed. Please verify the Atlas database username and password in Vercel MONGODB_URI.');
      } else if (err.message.includes('querySrv') || err.message.includes('ENOTFOUND')) {
        console.error('   👉 Diagnostic Hint: Cluster host not found. Please verify the cluster domain name in Vercel MONGODB_URI.');
      } else if (err.message.includes('timed out') || err.message.includes('selection timed out')) {
        console.error('   👉 Diagnostic Hint: Connection timed out. Ensure MongoDB Atlas -> Network Access allows 0.0.0.0/0 (Allow access from anywhere).');
      }
      return null;
    }
  }

  // 5. In serverless or production without valid remote URI -> fail cleanly
  if (isServerless || process.env.NODE_ENV === 'production') {
    isMongoConnected = false;
    connectionDiagnostic.status = 'invalid_production_uri';
    connectionDiagnostic.reason = 'A valid MongoDB Atlas URI (mongodb+srv://...) is required in Vercel production';
    console.error('❌ A valid MongoDB Atlas URI (mongodb+srv://...) is required in Vercel environment variables.');
    return null;
  }

  // 6. Local Development Mode (Offline fallback / Embedded dev DB)
  try {
    if (connUri && isLocalUri) {
      try {
        if (!cached.promise) {
          cached.promise = mongoose.connect(connUri, {
            serverSelectionTimeoutMS: 2000,
            bufferCommands: false
          }).then(m => m);
        }
        cached.conn = await cached.promise;
        isMongoConnected = true;
        connectionDiagnostic.status = 'connected';
        console.log(`✅ Connected to local MongoDB instance: ${connUri}`);
        await ensureInitialData();
        return cached.conn;
      } catch (localErr) {
        cached.promise = null;
      }
    }

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
    connectionDiagnostic.status = 'connected';
    console.log('✅ Development MongoDB engine connected successfully.');
    await ensureInitialData();
    return cached.conn;
  } catch (devErr) {
    cached.promise = null;
    isMongoConnected = false;
    connectionDiagnostic.status = 'connection_failed';
    connectionDiagnostic.reason = devErr.message;
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
  getDiagnosticInfo,
  sanitizeUri,
  maskUri,
  ensureInitialData,
  isExpenseDeleted,
  recordDeletedExpenseId,
  syncExpenseStore,
  memoryStore,
  saveLocalStore,
  loadLocalStore
};
