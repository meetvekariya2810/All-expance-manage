const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  _id: { type: String, default: () => 'usr_' + Date.now() + '_' + Math.floor(Math.random() * 1000) },
  id: { type: String },
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  mobile: { type: String, default: '', trim: true },
  username: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'user'], default: 'user' },
  profile_image: { type: String, default: '/uploads/default-avatar.png' },
  status: { type: String, enum: ['active', 'disabled'], default: 'active' },
  created_at: { type: Date, default: Date.now }
}, {
  _id: false,
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Hash password before save if modified
userSchema.pre('save', async function (next) {
  if (this._id && !this.id) {
    this.id = this._id;
  }
  if (!this.isModified('password')) return next();
  // Don't re-hash if already bcrypt hash
  if (typeof this.password === 'string' && (this.password.startsWith('$2a$') || this.password.startsWith('$2b$'))) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
