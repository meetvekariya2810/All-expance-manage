const mongoose = require('mongoose');

const importBatchSchema = new mongoose.Schema({
  _id: { type: String, default: () => 'batch_' + Date.now() + '_' + Math.floor(Math.random() * 1000) },
  id: { type: String },
  batch_id: { type: String, required: true, unique: true, index: true },
  initiated_by: { type: String, required: true, index: true },
  initiated_by_name: { type: String, required: true },
  target_user_id: { type: String, default: '' },
  target_user_name: { type: String, default: '' },
  original_filename: { type: String, default: 'unknown.xlsx' },
  file_hash: { type: String, default: '' },
  total_rows: { type: Number, default: 0 },
  valid_rows: { type: Number, default: 0 },
  imported_rows: { type: Number, default: 0 },
  rejected_rows: { type: Number, default: 0 },
  duplicate_rows: { type: Number, default: 0 },
  total_imported_amount: { type: Number, default: 0 },
  status: { 
    type: String, 
    enum: ['validated', 'completed', 'partial', 'failed'], 
    default: 'completed',
    index: true
  },
  started_at: { type: Date, default: Date.now },
  completed_at: { type: Date, default: Date.now },
  error_summary: { type: String, default: '' },
  errors: [{
    rowNumber: { type: Number },
    field: { type: String },
    value: { type: String },
    message: { type: String }
  }],
  preview: [{
    rowNumber: { type: Number },
    date: { type: String },
    title: { type: String },
    category: { type: String },
    amount: { type: Number },
    payment_method: { type: String },
    vendor: { type: String },
    status: { type: String }
  }],
  idempotency_key: { type: String, default: '', index: true },
  created_at: { type: Date, default: Date.now, index: true }
}, {
  _id: false,
  suppressReservedKeysWarning: true,
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

importBatchSchema.pre('save', function(next) {
  if (this._id && !this.id) {
    this.id = this._id;
  }
  next();
});

module.exports = mongoose.model('ImportBatch', importBatchSchema);
