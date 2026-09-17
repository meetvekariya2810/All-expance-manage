const mongoose = require('mongoose');

const settlementSchema = new mongoose.Schema({
  _id: { type: String, default: () => 'settle_' + Date.now() + '_' + Math.floor(Math.random() * 1000) },
  id: { type: String },
  settlement_id: { type: String, required: true, unique: true, index: true },
  person_name: { type: String, required: true, trim: true },
  amount: { type: Number, required: true, min: 0.01 },
  settlement_type: { 
    type: String, 
    enum: ['Paid', 'Received'], 
    required: true, 
    default: 'Paid' 
  },
  settlement_date: { type: String, required: true, index: true }, // Format: YYYY-MM-DD
  status: { 
    type: String, 
    enum: ['Pending', 'Settled'], 
    default: 'Settled',
    index: true
  },
  notes: { type: String, default: '', trim: true },
  user_id: { type: String, required: true, index: true },
  user_name: { type: String, required: true },
  created_by: { type: String, default: '' },
  created_at: { type: Date, default: Date.now, index: true },
  updated_at: { type: Date, default: Date.now }
}, {
  _id: false,
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

settlementSchema.pre('save', function(next) {
  if (this._id && !this.id) {
    this.id = this._id;
  }
  if (!this.created_by && this.user_name) {
    this.created_by = this.user_name;
  }
  next();
});

settlementSchema.index({ user_id: 1, settlement_date: -1 });
settlementSchema.index({ person_name: 'text', notes: 'text', settlement_id: 'text' });

module.exports = mongoose.model('Settlement', settlementSchema);
