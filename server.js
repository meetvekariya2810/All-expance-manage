const app = require('./server/server');
const { connectDB } = require('./server/config/db');

const PORT = process.env.PORT || 5000;

if (require.main === module) {
  const server = app.listen(PORT, () => {
    console.log(`========================================================`);
    console.log(`🚀 Smart Expense MERN Backend Server running on port ${PORT}`);
    console.log(`🌐 Server Base URL: http://localhost:${PORT}`);
    console.log(`========================================================`);
  });

  connectDB().catch((err) => {
    console.error('Failed to connect to database during startup:', err.message);
  });
}

module.exports = app;
