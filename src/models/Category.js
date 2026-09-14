const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  _id: { type: String },
  id: { type: String },
  category_name: { type: String, required: true, unique: true },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  icon: { type: String, default: 'fa-tags' },
  is_default: { type: Boolean, default: false }
}, { _id: false, id: false });


module.exports = mongoose.model('Category', categorySchema);
