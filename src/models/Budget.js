const mongoose = require('mongoose');

const budgetSchema = new mongoose.Schema({
  _id: { type: String },
  id: { type: String },
  user_id: { type: String, required: true },
  month: { type: String, required: true }, // Format: YYYY-MM
  budget_amount: { type: Number, required: true },
  created_at: { type: Date, default: Date.now }
}, { _id: false, id: false });

budgetSchema.index({ user_id: 1, month: 1 }, { unique: true });


module.exports = mongoose.model('Budget', budgetSchema);
