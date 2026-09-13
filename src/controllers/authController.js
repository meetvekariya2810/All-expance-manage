const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { getMongoStatus, memoryStore, saveLocalStore } = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'smart_expense_super_secret_jwt_key_2026!';

const login = async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password are required.' });
    }

    let user = null;
    if (getMongoStatus()) {
      user = await User.findOne({ username: username.toLowerCase() });
    } else {
      user = memoryStore.users.find(u => u.username.toLowerCase() === username.toLowerCase());
    }

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid username or password.' });
    }

    if (user.status === 'disabled') {
      return res.status(403).json({ success: false, message: 'Your account is disabled by Admin.' });
    }

    let isMatch = false;
    if (getMongoStatus()) {
      isMatch = await user.matchPassword(password);
    } else {
      isMatch = await bcrypt.compare(password, user.password);
    }

    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid username or password.' });
    }

    const payload = {
      id: user._id || user.id,
      name: user.name,
      username: user.username,
      email: user.email,
      role: user.role
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      success: true,
      message: 'Login successful.',
      token,
      user: {
        id: user._id || user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        mobile: user.mobile,
        role: user.role,
        profile_image: user.profile_image,
        status: user.status
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Server error during authentication.' });
  }
};

const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const userId = req.user.id;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Current password and new password required.' });
    }

    if (getMongoStatus()) {
      const user = await User.findById(userId);
      if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

      const isMatch = await user.matchPassword(oldPassword);
      if (!isMatch) return res.status(400).json({ success: false, message: 'Incorrect current password.' });

      user.password = newPassword;
      await user.save();
    } else {
      const user = memoryStore.users.find(u => (u._id || u.id) === userId);
      if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

      const isMatch = await bcrypt.compare(oldPassword, user.password);
      if (!isMatch) return res.status(400).json({ success: false, message: 'Incorrect current password.' });

      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(newPassword, salt);
      saveLocalStore();
    }

    res.json({ success: true, message: 'Password updated successfully.' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ success: false, message: 'Error updating password.' });
  }
};

const getProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    let user = null;

    if (getMongoStatus()) {
      user = await User.findById(userId).select('-password');
    } else {
      const found = memoryStore.users.find(u => (u._id || u.id) === userId);
      if (found) {
        const { password, ...rest } = found;
        user = rest;
      }
    }

    if (!user) return res.status(404).json({ success: false, message: 'User profile not found.' });
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching user profile.' });
  }
};

module.exports = {
  login,
  changePassword,
  getProfile
};
