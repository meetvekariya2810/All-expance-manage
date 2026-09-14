const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Expense = require('../models/Expense');
const { getMongoStatus, memoryStore, saveLocalStore } = require('../config/db');

const getUsers = async (req, res) => {
  try {
    let users = [];
    if (getMongoStatus()) {
      users = await User.find().select('-password').sort({ created_at: -1 });

      // Attach expense statistics
      const allExpenses = await Expense.find({}, 'user_id amount');
      const userStats = {};
      allExpenses.forEach(e => {
        if (!userStats[e.user_id]) userStats[e.user_id] = { count: 0, total: 0 };
        userStats[e.user_id].count += 1;
        userStats[e.user_id].total += (parseFloat(e.amount) || 0);
      });

      const usersWithStats = users.map(u => {
        const uObj = u.toObject ? u.toObject() : u;
        const uid = uObj._id || uObj.id;
        uObj.totalExpenses = userStats[uid] ? userStats[uid].count : 0;
        uObj.totalSpending = userStats[uid] ? userStats[uid].total : 0;
        return uObj;
      });

      res.json({ success: true, data: usersWithStats });
    } else {
      const expenses = memoryStore.expenses || [];
      const userStats = {};
      expenses.forEach(e => {
        if (!userStats[e.user_id]) userStats[e.user_id] = { count: 0, total: 0 };
        userStats[e.user_id].count += 1;
        userStats[e.user_id].total += (parseFloat(e.amount) || 0);
      });

      const usersWithStats = (memoryStore.users || []).map(u => {
        const { password, ...rest } = u;
        const uid = rest._id || rest.id;
        rest.totalExpenses = userStats[uid] ? userStats[uid].count : 0;
        rest.totalSpending = userStats[uid] ? userStats[uid].total : 0;
        return rest;
      });

      res.json({ success: true, data: usersWithStats });
    }
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ success: false, message: 'Error retrieving user list.' });
  }
};

const createUser = async (req, res) => {
  try {
    const { name, email, mobile, username, password, role } = req.body;
    if (!name || !email || !username || !password) {
      return res.status(400).json({ success: false, message: 'Name, email, username, and password are required.' });
    }

    const trimmedUsername = username.toLowerCase().trim();
    const trimmedEmail = email.toLowerCase().trim();

    if (getMongoStatus()) {
      const existingUser = await User.findOne({ $or: [{ email: trimmedEmail }, { username: trimmedUsername }] });
      if (existingUser) {
        return res.status(400).json({ success: false, message: 'Username or Email already exists.' });
      }

      const userId = 'usr_' + Date.now();
      const user = new User({
        _id: userId,
        id: userId,
        name: name.trim(),
        email: trimmedEmail,
        mobile: mobile ? mobile.trim() : '',
        username: trimmedUsername,
        password,
        role: role === 'admin' ? 'admin' : 'user',
        status: 'active'
      });
      await user.save();

      const userObj = user.toObject();
      delete userObj.password;
      res.status(201).json({ success: true, message: 'User added successfully.', data: userObj });
    } else {
      const existingUser = (memoryStore.users || []).find(
        u => u.email.toLowerCase() === trimmedEmail || u.username.toLowerCase() === trimmedUsername
      );
      if (existingUser) {
        return res.status(400).json({ success: false, message: 'Username or Email already exists.' });
      }

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      const userId = 'usr_' + Date.now();
      const newUser = {
        _id: userId,
        id: userId,
        name: name.trim(),
        email: trimmedEmail,
        mobile: mobile ? mobile.trim() : '',
        username: trimmedUsername,
        password: hashedPassword,
        role: role === 'admin' ? 'admin' : 'user',
        profile_image: '/uploads/default-avatar.png',
        status: 'active',
        created_at: new Date()
      };

      if (!memoryStore.users) memoryStore.users = [];
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

const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, mobile, role } = req.body;

    if (!name || !email) {
      return res.status(400).json({ success: false, message: 'Name and email are required.' });
    }

    const trimmedEmail = email.toLowerCase().trim();

    if (getMongoStatus()) {
      const user = await User.findOne({ $or: [{ _id: id }, { id: id }] });
      if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

      // Check email duplicate
      const duplicate = await User.findOne({ email: trimmedEmail, _id: { $ne: user._id } });
      if (duplicate) return res.status(400).json({ success: false, message: 'Email address already in use.' });

      user.name = name.trim();
      user.email = trimmedEmail;
      if (mobile !== undefined) user.mobile = mobile.trim();
      if (role && ['admin', 'user'].includes(role)) user.role = role;
      await user.save();

      const userObj = user.toObject ? user.toObject() : user;
      delete userObj.password;
      res.json({ success: true, message: 'User details updated successfully.', data: userObj });
    } else {
      const idx = (memoryStore.users || []).findIndex(u => (u._id || u.id) === id);
      if (idx === -1) return res.status(404).json({ success: false, message: 'User not found.' });

      const duplicate = memoryStore.users.find(u => u.email.toLowerCase() === trimmedEmail && (u._id || u.id) !== id);
      if (duplicate) return res.status(400).json({ success: false, message: 'Email address already in use.' });

      memoryStore.users[idx].name = name.trim();
      memoryStore.users[idx].email = trimmedEmail;
      if (mobile !== undefined) memoryStore.users[idx].mobile = mobile.trim();
      if (role && ['admin', 'user'].includes(role)) memoryStore.users[idx].role = role;
      saveLocalStore();

      const { password, ...safeUser } = memoryStore.users[idx];
      res.json({ success: true, message: 'User details updated successfully.', data: safeUser });
    }
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ success: false, message: 'Error updating user details.' });
  }
};

const updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['active', 'disabled'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value. Must be active or disabled.' });
    }

    if (getMongoStatus()) {
      const user = await User.findOne({ $or: [{ _id: id }, { id: id }] });
      if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
      user.status = status;
      await user.save();
    } else {
      const user = (memoryStore.users || []).find(u => (u._id || u.id) === id);
      if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
      user.status = status;
      saveLocalStore();
    }

    res.json({ success: true, message: `User status updated to ${status}.` });
  } catch (error) {
    console.error('Update user status error:', error);
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
      const user = await User.findOne({ $or: [{ _id: id }, { id: id }] });
      if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
      user.password = newPassword;
      await user.save();
    } else {
      const user = (memoryStore.users || []).find(u => (u._id || u.id) === id);
      if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(newPassword, salt);
      saveLocalStore();
    }

    res.json({ success: true, message: 'User password reset successfully.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ success: false, message: 'Error resetting password.' });
  }
};

module.exports = {
  getUsers,
  createUser,
  updateUser,
  updateUserStatus,
  resetPassword
};
