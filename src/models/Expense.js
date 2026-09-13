const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
  expense_id: { type: String, required: true, unique: true },
  user_id: { type: String, required: true },
  user_name: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  category: { type: String, required: true },
  amount: { type: Number, required: true },
  payment_method: { 
    type: String, 
    enum: ['Cash', 'UPI', 'Credit Card', 'Debit Card', 'Net Banking'],
    default: 'UPI'
  },
  vendor: { type: String, default: '' },
  location: { type: String, default: '' },
  receipt: { type: String, default: '' },
  notes: { type: String, default: '' },
  expense_date: { type: String, required: true }, // Format: YYYY-MM-DD
  expense_time: { type: String, required: true }, // Format: HH:mm
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Expense', expenseSchema);
