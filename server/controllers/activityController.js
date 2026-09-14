const ActivityLog = require('../models/ActivityLog');
const User = require('../models/User');

const getActivities = async (req, res) => {
  try {
    const { role, id: userId, username } = req.user;
    const { user, limit = 20, page = 1 } = req.query;

    let filter = {};

    // Strict role scoping
    if (role !== 'admin') {
      filter.$or = [{ user_id: userId }, { user_id: username }];
    } else if (user && user !== 'all') {
      const targetUser = await User.findOne({
        $or: [{ _id: user }, { id: user }, { username: user }]
      });
      if (targetUser) {
        filter.$or = [
          { user_id: targetUser._id },
          { user_id: targetUser.username },
          { user_name: new RegExp(targetUser.name, 'i') }
        ];
      } else {
        filter.user_id = user;
      }
    }

    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const pageNum = Math.max(1, parseInt(page) || 1);

    const total = await ActivityLog.countDocuments(filter);
    const activities = await ActivityLog.find(filter)
      .sort({ timestamp: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);

    res.json({
      success: true,
      activities,
      total,
      page: pageNum,
      limit: limitNum
    });
  } catch (error) {
    console.error('Error fetching activities:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve activity log.' });
  }
};

module.exports = {
  getActivities
};
