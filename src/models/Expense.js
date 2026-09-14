const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
  _id: { type: String },
  id: { type: String },
  expense_id: { type: String, required: true, unique: true },
  user_id: { type: String, required: true, index: true },
  user_name: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  category: { type: String, required: true, index: true },
  amount: { type: Number, required: true },
  payment_method: { 
    type: String, 
    enum: ['Cash', 'UPI', 'Credit Card', 'Debit Card', 'Net Banking', 'Other'],
    default: 'UPI'
  },
  vendor: { type: String, default: '' },
  location: { type: String, default: '' },
  receipt: { type: String, default: '' },
  notes: { type: String, default: '' },
  expense_date: { type: String, required: true, index: true }, // Format: YYYY-MM-DD
  expense_time: { type: String, required: true }, // Format: HH:mm
  created_at: { type: Date, default: Date.now, index: true },
  updated_at: { type: Date, default: Date.now }
}, { _id: false, id: false });

expenseSchema.index({ user_id: 1, expense_date: -1 });

module.exports = mongoose.model('Expense', expenseSchema);

