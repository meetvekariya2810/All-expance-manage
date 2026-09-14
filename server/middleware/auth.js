const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authMiddleware = async (req, res, next) => {
  let token = null;
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'smart_expense_super_secret_jwt_key_2026!');
    
    // Live database status check: ensure account still exists and is not disabled
    try {
      const user = await User.findOne({ 
        $or: [{ _id: decoded.id }, { id: decoded.id }, { username: decoded.username }] 
      }).select('-password');

      if (!user) {
        return res.status(401).json({ success: false, message: 'User account not found. Please login again.' });
      }

      if (user.status === 'disabled') {
        return res.status(403).json({ success: false, message: 'Account has been disabled by Administrator.' });
      }

      req.user = {
        id: user._id || user.id,
        _id: user._id || user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status
      };
    } catch (dbErr) {
      // Fallback to token payload if DB query fails during disconnection
      req.user = decoded;
    }

    next();
  } catch (ex) {
    return res.status(401).json({ success: false, message: 'Invalid or expired session token. Please login again.' });
  }
};

const verifyAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ success: false, message: 'Forbidden. Admin privileges required.' });
  }
};

module.exports = { authMiddleware, verifyAdmin };
