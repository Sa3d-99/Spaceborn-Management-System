const { randomBytes } = require('node:crypto');
const { query } = require('../config/db');
const { DEPARTMENTS, normalizeDepartment } = require('../config/departments');
const Report = require('../models/Report');
const User = require('../models/User');
const { businessDate } = require('../utils/businessTime');
const { formatResponse } = require('../utils/helpers');
const { notifyReportSubmitted } = require('../utils/notificationDispatcher');

const companyReviewers = new Set(['CEO', 'COO']);
const teamReviewers = new Set(['Manager', 'Team Lead', 'CO Head', 'Co-Head']);
const fields = {
  completedTasks: { label: 'Completed work', required: true },
  ongoingWork: { label: 'Ongoing work' },
  issuesFaced: { label: 'Issues or blockers' },
  nextDayPlan: { label: 'Next-day plan', required: true }
};

const isOwner = (user, ownerId) => String(user.id) === String(ownerId);
const mayReview = user => companyReviewers.has(user.role) || teamReviewers.has(user.role);
const mayReviewDepartment = (user, department) => companyReviewers.has(user.role) ||
  (teamReviewers.has(user.role) && Boolean(user.department) &&
    normalizeDepartment(user.department) === normalizeDepartment(department));

function validHistoryDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value > businessDate()) return false;
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function reportFields(body, existing = {}) {
  const data = {};
  for (const [field, { label, required }] of Object.entries(fields)) {
    const value = Object.hasOwn(body, field) ? body[field] : existing[field] ?? '';
    if (typeof value !== 'string') return { error: `${label} must be text.` };
    const text = value.trim();
    const count = [...text].length;
    if ((required && count < 10) || count > 2000) {
      return { error: `${label} must have ${required ? '10–2,000' : 'at most 2,000'} characters.` };
    }
    data[field] = text;
  }
  return { data };
}

const forbidden = res => res.status(403).json(formatResponse(false, 'You do not have permission to access this report.'));
const invalid = (res, message) => res.status(400).json(formatResponse(false, message));
const notFound = res => res.status(404).json(formatResponse(false, 'Report not found.'));

async function mayReadUser(actor, targetId) {
  if (isOwner(actor, targetId) || companyReviewers.has(actor.role)) return true;
  if (!teamReviewers.has(actor.role) || !actor.department) return false;
  const target = await User.findById(targetId).select('department');
  return Boolean(target && mayReviewDepartment(actor, target.department));
}

exports.submitReport = async (req, res) => {
  const body = req.body || {};
  if (body.date !== businessDate()) return invalid(res, 'Reports must use today’s date in IST.');
  const validated = reportFields(body);
  if (validated.error) return invalid(res, validated.error);

  const id = randomBytes(12).toString('hex');
  const author = {
    userId: String(req.user.id),
    userName: req.user.name,
    userRole: req.user.role,
    department: normalizeDepartment(req.user.department) || '',
    employeeId: req.user.employeeId,
    date: body.date
  };
  const report = {
    id,
    _id: id,
    ...author,
    ...validated.data,
    status: 'submitted',
    submittedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  const update = { ...author, ...validated.data, status: 'submitted', updatedAt: new Date().toISOString() };
  const { rows: [saved] } = await query(`
    INSERT INTO reports (id, data) VALUES ($1, $2::jsonb)
    ON CONFLICT ((data->>'userId'), (data->>'date'))
    DO UPDATE SET data = reports.data || $3::jsonb, updated_at = NOW()
    RETURNING id, data
  `, [id, JSON.stringify(report), JSON.stringify(update)]);
  const result = { ...saved.data, id: saved.id, _id: saved.id };
  const created = saved.id === id;
  if (created) {
    try {
      await notifyReportSubmitted(result);
    } catch {
      console.error('Daily report was saved but its notification failed.');
    }
  }
  return res.status(created ? 201 : 200).json(formatResponse(
    true, created ? 'Report submitted successfully.' : 'Report updated successfully.', result
  ));
};

exports.getTodayReport = async (req, res) => {
  const { userId } = req.params;
  if (!await mayReadUser(req.user, userId)) return forbidden(res);
  const report = await Report.findOne({ userId, date: businessDate() });
  return report ? res.json(formatResponse(true, 'Today’s report.', report)) : notFound(res);
};

exports.getUserReports = async (req, res) => {
  const { userId } = req.params;
  if (!await mayReadUser(req.user, userId)) return forbidden(res);
  const reports = await Report.find({ userId }).sort({ date: -1 }).limit(100);
  return res.json(formatResponse(true, 'User reports.', reports));
};

function departmentFilter(value) {
  if (value === undefined || value === '') return null;
  if (typeof value !== 'string') return undefined;
  if (/^all$/i.test(value)) return null;
  const department = normalizeDepartment(value);
  return DEPARTMENTS.includes(department) ? department : undefined;
}

async function listReports(req, res, departmentValue) {
  if (!mayReview(req.user)) return forbidden(res);
  const department = departmentFilter(departmentValue);
  if (department === undefined) return invalid(res, 'Select a valid department.');
  if (department && !mayReviewDepartment(req.user, department)) return forbidden(res);

  const { date, start, end } = req.query;
  if (date !== undefined && !validHistoryDate(date)) return invalid(res, 'Select a valid report date up to today in IST.');
  if ((start !== undefined || end !== undefined) && (!validHistoryDate(start) || !validHistoryDate(end) || start > end)) {
    return invalid(res, 'Select a valid date range up to today in IST.');
  }

  const criteria = {};
  if (date) criteria.date = date;
  else if (start) criteria.date = { $gte: start, $lte: end };
  const reports = await Report.find(criteria).sort({ date: -1, createdAt: -1 });
  const visible = reports.filter(report => mayReviewDepartment(req.user, report.department) &&
    (!department || normalizeDepartment(report.department) === department));
  return res.json(formatResponse(true, 'Daily reports.', visible));
}

exports.getDepartmentReports = (req, res) => listReports(req, res, req.params.department);
exports.getAllReports = (req, res) => listReports(req, res, req.query.department);

exports.updateReport = async (req, res) => {
  const report = await Report.findById(req.params.id);
  if (!report) return notFound(res);
  if (!isOwner(req.user, report.userId)) return forbidden(res);
  if (report.date !== businessDate()) return invalid(res, 'Only today’s report can be updated.');
  const validated = reportFields(req.body || {}, report);
  if (validated.error) return invalid(res, validated.error);
  const updated = await Report.findByIdAndUpdate(report.id, { ...validated.data, updatedAt: new Date() }, { new: true });
  return updated ? res.json(formatResponse(true, 'Report updated.', updated)) : notFound(res);
};

exports.deleteReport = async (req, res) => {
  const report = await Report.findById(req.params.id);
  if (!report) return notFound(res);
  const manager = ['CEO', 'COO', 'Manager'].includes(req.user.role);
  if (!isOwner(req.user, report.userId) && !(manager && mayReviewDepartment(req.user, report.department))) {
    return forbidden(res);
  }
  await Report.findByIdAndDelete(report.id);
  return res.json(formatResponse(true, 'Report deleted.'));
};

const rosterEntry = account => ({ id: account.id, name: account.fullName, employeeId: account.employeeId });

exports.getComplianceReport = async (req, res) => {
  const date = req.query.date ?? businessDate();
  if (!validHistoryDate(date)) return invalid(res, 'Select a valid report date up to today in IST.');
  const mine = req.query.scope === 'mine' || !mayReview(req.user);

  if (mine) {
    const monthStart = date.slice(0, 8) + '01';
    const reports = await Report.find({ userId: String(req.user.id), date: { $gte: monthStart, $lte: date } });
    const dates = new Set(reports.map(report => report.date));
    const expected = Number(date.slice(-2));
    const ISODate = new Date(date + 'T00:00:00Z');
    let streak = 0;
    while (dates.has(ISODate.toISOString().slice(0, 10))) {
      streak++;
      ISODate.setUTCDate(ISODate.getUTCDate() - 1);
    }
    return res.json(formatResponse(true, 'Personal report compliance.', {
      submittedThisMonth: dates.size, expectedThisMonth: expected,
      percentage: Math.round(dates.size * 100 / expected), streak
    }));
  }

  const department = departmentFilter(req.query.department);
  if (department === undefined) return invalid(res, 'Select a valid department.');
  if (department && !mayReviewDepartment(req.user, department)) return forbidden(res);
  const departmentMatches = value => mayReviewDepartment(req.user, value) &&
    (!department || normalizeDepartment(value) === department);

  const [reports, accounts] = await Promise.all([
    Report.find({ date }),
    User.find({ isActive: true }).select('id fullName employeeId department joinDate')
  ]);
  const eligible = accounts.filter(account => departmentMatches(account.department) &&
    (!account.joinDate || String(account.joinDate).slice(0, 10) <= date));
  const submittedIds = new Set(reports.filter(report => departmentMatches(report.department)).map(report => String(report.userId)));
  const submitted = eligible.filter(account => submittedIds.has(String(account.id))).map(rosterEntry);
  const missed = eligible.filter(account => !submittedIds.has(String(account.id))).map(rosterEntry);
  return res.json(formatResponse(true, 'Team report compliance.', {
    date, submitted, missed, expectedCount: eligible.length,
    submittedCount: submitted.length,
    percentage: eligible.length ? Math.round(submitted.length * 100 / eligible.length) : 0
  }));
};
