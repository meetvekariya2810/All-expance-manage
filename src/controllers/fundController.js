const Fund = require('../models/Fund');
const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');

// Generate unique human-readable fund ID
const generateFundId = async () => {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `FUND-${dateStr}-${randomSuffix}`;
};

// Safe lookup helper for MongoDB
const findFundDoc = async (id) => {
  return await Fund.findOne({
    $or: [{ _id: id }, { id: id }, { fund_id: id }]
  });
};

// GET /api/funds
const getFunds = async (req, res) => {
  try {
    const { role, id: userId, username } = req.user;
    const {
      search,
      person,
      startDate,
      endDate,
      month,
      minAmount,
      maxAmount,
      sortBy = 'fund_date',
      sortOrder = 'desc',
      page = 1,
      limit = 20
    } = req.query;

    let filter = {};

    // 1. Role Authorization Enforcement: Non-admins can ONLY access their own fund records
    if (role !== 'admin') {
      filter.$or = [{ user_id: userId }, { user_id: username }];
    } else if (person && person !== 'all') {
      const targetUser = await User.findOne({
        $or: [{ _id: person }, { id: person }, { username: person }]
      });
      if (targetUser) {
        filter.$or = [
          { user_id: targetUser._id },
          { user_id: targetUser.username },
          { person_name: { $regex: targetUser.name, $options: 'i' } }
        ];
      } else {
        filter.$or = [
          { user_id: person },
          { person_name: { $regex: person, $options: 'i' } }
        ];
      }
    }

    // 2. Date Filtering
    if (startDate && endDate) {
      filter.fund_date = { $gte: startDate, $lte: endDate };
    } else if (startDate) {
      filter.fund_date = { $gte: startDate };
    } else if (endDate) {
      filter.fund_date = { $lte: endDate };
    } else if (month) {
      filter.fund_date = { $regex: `^${month}` };
    }

    // 3. Amount Filtering
    const min = parseFloat(minAmount);
    const max = parseFloat(maxAmount);
    if (!isNaN(min) && !isNaN(max)) {
      filter.amount = { $gte: min, $lte: max };
    } else if (!isNaN(min)) {
      filter.amount = { $gte: min };
    } else if (!isNaN(max)) {
      filter.amount = { $lte: max };
    }

    // 4. Global Search
    if (search && search.trim()) {
      const q = search.trim();
      const searchRegex = { $regex: q, $options: 'i' };
      const searchConditions = [
        { fund_id: searchRegex },
        { person_name: searchRegex },
        { notes: searchRegex },
        { user_name: searchRegex },
        { created_by: searchRegex }
      ];

      if (filter.$or) {
        filter = {
          $and: [
            { $or: filter.$or },
            { $or: searchConditions }
          ]
        };
      } else {
        filter.$or = searchConditions;
      }
    }

    // Total Count & Sum of Funds matching query
    const totalCount = await Fund.countDocuments(filter);
    const allMatching = await Fund.find(filter).select('amount');
    const totalAmount = allMatching.reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0);

    // Pagination
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    // Sorting
    const sort = {};
    const sortField = ['fund_date', 'amount', 'person_name', 'created_at'].includes(sortBy) ? sortBy : 'fund_date';
    sort[sortField] = sortOrder === 'asc' ? 1 : -1;
    if (sortField !== 'created_at') {
      sort.created_at = -1;
    }

    const funds = await Fund.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limitNum);

    res.status(200).json({
      success: true,
      count: funds.length,
      totalCount,
      totalAmount,
      page: pageNum,
      totalPages: Math.ceil(totalCount / limitNum) || 1,
      funds
    });
  } catch (error) {
    console.error('Error in getFunds:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve funds.' });
  }
};

// GET /api/funds/:id
const getFundById = async (req, res) => {
  try {
    const fund = await findFundDoc(req.params.id);
    if (!fund) {
      return res.status(404).json({ success: false, message: 'Fund entry not found.' });
    }

    // Role check
    if (req.user.role !== 'admin' && fund.user_id !== req.user.id && fund.user_id !== req.user.username) {
      return res.status(403).json({ success: false, message: 'Access denied to this fund record.' });
    }

    res.status(200).json({ success: true, fund });
  } catch (error) {
    console.error('Error in getFundById:', error);
    res.status(500).json({ success: false, message: 'Error retrieving fund details.' });
  }
};

// POST /api/funds
const createFund = async (req, res) => {
  try {
    const { amount, person_name, fund_date, notes } = req.body;

    // Backend Validation
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Fund amount must be a valid positive number greater than 0.'
      });
    }

    if (!person_name || !person_name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Person Name is required.'
      });
    }

    if (!fund_date || isNaN(new Date(fund_date).getTime())) {
      return res.status(400).json({
        success: false,
        message: 'A valid date is required for the fund entry.'
      });
    }

    const fundId = await generateFundId();
    const creatorName = req.user.name || req.user.username || 'Admin';

    const newFund = new Fund({
      fund_id: fundId,
      amount: parsedAmount,
      person_name: person_name.trim(),
      fund_date: fund_date.slice(0, 10),
      notes: (notes || '').trim(),
      user_id: req.user.id,
      user_name: creatorName,
      created_by: creatorName
    });

    const savedFund = await newFund.save();

    // Log Activity
    try {
      await ActivityLog.create({
        user_id: req.user.id,
        user_name: creatorName,
        action: `${creatorName} added a fund: +₹${parsedAmount.toLocaleString('en-IN')} from ${person_name.trim()}`,
        expense_id: fundId,
        amount: parsedAmount,
        category: 'Fund / Money In',
        title: `Fund from ${person_name.trim()}`,
        details: notes || 'Incoming fund entry',
        type: 'fund_create'
      });
    } catch (actErr) {
      console.warn('Activity log notice:', actErr.message);
    }

    res.status(201).json({
      success: true,
      message: 'Fund entry successfully added to MongoDB Atlas.',
      fund: savedFund
    });
  } catch (error) {
    console.error('Error in createFund:', error);
    res.status(500).json({
      success: false,
      message: 'Server error creating fund record: ' + error.message
    });
  }
};

// PUT /api/funds/:id
const updateFund = async (req, res) => {
  try {
    const fund = await findFundDoc(req.params.id);
    if (!fund) {
      return res.status(404).json({ success: false, message: 'Fund entry not found.' });
    }

    // Role check
    if (req.user.role !== 'admin' && fund.user_id !== req.user.id && fund.user_id !== req.user.username) {
      return res.status(403).json({ success: false, message: 'Permission denied: Cannot edit this fund.' });
    }

    const { amount, person_name, fund_date, notes } = req.body;

    const oldAmount = fund.amount;
    let newAmount = oldAmount;

    if (amount !== undefined) {
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ success: false, message: 'Fund amount must be greater than zero.' });
      }
      fund.amount = parsedAmount;
      newAmount = parsedAmount;
    }

    if (person_name !== undefined) {
      if (!person_name.trim()) {
        return res.status(400).json({ success: false, message: 'Person Name cannot be empty.' });
      }
      fund.person_name = person_name.trim();
    }

    if (fund_date !== undefined) {
      if (isNaN(new Date(fund_date).getTime())) {
        return res.status(400).json({ success: false, message: 'A valid date is required.' });
      }
      fund.fund_date = fund_date.slice(0, 10);
    }

    if (notes !== undefined) {
      fund.notes = notes.trim();
    }

    fund.updated_at = new Date();
    const updatedFund = await fund.save();

    // Log Activity
    try {
      const creatorName = req.user.name || req.user.username;
      const changeMsg = oldAmount !== newAmount
        ? `Amount changed: ₹${oldAmount.toLocaleString('en-IN')} → ₹${newAmount.toLocaleString('en-IN')}`
        : `Updated details for ${fund.person_name}`;

      await ActivityLog.create({
        user_id: req.user.id,
        user_name: creatorName,
        action: `${creatorName} updated Fund ${fund.fund_id}. ${changeMsg}`,
        expense_id: fund.fund_id,
        amount: newAmount,
        category: 'Fund / Money In',
        title: `Fund update: ${fund.person_name}`,
        details: changeMsg,
        type: 'fund_update'
      });
    } catch (actErr) {
      console.warn('Activity log notice:', actErr.message);
    }

    res.status(200).json({
      success: true,
      message: 'Fund updated successfully in MongoDB Atlas.',
      fund: updatedFund
    });
  } catch (error) {
    console.error('Error in updateFund:', error);
    res.status(500).json({ success: false, message: 'Failed to update fund.' });
  }
};

// DELETE /api/funds/:id
const deleteFund = async (req, res) => {
  try {
    const fund = await findFundDoc(req.params.id);
    if (!fund) {
      return res.status(404).json({ success: false, message: 'Fund entry not found.' });
    }

    // Role check
    if (req.user.role !== 'admin' && fund.user_id !== req.user.id && fund.user_id !== req.user.username) {
      return res.status(403).json({ success: false, message: 'Permission denied: Cannot delete this fund.' });
    }

    const fundId = fund.fund_id;
    const personName = fund.person_name;
    const fundAmt = fund.amount;

    // Permanent delete from MongoDB Atlas
    await Fund.deleteOne({ _id: fund._id });

    // Log Activity
    try {
      const creatorName = req.user.name || req.user.username;
      await ActivityLog.create({
        user_id: req.user.id,
        user_name: creatorName,
        action: `${creatorName} permanently deleted Fund ${fundId} (₹${fundAmt.toLocaleString('en-IN')} from ${personName})`,
        expense_id: fundId,
        amount: fundAmt,
        category: 'Fund / Money In',
        title: `Deleted fund: ${personName}`,
        details: 'Fund permanently removed',
        type: 'fund_delete'
      });
    } catch (actErr) {
      console.warn('Activity log notice:', actErr.message);
    }

    res.status(200).json({
      success: true,
      message: `Fund ${fundId} has been permanently deleted from MongoDB Atlas.`
    });
  } catch (error) {
    console.error('Error in deleteFund:', error);
    res.status(500).json({ success: false, message: 'Failed to delete fund.' });
  }
};

module.exports = {
  getFunds,
  getFundById,
  createFund,
  updateFund,
  deleteFund
};
