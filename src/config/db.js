const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

let isMongoConnected = false;
const PROJECT_DATA_FILE = path.join(__dirname, '../../data_store.json');
const TMP_DATA_FILE = path.join('/tmp', 'data_store.json');

// Memory Data Store fallback
const memoryStore = {
  users: [],
  expenses: [],
  categories: [],
  budgets: [],
  activityLogs: []
};

// Global cache object for serverless (Vercel) function re-use
let cached = global.mongooseCache;
if (!cached) {
  cached = global.mongooseCache = { conn: null, promise: null };
}

// Load initial local store if exists (Read-only on Vercel)
function loadLocalStore() {
  try {
    if (memoryStore.users.length > 0) return; // Already loaded

    let raw = null;
    if (fs.existsSync(TMP_DATA_FILE)) {
      raw = fs.readFileSync(TMP_DATA_FILE, 'utf8');
    } else if (fs.existsSync(PROJECT_DATA_FILE)) {
      raw = fs.readFileSync(PROJECT_DATA_FILE, 'utf8');
    } else {
      try {
        const bundled = require('../../data_store.json');
        memoryStore.users = bundled.users || [];
        memoryStore.expenses = bundled.expenses || [];
        memoryStore.categories = bundled.categories || [];
        memoryStore.budgets = bundled.budgets || [];
        memoryStore.activityLogs = bundled.activityLogs || [];
        return;
      } catch (e) {
        console.warn('Bundled store notice:', e.message);
      }
    }

    if (raw) {
      const data = JSON.parse(raw);
      memoryStore.users = data.users || [];
      memoryStore.expenses = data.expenses || [];
      memoryStore.categories = data.categories || [];
      memoryStore.budgets = data.budgets || [];
      memoryStore.activityLogs = data.activityLogs || [];
    }
  } catch (err) {
    console.error('Error loading local data store:', err);
  }
}

function saveLocalStore() {
  const isVercel = !!(process.env.VERCEL || process.env.NOW_BUILDER);
  // Never attempt filesystem write in production serverless environment
  if (isVercel) {
    return;
  }

  try {
    const dir = path.dirname(PROJECT_DATA_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(PROJECT_DATA_FILE, JSON.stringify(memoryStore, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving local data store:', err.message);
  }
}

const connectDB = async () => {
  if (cached.conn && mongoose.connection.readyState === 1) {
    isMongoConnected = true;
    return cached.conn;
  }

  const isVercel = !!(process.env.VERCEL || process.env.NOW_BUILDER);
  const connUri = process.env.MONGODB_URI;

  if (!connUri) {
    if (isVercel) {
      console.warn('⚠️ MONGODB_URI environment variable is missing in Vercel settings.');
      isMongoConnected = false;
      loadLocalStore();
      return null;
    }
    // Local development fallback URI
    const localUri = 'mongodb://127.0.0.1:27017/expense_tracker';
    try {
      if (!cached.promise) {
        cached.promise = mongoose.connect(localUri, {
          serverSelectionTimeoutMS: 2000
        });
      }
      cached.conn = await cached.promise;
      isMongoConnected = true;
      console.log('✅ Local MongoDB Connected successfully.');
      return cached.conn;
    } catch (err) {
      cached.promise = null;
      isMongoConnected = false;
      console.warn('⚠️ Local MongoDB connection unavailable:', err.message);
      loadLocalStore();
      return null;
    }
  }

  try {
    if (!cached.promise) {
      console.log('Connecting to MongoDB Atlas / Cloud database...');
      cached.promise = mongoose.connect(connUri, {
        bufferCommands: false,
        serverSelectionTimeoutMS: 5000
      }).then((m) => m);
    }

    cached.conn = await cached.promise;
    isMongoConnected = true;
    console.log('✅ Production MongoDB Connected successfully.');
    return cached.conn;
  } catch (err) {
    cached.promise = null;
    isMongoConnected = false;
    console.error('❌ MongoDB Connection Error:', err.message);
    loadLocalStore();
    return null;
  }
};

const getMongoStatus = () => isMongoConnected;

module.exports = {
  connectDB,
  getMongoStatus,
  memoryStore,
  saveLocalStore,
  loadLocalStore
};
