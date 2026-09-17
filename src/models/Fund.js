const mongoose = require('mongoose');

const fundSchema = new mongoose.Schema({
  _id: { type: String, default: () => 'fund_' + Date.now() + '_' + Math.floor(Math.random() * 1000) },
  id: { type: String },
  fund_id: { type: String, required: true, unique: true, index: true },
  amount: { type: Number, required: true, min: 0.01 },
  person_name: { type: String, required: true, trim: true },
  fund_date: { type: String, required: true, index: true }, // Format: YYYY-MM-DD
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

fundSchema.pre('save', function(next) {
  if (this._id && !this.id) {
    this.id = this._id;
  }
  if (!this.created_by && this.user_name) {
    this.created_by = this.user_name;
  }
  next();
});

fundSchema.index({ user_id: 1, fund_date: -1 });
fundSchema.index({ person_name: 'text', notes: 'text', fund_id: 'text' });

module.exports = mongoose.model('Fund', fundSchema);
