const ROLE_HIERARCHY = {
  CEO: 4,
  COO: 3,
  Manager: 2,
  'Team Lead': 1,
  'Co-Head': 1,
  'CO Head': 1,
  Member: 0,
  HR: 0
};

function effectiveRole(user) {
  const role = { Lead: 'Team Lead', 'Co-Lead': 'CO Head', Coordinator: 'HR' }[user.role] || user.role;
  return role === 'Team Lead' && /\bco[\s-]*(?:lead|head)\b/i.test(user.designation || '')
    ? 'CO Head' : role;
}

function canTerminateUser(actor, target) {
  if (!actor || !target || (actor.id && String(actor.id) === String(target.id))) return false;
  const role = effectiveRole(actor);
  if (role === 'CEO') return true;
  const targetRole = effectiveRole(target);
  if (['CEO', 'COO'].includes(targetRole)) return false;
  if (role === 'COO') return true;
  if (['HR', 'Coordinator'].includes(role)) return targetRole !== 'HR';
  return role === 'Team Lead' && ['Member', 'CO Head', 'Co-Head'].includes(targetRole) &&
    Boolean(actor.department && actor.department === target.department);
}

const getTerminationReason = (actorRole, targetRole) => canTerminateUser({ role: actorRole }, { role: targetRole })
  ? 'Termination requested successfully.' : 'You do not have permission to terminate this employee.';

function canAssignEmployeeRole(actorRole, targetRole) {
  if (!Object.hasOwn(ROLE_HIERARCHY, targetRole)) return false;
  if (actorRole === 'CEO') return true;
  if (actorRole === 'COO') return !['CEO', 'COO'].includes(targetRole);
  return ['Manager', 'HR', 'Coordinator'].includes(actorRole) && targetRole === 'Member';
}

module.exports = { ROLE_HIERARCHY, canTerminateUser, canAssignEmployeeRole, effectiveRole, getTerminationReason };
