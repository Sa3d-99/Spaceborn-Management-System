const ResourceRequest = require('../models/ResourceRequest');
const User = require('../models/User');
const { formatResponse } = require('../utils/helpers');
const { ownsRequest, canReviewRequest, requesterFor, requestVisibility } = require('../utils/requestPermissions');
const { notifyResourceRequested, notifyResourceDecision } = require('../utils/notificationDispatcher');

exports.createRequest = async (req, res) => {
  const { resourceName, resourceType, quantity, reason, priority } = req.body || {};
  const actor = req.user;
  const request = await ResourceRequest.create({
    requester: actor.id || actor._id,
    requesterName: actor.name,
    requesterRole: actor.role,
    department: actor.department,
    resourceName,
    resourceType,
    quantity,
    reason,
    priority,
    status: 'pending'
  });
  await notifyResourceRequested(request, actor).catch(console.error);
  return res.status(201).json(formatResponse(true, 'Resource request created successfully', request));
};

const sendList = (res, requests) => res.json({ success: true, count: requests.length, data: requests });

exports.getMyRequests = async (req, res) => {
  const requests = await ResourceRequest.find({ requester: req.user.id || req.user._id }).sort({ createdAt: -1 });
  return sendList(res, requests);
};

exports.getPendingRequests = async (req, res) => {
  const requests = await ResourceRequest.find({ status: 'pending' }).sort({ createdAt: -1 });
  return sendList(res, await requestVisibility(req.user, requests, true));
};

exports.getRequests = async (req, res) => {
  const { status, department, requester } = req.query;
  if (requester === 'me') return exports.getMyRequests(req, res);
  const filter = { ...(status && { status }), ...(department && { department }) };
  const requests = await ResourceRequest.find(filter).sort({ createdAt: -1 });
  return sendList(res, await requestVisibility(req.user, requests));
};

exports.getAllRequests = exports.getRequests;

const reviewRequest = status => async (req, res) => {
  const request = await ResourceRequest.findById(req.params.id);
  if (!request) return res.status(404).json(formatResponse(false, 'Request not found'));

  if (!canReviewRequest(req.user, requesterFor(request, await User.find()))) {
    return res.status(403).json(formatResponse(false, 'You cannot review this resource request'));
  }

  const actorId = req.user.id || req.user._id;
  const time = new Date();
  const decision = status === 'approved'
    ? { approvedBy: actorId, approvedByName: req.user.name, approvedAt: time }
    : { rejectedBy: actorId, rejectedByName: req.user.name, rejectedAt: time, rejectionReason: req.body?.rejectionReason };
  const updated = await ResourceRequest.updateIfStatus(request.id, 'pending', { status, ...decision });
  if (!updated) return res.status(400).json(formatResponse(false, 'Request already processed'));

  await notifyResourceDecision(updated, status).catch(console.error);
  return res.status(200).json(formatResponse(true, `Request ${status}`, updated));
};

exports.approveRequest = reviewRequest('approved');
exports.rejectRequest = reviewRequest('rejected');

exports.deleteRequest = async (req, res) => {
  const request = await ResourceRequest.findById(req.params.id);
  if (!request || !ownsRequest(req.user, request)) return res.status(404).json(formatResponse(false, 'Request not found'));
  if (request.status !== 'pending') return res.status(400).json(formatResponse(false, 'Processed requests cannot be deleted'));

  await ResourceRequest.findByIdAndDelete(request.id);
  return res.json(formatResponse(true, 'Request deleted successfully'));
};
