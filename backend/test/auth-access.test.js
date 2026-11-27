const assert = require('node:assert/strict');
const { once } = require('node:events');
const { after, before, test } = require('node:test');
const { createHmac, scryptSync } = require('node:crypto');

delete process.env.DATABASE_URL;
delete process.env.VERCEL;
process.env.PGLITE_DATA_DIR = 'memory://';
process.env.SEED_DEMO_DATA = 'false';
process.env.JWT_SECRET = 'auth-access-test-secret';
process.env.REQUIRE_TWO_FACTOR_AUTH = 'false';

const connectDB = require('../src/config/db');
const User = require('../src/models/User');
const app = require('../src/app');

const originalPassword = 'a private test phrase';
let db;
let server;

before(async () => {
  db = await connectDB();
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
});

after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  if (db) await db.close();
});

function employee(employeeId, attributes = {}) {
  return User.create({
    employeeId, firstName: 'Sample', lastName: 'Employee',
    email: `${employeeId.toLowerCase()}@example.test`,
    password: originalPassword, ...attributes
  });
}

async function request(path, { credentials, token, method = credentials ? 'POST' : 'GET' } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api${path}`, {
    method, headers, body: JSON.stringify(credentials)
  });
  return { status: response.status, body: await response.json() };
}

function signIn(employeeId, password = originalPassword) {
  return request('/auth/login', { credentials: { employeeId, password } });
}

test('the fifth consecutive failure locks the account across identifier aliases', async () => {
  const user = await employee('INT601');
  for (const identifier of [user.employeeId, user.email, user.employeeId.toLowerCase(), user.email]) {
    assert.equal((await signIn(identifier, 'wrong phrase')).status, 401);
  }
  const fifth = await signIn(user.employeeId, 'wrong phrase');
  assert.equal(fifth.status, 429);
  assert.match(fifth.body.message, /locked.*15 minutes/i);
  const correct = await signIn(user.email);
  assert.equal(correct.status, 429);
  assert.equal(correct.body.data.remainingMinutes, 15);
});

test('logout revokes its session and leaves another signed-in browser active', async () => {
  await employee('INT602');
  const first = (await signIn('INT602')).body.data.token;
  const second = (await signIn('INT602')).body.data.token;
  assert.equal((await request('/auth/verify', { token: first })).status, 200);
  assert.equal((await request('/auth/logout', { token: first, method: 'POST' })).status, 200);
  assert.equal((await request('/auth/verify', { token: first })).status, 401);
  assert.equal((await request('/auth/verify', { token: second })).status, 200);
});

test('temporary credentials only authorize changing the password before full sign-in', async () => {
  await employee('INT603', { mustChangePassword: true });
  const login = await signIn('INT603');
  assert.equal(login.status, 200);
  assert.equal(login.body.data.user.mustChangePassword, true);
  const token = login.body.data.token;
  assert.equal((await request('/tasks', { token })).status, 403);
  const credentials = { currentPassword: originalPassword, newPassword: 'kx8#mqzt' };
  assert.equal((await request('/auth/change-password', { token, credentials })).status, 200);
  assert.equal((await request('/auth/verify', { token })).status, 401);
  const changed = await signIn('INT603', credentials.newPassword);
  assert.equal(changed.status, 200);
  assert.equal(changed.body.data.user.mustChangePassword, false);
  assert.equal((await request('/tasks', { token: changed.body.data.token })).status, 200);
});

test('login rejects a password above 64 characters before verifying credentials', async () => {
  const result = await signIn('INT604', 'a'.repeat(65));
  assert.equal(result.status, 400);
  assert.match(result.body.message, /64 characters/);
});

test('verified auth uses the user record and shows the effective Co-Lead role', async () => {
  await employee('COH605', { role: 'Team Lead', designation: 'Co-Lead' });
  const result = await signIn('coh605');
  assert.equal(result.body.data.user.role, 'CO Head');
  const token = result.body.data.token;
  const verified = await request('/auth/verify', { token });
  assert.equal(verified.body.data.role, 'CO Head');
  assert.ok(!JSON.stringify(verified.body).includes(originalPassword));
});

test('staged two-factor authentication enrolls a user and consumes backup codes once', async () => {
  await employee('INT606');
  const preRolloutToken = (await signIn('INT606')).body.data.token;
  process.env.REQUIRE_TWO_FACTOR_AUTH = 'true';
  try {
    assert.equal((await request('/auth/verify', { token: preRolloutToken })).status, 401);
    const start = await signIn('INT606');
    assert.equal(start.status, 200);
    assert.ok(!start.body.data.token);
    const setup = start.body.data.twoFactor;
    assert.equal(setup.setup, true);
    assert.equal((await request('/auth/verify', { token: setup.challengeToken })).status, 401);

    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const bits = [...setup.setupKey].map(character => alphabet.indexOf(character).toString(2).padStart(5, '0')).join('');
    const key = Buffer.from(bits.match(/.{8}/g).map(byte => Number.parseInt(byte, 2)));
    const counter = Buffer.alloc(8);
    counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)));
    const digest = createHmac('sha1', key).update(counter).digest();
    const code = String((digest.readUInt32BE(digest[19] & 15) & 0x7fffffff) % 1_000_000).padStart(6, '0');
    const confirmation = await request('/auth/two-factor/verify', {
      credentials: { challengeToken: setup.challengeToken, code }
    });
    assert.equal(confirmation.status, 200);
    assert.equal(new Set(confirmation.body.data.backupCodes).size, 10);
    assert.equal((await request('/auth/verify', { token: confirmation.body.data.token })).status, 200);

    const next = (await signIn('INT606')).body.data.twoFactor;
    assert.equal(next.setup, false);
    assert.equal(next.setupKey, undefined);
    const recovery = {
      challengeToken: next.challengeToken, code: confirmation.body.data.backupCodes[0]
    };
    assert.equal((await request('/auth/two-factor/verify', { credentials: recovery })).status, 200);
    assert.equal((await request('/auth/two-factor/verify', { credentials: recovery })).status, 401);

    for (let attempt = 0; attempt < 3; attempt++) {
      assert.equal((await request('/auth/two-factor/verify', { credentials: recovery })).status, 401);
    }
    assert.equal((await request('/auth/two-factor/verify', { credentials: recovery })).status, 429);
    assert.equal((await signIn('INT606')).status, 429);
  } finally {
    process.env.REQUIRE_TWO_FACTOR_AUTH = 'false';
  }
});


test('password change enforces the approved policy and upgrades legacy hashes', async () => {
  const account = await employee('INT607');
  const salt = Buffer.alloc(16, 5).toString('hex');
  const legacy = scryptSync(originalPassword, salt, 64, { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 ** 2 });
  await db.query(`UPDATE users SET data = (data - 'passwordAlgorithm') || jsonb_build_object('password', $2::text) WHERE id = $1`,
    [account.id, `scrypt:${salt}:${legacy.toString('hex')}`]);
  const signedIn = await signIn('INT607');
  assert.equal(signedIn.status, 200);
  assert.match((await User.findById(account.id)).password, /^\$2b\$12\$/);
  const token = signedIn.body.data.token;
  for (const value of ['small', 'z'.repeat(65), 'password123', 'prefixINT607', 'Spaceborn next pass', originalPassword]) {
    const response = await request('/auth/change-password', { token, credentials: { currentPassword: originalPassword, newPassword: value } });
    assert.equal(response.status, 400);
  }
  const unicode = '🌙🎵'.repeat(18) + ' violet harbor ';
  const changed = await request('/auth/change-password', { token, credentials: { currentPassword: originalPassword, newPassword: unicode } });
  assert.equal(changed.status, 200);
  assert.equal((await User.findById(account.id)).passwordAlgorithm, 'bcrypt-sha384');
  assert.equal((await signIn('INT607', unicode)).status, 200);
});

test('a device recovery request is limited to an administrator within scope', async () => {
  const target = await employee('INT608');
  const hr = await employee('HR608', { role: 'HR' });
  const ceo = await employee('CEO608', { role: 'CEO' });
  const manager = await employee('PM608', { role: 'Manager' });
  const endpoint = id => `/auth/two-factor/${id}/reset`;
  const token = (await signIn(target.employeeId)).body.data.token;
  assert.equal((await request(endpoint(target.id), { token: manager.getSignedJwtToken(), method: 'POST' })).status, 403);
  assert.equal((await request(endpoint(ceo.id), { token: hr.getSignedJwtToken(), method: 'POST' })).status, 403);
  assert.equal((await request(endpoint(target.id), { token: hr.getSignedJwtToken(), method: 'POST' })).status, 200);
  assert.equal((await request('/auth/verify', { token })).status, 401);
});


test('sign-in remains available outside the displayed IST shift', async t => {
  await employee('INT609');
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-27T03:00:00+05:30') });
  const result = await signIn('INT609');
  assert.equal(result.status, 200);
  assert.equal(result.body.data.expiresAt - Date.now(), 24 * 60 * 60 * 1000);
});
