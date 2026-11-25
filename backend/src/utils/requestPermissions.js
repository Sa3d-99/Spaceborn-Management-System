const User = require('../models/User');
const { effectiveRole } = require('./terminationPermissions');

const userId = user => String(user?.id || user?._id || '');

function ownsRequest(actor, request) {
  const owner = request.requester || request.userId;
  return Boolean(actor && (String(owner) === userId(actor) ||
    (actor.employeeId && request.employeeId === actor.employeeId)));
}

function canReviewRequest(actor, requester) {
  if (!actor || !requester || userId(actor) === userId(requester)) return false;
  const requesterRole = effectiveRole(requester);
  if (requesterRole === 'CEO') return false;
  if (actor.role === 'CEO') return true;
  if (actor.role === 'COO') return requesterRole !== 'COO';
  if (['HR', 'Coordinator'].includes(actor.role)) return requesterRole === 'Member';

  const reportsToActor = [actor.id, actor._id, actor.employeeId]
    .filter(Boolean).some(id => String(id) === String(requester.manager || requester.managerId));
  const sameTeam = actor.department && actor.department === requester.department &&
    (!actor.team || !requester.team || actor.team === requester.team);
  if (!sameTeam && !reportsToActor) return false;

  if (effectiveRole(actor) === 'Team Lead') return requesterRole === 'Member';
  return actor.role === 'Manager' && ['Member', 'Team Lead', 'CO Head', 'Co-Head'].includes(requesterRole);
}

function requesterFor(request, users) {
  return users.find(user => ownsRequest(user, request));
}

async function requestVisibility(actor, requests, onlyReviewable = false) {
  const users = await User.find();
  return requests.flatMap(request => {
    const canReview = canReviewRequest(actor, requesterFor(request, users));
    return canReview || (!onlyReviewable && ownsRequest(actor, request))
      ? [{ ...request.toObject(), canReview }]
      : [];
  });
}

module.exports = { ownsRequest, canReviewRequest, requesterFor, requestVisibility };
