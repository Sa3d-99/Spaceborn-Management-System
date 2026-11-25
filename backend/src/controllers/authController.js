const { setTimeout: wait } = require('node:timers/promises');
const User = require('../models/User');
const { effectiveRole, canAssignEmployeeRole } = require('../utils/terminationPermissions');
const { formatResponse } = require('../utils/helpers');
const { passwordError } = require('../utils/passwords');
const { emailSettings } = require('../services/emailService');
const { emailResetLink, isResetToken, isResetLinkValid, redeemResetLink } = require('../services/passwordResetService');

// Register new user
exports.register = async (req, res) => {
  try {
    const { email, password, name, role, department, employeeId, phone, joinDate, designation } = req.body || {};
    const accountRole = effectiveRole({ role: role || 'Member', designation });
    
    const policyError = passwordError(password);
    if (policyError) return res.status(400).json(formatResponse(false, policyError));
    if (typeof name !== 'string' || !name.trim() || typeof email !== 'string' || typeof employeeId !== 'string') {
      return res.status(400).json(formatResponse(false, 'Name, email and employee ID are required'));
    }
    if (!canAssignEmployeeRole(req.user.role, accountRole)) {
      return res.status(403).json(formatResponse(false, 'You do not have permission to assign this role'));
    }

    // Check if user exists
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedId = employeeId.trim().toUpperCase();
    const existingUser = await User.findOne({ $or: [{ email: normalizedEmail }, { employeeId: normalizedId }] });
    if (existingUser) {
      return res.status(400).json(formatResponse(false, 'User already exists'));
    }
    
    // Create user
    const nameParts = name.split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ') || firstName;
    
    const user = await User.create({
      email: normalizedEmail,
      password,
      firstName,
      lastName,
      role: accountRole,
      department: department || 'Core Systems',
      employeeId: normalizedId,
      phone,
      joinDate,
      designation,
      createdBy: req.user?._id,
      createdByName: req.user?.fullName
    });
    
    // Generate token
    const token = user.getSignedJwtToken();
    
    res.status(201).json(formatResponse(true, 'User registered', {
      user: {
        id: user._id,
        employeeId: user.employeeId,
        name: user.fullName,
        email: user.email,
        role: effectiveRole(user),
        timeZone: user.timeZone,
        department: user.department
      },
      token
    }));
  } catch (error) {
    res.status(500).json(formatResponse(false, error.message));
  }
};

// Login
exports.login = async (req, res) => {
  try {
    const { employeeId, password } = req.body || {};
    
    if (typeof employeeId !== 'string' || !employeeId.trim() || typeof password !== 'string' || !password) {
      return res.status(400).json(formatResponse(false, 'Please provide an employee ID or email and a password'));
    }
    
    const identifier = employeeId.trim();
    const lookup = identifier.includes('@') ? { email: identifier.toLowerCase() } : { employeeId: identifier.toUpperCase() };
    const user = await User.findOne(lookup).select('+password');
    if (!user || user.isActive === false) {
      return res.status(401).json(formatResponse(false, 'Invalid credentials'));
    }
    
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json(formatResponse(false, 'Invalid credentials'));
    }
    
    user.isOnline = true;
    user.lastSeen = new Date();
    await user.save();

    const token = user.getSignedJwtToken();
    
    res.json(formatResponse(true, 'Login successful', {
      user: {
        id: user._id,
        employeeId: user.employeeId,
        name: user.fullName,
        email: user.email,
        role: effectiveRole(user),
        timeZone: user.timeZone,
        department: user.department
      },
      token
    }));
  } catch (error) {
    res.status(500).json(formatResponse(false, error.message));
  }
};

// Logout
exports.logout = async (req, res) => {
  try {
    if (req.user?.id) {
      await User.findByIdAndUpdate(req.user.id, {
        isOnline: false,
        lastSeen: new Date()
      });
    }
  } catch (error) {
    console.error('Logout update error:', error);
  }

  res.json(formatResponse(true, 'Logged out'));
};

// Get current user
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id || req.user._id).select('-password');
    if (!user) {
      return res.status(404).json(formatResponse(false, 'User not found'));
    }

    res.json(formatResponse(true, 'User fetched', {
      id: user._id,
      employeeId: user.employeeId,
      name: user.fullName || `${user.firstName || ''} ${user.lastName || ''}`.trim(),
      email: user.email,
      role: effectiveRole(user),
      timeZone: user.timeZone,
      department: user.department,
      phone: user.phone,
      joinDate: user.joinDate,
      designation: user.designation,
      team: user.team,
      manager: user.manager
    }));
  } catch (error) {
    res.status(500).json(formatResponse(false, error.message));
  }
};

exports.requestPasswordReset = async (req, res) => {
  const employeeId = typeof req.body?.employeeId === 'string' ? req.body.employeeId.trim() : '';
  if (!employeeId || employeeId.length > (employeeId.includes('@') ? 254 : 64)) {
    return res.status(400).json(formatResponse(false, 'Enter a valid employee ID or email.'));
  }

  const sender = emailSettings();
  if (!sender) {
    return res.status(503).json(formatResponse(false, 'Reset email could not be sent right now. Try again later.'));
  }

  // A common response window covers the provider timeout and obscures account lookup timing.
  const responseDelay = wait(2750);
  try {
    await emailResetLink(employeeId, sender);
  } catch (error) {
    console.error('Password reset request failed:', error.message);
  }
  await responseDelay;
  return res.status(202).json(formatResponse(true, 'If the account can be reset, a link will be sent to its registered email.'));
};

function invalidResetLink(res) {
  return res.status(400).json({
    ...formatResponse(false, 'This link is invalid, expired, or already used. Request a new link.'),
    error: 'INVALID_RESET_LINK'
  });
}

exports.validatePasswordReset = async (req, res) => {
  if (!await isResetLinkValid(req.body?.token)) return invalidResetLink(res);
  return res.json(formatResponse(true, 'Reset link is valid.'));
};

exports.resetPassword = async (req, res) => {
  const { token, newPassword } = req.body || {};
  if (!isResetToken(token)) return invalidResetLink(res);

  const policyError = passwordError(newPassword);
  if (policyError) return res.status(400).json(formatResponse(false, policyError));

  try {
    if (!await redeemResetLink(token, newPassword)) return invalidResetLink(res);
    return res.json(formatResponse(true, 'Password updated. Sign in with your new password.'));
  } catch (error) {
    console.error('Password reset failed:', error.message);
    return res.status(500).json(formatResponse(false, 'Password reset failed. Please try again.'));
  }
};

exports.changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  const policyError = passwordError(newPassword);
  if (policyError) return res.status(400).json(formatResponse(false, policyError));
  if (currentPassword === newPassword) {
    return res.status(400).json(formatResponse(false, 'Choose a different password.'));
  }

  try {
    const user = await User.findById(req.user.id);
    if (!user || !await user.comparePassword(currentPassword)) {
      return res.status(401).json(formatResponse(false, 'Current password is incorrect.'));
    }
    user.password = newPassword;
    await user.save();
    return res.json(formatResponse(true, 'Password changed. Sign in with your new password.'));
  } catch (error) {
    console.error('Password change failed:', error.message);
    return res.status(500).json(formatResponse(false, 'Password change failed. Please try again.'));
  }
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
