const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Expense = require('../models/Expense');
const { getMongoStatus, memoryStore, saveLocalStore } = require('../config/db');

const getUsers = async (req, res) => {
  try {
    if (getMongoStatus()) {
      const users = await User.find({}).select('-password').sort({ created_at: -1 });

      const currentMonthStr = new Date().toISOString().slice(0, 7);
      const stats = await Expense.aggregate([
        {
          $group: {
            _id: '$user_id',
            totalSpent: { $sum: '$amount' },
            transactionCount: { $sum: 1 },
            lastActive: { $max: '$created_at' }
          }
        }
      ]);

      const monthStats = await Expense.aggregate([
        { $match: { expense_date: { $regex: `^${currentMonthStr}` } } },
        {
          $group: {
            _id: '$user_id',
            thisMonthSpent: { $sum: '$amount' }
          }
        }
      ]);

      const statsMap = {};
      stats.forEach(s => { statsMap[s._id] = s; });

      const monthMap = {};
      monthStats.forEach(m => { monthMap[m._id] = m.thisMonthSpent; });

      const enrichedUsers = users.map(u => {
        const uObj = u.toObject();
        const userStat = statsMap[uObj._id] || statsMap[uObj.id] || statsMap[uObj.username] || {
          totalSpent: 0,
          transactionCount: 0,
          lastActive: uObj.created_at
        };
        const thisMonth = monthMap[uObj._id] || monthMap[uObj.id] || monthMap[uObj.username] || 0;
        return {
          ...uObj,
          id: uObj._id,
          totalSpent: userStat.totalSpent,
          transactionCount: userStat.transactionCount,
          thisMonthSpent: thisMonth,
          lastActive: userStat.lastActive
        };
      });

      return res.json({ success: true, users: enrichedUsers });
    } else {
      // Memory Store logic
      const currentMonthStr = new Date().toISOString().slice(0, 7);
      const expenses = memoryStore.expenses || [];

      const enrichedUsers = (memoryStore.users || []).map(u => {
        const userExpenses = expenses.filter(e => e.user_id === u._id || e.user_id === u.id || e.user_id === u.username);
        const totalSpent = userExpenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
        const thisMonthSpent = userExpenses
          .filter(e => e.expense_date && e.expense_date.startsWith(currentMonthStr))
          .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
        const lastExpense = userExpenses.sort((a, b) => new Date(b.created_at || b.expense_date) - new Date(a.created_at || a.expense_date))[0];

        const { password, ...safeUser } = u;
        return {
          ...safeUser,
          id: safeUser._id || safeUser.id,
          totalSpent,
          transactionCount: userExpenses.length,
          thisMonthSpent,
          lastActive: lastExpense ? (lastExpense.created_at || lastExpense.expense_date) : (safeUser.created_at || new Date())
        };
      });

      return res.json({ success: true, users: enrichedUsers });
    }
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ success: false, message: 'Error retrieving user accounts.' });
  }
};

const createUser = async (req, res) => {
  try {
    const { name, username, email, mobile, password, role = 'user' } = req.body;

    if (!name || !username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, username, email, and initial password are required.'
      });
    }

    const trimmedUsername = username.toLowerCase().trim();
    const trimmedEmail = email.toLowerCase().trim();

    if (getMongoStatus()) {
      const existingUser = await User.findOne({
        $or: [{ username: trimmedUsername }, { email: trimmedEmail }]
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Username or email is already registered.'
        });
      }

      const uniqueId = 'usr_' + trimmedUsername + '_' + Date.now().toString().slice(-4);
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      const newUser = new User({
        _id: uniqueId,
        id: uniqueId,
        name: name.trim(),
        username: trimmedUsername,
        email: trimmedEmail,
        mobile: (mobile || '').trim(),
        password: hashedPassword,
        role: role === 'admin' ? 'admin' : 'user',
        status: 'active',
        profile_image: '/uploads/default-avatar.png',
        created_at: new Date()
      });

      await newUser.save();

      const safeUser = newUser.toObject();
      delete safeUser.password;

      return res.status(201).json({
        success: true,
        message: `User account '${newUser.name}' created successfully.`,
        user: safeUser
      });
    } else {
      const existingUser = (memoryStore.users || []).find(
        u => (u.username && u.username.toLowerCase() === trimmedUsername) ||
             (u.email && u.email.toLowerCase() === trimmedEmail)
      );

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Username or email is already registered.'
        });
      }

      const uniqueId = 'usr_' + trimmedUsername + '_' + Date.now().toString().slice(-4);
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      const newUser = {
        _id: uniqueId,
        id: uniqueId,
        name: name.trim(),
        username: trimmedUsername,
        email: trimmedEmail,
        mobile: (mobile || '').trim(),
        password: hashedPassword,
        role: role === 'admin' ? 'admin' : 'user',
        status: 'active',
        profile_image: '/uploads/default-avatar.png',
        created_at: new Date().toISOString()
      };

      memoryStore.users.push(newUser);
      saveLocalStore();

      const { password: _, ...safeUser } = newUser;
      return res.status(201).json({
        success: true,
        message: `User account '${newUser.name}' created successfully.`,
        user: safeUser
      });
    }
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ success: false, message: 'Error creating user account.' });
  }
};

const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, mobile, role } = req.body;

    if (getMongoStatus()) {
      const user = await User.findOne({ $or: [{ _id: id }, { id: id }] });
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found.' });
      }

      if (email) {
        const duplicate = await User.findOne({
          email: email.toLowerCase().trim(),
          _id: { $ne: user._id }
        });
        if (duplicate) {
          return res.status(400).json({ success: false, message: 'Email already in use by another user.' });
        }
        user.email = email.toLowerCase().trim();
      }

      if (name) user.name = name.trim();
      if (mobile !== undefined) user.mobile = mobile.trim();
      if (role && ['admin', 'user'].includes(role)) user.role = role;

      await user.save();

      const safeUser = user.toObject();
      delete safeUser.password;

      return res.json({
        success: true,
        message: 'User updated successfully.',
        user: safeUser
      });
    } else {
      const idx = (memoryStore.users || []).findIndex(u => (u._id || u.id) === id);
      if (idx === -1) {
        return res.status(404).json({ success: false, message: 'User not found.' });
      }

      if (email) {
        const duplicate = memoryStore.users.find(
          u => u.email && u.email.toLowerCase() === email.toLowerCase().trim() && (u._id || u.id) !== id
        );
        if (duplicate) {
          return res.status(400).json({ success: false, message: 'Email already in use by another user.' });
        }
        memoryStore.users[idx].email = email.toLowerCase().trim();
      }

      if (name) memoryStore.users[idx].name = name.trim();
      if (mobile !== undefined) memoryStore.users[idx].mobile = mobile.trim();
      if (role && ['admin', 'user'].includes(role)) memoryStore.users[idx].role = role;

      saveLocalStore();

      const { password, ...safeUser } = memoryStore.users[idx];
      return res.json({
        success: true,
        message: 'User updated successfully.',
        user: safeUser
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error updating user.' });
  }
};

const updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (getMongoStatus()) {
      const user = await User.findOne({ $or: [{ _id: id }, { id: id }] });
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found.' });
      }

      if ((user._id === req.user.id || user.id === req.user.id) && status === 'disabled') {
        return res.status(400).json({ success: false, message: 'Cannot disable your own active admin account.' });
      }

      user.status = status === 'disabled' ? 'disabled' : 'active';
      await user.save();

      return res.json({
        success: true,
        message: `User status set to ${user.status}.`,
        status: user.status
      });
    } else {
      const idx = (memoryStore.users || []).findIndex(u => (u._id || u.id) === id);
      if (idx === -1) {
        return res.status(404).json({ success: false, message: 'User not found.' });
      }

      const u = memoryStore.users[idx];
      if ((u._id === req.user.id || u.id === req.user.id) && status === 'disabled') {
        return res.status(400).json({ success: false, message: 'Cannot disable your own active admin account.' });
      }

      memoryStore.users[idx].status = status === 'disabled' ? 'disabled' : 'active';
      saveLocalStore();

      return res.json({
        success: true,
        message: `User status set to ${memoryStore.users[idx].status}.`,
        status: memoryStore.users[idx].status
      });
    }
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
      const user = await User.findOne({ $or: [{ _id: id }, { id: id }] });
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found.' });
      }

      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(newPassword, salt);
      await user.save();

      return res.json({
        success: true,
        message: `Password for ${user.name} has been reset successfully.`
      });
    } else {
      const idx = (memoryStore.users || []).findIndex(u => (u._id || u.id) === id);
      if (idx === -1) {
        return res.status(404).json({ success: false, message: 'User not found.' });
      }

      const salt = await bcrypt.genSalt(10);
      memoryStore.users[idx].password = await bcrypt.hash(newPassword, salt);
      saveLocalStore();

      return res.json({
        success: true,
        message: `Password for ${memoryStore.users[idx].name} has been reset successfully.`
      });
    }
  } catch (error) {
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
