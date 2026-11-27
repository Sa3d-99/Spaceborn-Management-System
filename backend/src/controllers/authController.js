const { setTimeout: wait } = require('node:timers/promises');
const { query } = require('../config/db');
const User = require('../models/User');
const { effectiveRole } = require('../utils/terminationPermissions');
const { formatResponse } = require('../utils/helpers');
const { hashPassword, newPasswordFields, passwordError, passwordHashAlgorithm, verifyPassword } = require('../utils/passwords');
const { emailSettings } = require('../services/emailService');
const { emailResetLink, getResetAccount, isResetLinkValid, redeemResetLink } = require('../services/passwordResetService');
const { markLoginAttendance } = require('./attendanceController');
const { recordLoginActivity } = require('../services/loginActivity');
const {
  twoFactorRequired, startChallenge, verifyChallenge, getChallengeAccount, acceptCode, resetTwoFactor
} = require('../services/twoFactor');
const {
  normalizeIdentifier, findAccount, attemptId, lockedUntil, recordFailure, clearFailures, acceptResetRequest,
  createSession, revokeSession, revokeUserSessions
} = require('../services/authState');

const dummyPasswordHash = '$2b$12$T8.TPfCDyeFbj6CCUpFc1eDEsPxgbJRz3k2P/pD9fJ4sfbAAS5ivu';

function publicAccount(user) {
  return {
    id: user.id,
    employeeId: user.employeeId,
    name: user.fullName || user.name || [user.firstName, user.lastName].filter(Boolean).join(' '),
    email: user.email,
    role: effectiveRole(user),
    timeZone: user.timeZone,
    department: user.department,
    phone: user.phone,
    joinDate: user.joinDate,
    designation: user.designation,
    team: user.team,
    manager: user.manager,
    mustChangePassword: user.mustChangePassword === true
  };
}

// Legacy clients use the same employee ID allocation and setup email flow.
exports.register = require('./userController').createEmployee;

function reportLock(res, until) {
  const remainingMinutes = Math.ceil((until - Date.now()) / 60_000);
  res.set('Retry-After', String(Math.ceil((until - Date.now()) / 1000)));
  return res.status(429).json({
    ...formatResponse(false, `Account locked. Try again in ${remainingMinutes} minute${remainingMinutes === 1 ? '' : 's'}.`, { remainingMinutes }),
    error: 'ACCOUNT_LOCKED'
  });
}

async function finishLogin(account, res, twoFactor = false, backupCodes) {
  const session = await createSession(account, { twoFactor });
  if (!session) return res.status(401).json(formatResponse(false, 'Invalid credentials'));
  if (!account.mustChangePassword) {
    const now = new Date().toISOString();
    await User.findByIdAndUpdate(account.id, { isOnline: true, lastSeen: now, lastLogin: now });
    await Promise.all([
      recordLoginActivity(account.id, 'login'),
      markLoginAttendance(publicAccount(account)).catch(() => console.error('Could not mark sign-in attendance.'))
    ]);
  }
  return res.json(formatResponse(true, 'Login successful', {
    user: publicAccount(account), ...session, ...(backupCodes ? { backupCodes } : {})
  }));
}

exports.login = async (req, res) => {
  const identifier = normalizeIdentifier(req.body?.employeeId);
  const { password } = req.body || {};
  if (!identifier || typeof password !== 'string' || !password) {
    return res.status(400).json(formatResponse(false, 'Please provide employee ID and password'));
  }
  if ([...password.normalize('NFC')].length > 64) {
    return res.status(400).json(formatResponse(false, 'Password must be 64 characters or fewer.'));
  }

  const account = await findAccount(identifier);
  const attempt = attemptId('password', account, identifier);
  const until = await lockedUntil(attempt);
  if (until > Date.now()) return reportLock(res, until);

  const active = Boolean(account?.password && account.isActive !== false);
  const isMatch = await verifyPassword(password, active ? account.password : dummyPasswordHash, active && account.passwordAlgorithm);
  if (!active || !isMatch) {
    const locked = await recordFailure(attempt);
    return locked > Date.now()
      ? reportLock(res, locked)
      : res.status(401).json(formatResponse(false, 'Invalid credentials'));
  }
  const currentLock = await lockedUntil(attempt);
  if (currentLock > Date.now()) return reportLock(res, currentLock);
  await clearFailures(attempt);
  if (account.password.startsWith('scrypt:')) {
    const upgraded = await hashPassword(password);
    await query(`
      UPDATE users SET data = data || jsonb_build_object('password', $2::text, 'passwordAlgorithm', $3::text)
      WHERE id = $1 AND data->>'password' = $4
    `, [account.id, upgraded, passwordHashAlgorithm(password), account.password]);
  }
  if (twoFactorRequired(account)) {
    const until = await lockedUntil(attemptId('two-factor', account));
    if (until > Date.now()) return reportLock(res, until);
    return res.json(formatResponse(true, 'Verify two-factor authentication.', { twoFactor: startChallenge(account) }));
  }
  return finishLogin(account, res);
};

exports.confirmTwoFactor = async (req, res) => {
  const challenge = verifyChallenge(req.body?.challengeToken);
  const account = challenge && await getChallengeAccount(challenge);
  if (!account) return res.status(401).json(formatResponse(false, 'This sign-in step expired. Enter your password again.'));

  const attempt = attemptId('two-factor', account);
  const until = await lockedUntil(attempt);
  if (until > Date.now()) return reportLock(res, until);
  const accepted = await acceptCode(account, challenge, req.body?.code);
  if (!accepted) {
    const locked = await recordFailure(attempt);
    return locked > Date.now()
      ? reportLock(res, locked)
      : res.status(401).json({
        ...formatResponse(false, 'Invalid or already used verification code.'),
        error: 'INVALID_TWO_FACTOR_CODE'
      });
  }
  await clearFailures(attempt);
  return finishLogin(account, res, true, accepted.backupCodes);
};

exports.resetEmployeeTwoFactor = async (req, res) => {
  const status = await resetTwoFactor(req.user, req.params.id);
  if (status === 'missing') return res.status(404).json(formatResponse(false, 'Employee not found.'));
  if (status === 'forbidden') return res.status(403).json(formatResponse(false, 'You do not have permission to reset two-factor authentication for this employee.'));
  if (status === 'conflict') return res.status(409).json(formatResponse(false, 'Employee changed. Try again.'));
  return res.json(formatResponse(true, 'Two-factor authentication was reset. The employee must enroll again when required.'));
};

exports.logout = async (req, res) => {
  const isOnline = await revokeSession(req.user.sid, req.user.id);
  await User.findByIdAndUpdate(req.user.id, { isOnline, lastSeen: new Date() });
  if (!req.user.mustChangePassword) await recordLoginActivity(req.user.id, 'logout');
  return res.json(formatResponse(true, 'Logged out'));
};

exports.getMe = (req, res) => res.json(formatResponse(true, 'User fetched', {
  ...publicAccount(req.user),
  sessionExpiresAt: req.user.exp * 1000
}));

exports.requestPasswordReset = async (req, res) => {
  const identifier = normalizeIdentifier(req.body?.employeeId);
  if (!identifier) return res.status(400).json(formatResponse(false, 'Employee ID is required'));
  const emailFormat = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const idFormat = /^(?:[A-Z][A-Z0-9-]*\d{3,}|INTS\d+)$/;
  if (!(identifier.includes('@') ? emailFormat : idFormat).test(identifier)) {
    return res.status(400).json(formatResponse(false, 'Enter a valid employee ID or email address.'));
  }

  const sender = emailSettings();
  if (!sender) {
    return res.status(503).json(formatResponse(false, 'Reset email could not be sent right now. Try again later.'));
  }
  const account = await findAccount(identifier);
  if (!await acceptResetRequest(attemptId('reset', account, identifier))) {
    return res.status(429).json(formatResponse(false, 'Too many requests'));
  }

  // Use the same response window for active, inactive and unknown accounts.
  const responseDelay = wait(2750);
  try {
    if (account && account.isActive !== false) await emailResetLink(account.id, sender);
  } catch {
    console.error('Password reset request failed.');
  }
  await responseDelay;
  return res.status(202).json(formatResponse(true,
    'Request received. Only active, registered CRM accounts receive a reset link at their saved email address.'));
};

function invalidResetLink(res) {
  return res.status(400).json({
    ...formatResponse(false, 'This reset link is invalid or has expired'),
    error: 'INVALID_RESET_LINK'
  });
}

exports.validatePasswordReset = async (req, res) => {
  if (!await isResetLinkValid(req.body?.token)) return invalidResetLink(res);
  return res.json(formatResponse(true, 'Reset link is valid.'));
};

exports.resetPassword = async (req, res) => {
  const { token, newPassword } = req.body || {};
  const account = await getResetAccount(token);
  if (!account) return invalidResetLink(res);

  const policyError = passwordError(newPassword, account);
  if (policyError) return res.status(400).json(formatResponse(false, policyError));
  const result = await redeemResetLink(token, newPassword);
  if (!result) return invalidResetLink(res);
  if (result.setupEmployeeId) {
    return res.json(formatResponse(true, 'Password created. Sign in to open your team.', result));
  }
  return res.json(formatResponse(true, 'Password updated. Sign in with your new password.'));
};

exports.changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (typeof currentPassword !== 'string' || !currentPassword) {
    return res.status(400).json(formatResponse(false, 'Current password is required.'));
  }
  const { rows: [row] } = await query('SELECT data FROM users WHERE id = $1', [req.user.id]);
  const account = row?.data;
  if (!account) return res.status(401).json(formatResponse(false, 'Sign in again.'));

  const policyError = passwordError(newPassword, account);
  if (policyError) return res.status(400).json(formatResponse(false, policyError));
  if (currentPassword.normalize('NFC') === newPassword.normalize('NFC')) {
    return res.status(400).json(formatResponse(false, 'Choose a different password.'));
  }
  if (!await verifyPassword(currentPassword, account.password, account.passwordAlgorithm)) {
    return res.status(400).json(formatResponse(false, 'Current password is incorrect.'));
  }

  const passwordData = await newPasswordFields(newPassword);
  const { rows } = await query(`
    UPDATE users SET data = data || $2::jsonb, updated_at = NOW()
    WHERE id = $1 AND (data->>'passwordVersion') IS NOT DISTINCT FROM $3
      AND (data->>'isActive') IS DISTINCT FROM 'false'
    RETURNING id
  `, [req.user.id, JSON.stringify(passwordData), account.passwordVersion || null]);
  if (!rows.length) return res.status(409).json(formatResponse(false, 'Password changed in another session. Sign in again.'));
  await revokeUserSessions(req.user.id);
  return res.json(formatResponse(true, 'Password changed. Sign in with your new password.'));
};

exports.updatePreferences = async (req, res) => {
  const { timeZone } = req.body || {};
  if (typeof timeZone !== 'string' || !timeZone || timeZone.length > 128) {
    return res.status(400).json(formatResponse(false, 'Select a supported time zone.'));
  }

  try {
    new Intl.DateTimeFormat('en', { timeZone });
  } catch {
    return res.status(400).json(formatResponse(false, 'Select a supported time zone.'));
  }

  await User.findByIdAndUpdate(req.user.id, { timeZone });
  return res.json(formatResponse(true, 'Time zone saved.', { timeZone }));
};
