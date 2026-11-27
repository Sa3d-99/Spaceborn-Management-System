const express = require('express');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/authMiddleware');
const { normalizeDepartment } = require('../config/departments');
const { effectiveRole } = require('../utils/terminationPermissions');
const router = express.Router();

const teamLeads = ['Team Lead', 'CO Head'];
const canList = authorize('CEO', 'COO', 'Manager', 'HR', ...teamLeads);
const memberName = user => user.fullName || [user.firstName, user.lastName].filter(Boolean).join(' ');

async function teamMembers(department) {
  const users = await User.find({ isActive: true, signupDepartment: { $exists: false } });
  return department ? users.filter(user => normalizeDepartment(user.department) === department) : users;
}

function rosterEntry(user) {
  const name = memberName(user);
  return {
    id: user.id, employeeId: user.employeeId, name, role: effectiveRole(user),
    department: normalizeDepartment(user.department), email: user.email,
    initials: name.split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase()
  };
}

router.get('/team-members/mine', protect, async (req, res) => {
  const department = normalizeDepartment(req.user.department);
  const employees = department ? await teamMembers(department) : [];
  const members = employees.map(user => ({ id: user.id, name: memberName(user), role: effectiveRole(user) }));
  return res.json({ success: true, data: { department, members } });
});

router.get('/team-members', protect, canList, async (req, res) => {
  const department = normalizeDepartment(typeof req.query.department === 'string' ? req.query.department : '');
  if (!department) return res.status(400).json({ success: false, message: 'Department is required' });
  if (teamLeads.includes(req.user.role) && normalizeDepartment(req.user.department) !== department) {
    return res.status(403).json({ success: false, message: 'Only your department team can be viewed' });
  }
  return res.json({ success: true, employees: (await teamMembers(department)).map(rosterEntry) });
});

router.get('/team-members/all', protect, canList, async (req, res) => {
  const department = teamLeads.includes(req.user.role) ? normalizeDepartment(req.user.department) : null;
  const users = teamLeads.includes(req.user.role) && !department ? [] : await teamMembers(department);
  return res.json({ success: true, employees: users.map(rosterEntry) });
});

module.exports = router;
