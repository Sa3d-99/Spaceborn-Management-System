const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../utils/jwtSecret');
const User = require('../models/User');
const { effectiveRole } = require('../utils/terminationPermissions');

// Simple auth middleware.
// NOTE: Keep response JSON-based so frontend can handle it (avoid HTML 404 pages).
const protect = async (req, res, next) => {
  const header = req.headers.authorization;
  const token = header?.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'No token, authorization denied',
      error: 'NO_TOKEN'
    });
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret());
    const user = await User.findById(decoded.id).select('-password');

    if (!user || user.isActive === false || decoded.pv !== user.passwordVersion) {
      return res.status(401).json({
        success: false,
        message: 'This session is no longer valid. Sign in again.',
        error: 'INVALID_TOKEN'
      });
    }

    await User.findByIdAndUpdate(user._id, {
      isOnline: true,
      lastSeen: new Date()
    });

    req.user = {
      ...decoded,
      id: String(user._id),
      _id: user._id,
      employeeId: user.employeeId,
      name: user.fullName || `${user.firstName || ''} ${user.lastName || ''}`.trim(),
      email: user.email,
      role: effectiveRole(user),
      designation: user.designation,
      managerId: user.managerId,
      department: user.department,
      team: user.team,
      manager: user.manager,
      joinDate: user.joinDate
    };
    return next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Token is not valid',
      error: 'INVALID_TOKEN'
    });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized',
        error: 'FORBIDDEN'
      });
    }
    return next();
  };
};

module.exports = { protect, authorize };
