const HourBreak = require('../models/HourBreak');
const User = require('../models/User');
const { formatResponse } = require('../utils/helpers');
const { ownsRequest, canReviewRequest, requesterFor, requestVisibility } = require('../utils/requestPermissions');
const { notifyHourBreakRequested, notifyHourBreakDecision } = require('../utils/notificationDispatcher');

exports.getHourBreaks = async (req, res) => {
  const breaks = await HourBreak.find().sort({ createdAt: -1 });
  res.json(formatResponse(true, 'Breaks fetched', await requestVisibility(req.user, breaks)));
};

exports.applyBreak = async (req, res) => {
  const { userId, date, hours, reason } = req.body || {};
  const actor = req.user;
  const actorId = String(actor.id || actor._id);
  const requester = userId && String(userId) !== actorId ? await User.findById(userId) : actor;
  if (!requester || (requester !== actor && !canReviewRequest(actor, requester))) {
    return res.status(403).json(formatResponse(false, 'You cannot request an hour break for this employee'));
  }
  const duration = Number(hours);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !Number.isFinite(duration) || duration <= 0 || duration > 24 ||
      typeof reason !== 'string' || !reason.trim()) {
    return res.status(400).json(formatResponse(false, 'Enter a date, duration and reason'));
  }

  const autoApproved = requester.role === 'CEO';
  const record = await HourBreak.create({
    userId: String(requester.id || requester._id),
    userName: requester.name || requester.fullName,
    employeeId: requester.employeeId,
    userRole: requester.role,
    department: requester.department,
    date,
    hours: duration,
    reason: reason.trim(),
    status: autoApproved ? 'approved' : 'pending',
    ...(autoApproved ? { approvedBy: 'CEO', approvedOn: new Date() } : {})
  });

  if (!autoApproved) await notifyHourBreakRequested(record, requester).catch(console.error);
  return res.status(201).json(formatResponse(true, 'Break requested', record));
};

exports.updateBreakStatus = async (req, res) => {
  const { status, rejectionReason } = req.body || {};
  const nextStatus = String(status).toLowerCase();
  if (!['approved', 'rejected'].includes(nextStatus)) {
    return res.status(400).json(formatResponse(false, 'Invalid status'));
  }
  const record = await HourBreak.findById(req.params.breakId);
  if (!record) return res.status(404).json(formatResponse(false, 'Break not found'));

  const requester = requesterFor(record, await User.find());
  if (!canReviewRequest(req.user, requester)) {
    return res.status(403).json(formatResponse(false, 'You cannot review this hour break'));
  }

  const updated = await HourBreak.updateIfStatus(record.id, 'pending', {
    status: nextStatus,
    approvedBy: req.user.name || req.user.role,
    approvedOn: new Date(),
    ...(nextStatus === 'rejected' && typeof rejectionReason === 'string' ? { rejectionReason } : {})
  });
  if (!updated) return res.status(400).json(formatResponse(false, 'Break already processed'));
  await notifyHourBreakDecision(updated, requester).catch(console.error);
  return res.status(200).json(formatResponse(true, `Break ${nextStatus}`, updated));
};

exports.deleteBreak = async (req, res) => {
  const record = await HourBreak.findById(req.params.breakId);
  if (!record || !ownsRequest(req.user, record)) return res.status(404).json(formatResponse(false, 'Break not found'));
  if (record.status !== 'pending') return res.status(400).json(formatResponse(false, 'Processed breaks cannot be deleted'));
  await HourBreak.findByIdAndDelete(record.id);
  return res.status(200).json(formatResponse(true, 'Break deleted'));
};

exports.getMyBreaks = async (req, res) => {
  if (String(req.params.userId) !== String(req.user.id)) {
    return res.status(403).json(formatResponse(false, 'You can only view your own breaks here'));
  }
  const breaks = await HourBreak.find().sort({ createdAt: -1 });
  return res.status(200).json(formatResponse(true, 'Breaks fetched', breaks.filter(record => ownsRequest(req.user, record))));
};
