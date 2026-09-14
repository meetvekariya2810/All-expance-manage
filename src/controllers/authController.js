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
      user = await User.findOne({ username: username.toLowerCase().trim() });
    } else {
      user = memoryStore.users.find(u => u.username.toLowerCase() === username.toLowerCase().trim());
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
    const { oldPassword, newPassword, confirmPassword } = req.body;
    const userId = req.user.id;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Current password and new password are required.' });
    }

    if (confirmPassword && newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'New password and confirm password do not match.' });
    }

    if (newPassword.length < 4) {
      return res.status(400).json({ success: false, message: 'New password must be at least 4 characters long.' });
    }

    if (getMongoStatus()) {
      const user = await User.findOne({ $or: [{ _id: userId }, { id: userId }] });
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
      user = await User.findOne({ $or: [{ _id: userId }, { id: userId }] }).select('-password');
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

const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, email, mobile } = req.body;

    if (!name || !email) {
      return res.status(400).json({ success: false, message: 'Name and email are required.' });
    }

    if (getMongoStatus()) {
      const user = await User.findOne({ $or: [{ _id: userId }, { id: userId }] });
      if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

      // Check unique email conflict
      const existing = await User.findOne({ email, _id: { $ne: user._id } });
      if (existing) {
        return res.status(400).json({ success: false, message: 'Email address already in use.' });
      }

      user.name = name.trim();
      user.email = email.trim();
      if (mobile !== undefined) user.mobile = mobile.trim();
      await user.save();

      const userObj = user.toObject ? user.toObject() : user;
      delete userObj.password;
      res.json({ success: true, message: 'Profile updated successfully.', user: userObj });
    } else {
      const idx = memoryStore.users.findIndex(u => (u._id || u.id) === userId);
      if (idx === -1) return res.status(404).json({ success: false, message: 'User not found.' });

      const existing = memoryStore.users.find(u => u.email === email && (u._id || u.id) !== userId);
      if (existing) {
        return res.status(400).json({ success: false, message: 'Email address already in use.' });
      }

      memoryStore.users[idx].name = name.trim();
      memoryStore.users[idx].email = email.trim();
      if (mobile !== undefined) memoryStore.users[idx].mobile = mobile.trim();
      saveLocalStore();

      const { password, ...safeUser } = memoryStore.users[idx];
      res.json({ success: true, message: 'Profile updated successfully.', user: safeUser });
    }
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ success: false, message: 'Error updating profile.' });
  }
};

module.exports = {
  login,
  changePassword,
  getProfile,
  updateProfile
};

