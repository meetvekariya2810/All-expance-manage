const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'smart_expense_super_secret_jwt_key_2026!';

const login = async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password are required.' });
    }

    const trimmedUsername = username.toLowerCase().trim();
    const user = await User.findOne({ username: trimmedUsername });

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid username or password.' });
    }

    if (user.status === 'disabled') {
      return res.status(403).json({ success: false, message: 'Your account has been disabled by Admin.' });
    }

    const isMatch = await user.matchPassword(password);
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
        _id: user._id || user.id,
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

const logout = async (req, res) => {
  res.json({ success: true, message: 'Logged out successfully.' });
};

const getMe = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findOne({ 
      $or: [{ _id: userId }, { id: userId }, { username: req.user.username }] 
    }).select('-password');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User profile not found.' });
    }

    res.json({
      success: true,
      user: {
        id: user._id || user.id,
        _id: user._id || user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        mobile: user.mobile,
        role: user.role,
        profile_image: user.profile_image,
        status: user.status,
        created_at: user.created_at
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching user profile.' });
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

    const user = await User.findOne({ $or: [{ _id: userId }, { id: userId }] });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const isMatch = await user.matchPassword(oldPassword);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Incorrect current password.' });
    }

    user.password = newPassword;
    await user.save();

    res.json({ success: true, message: 'Password updated successfully.' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ success: false, message: 'Error updating password.' });
  }
};

const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, email, mobile } = req.body;

    if (!name || !email) {
      return res.status(400).json({ success: false, message: 'Name and email are required.' });
    }

    const user = await User.findOne({ $or: [{ _id: userId }, { id: userId }] });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    // Check unique email conflict
    const existing = await User.findOne({ 
      email: email.toLowerCase().trim(), 
      _id: { $ne: user._id } 
    });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Email address already in use by another account.' });
    }

    user.name = name.trim();
    user.email = email.toLowerCase().trim();
    if (mobile !== undefined) user.mobile = mobile.trim();
    await user.save();

    const userObj = user.toObject();
    delete userObj.password;
    res.json({ 
      success: true, 
      message: 'Profile updated successfully.', 
      user: {
        id: userObj._id,
        _id: userObj._id,
        name: userObj.name,
        username: userObj.username,
        email: userObj.email,
        mobile: userObj.mobile,
        role: userObj.role,
        profile_image: userObj.profile_image,
        status: userObj.status
      } 
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ success: false, message: 'Error updating profile.' });
  }
};

module.exports = {
  login,
  logout,
  getMe,
  changePassword,
  updateProfile
};
