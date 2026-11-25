const assert = require('node:assert/strict');
const { test } = require('node:test');
const { canTerminateUser, effectiveRole } = require('./terminationPermissions');

const member = { id: 'member', role: 'Member', department: 'Core Systems' };

test('CEO and Directors can terminate below their authority', () => {
  assert.equal(canTerminateUser({ role: 'CEO', id: 'ceo' }, member), true);
  assert.equal(canTerminateUser({ role: 'COO', id: 'director' }, member), true);
  assert.equal(canTerminateUser({ role: 'COO' }, { role: 'CEO' }), false);
  assert.equal(canTerminateUser({ role: 'CEO', id: 'ceo' }, { role: 'CEO', id: 'ceo' }), false);
});

test('HR and the department Team Lead can terminate an intern', () => {
  assert.equal(canTerminateUser({ role: 'HR' }, member), true);
  assert.equal(canTerminateUser({ role: 'Team Lead', department: member.department }, member), true);
  assert.equal(canTerminateUser({ role: 'Team Lead', department: 'Other' }, member), false);
});

test('project managers, interns and co-leads cannot terminate employees', () => {
  for (const role of ['Manager', 'Member', 'CO Head', 'Co-Head']) {
    assert.equal(canTerminateUser({ role, department: member.department }, member), false);
  }
  const legacyCoLead = { role: 'Team Lead', designation: 'Co-Lead', department: member.department };
  assert.equal(effectiveRole(legacyCoLead), 'CO Head');
  assert.equal(canTerminateUser(legacyCoLead, member), false);
});
