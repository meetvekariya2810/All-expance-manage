const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  _id: { type: String, default: () => 'cat_' + Date.now() + '_' + Math.floor(Math.random() * 1000) },
  id: { type: String },
  category_name: { type: String, required: true, unique: true, trim: true },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  icon: { type: String, default: 'fa-tags' },
  is_default: { type: Boolean, default: false }
}, {
  _id: false,
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

categorySchema.pre('save', function(next) {
  if (this._id && !this.id) {
    this.id = this._id;
  }
  next();
});

module.exports = mongoose.model('Category', categorySchema);
