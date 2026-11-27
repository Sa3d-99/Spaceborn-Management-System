const jwt = require('jsonwebtoken');
const { query } = require('../config/db');
const { getJwtSecret } = require('../utils/jwtSecret');
const { effectiveRole } = require('../utils/terminationPermissions');
const { verifySession } = require('../services/authState');

const invalidToken = res => res.status(401).json({
  success: false,
  message: 'This session is no longer valid. Sign in again.',
  error: 'INVALID_TOKEN'
});

const restrictedAccountRoutes = new Set([
  'POST /change-password', 'POST /logout', 'GET /me', 'GET /verify', 'HEAD /me', 'HEAD /verify'
]);

const protect = async (req, res, next) => {
  const token = /^Bearer\s+(\S+)$/i.exec(req.headers.authorization || '')?.[1];
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'No token, authorization denied',
      error: 'NO_TOKEN'
    });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'] });
  } catch {
    return invalidToken(res);
  }
  if (typeof decoded.id !== 'string' || decoded.purpose) return invalidToken(res);

  const { rows: [row] } = await query('SELECT data, two_factor IS NOT NULL AS enrolled FROM users WHERE id = $1', [decoded.id]);
  const user = row?.data;
  if (!user || user.isActive === false || decoded.pv !== user.passwordVersion) return invalidToken(res);
  if ((row.enrolled || process.env.REQUIRE_TWO_FACTOR_AUTH === 'true') && decoded.mfa !== true) return invalidToken(res);

  if (decoded.sid && !await verifySession(decoded.sid, decoded.id)) return invalidToken(res);
  if (user.mustChangePassword === true &&
    !(req.baseUrl === '/api/auth' && restrictedAccountRoutes.has(`${req.method} ${req.path}`))) {
    return res.status(403).json({
      success: false,
      message: 'Change your temporary password before continuing.',
      error: 'PASSWORD_CHANGE_REQUIRED'
    });
  }

  req.user = {
    id: decoded.id,
    _id: decoded.id,
    sid: decoded.sid,
    exp: decoded.exp,
    employeeId: user.employeeId,
    name: user.fullName || user.name || [user.firstName, user.lastName].filter(Boolean).join(' '),
    email: user.email,
    role: effectiveRole(user),
    designation: user.designation,
    managerId: user.managerId,
    department: user.department,
    team: user.team,
    manager: user.manager,
    joinDate: user.joinDate,
    phone: user.phone,
    timeZone: user.timeZone,
    mustChangePassword: user.mustChangePassword === true
  };
  return next();
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
