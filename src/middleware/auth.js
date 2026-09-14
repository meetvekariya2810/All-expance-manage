const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
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
    req.user = decoded;
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

