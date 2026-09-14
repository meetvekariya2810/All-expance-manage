const mongoose = require('mongoose');

const budgetSchema = new mongoose.Schema({
  _id: { type: String, default: () => 'bgt_' + Date.now() + '_' + Math.floor(Math.random() * 1000) },
  id: { type: String },
  user_id: { type: String, required: true }, // 'global' or userId like 'usr_bhavik_02' or username
  month: { type: String, required: true },    // Format: YYYY-MM
  budget_amount: { type: Number, required: true, min: 0 },
  created_at: { type: Date, default: Date.now }
}, {
  _id: false,
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

budgetSchema.pre('save', function(next) {
  if (this._id && !this.id) {
    this.id = this._id;
  }
  next();
});

budgetSchema.index({ user_id: 1, month: 1 }, { unique: true });

module.exports = mongoose.model('Budget', budgetSchema);
