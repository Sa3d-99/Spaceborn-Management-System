const assert = require('node:assert/strict');
const { once } = require('node:events');
const { after, before, test } = require('node:test');
const { businessDate } = require('../src/utils/businessTime');
const express = require('express');

delete process.env.DATABASE_URL;
delete process.env.VERCEL;
process.env.PGLITE_DATA_DIR = 'memory://';
process.env.SEED_DEMO_DATA = 'false';
process.env.JWT_SECRET = 'system-menu-integration-test-secret';

const connectDB = require('../src/config/db');
const User = require('../src/models/User');
const Attendance = require('../src/models/Attendance');
const app = express();
app.use(express.json());
app.use('/api/auth', require('../src/routes/authRoutes'));
app.use('/api/menu', require('../src/routes/menuRoutes'));
app.use('/api/dashboard', require('../src/routes/dashboardRoutes'));
app.use('/api/attendance', require('../src/routes/attendanceRoutes'));
const password = 'system menu browser fixture passphrase';

let database;
let server;
let hr;
let intern;
let ceo;

before(async () => {
  database = await connectDB();
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  hr = await User.create({ employeeId: 'HRGEN1', fullName: 'HR Reviewer', role: 'HR', department: 'Operations & Management' });
  intern = await User.create({ employeeId: 'INTGEN1', fullName: 'Employee', role: 'Member', password });
  ceo = await User.create({ employeeId: 'CEOGEN1', fullName: 'CEO Reviewer', role: 'CEO' });
});

after(async () => {
  if (server) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  if (database) await database.close();
});

function request(path, actor, body) {
  const token = typeof actor === 'string' ? actor : actor?.getSignedJwtToken();
  return fetch(`http://127.0.0.1:${server.address().port}/api${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
}

const menu = (path, actor) => request(`/menu${path}`, actor);

test('dashboard menus require a session and the appropriate role', async () => {
  for (const path of ['/manager', '/team-lead', '/member', '/hr']) {
    assert.equal((await menu(path)).status, 401, path);
  }
  assert.equal((await menu('/manager', intern)).status, 403);
  assert.equal((await menu('/member', intern)).status, 200);
});

test('activity includes the real successful login and attendance while excluding unaudited roles', async () => {
  const login = await request('/auth/login', null, { employeeId: intern.employeeId, password });
  assert.equal(login.status, 200);
  const { data: { token } } = await login.json();
  assert.equal(await Attendance.countDocuments({ userId: intern.id, date: businessDate(), isAutoMarked: true }), 1);

  assert.equal((await request('/dashboard/activity?days=1', intern)).status, 403);
  const response = await request('/dashboard/activity?days=1', ceo);
  assert.equal(response.status, 200);
  const { data } = await response.json();
  const entries = data.filter(event => event.employeeId === intern.employeeId);
  assert.deepEqual(entries.map(event => event.action).sort(), ['check-in', 'login']);
  assert.ok(entries.every(event => event.name === intern.fullName && Number.isFinite(Date.parse(event.timestamp))));

  const sessions = await request('/dashboard/login-management', ceo);
  assert.equal(sessions.status, 200);
  assert.ok((await sessions.json()).data.sessions.some(session => session.employeeId === intern.employeeId));
  assert.equal((await request('/auth/logout', token, {})).status, 200);
  const signedOut = await request('/dashboard/login-management', ceo);
  assert.ok(!(await signedOut.json()).data.sessions.some(session => session.employeeId === intern.employeeId));
});

test('the header can read its own attendance and cannot select another employee by query string', async () => {
  await Attendance.create({ userId: hr.id, date: businessDate(), employeeId: hr.employeeId,
    userName: hr.fullName, checkInTime: new Date(), status: 'present' });
  const response = await request(`/dashboard/my-attendance?userId=${intern.id}`, hr);
  assert.equal(response.status, 200);
  const { data } = await response.json();
  assert.equal(data.employeeId, hr.employeeId);
  assert.equal(data.date, businessDate());
});

test('the HR menu exposes its assigned work, including Employee Database, import, and attendance', async () => {
  const response = await menu('/hr', hr);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual((body.data || body).map(item => item.label), [
    'Dashboard', 'Employee Database', 'Import from Excel', 'Attendance', 'Leave and Hour Breaks',
    'Resource Requests', 'Notifications', 'My Profile'
  ]);
});

test('HR can read the company attendance roster while an intern cannot', async () => {
  const roster = await request('/attendance/roster', hr);
  assert.equal(roster.status, 200);
  assert.ok((await roster.json()).data.some(record => record.employeeId === intern.employeeId));
  assert.equal((await request('/attendance/roster', intern)).status, 403);
});
