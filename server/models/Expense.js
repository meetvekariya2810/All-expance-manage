const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
  _id: { type: String, default: () => 'exp_' + Date.now() + '_' + Math.floor(Math.random() * 1000) },
  id: { type: String },
  expense_id: { type: String, required: true, unique: true, index: true },
  user_id: { type: String, required: true, index: true },
  user_name: { type: String, required: true },
  created_by: { type: String, default: '' },
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '', trim: true },
  category: { type: String, required: true, index: true, trim: true },
  amount: { type: Number, required: true, min: 0.01 },
  payment_method: { 
    type: String, 
    enum: ['Cash', 'UPI', 'Credit Card', 'Debit Card', 'Net Banking', 'Other'],
    default: 'UPI'
  },
  vendor: { type: String, default: '', trim: true },
  location: { type: String, default: '', trim: true },
  receipt: { type: String, default: '' },
  notes: { type: String, default: '', trim: true },
  expense_date: { type: String, required: true, index: true }, // Format: YYYY-MM-DD
  expense_time: { type: String, required: true },             // Format: HH:mm
  created_at: { type: Date, default: Date.now, index: true },
  updated_at: { type: Date, default: Date.now }
}, {
  _id: false,
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

expenseSchema.pre('save', function(next) {
  if (this._id && !this.id) {
    this.id = this._id;
  }
  next();
});

expenseSchema.index({ user_id: 1, expense_date: -1 });
expenseSchema.index({ title: 'text', description: 'text', vendor: 'text', notes: 'text' });

module.exports = mongoose.model('Expense', expenseSchema);
