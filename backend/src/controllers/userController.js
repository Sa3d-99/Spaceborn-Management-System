const User = require('../models/User');
const { formatResponse } = require('../utils/helpers');
const { uploadEmployeeDocumentToDrive } = require('../services/googleDriveService');
const { randomUUID } = require('node:crypto');
const { canTerminateUser, canAssignEmployeeRole, canChangeEmployeeRole, effectiveRole } = require('../utils/terminationPermissions');
const { validateEmployeeFields, cleanText } = require('../utils/employeeFields');
const { businessDate } = require('../utils/businessTime');
const { emailSettings } = require('../services/emailService');
const { emailAdminResetLink } = require('../services/passwordResetService');
const { extname } = require('node:path');
const { readEmployeeWorkbook } = require('../services/employeeWorkbook');
const { queueEmployeeSetupEmail } = require('../services/employeeSetupEmailService');
const {
  allocateEmployeeIds, withEmployeeIdentityLock, emailOwner,
  newEmployee, insertEmployees, updateEmployees, removeEmployee
} = require('../services/employeeDirectoryService');
const Leave = require('../models/Leave');
const LeaveBalance = require('../models/LeaveBalance');
const { DEPARTMENTS, normalizeDepartment, normalizeDepartments } = require('../config/departments');

const getFullName = (user) =>
  user?.fullName || user?.name || [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();

const buildDriveUrls = (fileId, webViewLink, webContentLink) => ({
  fileUrl: webContentLink || `https://drive.google.com/uc?export=download&id=${fileId}`,
  viewUrl: webViewLink || `https://drive.google.com/file/d/${fileId}/view`
});

const applyDocumentToDto = (employee, documentType, document) => {
  const docs = employee.documents || {};

  if (docs.profile_photo) employee.profilePhoto = docs.profile_photo;
  if (docs.aadhaar) employee.aadhaar = { ...(employee.aadhaar || {}), ...docs.aadhaar };
  if (docs.pan) employee.pan = { ...(employee.pan || {}), ...docs.pan };
  if (docs.resume) employee.resume = docs.resume;
  if (docs.nda) employee.nda = { ...(employee.nda || {}), ...docs.nda };
  if (docs.code_of_conduct) employee.codeOfConduct = { ...(employee.codeOfConduct || {}), ...docs.code_of_conduct };
  if (docs.ip_agreement) employee.ipAgreement = { ...(employee.ipAgreement || {}), ...docs.ip_agreement };
  if (Array.isArray(docs.education)) {
    employee.education = { ...(employee.education || {}), documents: docs.education };
  }
  if (Array.isArray(docs.onboarding)) employee.onboardingDocs = docs.onboarding;

  if (documentType && document) {
    employee.lastUploadedDocument = document;
  }

  return employee;
};

const mergeEmployeeDocument = (documents = {}, documentType, document) => {
  const nextDocuments = { ...documents };

  if (documentType === 'education' || documentType === 'onboarding') {
    nextDocuments[documentType] = [...(Array.isArray(nextDocuments[documentType]) ? nextDocuments[documentType] : []), document];
    return nextDocuments;
  }

  nextDocuments[documentType] = {
    ...(nextDocuments[documentType] || {}),
    ...document,
    ...(documentType === 'resume' ? { version: ((nextDocuments.resume && nextDocuments.resume.version) || 0) + 1 } : {}),
    ...(documentType === 'nda' ? { signed: true, signedDate: document.uploaded } : {}),
    ...(documentType === 'code_of_conduct' ? { signed: true, accepted: true, signedDate: document.uploaded } : {}),
    ...(documentType === 'ip_agreement' ? { signed: true, accepted: true, signedDate: document.uploaded } : {})
  };

  return nextDocuments;
};

const toEmployeeDto = (user) => {
  if (!user) return null;
  const plain = typeof user.toObject === 'function' ? user.toObject() : user;
  const name = getFullName(plain);

  const employee = {
    id: plain._id,
    _id: plain._id,
    employeeId: plain.employeeId,
    name,
    firstName: plain.firstName,
    lastName: plain.lastName,
    email: plain.email,
    phone: plain.phone || '',
    role: effectiveRole(plain),
    department: normalizeDepartment(plain.department || ''),
    designation: plain.designation || '',
    team: plain.team || '',
    manager: plain.manager || '',
    managerId: plain.managerId,
    joinDate: plain.joinDate,
    dateOfBirth: plain.dateOfBirth,
    status: plain.isActive === false ? 'Inactive' : plain.onLeave ? 'On Leave' : 'Active',
    employmentStatus: plain.isActive === false ? 'inactive' : plain.onLeave ? 'on-leave' : 'active',
    isOnboarded: plain.isOnboarded ?? (!plain.mustChangePassword && Boolean(plain.passwordChangedAt || plain.lastLogin)),
    ndaSigned: Boolean(plain.ndaSigned || plain.documents?.nda?.signed),
    setupEmailStatus: !plain.passwordChangedAt ? plain.setupEmailStatus : undefined,
    lastLogin: plain.lastLogin || plain.lastLoginAt,
    isActive: plain.isActive !== false,
    isOnline: plain.isActive !== false && Boolean(plain.isOnline),
    lastSeen: plain.lastSeen,
    terminatedAt: plain.terminatedAt,
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt,
    documents: plain.documents || {},
  };

  return applyDocumentToDto(employee);
};

const leadership = ['CEO', 'COO', 'Manager', 'HR'];
const leadRoles = ['Team Lead', 'CO Head'];
const scopesEmployee = (actor, target) => leadership.includes(actor.role) ||
  (leadRoles.includes(actor.role) && normalizeDepartment(actor.department) === normalizeDepartment(target.department));

function employeeDirectoryError(res, error) {
  const status = error.status || 500;
  if (status === 500) console.error('Employee directory error:', error.code || error.message);
  return res.status(status).json(formatResponse(false, status === 500 ? 'Could not complete the employee request.' : error.message));
}

function readFilters(req) {
  const { department, role, status, search } = req.query;
  const query = {};
  if (department && !/^all$/i.test(department)) query.department = normalizeDepartment(department);
  if (role && !/^all$/i.test(role)) query.role = role;
  const name = cleanText(search);
  if (typeof search !== 'undefined' && (typeof search !== 'string' || name.length > 100)) {
    throw Object.assign(new Error('Search must be at most 100 characters.'), { status: 400 });
  }
  if (name) {
    const literal = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    query.$or = ['firstName', 'lastName', 'fullName', 'employeeId', 'email']
      .map(field => ({ [field]: { $regex: literal, $options: 'i' } }));
  }
  return { query, status };
}

function employeeActions(actor, target) {
  const allowed = canTerminateUser(actor, target);
  return { canDeactivate: allowed, canTerminate: allowed, canResetPassword: allowed };
}

async function findReportingManager(user) {
  const reference = String(user.manager || '').trim();
  const manager = (user.managerId && await User.findById(user.managerId)) ||
    (reference && await User.findOne({ $or: [
      { employeeId: reference.toUpperCase() }, { email: reference.toLowerCase() },
      { fullName: reference }
    ] }));
  return manager && { id: manager.id, name: getFullName(manager) };
}

async function employeeDetails(user, actor) {
  const manager = await findReportingManager(user);
  const leaveBalance = await currentLeaveBalance(user);
  return {
    ...toEmployeeDto(user), ...employeeActions(actor, user), leaveBalance,
    manager: manager?.name || user.manager || '', managerId: manager?.id,
  };
}

async function listEmployees(req, res) {
  try {
    const { query, status } = readFilters(req);
    const date = businessDate();
    const [employees, leaves] = await Promise.all([
      User.find(query).sort({ createdAt: -1 }),
      Leave.find({ startDate: { $lte: date }, endDate: { $gte: date }, status: 'Approved' })
    ]);
    const onLeave = new Set(leaves.flatMap(leave => [leave.userId, leave.employeeId]));
    const data = employees.filter(user => scopesEmployee(req.user, user)).map(user => ({
      ...toEmployeeDto({ ...user, onLeave: onLeave.has(user.id) || onLeave.has(user.employeeId) }),
      ...employeeActions(req.user, user)
    })).filter(user => !status || /^all$/i.test(status) || user.status.toLowerCase() === String(status).toLowerCase());

    return res.json(formatResponse(true, 'Employees fetched successfully', data));
  } catch (error) {
    return employeeDirectoryError(res, error);
  }
}

exports.createEmployee = async (req, res) => {
  try {
    const body = req.body || {};
    const { fields, errors } = validateEmployeeFields(body);
    if (errors.length) return res.status(400).json(formatResponse(false, errors[0], errors));
    if (!canAssignEmployeeRole(req.user.role, fields.role)) {
      return res.status(403).json(formatResponse(false, 'You cannot assign this role'));
    }
    const user = await withEmployeeIdentityLock(async client => {
      if (await emailOwner(client, fields.email)) return null;
      const [employeeId] = await allocateEmployeeIds(fields.role, 1, client);
      const record = newEmployee({
        ...fields, fullName: [fields.firstName, fields.lastName].join(' '),
        team: cleanText(body.team), manager: cleanText(body.manager) || getFullName(req.user),
        managerId: cleanText(body.managerId) || (cleanText(body.manager) ? undefined : req.user.id),
        createdBy: req.user.id, createdByName: getFullName(req.user), isActive: true
      }, employeeId);
      await insertEmployees(client, [record]);
      return record;
    });
    if (!user) return res.status(400).json(formatResponse(false, 'Email already exists'));
    const employee = toEmployeeDto(user);
    return res.status(201).json(formatResponse(true, 'Employee created. A password setup email is queued.', { ...employee, employee }));
  } catch (error) {
    return employeeDirectoryError(res, error);
  }
};

exports.getAllEmployees = listEmployees;
exports.getEmployees = listEmployees;

exports.getEmployee = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json(formatResponse(false, 'Employee not found'));
    if (!scopesEmployee(req.user, user)) return res.status(403).json(formatResponse(false, 'You cannot view this employee'));
    return res.json(formatResponse(true, 'Employee fetched successfully', await employeeDetails(user, req.user)));
  } catch (error) {
    return employeeDirectoryError(res, error);
  }
};

// @desc    Check whether a user has a role
// @route   GET /api/users/:id/has-role/:role
// @access  Private
exports.hasRole = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('role');

    if (!user) {
      return res.status(404).json(formatResponse(false, 'Employee not found'));
    }

    res.status(200).json({
      hasAccess: user.role === decodeURIComponent(req.params.role)
    });
  } catch (error) {
    res.status(500).json(formatResponse(false, error.message));
  }
};

exports.updateEmployee = async (req, res) => {
  try {
    const body = req.body || {};
    const result = await withEmployeeIdentityLock(async client => {
      const { rows: [row] } = await client.query('SELECT data FROM users WHERE id = $1', [req.params.id]);
      if (!row) return { status: 404, message: 'Employee not found' };
      const user = row.data;
      if (!canTerminateUser(req.user, user)) return { status: 403, message: 'You cannot update this account' };
      const { fields, errors } = validateEmployeeFields(body, user);
      if (errors.length) return { status: 400, message: errors[0], errors };
      if (fields.email && await emailOwner(client, fields.email, req.params.id)) {
        return { status: 400, message: 'Email already exists' };
      }
      const status = cleanText(body.status).toLowerCase();
      if ('status' in body && !['active', 'inactive'].includes(status)) {
        return { status: 400, message: 'Status must be Active or Inactive.' };
      }
      if ('isActive' in body && typeof body.isActive !== 'boolean') {
        return { status: 400, message: 'isActive must be true or false.' };
      }
      const patch = { ...fields, updatedAt: new Date().toISOString() };
      for (const property of ['team', 'manager', 'managerId']) {
        if (Object.hasOwn(body, property)) patch[property] = cleanText(body[property]);
      }
      if (Object.hasOwn(patch, 'manager') && !Object.hasOwn(patch, 'managerId')) patch.managerId = '';
      if ('firstName' in fields || 'lastName' in fields) {
        patch.fullName = [fields.firstName ?? user.firstName, fields.lastName ?? user.lastName].join(' ');
      }
      if ('isActive' in body || status) {
        patch.isActive = status ? status === 'active' : body.isActive;
        if (patch.isActive === false) {
          patch.isOnline = false;
          if (user.isActive !== false) patch.passwordVersion = randomUUID();
        }
      }
      const nextRole = effectiveRole({ ...user, ...patch });
      if (nextRole !== effectiveRole(user) && !canChangeEmployeeRole(req.user, user, nextRole)) {
        return { status: 403, message: 'You cannot assign this role' };
      }
      const employee = { ...user, ...patch };
      await updateEmployees(client, [{ ...patch, userIdForUpdate: req.params.id }]);
      return { status: 200, message: 'Employee updated successfully', employee };
    });
    return result.employee
      ? res.json(formatResponse(true, result.message, await employeeDetails(result.employee, req.user)))
      : res.status(result.status).json(formatResponse(false, result.message, result.errors));
  } catch (error) {
    return employeeDirectoryError(res, error);
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json(formatResponse(false, 'Employee not found'));
    if (!canTerminateUser(req.user, user)) {
      return res.status(403).json(formatResponse(false, 'You cannot reset this account'));
    }
    if (user.isActive === false) return res.status(400).json(formatResponse(false, 'Activate the employee before sending a password email.'));
    const settings = emailSettings();
    if (!settings) return res.status(503).json(formatResponse(false, 'Resend is unavailable. Check the server email settings.'));
    if (!user.password && user.mustChangePassword) return exports.resendSetupEmail(req, res);
    const result = await emailAdminResetLink(user.id, settings);
    if (result === 'sent') return res.json(formatResponse(true, 'Password reset link sent to the employee.'));
    if (result === 'failed') return res.status(502).json(formatResponse(false, 'Resend could not send the password reset email.'));
    return res.status(429).json(formatResponse(false, 'A password email was requested recently. Try again later.'));
  } catch (error) {
    return employeeDirectoryError(res, error);
  }
};

exports.resendSetupEmail = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json(formatResponse(false, 'Employee not found'));
    if (!canTerminateUser(req.user, user)) {
      return res.status(403).json(formatResponse(false, 'You cannot send a setup link for this account'));
    }
    if (!emailSettings()) return res.status(503).json(formatResponse(false, 'Resend is unavailable. Check the server email settings.'));
    const queued = await queueEmployeeSetupEmail(user.id);
    if (!queued) return res.status(409).json(formatResponse(false, 'This account has finished setup, is inactive, or already has a setup email queued.'));
    return res.status(202).json(formatResponse(true, 'A password setup email is queued.'));
  } catch (error) {
    return employeeDirectoryError(res, error);
  }
};

function changeActiveState(active) {
  return async (req, res) => {
    try {
      const result = await withEmployeeIdentityLock(async client => {
        const { rows: [row] } = await client.query('SELECT data FROM users WHERE id = $1', [req.params.id]);
        if (!row) return 404;
        if (!canTerminateUser(req.user, row.data)) return 403;
        const update = { userIdForUpdate: req.params.id, isActive: active, updatedAt: new Date().toISOString() };
        if (!active) {
          update.isOnline = false;
          if (row.data.isActive !== false) update.passwordVersion = randomUUID();
        }
        await updateEmployees(client, [update]);
        return 200;
      });
      const action = active ? 'activate' : 'deactivate';
      if (result === 404) return res.status(404).json(formatResponse(false, 'Employee not found'));
      if (result === 403) return res.status(403).json(formatResponse(false, `You cannot ${action} this employee`));
      return res.json(formatResponse(true, `Employee ${action}d successfully`));
    } catch (error) {
      return employeeDirectoryError(res, error);
    }
  };
}

exports.deactivateEmployee = changeActiveState(false);
exports.activateEmployee = changeActiveState(true);
exports.getEmployeeById = exports.getEmployee;

exports.getEmployeeByEmail = async (req, res) => {
  try {
    const user = await User.findOne({ email: req.params.email.toLowerCase() }).select('-password');
    if (!user) return res.status(404).json(formatResponse(false, 'Employee not found'));
    if (!scopesEmployee(req.user, user)) return res.status(403).json(formatResponse(false, 'You cannot view this employee'));
    res.status(200).json(formatResponse(true, 'Employee fetched successfully', toEmployeeDto(user)));
  } catch (error) {
    res.status(500).json(formatResponse(false, error.message));
  }
};

exports.getEmployeeByEmployeeId = async (req, res) => {
  try {
    const user = await User.findOne({ employeeId: req.params.employeeId.toUpperCase() }).select('-password');
    if (!user) return res.status(404).json(formatResponse(false, 'Employee not found'));
    if (!scopesEmployee(req.user, user)) return res.status(403).json(formatResponse(false, 'You cannot view this employee'));
    res.status(200).json(formatResponse(true, 'Employee fetched successfully', toEmployeeDto(user)));
  } catch (error) {
    res.status(500).json(formatResponse(false, error.message));
  }
};

exports.getEmployeeDepartments = async (req, res) => {
  try {
    const departments = await User.distinct('department', { department: { $nin: [null, ''] } });
    res.status(200).json(formatResponse(true, 'Departments fetched successfully', normalizeDepartments(departments)));
  } catch (error) {
    res.status(500).json(formatResponse(false, error.message));
  }
};

exports.getEmployeeStats = async (req, res) => {
  try {
    const employees = await User.find({}).select('-password');
    const dtos = employees.map(toEmployeeDto);
    const departments = normalizeDepartments(dtos.map(employee => employee.department));
    const roles = [...new Set(dtos.map(employee => employee.role).filter(Boolean))];
    const now = new Date();

    res.status(200).json(formatResponse(true, 'Employee stats fetched successfully', {
      total: dtos.length,
      active: dtos.filter(employee => employee.status === 'Active').length,
      inactive: dtos.filter(employee => employee.status !== 'Active').length,
      terminated: dtos.filter(employee => employee.status === 'Inactive').length,
      departments: departments.length,
      departmentList: departments,
      roles: roles.length,
      roleList: roles,
      newThisMonth: dtos.filter(employee => {
        const joinDate = new Date(employee.joinDate || employee.createdAt);
        return joinDate.getMonth() === now.getMonth() && joinDate.getFullYear() === now.getFullYear();
      }).length,
      departmentDistribution: departments.map(department => ({
        department,
        count: dtos.filter(employee => employee.department === department).length
      })),
      roleDistribution: roles.map(role => ({
        role,
        count: dtos.filter(employee => employee.role === role).length
      }))
    }));
  } catch (error) {
    res.status(500).json(formatResponse(false, error.message));
  }
};

exports.getEmployeesByDepartment = async (req, res) => {
  try {
    const employees = await User.find({ department: normalizeDepartment(req.params.department) }).select('-password').sort({ firstName: 1 });
    res.status(200).json(formatResponse(true, 'Department employees fetched successfully', employees.filter(user => scopesEmployee(req.user, user)).map(toEmployeeDto)));
  } catch (error) {
    res.status(500).json(formatResponse(false, error.message));
  }
};

exports.getEmployeesByRole = async (req, res) => {
  try {
    const employees = await User.find({ role: req.params.role }).select('-password').sort({ firstName: 1 });
    res.status(200).json(formatResponse(true, 'Role employees fetched successfully', employees.filter(user => scopesEmployee(req.user, user)).map(toEmployeeDto)));
  } catch (error) {
    res.status(500).json(formatResponse(false, error.message));
  }
};

exports.getEmployeesByManager = async (req, res) => {
  try {
    const manager = await User.findById(req.params.managerId).select('-password');
    const managerName = getFullName(manager);
    const employees = await User.find({
      $or: [
        { managerId: req.params.managerId },
        ...(managerName ? [{ manager: managerName }] : [])
      ]
    }).select('-password').sort({ firstName: 1 });

    res.status(200).json(formatResponse(true, 'Manager employees fetched successfully', employees.filter(user => scopesEmployee(req.user, user)).map(toEmployeeDto)));
  } catch (error) {
    res.status(500).json(formatResponse(false, error.message));
  }
};

exports.searchEmployees = (req, res) => listEmployees({ ...req, query: { ...req.query, search: req.query.search ?? req.query.q } }, res);

exports.deleteEmployee = async (req, res) => {
  try {
    const { status, target } = await removeEmployee(req.params.id, req.user);
    if (status === 404) return res.status(404).json(formatResponse(false, 'Employee not found'));
    if (status === 403) {
      return res.status(403).json(formatResponse(false, 'You do not have permission to terminate this employee'));
    }
    return res.json(formatResponse(true, 'Employee permanently deleted', toEmployeeDto(target)));
  } catch (error) {
    res.status(500).json(formatResponse(false, error.message));
  }
};

const defaultLeaveBalance = { Sick: 12, Casual: 10, Annual: 15, Emergency: 5, Other: 3 };

async function currentLeaveBalance(user) {
  const year = Number(businessDate().slice(0, 4));
  const saved = await LeaveBalance.findOne({ userId: user.id, year });
  return Object.fromEntries(Object.entries(defaultLeaveBalance).map(([type, defaultDays]) =>
    [type, saved?.[type] ?? user.leaveBalance?.[type] ?? defaultDays]));
}

exports.getLeaveBalance = async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json(formatResponse(false, 'Employee not found'));
  if (req.user.id !== user.id && !scopesEmployee(req.user, user)) {
    return res.status(403).json(formatResponse(false, 'You cannot view this leave balance'));
  }
  return res.json(formatResponse(true, 'Leave balance fetched successfully', await currentLeaveBalance(user)));
};

exports.updateLeaveBalance = async (req, res) => {
  const { leaveType, days } = req.body || {};
  if (!Object.hasOwn(defaultLeaveBalance, leaveType) || !Number.isFinite(days) || days < 0) {
    return res.status(400).json(formatResponse(false, 'Enter a valid leave type and a non-negative balance.'));
  }
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json(formatResponse(false, 'Employee not found'));
  if (!canTerminateUser(req.user, user)) return res.status(403).json(formatResponse(false, 'You cannot edit this leave balance'));
  const balances = { ...await currentLeaveBalance(user), [leaveType]: days };
  const key = { userId: user.id, year: Number(businessDate().slice(0, 4)) };
  await withEmployeeIdentityLock(async client => {
    const { rows: [existing] } = await client.query(
      "SELECT id FROM leave_balances WHERE data->>'userId' = $1 AND data->>'year' = $2 LIMIT 1",
      [key.userId, String(key.year)]
    );
    await client.query(`
      INSERT INTO leave_balances (id, data) VALUES ($1, $2)
      ON CONFLICT (id) DO UPDATE SET data = leave_balances.data || $2::jsonb, updated_at = NOW()
    `, [existing?.id || randomUUID(), JSON.stringify({ ...key, [leaveType]: days })]);
  });
  return res.json(formatResponse(true, 'Leave balance updated successfully', balances));
};

exports.uploadEmployeeDocument = async (req, res) => {
  try {
    const allowedTypes = [
      'profile_photo',
      'aadhaar',
      'pan',
      'resume',
      'education',
      'nda',
      'code_of_conduct',
      'ip_agreement',
      'onboarding'
    ];
    const documentType = req.body.documentType;

    if (!req.file) {
      return res.status(400).json(formatResponse(false, 'Document file is required'));
    }

    const extension = extname(req.file.originalname).toLowerCase();
    const bytes = req.file.buffer;
    const signatures = {
      '.pdf': Buffer.from('%PDF-'),
      '.jpeg': Buffer.from([0xff, 0xd8, 0xff]), '.jpg': Buffer.from([0xff, 0xd8, 0xff]),
      '.png': Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      '.docx': Buffer.from([0x50, 0x4b, 0x03, 0x04])
    };
    const signature = signatures[extension];
    if (!signature || !bytes.subarray(0, signature.length).equals(signature) ||
        (extension === '.docx' && !bytes.includes(Buffer.from('word/document.xml')))) {
      return res.status(400).json(formatResponse(false, 'Choose a valid PDF, JPG, PNG or DOCX document.'));
    }

    if (!allowedTypes.includes(documentType)) {
      return res.status(400).json(formatResponse(false, 'Invalid document type'));
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json(formatResponse(false, 'Employee not found'));
    }

    if (!canTerminateUser(req.user, user) && req.user.id !== user.id) {
      return res.status(403).json(formatResponse(false, 'You cannot upload documents for this employee'));
    }
    const accessToken = req.body.googleAccessToken || req.get('x-google-access-token');
    const driveFile = await uploadEmployeeDocumentToDrive({
      file: req.file,
      employee: user,
      documentType,
      accessToken
    });

    const uploaded = new Date().toISOString().split('T')[0];
    const urls = buildDriveUrls(driveFile.id, driveFile.webViewLink, driveFile.webContentLink);
    const document = {
      name: req.file.originalname,
      fileName: req.file.originalname,
      fileId: driveFile.id,
      mimeType: driveFile.mimeType || req.file.mimetype,
      size: driveFile.size || req.file.size,
      uploaded,
      uploadedAt: new Date(),
      uploadedBy: req.user?._id,
      ...urls
    };

    user.documents = mergeEmployeeDocument(user.documents || {}, documentType, document);
    await user.save();

    const employee = applyDocumentToDto(toEmployeeDto(user), documentType, document);
    res.status(201).json(formatResponse(true, 'Document uploaded to Google Drive successfully', {
      employee,
      document
    }));
  } catch (error) {
    console.error('Employee document upload error:', error.code || error.message);
    res.status(503).json(formatResponse(false, 'Could not store the document in Google Drive. Check the Drive settings and try again.'));
  }
};

exports.importEmployees = async (req, res) => {
  try {
    const { sheet, dryRun = true, updateExisting = false } = req.body || {};
    const workbook = req.file && await readEmployeeWorkbook(req.file.buffer, req.file.originalname, sheet);
    const rows = workbook?.rows ?? req.body?.rows;
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json(formatResponse(false, workbook && !workbook.headerRow
        ? 'The first 10 rows must contain headings for employee name and email.'
        : 'No rows to import', workbook?.file));
    }
    if (rows.length > 2000) {
      return res.status(400).json(formatResponse(false, 'Import is limited to 2,000 employee rows.'));
    }
    const { importEmployees } = require('../services/employeeImportService');
    const result = await importEmployees(rows, {
      dryRun: dryRun !== false && dryRun !== 'false',
      updateExisting: updateExisting === true || updateExisting === 'true',
      importer: req.user
    });
    const { summary } = result;
    const message = result.dryRun
      ? `Preview: ${summary.toCreate} to create, ${summary.toUpdate} to update, ${summary.skipped} skipped, ${summary.errors} with errors`
      : `Imported: ${summary.toCreate} created, ${summary.toUpdate} updated, ${summary.skipped} skipped, ${summary.errors} with errors`;
    return res.json(formatResponse(true, message, { ...result, ...workbook?.file }));
  } catch (error) {
    return employeeDirectoryError(res, error);
  }
};
