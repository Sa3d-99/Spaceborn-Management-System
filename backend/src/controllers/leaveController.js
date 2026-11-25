const Leave = require('../models/Leave');
const LeaveBalance = require('../models/LeaveBalance');
const { formatResponse } = require('../utils/helpers');
const { businessDate } = require('../utils/businessTime');
const { ownsRequest } = require('../utils/requestPermissions');
const { notifyLeaveRequested, notifyLeaveDecision } = require('../utils/notificationDispatcher');

const defaultBalance = { Sick: 12, Casual: 10, Annual: 15, Emergency: 5, Other: 3 };
const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value)) && new Date(value).toISOString().startsWith(value);

function canReviewLeave(actor, leave) {
  if (ownsRequest(actor, leave) || leave.userRole === 'CEO') return false;
  if (actor.role === 'CEO') return true;
  if (actor.role === 'COO') return leave.userRole !== 'COO';
  return actor.role === 'Manager' && !['COO', 'Manager'].includes(leave.userRole) &&
    actor.department === leave.department;
}

exports.applyLeave = async (req, res) => {
  const { startDate, endDate, type, reason, halfDay, halfDayType } = req.body || {};
  if (!validDate(startDate) || !validDate(endDate) || startDate > endDate ||
      !Object.hasOwn(defaultBalance, type) || typeof reason !== 'string' || !reason.trim() ||
      (halfDay && (startDate !== endDate || !['first', 'second'].includes(halfDayType)))) {
    return res.status(400).json(formatResponse(false, 'Enter a valid leave type, date range and reason.'));
  }

  const user = req.user;
  const userId = String(user.id);
  const days = halfDay ? 0.5 : (Date.parse(endDate) - Date.parse(startDate)) / 86_400_000 + 1;
  if (user.role !== 'CEO') {
    const balance = await LeaveBalance.findOne({ userId, year: Number(startDate.slice(0, 4)) });
    if ((balance?.[type] ?? defaultBalance[type]) < days) {
      return res.status(400).json(formatResponse(false, `Insufficient ${type} leave balance`));
    }
  }

  const autoApproved = user.role === 'CEO';
  const pendingApprovals = ['Manager', 'COO'].includes(user.role) ? ['CEO'] : ['Manager', 'CEO'];
  const leave = await Leave.create({
    userId,
    userName: user.name,
    userRole: user.role,
    employeeId: user.employeeId,
    department: user.department,
    startDate,
    endDate,
    type,
    reason: reason.trim(),
    days,
    halfDay: Boolean(halfDay),
    ...(halfDay ? { halfDayType } : {}),
    status: autoApproved ? 'Approved' : 'Pending',
    pendingApprovals: autoApproved ? [] : pendingApprovals,
    approvedBy: autoApproved ? ['CEO'] : []
  });

  await notifyLeaveRequested(leave).catch(console.error);
  return res.status(201).json(formatResponse(true, 'Leave applied', leave));
};

function leaveList(onlyPending) {
  return async (req, res) => {
    const leaves = await Leave.find(onlyPending ? { status: 'Pending' } : {}).sort({ createdAt: -1 });
    const data = leaves.flatMap(leave => {
      const canReview = canReviewLeave(req.user, leave);
      return (canReview || (!onlyPending && ownsRequest(req.user, leave)))
        ? [{ ...leave.toObject(), canReview }]
        : [];
    });
    return res.json(formatResponse(true, 'Leaves fetched', data));
  };
}

exports.getAllLeaves = leaveList(false);
exports.getPendingLeaves = leaveList(true);

exports.getMyLeaves = async (req, res) => {
  if (String(req.params.userId) !== String(req.user.id)) {
    return res.status(403).json(formatResponse(false, 'You can only view your own leaves here'));
  }
  const leaves = await Leave.find().sort({ createdAt: -1 });
  return res.json(formatResponse(true, 'Leaves fetched', leaves.filter(leave => ownsRequest(req.user, leave))));
};

exports.updateLeaveStatus = async (req, res) => {
  const { status, comments } = req.body || {};
  if (!['Approved', 'Rejected'].includes(status)) {
    return res.status(400).json(formatResponse(false, 'Invalid status'));
  }
  const leave = await Leave.findById(req.params.leaveId);
  if (!leave) return res.status(404).json(formatResponse(false, 'Leave not found'));
  if (!canReviewLeave(req.user, leave)) return res.status(403).json(formatResponse(false, 'You cannot review this leave'));

  const updated = await Leave.updateIfStatus(leave.id, 'Pending', {
    status,
    approvedBy: [...(leave.approvedBy || []), req.user.name],
    approvedOn: new Date(),
    comments: typeof comments === 'string' ? comments : '',
    pendingApprovals: []
  });
  if (!updated) return res.status(400).json(formatResponse(false, 'Leave has already been processed'));

  await notifyLeaveDecision(updated).catch(console.error);
  return res.json(formatResponse(true, `Leave ${status.toLowerCase()}`, updated));
};

exports.getLeaveBalance = async (req, res) => {
  const userId = String(req.params.userId);
  if (userId !== String(req.user.id) && !['CEO', 'COO', 'Manager'].includes(req.user.role)) {
    return res.status(403).json(formatResponse(false, 'You cannot view this leave balance'));
  }
  const year = Number(businessDate().slice(0, 4));
  const balance = await LeaveBalance.findOne({ userId, year });
  return res.json(formatResponse(true, 'Balance fetched', balance || { userId, year, ...defaultBalance }));
};

exports.cancelLeave = async (req, res) => {
  const leave = await Leave.findById(req.params.leaveId);
  if (!leave || !ownsRequest(req.user, leave)) return res.status(404).json(formatResponse(false, 'Leave not found'));
  const updated = await Leave.updateIfStatus(leave.id, 'Pending', { status: 'Cancelled' });
  if (!updated) return res.status(400).json(formatResponse(false, 'Can only cancel pending leaves'));
  return res.json(formatResponse(true, 'Leave cancelled', updated));
};
