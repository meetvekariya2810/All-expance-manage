const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
  user_id: { type: String, required: true, index: true },
  user_name: { type: String, required: true },
  action: { type: String, required: true },
  expense_id: { type: String, default: '' },
  amount: { type: Number, default: 0 },
  category: { type: String, default: '' },
  title: { type: String, default: '' },
  details: { type: String, default: '' },
  type: {
    type: String,
    enum: ['create', 'update', 'delete', 'budget', 'category', 'profile', 'info'],
    default: 'info'
  },
  timestamp: { type: Date, default: Date.now, index: true }
});

module.exports = mongoose.model('ActivityLog', activityLogSchema);
