const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { getMongoStatus, memoryStore, saveLocalStore } = require('../config/db');

const getUsers = async (req, res) => {
  try {
    let users = [];
    if (getMongoStatus()) {
      users = await User.find().select('-password').sort({ created_at: -1 });
    } else {
      users = memoryStore.users.map(u => {
        const { password, ...rest } = u;
        return rest;
      });
    }
    res.json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error retrieving user list.' });
  }
};

const createUser = async (req, res) => {
  try {
    const { name, email, mobile, username, password, role } = req.body;
    if (!name || !email || !username || !password) {
      return res.status(400).json({ success: false, message: 'Name, email, username, and password are required.' });
    }

    if (getMongoStatus()) {
      const existingUser = await User.findOne({ $or: [{ email }, { username }] });
      if (existingUser) {
        return res.status(400).json({ success: false, message: 'Username or Email already exists.' });
      }

      const user = new User({
        name,
        email,
        mobile: mobile || '',
        username: username.toLowerCase(),
        password,
        role: role || 'user',
        status: 'active'
      });
      await user.save();

      const userObj = user.toObject();
      delete userObj.password;
      res.status(201).json({ success: true, message: 'User added successfully.', data: userObj });
    } else {
      const existingUser = memoryStore.users.find(u => u.email === email || u.username.toLowerCase() === username.toLowerCase());
      if (existingUser) {
        return res.status(400).json({ success: false, message: 'Username or Email already exists.' });
      }

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      const userId = 'usr_' + Date.now();
      const newUser = {
        _id: userId,
        id: userId,
        name,
        email,
        mobile: mobile || '',
        username: username.toLowerCase(),
        password: hashedPassword,
        role: role || 'user',
        profile_image: '/uploads/default-avatar.png',
        status: 'active',
        created_at: new Date()
      };

      memoryStore.users.push(newUser);
      saveLocalStore();

      const { password: pw, ...userRes } = newUser;
      res.status(201).json({ success: true, message: 'User added successfully.', data: userRes });
    }
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ success: false, message: 'Error creating user account.' });
  }
};

const updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['active', 'disabled'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value.' });
    }

    if (getMongoStatus()) {
      const user = await User.findById(id);
      if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
      user.status = status;
      await user.save();
    } else {
      const user = memoryStore.users.find(u => (u._id || u.id) === id);
      if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
      user.status = status;
      saveLocalStore();
    }

    res.json({ success: true, message: `User status updated to ${status}.` });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error updating user status.' });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 4) {
      return res.status(400).json({ success: false, message: 'Password must be at least 4 characters long.' });
    }

    if (getMongoStatus()) {
      const user = await User.findById(id);
      if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
      user.password = newPassword;
      await user.save();
    } else {
      const user = memoryStore.users.find(u => (u._id || u.id) === id);
      if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(newPassword, salt);
      saveLocalStore();
    }

    res.json({ success: true, message: 'User password reset successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error resetting password.' });
  }
};

module.exports = {
  getUsers,
  createUser,
  updateUserStatus,
  resetPassword
};
