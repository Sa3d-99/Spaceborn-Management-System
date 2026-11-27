const User = require('../models/User');
const { businessDate } = require('../utils/businessTime');
const { effectiveRole } = require('../utils/terminationPermissions');
const { formatResponse } = require('../utils/helpers');
const { DEPARTMENTS, normalizeDepartments, normalizeDepartment } = require('../config/departments');

function accountDto(user) {
  const name = user.fullName || [user.firstName, user.lastName].filter(Boolean).join(' ');
  return {
    id: user.id, _id: user.id, employeeId: user.employeeId, name,
    firstName: user.firstName, lastName: user.lastName, email: user.email,
    phone: user.phone, department: normalizeDepartment(user.department), role: effectiveRole(user),
    designation: user.designation, manager: user.manager, joinDate: user.joinDate, dateOfBirth: user.dateOfBirth, createdAt: user.createdAt,
    isActive: user.isActive !== false, status: user.isActive === false ? 'Inactive' : 'Active',
    initials: name.split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase(),
    setupEmailStatus: !user.passwordChangedAt ? user.setupEmailStatus : undefined
  };
}

exports.getAllAccounts = async (_req, res) => {
  const users = await User.find().sort({ createdAt: -1 });
  return res.json(formatResponse(true, 'Accounts fetched successfully', users.map(accountDto)));
};

exports.getAccountStats = async (_req, res) => {
  const users = (await User.find()).map(accountDto);
  const month = businessDate().slice(0, 7);
  const byRole = Object.fromEntries(Object.keys(Object.groupBy(users, user => user.role))
    .map(role => [role, users.filter(user => role === user.role).length]));
  const byDepartment = normalizeDepartments([...DEPARTMENTS, ...users.map(user => user.department)]).map(department => {
    const members = users.filter(user => user.department === department);
    const lead = members.find(user => user.isActive && user.role === 'Team Lead');
    return { department, members: members.length, lead: lead?.name || 'Not Assigned' };
  });
  return res.json(formatResponse(true, 'Stats fetched successfully', {
    totalCreated: users.length,
    thisMonth: users.filter(user => user.createdAt?.startsWith(month)).length,
    byRole, byDepartment
  }));
};
