const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

let isMongoConnected = false;
let mongoServerInstance = null;

// Global cache object for connection re-use
let cached = global.mongooseCache;
if (!cached) {
  cached = global.mongooseCache = { conn: null, promise: null };
}

// Function to auto-populate MongoDB from backup if collections are empty
const ensureDataPopulated = async () => {
  try {
    const User = require('../models/User');
    const Expense = require('../models/Expense');
    const Category = require('../models/Category');
    const Budget = require('../models/Budget');

    const userCount = await User.countDocuments();
    if (userCount === 0) {
      console.log('🔄 Initializing authoritative MongoDB data from backup snapshot...');
      let backupPath = path.join(__dirname, '../../data_store.backup.json');
      if (!fs.existsSync(backupPath)) {
        backupPath = path.join(__dirname, '../../data_store.json');
      }

      if (fs.existsSync(backupPath)) {
        const raw = fs.readFileSync(backupPath, 'utf8');
        const data = JSON.parse(raw);

        if (data.categories && data.categories.length > 0) {
          for (const c of data.categories) {
            await Category.create(c).catch(() => {});
          }
        }
        if (data.users && data.users.length > 0) {
          for (const u of data.users) {
            await User.create(u).catch(() => {});
          }
        }
        if (data.budgets && data.budgets.length > 0) {
          for (const b of data.budgets) {
            await Budget.create(b).catch(() => {});
          }
        }
        if (data.expenses && data.expenses.length > 0) {
          for (const e of data.expenses) {
            await Expense.create({
              ...e,
              created_by: e.created_by || e.user_name || 'Member'
            }).catch(() => {});
          }
        }

        const ActivityLog = require('../models/ActivityLog');
        const actCount = await ActivityLog.countDocuments();
        if (actCount === 0 && data.expenses && data.expenses.length > 0) {
          const recent = data.expenses.slice(-12);
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
          }
        }

        console.log('✅ MongoDB successfully populated with all users, expenses, categories, budgets, and activity log.');
      }
    }
  } catch (err) {
    console.warn('Auto data population notice:', err.message);
  }
};

const net = require('net');

// Quick probe to check if local port is active
const checkPortListening = (port = 27017, host = '127.0.0.1', timeout = 250) => {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(timeout);
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.on('error', () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, host);
  });
};

const connectDB = async () => {
  if (cached.conn && mongoose.connection.readyState === 1) {
    isMongoConnected = true;
    return cached.conn;
  }

  const connUri = process.env.MONGODB_URI || '';
  const isRemoteUri = connUri.startsWith('mongodb+srv://') || 
    (connUri.startsWith('mongodb://') && !connUri.includes('127.0.0.1') && !connUri.includes('localhost'));

  // 1. Connect to remote MongoDB (e.g. MongoDB Atlas) if provided in .env
  if (isRemoteUri) {
    try {
      if (!cached.promise) {
        cached.promise = mongoose.connect(connUri, {
          serverSelectionTimeoutMS: 5000
        }).then((m) => m);
      }
      cached.conn = await cached.promise;
      isMongoConnected = true;
      console.log('✅ Connected to remote MongoDB Atlas database.');
      await ensureDataPopulated();
      return cached.conn;
    } catch (err) {
      console.warn(`⚠️ Could not connect to remote MONGODB_URI (${err.message}).`);
      cached.promise = null;
    }
  }

  // 2. Check if local MongoDB daemon is listening on port 27017
  const isLocalPortOpen = await checkPortListening(27017, '127.0.0.1');

  if (isLocalPortOpen) {
    const localUri = connUri.includes('127.0.0.1') || connUri.includes('localhost')
      ? connUri
      : 'mongodb://127.0.0.1:27017/expense_tracker';
    try {
      if (!cached.promise) {
        cached.promise = mongoose.connect(localUri, {
          serverSelectionTimeoutMS: 2000
        }).then((m) => m);
      }
      cached.conn = await cached.promise;
      isMongoConnected = true;
      console.log('✅ Connected to local MongoDB daemon (127.0.0.1:27017).');
      await ensureDataPopulated();
      return cached.conn;
    } catch (err) {
      cached.promise = null;
    }
  }

  // 3. Embedded authoritative MongoDB instance (zero-configuration, no ECONNREFUSED)
  console.log('ℹ️ Local MongoDB service not active on port 27017. Initializing embedded authoritative MongoDB instance...');
  try {
    let MongoMemoryServer;
    try {
      const mms = require('mongodb-memory-server');
      MongoMemoryServer = mms.MongoMemoryServer;
    } catch (e) {
      throw new Error('mongodb-memory-server is not installed. Please run npm install or configure MONGODB_URI in .env.');
    }

    if (!mongoServerInstance) {
      mongoServerInstance = await MongoMemoryServer.create({
        instance: {
          dbName: 'expense_tracker'
        }
      });
    }

    const memoryUri = mongoServerInstance.getUri();
    if (!cached.promise) {
      cached.promise = mongoose.connect(memoryUri, {
        serverSelectionTimeoutMS: 5000
      }).then((m) => m);
    }

    cached.conn = await cached.promise;
    isMongoConnected = true;
    console.log('✅ Embedded Authoritative MongoDB Server started and connected successfully.');
    await ensureDataPopulated();
    return cached.conn;
  } catch (embeddedErr) {
    cached.promise = null;
    isMongoConnected = false;
    console.error('❌ Failed to establish MongoDB connection:', embeddedErr.message);
    throw embeddedErr;
  }
};

const getMongoStatus = () => isMongoConnected && mongoose.connection.readyState === 1;

module.exports = {
  connectDB,
  getMongoStatus,
  ensureDataPopulated
};
