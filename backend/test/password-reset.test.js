const assert = require('node:assert/strict');
const { once } = require('node:events');
const { after, before, test } = require('node:test');

delete process.env.DATABASE_URL;
delete process.env.VERCEL;
delete process.env.SMTP_HOST;
process.env.PGLITE_DATA_DIR = 'memory://';
process.env.SEED_DEMO_DATA = 'false';
process.env.JWT_SECRET = 'password-reset-integration-test-secret';
process.env.RESEND_API_KEY = 're_password_reset_integration_test';
process.env.RESEND_FROM_EMAIL = 'Spaceborn <accounts@example.test>';
process.env.APP_URL = 'https://crm.example.test';

const connectDB = require('../src/config/db');
const User = require('../src/models/User');
const app = require('../src/app');

const localFetch = global.fetch;
const sentEmails = [];
const originalPassword = 'the original account passphrase';
const newPassword = 'a different account passphrase';
let server;
let database;

before(async () => {
  database = await connectDB();
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');

  global.fetch = async (url, options) => {
    assert.equal(String(url), 'https://api.resend.com/emails');
    assert.equal(options.method, 'POST');
    assert.equal(new Headers(options.headers).get('Authorization'), `Bearer ${process.env.RESEND_API_KEY}`);
    sentEmails.push(JSON.parse(options.body));
    return Response.json({ id: 'captured-resend-message' });
  };
});

after(async () => {
  global.fetch = localFetch;
  if (server) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  if (database) await database.close();
});

async function request(path, { token, body } = {}) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await localFetch(`http://127.0.0.1:${server.address().port}/api/auth${path}`, {
    method: body ? 'POST' : 'GET',
    headers,
    body: JSON.stringify(body)
  });
  const result = (response.headers.get('content-type') || '').includes('application/json')
    ? await response.json() : await response.text();

  return { status: response.status, body: result };
}

function createAccount(employeeId, isActive = true) {
  return User.create({
    employeeId,
    firstName: 'Reset',
    lastName: 'Test',
    email: `${employeeId.toLowerCase()}@example.test`,
    password: originalPassword,
    isActive
  });
}

async function getDeliveredEmail(emailAddress) {
  const deadline = Date.now() + 2000;
  let email;
  do {
    email = sentEmails.find(({ to }) => [].concat(to).includes(emailAddress));
    if (email) break;
    await new Promise(resolve => setTimeout(resolve, 10));
  } while (Date.now() < deadline);

  assert.ok(email, 'Resend accepted an email for the employee');
  assert.equal(email.from, process.env.RESEND_FROM_EMAIL);
  assert.doesNotMatch(email.text, /temporary password:/i);
  assert.doesNotMatch(email.text, /the original account passphrase/);
  return email;
}

function getResetLink(email) {
  const link = email.text.match(/https:\/\/[^\s]+\/reset-password#token=[^\s]+/)?.[0];
  assert.ok(link, 'Email contains a reset link');
  return link;
}

async function getDeliveredToken(emailAddress) {
  const resetUrl = new URL(getResetLink(await getDeliveredEmail(emailAddress)));
  assert.equal(resetUrl.origin, process.env.APP_URL);
  assert.equal(resetUrl.pathname, '/reset-password');
  assert.equal(resetUrl.search, '');

  const token = new URLSearchParams(resetUrl.hash.slice(1)).get('token');
  assert.ok(token, 'Reset token is in the URL fragment');
  return token;
}

async function assertInvalidLink(token) {
  const response = await request('/reset-password/validate', { body: { token } });
  assert.equal(response.status, 400);
  assert.equal(response.body.error, 'INVALID_RESET_LINK');
}

test('reset emails use a single-use token and successful reset revokes old sessions', async () => {
  const user = await createAccount('INT980');
  const credentials = { employeeId: user.employeeId, password: originalPassword };
  const login = await request('/login', { body: credentials });
  assert.equal(login.status, 200);
  const session = login.body.data.token;

  const requested = await request('/forgot-password', { body: { employeeId: user.employeeId } });
  assert.equal(requested.status, 202);
  assert.equal((await request('/login', { body: credentials })).status, 200);

  const token = await getDeliveredToken(user.email);
  assert.ok(!JSON.stringify(requested.body).includes(token));

  const validation = await request('/reset-password/validate', { body: { token } });
  assert.equal(validation.status, 200);
  assert.equal((await request('/login', { body: credentials })).status, 200);
  assert.equal((await request('/reset-password/validate', { body: { token } })).status, 200);

  const resetBody = { token, newPassword };
  const attempts = await Promise.all([
    request('/reset-password', { body: resetBody }),
    request('/reset-password', { body: resetBody })
  ]);
  assert.deepEqual(attempts.map(({ status }) => status).sort(), [200, 400]);
  await assertInvalidLink(token);
  assert.equal((await request('/me', { token: session })).status, 401);
  assert.equal((await request('/login', { body: credentials })).status, 401);
  assert.equal((await request('/login', { body: { ...credentials, password: newPassword } })).status, 200);
  const stored = await User.findById(user.id);
  assert.match(stored.password, /^\$2/);
  assert.ok(sentEmails.some(email => email.subject === 'Your Spaceborn password was reset' &&
    [].concat(email.to).includes(user.email) && !email.text.includes(newPassword)));
  const { rows } = await database.query("SELECT data FROM notifications WHERE data->>'userId' = $1", [user.id]);
  assert.equal(rows.filter(row => row.data.title === 'Password reset completed').length, 1);
});

test('a reset request by email sends matching links in the branded button and text fallback', async () => {
  const user = await createAccount('INT984');
  const result = await request('/forgot-password', { body: { employeeId: user.email.toUpperCase() } });
  assert.equal(result.status, 202);

  const email = await getDeliveredEmail(user.email);
  const textLink = getResetLink(email);
  assert.equal(new URL(textLink).origin, process.env.APP_URL);
  assert.match(email.html || '', /Spaceborn/i, 'Email includes branded HTML');
  const links = [...email.html.matchAll(/<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
  const button = links.find(([, , label]) => /(?:reset|set)[^<]*password/i.test(label));
  assert.ok(button, 'Email contains an actionable password reset button');
  assert.equal(button[1], textLink);
});

test('link validation rejects malformed, unknown, and expired reset tokens', async () => {
  const user = await createAccount('INT985');
  const result = await request('/forgot-password', { body: { employeeId: user.employeeId } });
  assert.equal(result.status, 202);
  const token = await getDeliveredToken(user.email);

  const { rows: [expiry] } = await database.query(`
    SELECT EXTRACT(EPOCH FROM (password_reset_expires_at - password_reset_requested_at)) AS seconds FROM users WHERE id = $1
  `, [user.id]);
  assert.equal(Number(expiry.seconds), 15 * 60);

  await assertInvalidLink('malformed');
  await assertInvalidLink('0'.repeat(64));

  await database.query(
    "UPDATE users SET password_reset_expires_at = NOW() - INTERVAL '1 second' WHERE id = $1",
    [user.id]
  );
  await assertInvalidLink(token);
  assert.equal((await request('/reset-password', { body: { token, newPassword } })).status, 400);
  assert.equal(await (await User.findById(user.id)).comparePassword(originalPassword), true);
});

test('only active registered accounts receive a reset email and all requests get the same acknowledgement', async () => {
  const active = await createAccount('INT981');
  const inactive = await createAccount('INT982', false);
  const count = sentEmails.length;
  const known = await request('/forgot-password', { body: { employeeId: active.employeeId } });

  assert.equal(known.status, 202);
  assert.equal(known.body.message,
    'Request received. Only active, registered CRM accounts receive a reset link at their saved email address.');
  for (const identifier of ['unknown@example.test', 'INT999', inactive.email]) {
    const result = await request('/forgot-password', { body: { employeeId: identifier } });
    assert.deepEqual(result, known);
  }
  assert.deepEqual(sentEmails.slice(count).map(({ to }) => to), [[active.email]]);
});

test('the old immediate reset route leaves the account password intact and requires email proof', async () => {
  const user = await createAccount('INT983');
  const response = await request('/forgot-password/immediate', { body: { employeeId: user.employeeId } });

  assert.ok(!Object.hasOwn(response.body, 'temporaryPassword'));
  assert.equal(await (await User.findById(user._id)).comparePassword(originalPassword), true);
  assert.equal(response.status, 202);
  await getDeliveredToken(user.email);
});

test('only three hourly requests per account are accepted, and only the newest link works', async () => {
  const user = await createAccount('INT987');
  for (const identifier of [user.employeeId, user.employeeId.toLowerCase(), user.email]) {
    assert.equal((await request('/forgot-password', { body: { employeeId: identifier } })).status, 202);
  }
  assert.equal((await request('/forgot-password', { body: { employeeId: user.email.toUpperCase() } })).status, 429);
  const links = sentEmails.filter(email => [].concat(email.to).includes(user.email));
  assert.equal(links.length, 3);
  assert.match(links[2].text, /15 minutes/);
  const tokens = links.map(email => new URLSearchParams(new URL(getResetLink(email)).hash.slice(1)).get('token'));
  await assertInvalidLink(tokens[0]);
  await assertInvalidLink(tokens[1]);
  assert.equal((await request('/reset-password/validate', { body: { token: tokens[2] } })).status, 200);
});
