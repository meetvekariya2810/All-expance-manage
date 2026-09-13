const mongoose = require('mongoose');

const budgetSchema = new mongoose.Schema({
  user_id: { type: String, required: true },
  month: { type: String, required: true }, // Format: YYYY-MM
  budget_amount: { type: Number, required: true },
  created_at: { type: Date, default: Date.now }
});

budgetSchema.index({ user_id: 1, month: 1 }, { unique: true });

module.exports = mongoose.model('Budget', budgetSchema);
