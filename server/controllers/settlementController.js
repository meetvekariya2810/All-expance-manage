const Settlement = require('../models/Settlement');
const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');

// Generate unique human-readable settlement ID
const generateSettlementId = async () => {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `SETTLE-${dateStr}-${randomSuffix}`;
};

// Safe lookup helper
const findSettlementDoc = async (id) => {
  return await Settlement.findOne({
    $or: [{ _id: id }, { id: id }, { settlement_id: id }]
  });
};

// GET /api/settlements
const getSettlements = async (req, res) => {
  try {
    const { role, id: userId, username } = req.user;
    const {
      person,
      status,
      settlement_type,
      startDate,
      endDate,
      search,
      sortBy = 'settlement_date',
      sortOrder = 'desc'
    } = req.query;

    let filter = {};

    // 1. Role Authorization
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

    // 2. Filters
    if (status && status !== 'all') filter.status = status;
    if (settlement_type && settlement_type !== 'all') filter.settlement_type = settlement_type;

    if (startDate && endDate) {
      filter.settlement_date = { $gte: startDate, $lte: endDate };
    } else if (startDate) {
      filter.settlement_date = { $gte: startDate };
    } else if (endDate) {
      filter.settlement_date = { $lte: endDate };
    }

    // 3. Search
    if (search && search.trim()) {
      const q = search.trim();
      const searchRegex = { $regex: q, $options: 'i' };
      const searchConditions = [
        { settlement_id: searchRegex },
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

    // Query all matching settlements
    const sort = {};
    const sortField = ['settlement_date', 'amount', 'person_name', 'created_at'].includes(sortBy) ? sortBy : 'settlement_date';
    sort[sortField] = sortOrder === 'asc' ? 1 : -1;
    if (sortField !== 'created_at') {
      sort.created_at = -1;
    }

    const settlements = await Settlement.find(filter).sort(sort);

    // Calculate aggregated metrics
    let totalPaid = 0;
    let totalReceived = 0;
    let pendingCount = 0;
    let pendingAmount = 0;
    let settledCount = 0;
    let settledAmount = 0;

    const personMap = {};

    settlements.forEach((s) => {
      const amt = parseFloat(s.amount) || 0;
      const pName = s.person_name || 'Unknown';

      if (!personMap[pName]) {
        personMap[pName] = {
          person_name: pName,
          totalReceived: 0,
          totalPaid: 0,
          net: 0,
          pendingCount: 0,
          pendingAmount: 0,
          settledCount: 0,
          settledAmount: 0,
          transactionsCount: 0
        };
      }

      personMap[pName].transactionsCount++;

      if (s.settlement_type === 'Paid') {
        totalPaid += amt;
        personMap[pName].totalPaid += amt;
      } else if (s.settlement_type === 'Received') {
        totalReceived += amt;
        personMap[pName].totalReceived += amt;
      }

      if (s.status === 'Pending') {
        pendingCount++;
        pendingAmount += amt;
        personMap[pName].pendingCount++;
        personMap[pName].pendingAmount += amt;
      } else {
        settledCount++;
        settledAmount += amt;
        personMap[pName].settledCount++;
        personMap[pName].settledAmount += amt;
      }

      // Net for person: Total Received - Total Paid
      personMap[pName].net = personMap[pName].totalReceived - personMap[pName].totalPaid;
    });

    const personBreakdown = Object.values(personMap).sort((a, b) => (b.totalReceived + b.totalPaid) - (a.totalReceived + a.totalPaid));

    res.status(200).json({
      success: true,
      count: settlements.length,
      summary: {
        totalPaid,
        totalReceived,
        net: totalReceived - totalPaid,
        pendingCount,
        pendingAmount,
        settledCount,
        settledAmount
      },
      personBreakdown,
      settlements
    });
  } catch (error) {
    console.error('Error in getSettlements:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve settlements.' });
  }
};

// GET /api/settlements/:id
const getSettlementById = async (req, res) => {
  try {
    const settlement = await findSettlementDoc(req.params.id);
    if (!settlement) {
      return res.status(404).json({ success: false, message: 'Settlement record not found.' });
    }

    if (req.user.role !== 'admin' && settlement.user_id !== req.user.id && settlement.user_id !== req.user.username) {
      return res.status(403).json({ success: false, message: 'Permission denied for this settlement.' });
    }

    res.status(200).json({ success: true, settlement });
  } catch (error) {
    console.error('Error in getSettlementById:', error);
    res.status(500).json({ success: false, message: 'Error retrieving settlement.' });
  }
};

// POST /api/settlements
const createSettlement = async (req, res) => {
  try {
    const { person_name, amount, settlement_type, settlement_date, status, notes } = req.body;

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Settlement amount must be a positive number greater than 0.'
      });
    }

    if (!person_name || !person_name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Person Name is required.'
      });
    }

    if (!['Paid', 'Received'].includes(settlement_type)) {
      return res.status(400).json({
        success: false,
        message: 'Settlement Type must be either "Paid" or "Received".'
      });
    }

    if (!settlement_date || isNaN(new Date(settlement_date).getTime())) {
      return res.status(400).json({
        success: false,
        message: 'A valid settlement date is required.'
      });
    }

    const settleStatus = ['Pending', 'Settled'].includes(status) ? status : 'Settled';
    const settlementId = await generateSettlementId();
    const creatorName = req.user.name || req.user.username || 'Admin';

    const newSettlement = new Settlement({
      settlement_id: settlementId,
      person_name: person_name.trim(),
      amount: parsedAmount,
      settlement_type,
      settlement_date: settlement_date.slice(0, 10),
      status: settleStatus,
      notes: (notes || '').trim(),
      user_id: req.user.id,
      user_name: creatorName,
      created_by: creatorName
    });

    const savedSettlement = await newSettlement.save();

    // Log Activity
    try {
      await ActivityLog.create({
        user_id: req.user.id,
        user_name: creatorName,
        action: `${creatorName} recorded settlement: ${settlement_type === 'Paid' ? 'Paid ₹' : 'Received ₹'}${parsedAmount.toLocaleString('en-IN')} ${settlement_type === 'Paid' ? 'to' : 'from'} ${person_name.trim()} (${settleStatus})`,
        expense_id: settlementId,
        amount: parsedAmount,
        category: 'Settle Up',
        title: `Settlement with ${person_name.trim()}`,
        details: notes || `${settlement_type} settlement recorded`,
        type: 'settlement_create'
      });
    } catch (actErr) {
      console.warn('Activity log notice:', actErr.message);
    }

    res.status(201).json({
      success: true,
      message: 'Settlement record created successfully.',
      settlement: savedSettlement
    });
  } catch (error) {
    console.error('Error in createSettlement:', error);
    res.status(500).json({ success: false, message: 'Server error creating settlement: ' + error.message });
  }
};

// PUT /api/settlements/:id
const updateSettlement = async (req, res) => {
  try {
    const settlement = await findSettlementDoc(req.params.id);
    if (!settlement) {
      return res.status(404).json({ success: false, message: 'Settlement record not found.' });
    }

    if (req.user.role !== 'admin' && settlement.user_id !== req.user.id && settlement.user_id !== req.user.username) {
      return res.status(403).json({ success: false, message: 'Permission denied: Cannot edit this settlement.' });
    }

    const { person_name, amount, settlement_type, settlement_date, status, notes } = req.body;

    if (amount !== undefined) {
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ success: false, message: 'Amount must be greater than 0.' });
      }
      settlement.amount = parsedAmount;
    }

    if (person_name !== undefined) {
      if (!person_name.trim()) {
        return res.status(400).json({ success: false, message: 'Person Name cannot be empty.' });
      }
      settlement.person_name = person_name.trim();
    }

    if (settlement_type !== undefined) {
      if (!['Paid', 'Received'].includes(settlement_type)) {
        return res.status(400).json({ success: false, message: 'Type must be Paid or Received.' });
      }
      settlement.settlement_type = settlement_type;
    }

    if (settlement_date !== undefined) {
      if (isNaN(new Date(settlement_date).getTime())) {
        return res.status(400).json({ success: false, message: 'Valid date is required.' });
      }
      settlement.settlement_date = settlement_date.slice(0, 10);
    }

    if (status !== undefined) {
      if (!['Pending', 'Settled'].includes(status)) {
        return res.status(400).json({ success: false, message: 'Status must be Pending or Settled.' });
      }
      settlement.status = status;
    }

    if (notes !== undefined) {
      settlement.notes = notes.trim();
    }

    settlement.updated_at = new Date();
    const updatedSettlement = await settlement.save();

    // Log Activity
    try {
      const creatorName = req.user.name || req.user.username;
      await ActivityLog.create({
        user_id: req.user.id,
        user_name: creatorName,
        action: `${creatorName} updated Settlement ${settlement.settlement_id} for ${settlement.person_name}`,
        expense_id: settlement.settlement_id,
        amount: settlement.amount,
        category: 'Settle Up',
        title: `Settlement updated: ${settlement.person_name}`,
        details: notes || 'Settlement record updated',
        type: 'settlement_update'
      });
    } catch (actErr) {
      console.warn('Activity log notice:', actErr.message);
    }

    res.status(200).json({
      success: true,
      message: 'Settlement updated successfully.',
      settlement: updatedSettlement
    });
  } catch (error) {
    console.error('Error in updateSettlement:', error);
    res.status(500).json({ success: false, message: 'Failed to update settlement.' });
  }
};

// PATCH /api/settlements/:id/status
const updateSettlementStatus = async (req, res) => {
  try {
    const settlement = await findSettlementDoc(req.params.id);
    if (!settlement) {
      return res.status(404).json({ success: false, message: 'Settlement record not found.' });
    }

    if (req.user.role !== 'admin' && settlement.user_id !== req.user.id && settlement.user_id !== req.user.username) {
      return res.status(403).json({ success: false, message: 'Permission denied.' });
    }

    const { status } = req.body;
    const targetStatus = ['Pending', 'Settled'].includes(status) ? status : (settlement.status === 'Pending' ? 'Settled' : 'Pending');

    settlement.status = targetStatus;
    settlement.updated_at = new Date();
    const saved = await settlement.save();

    // Log Activity
    try {
      const creatorName = req.user.name || req.user.username;
      await ActivityLog.create({
        user_id: req.user.id,
        user_name: creatorName,
        action: `${creatorName} changed Settlement ${settlement.settlement_id} status to ${targetStatus}`,
        expense_id: settlement.settlement_id,
        amount: settlement.amount,
        category: 'Settle Up',
        title: `Settlement ${targetStatus}`,
        details: `Status set to ${targetStatus}`,
        type: 'settlement_status'
      });
    } catch (actErr) {
      console.warn('Activity log notice:', actErr.message);
    }

    res.status(200).json({
      success: true,
      message: `Settlement status updated to ${targetStatus}.`,
      settlement: saved
    });
  } catch (error) {
    console.error('Error in updateSettlementStatus:', error);
    res.status(500).json({ success: false, message: 'Failed to change settlement status.' });
  }
};

// DELETE /api/settlements/:id
const deleteSettlement = async (req, res) => {
  try {
    const settlement = await findSettlementDoc(req.params.id);
    if (!settlement) {
      return res.status(404).json({ success: false, message: 'Settlement record not found.' });
    }

    if (req.user.role !== 'admin' && settlement.user_id !== req.user.id && settlement.user_id !== req.user.username) {
      return res.status(403).json({ success: false, message: 'Permission denied: Cannot delete this settlement.' });
    }

    const settleId = settlement.settlement_id;
    const personName = settlement.person_name;
    const amount = settlement.amount;

    await Settlement.deleteOne({ _id: settlement._id });

    // Log Activity
    try {
      const creatorName = req.user.name || req.user.username;
      await ActivityLog.create({
        user_id: req.user.id,
        user_name: creatorName,
        action: `${creatorName} deleted Settlement ${settleId} (₹${amount.toLocaleString('en-IN')} with ${personName})`,
        expense_id: settleId,
        amount,
        category: 'Settle Up',
        title: `Settlement deleted: ${personName}`,
        details: 'Settlement permanently removed',
        type: 'settlement_delete'
      });
    } catch (actErr) {
      console.warn('Activity log notice:', actErr.message);
    }

    res.status(200).json({
      success: true,
      message: `Settlement ${settleId} deleted permanently from MongoDB Atlas.`
    });
  } catch (error) {
    console.error('Error in deleteSettlement:', error);
    res.status(500).json({ success: false, message: 'Failed to delete settlement.' });
  }
};

module.exports = {
  getSettlements,
  getSettlementById,
  createSettlement,
  updateSettlement,
  updateSettlementStatus,
  deleteSettlement
};
