const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

const { connectDB, getMongoStatus, getDiagnosticInfo } = require('./config/db');

const authRoutes = require('./routes/authRoutes');
const expenseRoutes = require('./routes/expenseRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const budgetRoutes = require('./routes/budgetRoutes');
const userRoutes = require('./routes/userRoutes');
const reportRoutes = require('./routes/reportRoutes');
const activityRoutes = require('./routes/activityRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || true,
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Database connection assurance middleware for API routes
app.use('/api', async (req, res, next) => {
  if (req.path === '/health') return next();

  if (!getMongoStatus()) {
    try {
      await connectDB();
    } catch (err) {
      console.error('Database connection error during API request:', err.message);
    }
  }

  if (!getMongoStatus()) {
    const diagnostic = getDiagnosticInfo();
    return res.status(503).json({
      success: false,
      message: 'MongoDB Atlas connection failed. Please check MONGODB_URI and Atlas network access.',
      database: 'unavailable',
      reason: diagnostic.reason || 'Database connection offline'
    });
  }
  next();
});

// Health check endpoint (Item 11 specification)
app.get('/api/health', async (req, res) => {
  if (!getMongoStatus()) {
    try {
      await connectDB();
    } catch (err) {
      console.error('Health check DB connection attempt error:', err.message);
    }
  }

  const isConnected = getMongoStatus();
  const diagnostic = getDiagnosticInfo();

  if (isConnected) {
    return res.status(200).json({
      status: 'online',
      database: 'connected',
      system: 'Smart Personal Expense Management System',
      architecture: 'MERN Stack (MongoDB + Express + React + Node.js)',
      timestamp: new Date()
    });
  }

  return res.status(503).json({
    status: 'degraded',
    database: 'disconnected',
    system: 'Smart Personal Expense Management System',
    architecture: 'MERN Stack (MongoDB + Express + React + Node.js)',
    diagnostics: {
      configured: diagnostic.configured,
      uriType: diagnostic.uriType,
      reason: diagnostic.reason || 'Database unavailable'
    },
    timestamp: new Date()
  });
});

// Mount API Routes
app.use('/api/auth', authRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/budgets', budgetRoutes);
app.use('/api/users', userRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/activity', activityRoutes);

// Static uploads directory for receipts
const serverUploadsDir = path.join(__dirname, 'uploads');
const publicUploadsDir = path.join(__dirname, '../public/uploads');

if (fs.existsSync(serverUploadsDir)) {
  app.use('/uploads', express.static(serverUploadsDir));
}
if (fs.existsSync(publicUploadsDir)) {
  app.use('/uploads', express.static(publicUploadsDir));
}

// Undefined API handler
app.use('/api/*', (req, res) => {
  res.status(404).json({ success: false, message: 'API route not found' });
});

// Production: Serve Vite React frontend build from client/dist if available
const clientDistPath = path.join(__dirname, '../client/dist');
const legacyPublicPath = path.join(__dirname, '../public');

if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
} else if (fs.existsSync(legacyPublicPath)) {
  app.use(express.static(legacyPublicPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(legacyPublicPath, 'index.html'));
  });
}

// Global Central Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  const statusCode = err.status || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || 'An internal server error occurred.',
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

module.exports = app;

// Auto-start server if executed directly
if (require.main === module) {
  connectDB().then(() => {
    app.listen(PORT, () => {
      console.log(`========================================================`);
      console.log(`🚀 Smart Expense MERN Backend Server running on port ${PORT}`);
      console.log(`🌐 Server Base URL: http://localhost:${PORT}`);
      console.log(`========================================================`);
    });
  }).catch((err) => {
    console.error('Failed to start server:', err);
  });
}
