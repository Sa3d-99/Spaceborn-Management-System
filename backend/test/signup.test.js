const assert = require('node:assert/strict');
const { once } = require('node:events');
const { setTimeout: delay } = require('node:timers/promises');
const { after, before, test } = require('node:test');

delete process.env.DATABASE_URL;
delete process.env.VERCEL;
process.env.PGLITE_DATA_DIR = 'memory://';
process.env.SEED_DEMO_DATA = 'false';
process.env.JWT_SECRET = 'signup-integration-test-secret';
process.env.RESEND_API_KEY = 're_signup_integration_test';
process.env.RESEND_FROM_EMAIL = 'Spaceborn <accounts@example.test>';
process.env.APP_URL = 'https://crm.example.test';
process.env.SIGNUP_ADMIN_EMAIL = 'signup-admin@example.test';

const connectDB = require('../src/config/db');
const User = require('../src/models/User');
const app = require('../src/app');

const fetchLocal = global.fetch;
const emails = [];
const rejectedRecipients = new Set();
const password = 'a long signup test passphrase';
let database;
let server;
let ceoToken;
let managerToken;

before(async () => {
  database = await connectDB();
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');

  global.fetch = async (url, options) => {
    assert.equal(String(url), 'https://api.resend.com/emails');
    assert.equal(options.method, 'POST');
    assert.equal(new Headers(options.headers).get('Authorization'), `Bearer ${process.env.RESEND_API_KEY}`);
    const message = JSON.parse(options.body);
    assert.equal(message.from, process.env.RESEND_FROM_EMAIL);
    emails.push(message);
    if (message.to.some(recipient => rejectedRecipients.has(recipient))) {
      return Response.json({ message: 'Sender permission denied' }, { status: 403 });
    }
    return Response.json({ id: `captured-signup-email-${emails.length}` });
  };

  ceoToken = await loginAdmin('CEO001', 'CEO');
  managerToken = await loginAdmin('PM001', 'Manager');
});

after(async () => {
  global.fetch = fetchLocal;
  if (server) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  if (database) await database.close();
});

async function request(path, { token, body, method = body ? 'POST' : 'GET' } = {}) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetchLocal(`http://127.0.0.1:${server.address().port}/api/auth${path}`, {
    method,
    headers,
    body: JSON.stringify(body)
  });
  const contentType = response.headers.get('Content-Type') || '';
  const result = contentType.includes('application/json') ? await response.json() : await response.text();
  return { status: response.status, body: result };
}

async function loginAdmin(employeeId, role) {
  await User.create({
    employeeId,
    firstName: role,
    lastName: 'Test',
    email: `${employeeId.toLowerCase()}@example.test`,
    role,
    password
  });

  const response = await request('/login', { body: { employeeId, password } });
  assert.equal(response.status, 200);
  return response.body.data.token;
}

const recipientMatches = (message, recipient) => [].concat(message.to).includes(recipient);

async function waitForEmail(matches) {
  const deadline = Date.now() + 3000;
  do {
    const message = emails.find(matches);
    if (message) return message;
    await delay(10);
  } while (Date.now() < deadline);

  assert.fail('Expected email was not delivered through Resend');
}

test('public signup requires CEO approval and emailed password setup before login', async () => {
  const applicant = { name: 'Approved Applicant', email: 'approved@example.test', department: 'Sensor Stack' };
  const submission = await request('/signup', { body: applicant });

  assert.equal(submission.status, 202);
  assert.ok(!JSON.stringify(submission.body).includes(applicant.email));
  await waitForEmail(message =>
    recipientMatches(message, process.env.SIGNUP_ADMIN_EMAIL) && message.text.includes(applicant.email)
  );
  assert.equal(await User.findOne({ email: applicant.email }), null);
  assert.equal((await request('/signup-requests')).status, 401);
  assert.equal((await request('/signup-requests', { token: managerToken })).status, 403);

  const pending = await request('/signup-requests', { token: ceoToken });
  assert.equal(pending.status, 200);
  const row = pending.body.data.find(entry => entry.email === applicant.email);
  assert.ok(row, 'CEO can see the pending signup');
  const action = `/signup-requests/${row.id || row._id}/approve`;
  assert.equal((await request(action, { token: managerToken, body: {} })).status, 403);
  assert.ok(!emails.some(message => recipientMatches(message, applicant.email)));

  const approval = await request(action, { token: ceoToken, body: {} });
  assert.equal(approval.status, 200);
  const { employeeId, emailSent } = approval.body.data;
  assert.ok(employeeId, 'Approval returns the assigned employee ID');
  assert.equal(emailSent, true);
  assert.equal((await request('/login', { body: { employeeId, password } })).status, 401);
  assert.equal((await User.findOne({ email: applicant.email })).department, undefined);

  const email = await waitForEmail(message => recipientMatches(message, applicant.email));
  assert.equal(email.subject, 'Your Spaceborn signup was approved');
  assert.ok(email.text.includes(employeeId));
  const match = email.text.match(/https:\/\/[^\s]+\/reset-password#token=[^\s]+/);
  assert.ok(match, 'Onboarding email contains a setup link');
  const link = new URL(match[0]);
  assert.equal(link.origin, process.env.APP_URL);
  assert.equal(link.search, '');
  const token = new URLSearchParams(link.hash.slice(1)).get('token');
  assert.ok(token, 'Setup link contains a reset token in its fragment');
  const button = (email.html || '').match(/<a\b[^>]*\bhref="([^"]+)"[^>]*>Create Password<\/a>/);
  assert.equal(button?.[1], link.href, 'The branded button uses the same setup link as the plain-text email');
  assert.match(email.html, /Spaceborn/i);
  assert.ok(email.html.includes(employeeId));
  assert.ok(!JSON.stringify(approval.body).includes(token));

  assert.equal((await request('/reset-password/validate', { body: { token } })).status, 200);
  const setup = await request('/reset-password', { body: { token, newPassword: password } });
  assert.equal(setup.status, 200);
  assert.equal(setup.body.data.setupEmployeeId, employeeId);
  assert.equal((await request('/reset-password/validate', { body: { token } })).status, 400);
  const login = await request('/login', { body: { employeeId, password } });
  assert.equal(login.status, 200);
  assert.equal(login.body.data.user.role, 'Member');
  assert.equal(login.body.data.user.department, applicant.department);
  await User.create({
    employeeId: 'INTOTHER', firstName: 'Other', lastName: 'Team', department: 'Neural AI',
    email: 'other-team@example.test', password
  });
  const team = await fetchLocal(`http://127.0.0.1:${server.address().port}/api/team-members/mine?department=Neural%20AI`, {
    headers: { Authorization: `Bearer ${login.body.data.token}` }
  });
  assert.equal(team.status, 200);
  assert.deepEqual((await team.json()).data.members.map(entry => entry.id), [login.body.data.user.id]);
});

test('a failed setup email leaves the signup approved and can be resent', async () => {
  const applicant = { name: 'Retry Applicant', email: 'retry@example.test', department: 'Sensor Stack' };
  await request('/signup', { body: applicant });
  const pending = await request('/signup-requests', { token: ceoToken });
  const row = pending.body.data.find(entry => entry.email === applicant.email);
  const action = `/signup-requests/${row.id}`;
  const adminAction = { token: ceoToken, body: {} };
  rejectedRecipients.add(applicant.email);

  const approval = await request(`${action}/approve`, adminAction);
  assert.equal(approval.status, 200);
  assert.equal(approval.body.data.emailSent, false);
  assert.match(approval.body.message, /Resend setup link/);
  assert.equal((await request(`${action}/approve`, adminAction)).status, 409);
  const cooldown = await request(`${action}/resend`, adminAction);
  assert.equal(cooldown.status, 409);
  assert.match(cooldown.body.message, /wait one minute/i);

  const rejected = emails.find(message => recipientMatches(message, applicant.email));
  const token = rejected.text.match(/#token=([a-f0-9]{64})/)[1];
  assert.equal((await request('/reset-password/validate', { body: { token } })).status, 400);

  const advanceCooldown = () => database.query(
    "UPDATE users SET password_reset_requested_at = NOW() - INTERVAL '2 minutes' WHERE data->>'email' = $1",
    [applicant.email]
  );
  await advanceCooldown();
  assert.equal((await request(`${action}/resend`, adminAction)).status, 502);
  await advanceCooldown();
  rejectedRecipients.delete(applicant.email);

  const resend = await request(`${action}/resend`, adminAction);
  assert.equal(resend.status, 200);
  const resent = emails.filter(message => recipientMatches(message, applicant.email)).at(-1);
  const newToken = resent.text.match(/#token=([a-f0-9]{64})/)[1];
  assert.notEqual(newToken, token);
  assert.equal((await request('/reset-password', { body: { token: newToken, newPassword: password } })).status, 200);
  const completed = await request(`${action}/resend`, adminAction);
  assert.equal(completed.status, 409);
  assert.match(completed.body.message, /already created a password/i);
});

test('concurrent requests for the same email produce one pending signup and one admin email', async () => {
  const applicant = { name: 'Pending Applicant', email: 'duplicate@example.test', department: 'Neural AI' };
  const replies = await Promise.all([
    request('/signup', { body: applicant }),
    request('/signup', { body: { ...applicant, email: applicant.email.toUpperCase() } })
  ]);

  assert.equal(replies[0].status, 202);
  assert.deepEqual(replies[1], replies[0]);
  const matches = message =>
    recipientMatches(message, process.env.SIGNUP_ADMIN_EMAIL) && message.text.includes(applicant.email);
  await waitForEmail(matches);

  const pending = await request('/signup-requests', { token: ceoToken });
  assert.equal(pending.status, 200);
  assert.equal(pending.body.data.filter(entry => entry.email === applicant.email).length, 1);
  assert.equal(emails.filter(matches).length, 1);
});

test('signup reaches the CEO queue without Resend and can notify the CEO after configuration', async t => {
  const applicant = { name: 'Queued Applicant', email: 'queued@example.test', department: 'Sensor Stack' };
  const resendKey = process.env.RESEND_API_KEY;
  t.after(() => { process.env.RESEND_API_KEY = resendKey; });
  delete process.env.RESEND_API_KEY;

  const submission = await request('/signup', { body: applicant });
  assert.equal(submission.status, 202);
  const pending = await request('/signup-requests', { token: ceoToken });
  const queued = pending.body.data.find(entry => entry.email === applicant.email);
  assert.equal(queued?.status, 'pending');
  assert.equal(await User.findOne({ email: applicant.email }), null);
  const matches = message =>
    recipientMatches(message, process.env.SIGNUP_ADMIN_EMAIL) && message.text.includes(applicant.email);
  assert.ok(!emails.some(matches));

  process.env.RESEND_API_KEY = resendKey;
  const retry = await request('/signup', { body: applicant });
  assert.deepEqual(retry, submission);
  await waitForEmail(matches);
  const reviewedQueue = await request('/signup-requests', { token: ceoToken });
  const entries = reviewedQueue.body.data.filter(entry => entry.email === applicant.email);
  assert.deepEqual(entries.map(entry => entry.id), [queued.id]);
  assert.equal(emails.filter(matches).length, 1);
});

test('a CEO can approve again when an approved request has lost its linked account', async () => {
  const applicant = { name: 'Restore Applicant', email: 'restore@example.test', department: 'Sensor Stack' };
  const admin = { token: ceoToken, body: {} };
  assert.equal((await request('/signup', { body: applicant })).status, 202);
  const list = () => request('/signup-requests', { token: ceoToken });
  const { id } = (await list()).body.data.find(entry => entry.email === applicant.email);
  const action = `/signup-requests/${id}`;
  const first = await request(`${action}/approve`, admin);
  assert.equal(first.status, 200);
  await User.findByIdAndDelete((await User.findOne({ email: applicant.email })).id);

  const orphan = (await list()).body.data.find(entry => entry.id === id);
  assert.equal(orphan.setupStatus, 'missing-account');
  const resend = await request(`${action}/resend`, admin);
  assert.equal(resend.status, 409);
  assert.match(resend.body.message, /Approve again/);
  assert.equal(await User.findOne({ email: applicant.email }), null);
  const restored = await request(`${action}/approve`, admin);
  assert.equal(restored.status, 200);
  assert.equal(restored.body.data.emailSent, true);
  assert.notEqual(restored.body.data.employeeId, first.body.data.employeeId);

  assert.equal((await request(action, { token: managerToken, method: 'DELETE' })).status, 403);
  assert.equal((await request(action, { token: ceoToken, method: 'DELETE' })).status, 200);
  assert.ok(!(await list()).body.data.some(entry => entry.id === id));
  assert.ok(await User.findOne({ email: applicant.email }));
  assert.equal((await request(action, { token: ceoToken, method: 'DELETE' })).status, 404);
});
