const assert = require('node:assert/strict');
const { once } = require('node:events');
const { after, before, mock, test } = require('node:test');

delete process.env.DATABASE_URL;
delete process.env.VERCEL;
process.env.PGLITE_DATA_DIR = 'memory://';
process.env.SEED_DEMO_DATA = 'false';
process.env.JWT_SECRET = 'employees-integration-test-secret';

const connectDB = require('../src/config/db');
const User = require('../src/models/User');
const Attendance = require('../src/models/Attendance');
const Notification = require('../src/models/Notification');
const LeaveBalance = require('../src/models/LeaveBalance');
const { businessDate } = require('../src/utils/businessTime');
const driveService = require('../src/services/googleDriveService');
const driveUpload = mock.method(driveService, 'uploadEmployeeDocumentToDrive', async () => ({ id: 'drive-test-document' }));
const { processEmployeeSetupEmails } = require('../src/services/employeeSetupEmailService');
const app = require('../src/app');
const tokens = {};
let db;
let server;
let manager;
let intern;

before(async () => {
  db = await connectDB();
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');

  for (const [role, employeeId] of Object.entries({
    CEO: 'CEO001', COO: 'DIR001', Manager: 'PM001', HR: 'HR001',
    'Team Lead': 'LD001', 'CO Head': 'COH001', Member: 'INT001'
  })) {
    const user = await User.create({
      role, employeeId, firstName: 'Sample', lastName: 'Employee', department: 'Sensor Stack',
      email: `${employeeId}@example.test`.toLowerCase()
    });
    tokens[role] = user.getSignedJwtToken();
    if (role === 'Manager') manager = user;
    if (role === 'Member') intern = user;
  }
});

after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  if (db) await db.close();
});

async function request(path, role, body, method = body ? 'POST' : 'GET') {
  const headers = { Authorization: `Bearer ${tokens[role]}` };
  if (body && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(body);
  }
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api${path}`, { method, headers, body });
  return { status: response.status, body: await response.json() };
}

const employee = (overrides = {}) => ({
  firstName: 'Testing', lastName: 'Person', email: 'person@example.test',
  department: 'Sensor Stack', joinDate: '2025-01-31', ...overrides
});

test('validates employee fields before creation and persists date of birth', async () => {
  for (const overrides of [
    { lastName: '' }, { firstName: 'N4me' }, { email: 'broken' },
    { phone: '123456789' }, { designation: 'X' }, { department: 'Unknown Department' },
    { joinDate: '2019-12-31' }, { joinDate: '2025-02-31' }, { dateOfBirth: '2009-02-01' }
  ]) {
    const result = await request('/employees', 'Manager', employee(overrides));
    assert.equal(result.status, 400, JSON.stringify(overrides));
  }
  const result = await request('/employees', 'Manager', employee({ lastName: 'M', dateOfBirth: '2009-01-31' }));
  assert.equal(result.status, 201, result.body.message);
  assert.equal(result.body.data.dateOfBirth, '2009-01-31');
  assert.equal((await request('/employees', 'Manager', employee({ email: 'PERSON@EXAMPLE.TEST' }))).status, 400);
});

test('employee list and administrative actions follow the role matrix', async () => {
  assert.equal((await request('/team-members?department=Sensor%20Stack', 'Member')).status, 403);
  assert.equal((await request('/team-members/all', 'Member')).status, 403);
  assert.equal((await request('/employees?search=%5B', 'Manager')).status, 200);
  assert.equal((await request(`/employees?search=${'a'.repeat(101)}`, 'Manager')).status, 400);
  for (const role of ['Team Lead', 'CO Head']) {
    for (const action of ['deactivate', 'terminate']) {
      assert.equal((await request(`/users/${intern.id}/${action}`, role, {})).status, 403);
    }
    assert.equal((await request(`/employees/${intern.id}`, role, undefined, 'DELETE')).status, 403);
  }
  const lead = await request('/employees', 'Manager', employee({ email: 'lead@example.test', role: 'Team Lead' }));
  assert.equal(lead.status, 201, lead.body.message);
  assert.equal((await request('/employees', 'HR', employee({ email: 'hr-add@example.test' }))).status, 201);
  assert.equal((await request('/employees', 'HR', employee({ email: 'director@example.test', role: 'COO' }))).status, 403);
  assert.equal((await request(`/users/${intern.id}/deactivate`, 'Manager', {})).status, 200);
  const inactive = await request(`/employees/${intern.id}`, 'Manager');
  assert.equal(inactive.body.data.status, 'Inactive');
  assert.equal(inactive.body.data.isOnline, false);
  assert.equal((await request(`/users/${intern.id}/activate`, 'HR', {})).status, 200);
});

test('accounts statistics match the employee records and never expose a password', async () => {
  const stats = await request('/accounts/stats', 'Manager');
  assert.equal(stats.status, 200, stats.body.message);
  assert.equal(stats.body.data.totalCreated, await User.countDocuments());
  const list = await request('/accounts/all', 'Manager');
  assert.ok(list.body.data.every(row => !Object.hasOwn(row, 'password')));
});

test('a terminated employee ID is never recycled and historical attendance is marked', async () => {
  const created = await request('/employees', 'Manager', employee({ email: 'retired@example.test' }));
  assert.equal(created.status, 201, created.body.message);
  const target = created.body.data;
  const attendance = await Attendance.create({
    userId: target.id, employeeId: target.employeeId, userName: target.name, date: '2025-03-01'
  });
  const notification = await Notification.create({ userId: target.id, title: 'Test event' });
  assert.equal((await request(`/users/${target.id}/terminate`, 'Manager', {})).status, 200);
  assert.equal(await User.findById(target.id), null);
  assert.equal((await Attendance.findById(attendance.id)).formerEmployee, true);
  assert.equal(await Notification.findById(notification.id), null);
  const next = await request('/employees', 'Manager', employee({ email: 'next@example.test' }));
  assert.equal(next.status, 201, next.body.message);
  assert.notEqual(next.body.data.employeeId, target.employeeId);
});

test('imports validated CSV from a file, recognizes alternate headings and is idempotent', async () => {
  const csv = 'Employee directory\nFull Name,E-mail Address,Mobile,Team,DOJ\nFresh Trainee,trainee@example.test,9876543210,Sensor Stack,15/01/2025';
  const form = (name, content = csv, dryRun = true) => {
    const data = new FormData();
    data.set('file', new Blob([content]), name);
    data.set('dryRun', String(dryRun));
    return data;
  };
  assert.equal((await request('/employees/import', 'Manager', form('employees.xls'))).status, 400);
  assert.equal((await request('/employees/import', 'Manager', form('large.csv', 'a'.repeat(5 * 1024 ** 2 + 1)))).status, 413);
  const preview = await request('/employees/import', 'Manager', form('employees.csv'));
  assert.equal(preview.status, 200, preview.body.message);
  assert.equal(preview.body.data.summary.toCreate, 1);
  assert.equal(await User.findOne({ email: 'trainee@example.test' }), null);
  const committed = await request('/employees/import', 'Manager', form('employees.csv', csv, false));
  assert.equal(committed.status, 200, committed.body.message);
  assert.equal(committed.body.data.summary.toCreate, 1);
  const again = await request('/employees/import', 'Manager', form('employees.csv', csv, false));
  assert.equal(again.body.data.summary.skipped, 1);
  assert.equal(await User.countDocuments({ email: 'trainee@example.test' }), 1);
});


test('employee and roadmap document routes accept 10 MiB and reject a larger attachment', async () => {
  const roadmap = await request('/roadmaps', 'CEO', { title: 'Upload boundary', department: 'Sensor Stack' });
  assert.equal(roadmap.status, 201, roadmap.body.message);
  const limit = 10 * 1024 ** 2;
  const routes = [
    { path: `/employees/${intern.id}/documents`, field: 'document' },
    { path: `/roadmaps/${roadmap.body.data.id}/attachments`, field: 'file' }
  ];
  for (const { path, field } of routes) {
    const attachment = bytes => {
      const content = Buffer.alloc(bytes);
      content.write('%PDF-1.7');
      const data = new FormData();
      data.set(field, new Blob([content], { type: 'application/pdf' }), 'boundary.pdf');
      if (field === 'document') data.set('documentType', 'resume');
      return data;
    };
    const oversized = await request(path, 'CEO', attachment(limit + 1));
    assert.equal(oversized.status, 413, `${path} ${oversized.body.message || ''}`);
    assert.match(oversized.body.message, /10\s*MB/i);
    const exact = await request(path, 'CEO', attachment(limit));
    assert.equal(exact.status, 201, exact.body.message);
    if (exact.body.data.path) await require('node:fs/promises').unlink(exact.body.data.path);
  }
  assert.equal(driveUpload.mock.callCount(), 1);
  assert.equal(driveUpload.mock.calls[0].arguments[0].file.size, limit);
});

test('new employee setup emails deliver a branded one-use link through Resend', async t => {
  const settings = { apiKey: 'test-only', from: 'CRM <notify@example.test>', origin: 'https://crm.example.test' };
  const fetchOriginal = global.fetch;
  const emailEnv = { RESEND_API_KEY: settings.apiKey, RESEND_FROM_EMAIL: settings.from, APP_URL: settings.origin };
  const previous = Object.fromEntries(Object.keys(emailEnv).map(name => [name, process.env[name]]));
  Object.assign(process.env, emailEnv);
  t.after(() => {
    for (const name of Object.keys(previous)) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
  });
  let delivered;
  t.mock.method(global, 'fetch', async (url, options) => {
    if (url === 'https://api.resend.com/emails') return Response.json({ id: 'hr-reset-email' });
    if (url === 'https://api.resend.com/emails/batch') {
      const messages = JSON.parse(options.body);
      delivered = messages.find(message => message.to.includes('setup@example.test'));
      return new Response(JSON.stringify({ data: messages.map((_, index) => ({ id: String(index) })) }));
    }
    return fetchOriginal(url, options);
  });
  const created = await request('/employees', 'Manager', employee({ email: 'setup@example.test' }));
  assert.equal(created.status, 201, created.body.message);
  assert.equal(created.body.data.setupEmailStatus, 'pending');
  assert.equal(created.body.data.password, undefined);
  await processEmployeeSetupEmails(settings);
  assert.ok(delivered);
  const url = new URL(delivered.text.match(/https?:\/\/[^\s]+/)[0]);
  assert.equal(url.pathname, '/reset-password');
  const token = new URLSearchParams(url.hash.slice(1)).get('token');
  assert.ok(token);
  assert.equal((await request('/auth/reset-password', 'CEO', { token, newPassword: 'Sunrise river bicycle!' })).status, 200);
  assert.equal((await request('/auth/reset-password', 'CEO', { token, newPassword: 'Sunrise river bicycle!' })).status, 400);
  const signedIn = await request('/auth/login', 'CEO', { employeeId: created.body.data.employeeId, password: 'Sunrise river bicycle!' });
  assert.equal(signedIn.status, 200, signedIn.body.message);
  assert.equal(signedIn.body.data.user.role, 'Member');
  await require('../src/config/db').query(
    "UPDATE users SET password_reset_requested_at = NOW() - INTERVAL '2 minutes' WHERE id = $1", [created.body.data.id]
  );
  const target = created.body.data.id;
  assert.equal((await request(`/users/${target}/reset-password`, 'HR', {})).status, 200);
  assert.equal((await request(`/users/${target}/terminate`, 'HR', {})).status, 200);
});


test('employee details resolve the actual manager, current leave balance, and last sign-in', async () => {
  const timestamp = new Date().toISOString();
  await User.findByIdAndUpdate(intern.id, { managerId: manager.id, manager: 'Previous manager', lastLogin: timestamp });
  await LeaveBalance.create({ userId: intern.id, year: Number(businessDate().slice(0, 4)), Annual: 4 });
  const details = await request(`/employees/${intern.id}`, 'HR');
  assert.equal(details.status, 200);
  assert.equal(details.body.data.manager, manager.fullName);
  assert.equal(details.body.data.leaveBalance.Annual, 4);
  assert.equal(details.body.data.lastLogin, timestamp);
});

test('parallel account creation and legacy registration use the same ID allocator', async () => {
  const saved = await Promise.all([
    request('/employees', 'COO', employee({ email: 'parallel-one@example.test' })),
    request('/auth/register', 'Manager', employee({ email: 'parallel-two@example.test', employeeId: 'INT9999', password: 'ignored' })),
    request('/employees', 'CEO', employee({ email: 'parallel-three@example.test' }))
  ]);
  assert.ok(saved.every(result => result.status === 201));
  const ids = saved.map(result => result.body.data.employeeId);
  assert.equal(new Set(ids).size, 3);
  assert.ok(ids.every(id => /^INT\d{3,}$/.test(id) && id !== 'INT9999'));
  const created = await User.findById(saved[1].body.data.id);
  assert.equal(created.password, undefined);
  assert.equal((await request('/employees', 'COO', employee({ email: 'blocked-director@example.test', role: 'COO' }))).status, 403);
  assert.equal((await request('/employees', 'CEO', employee({ email: 'new-director@example.test', role: 'COO' }))).status, 201);
});

test('import preview reports source rows and commit preserves an existing credential', async () => {
  const target = await User.create({ employeeId: 'INT888', firstName: 'Existing', lastName: 'Employee',
    email: 'keep-account@example.test', password: 'Long valid archive passphrase', role: 'Member', department: 'Sensor Stack' });
  const csv = [
    'Employee ID,Full Name,E-mail Address,Designation,Department,DOJ,Reporting Manager',
    'INT888,Existing Employee,keep-account@example.test,Updated Designation,Sensor Stack,14/02/2025,Unknown Person',
    ',Duplicate Email,keep-account@example.test,Intern,Sensor Stack,24/02/2025,',
    ',Invalid Date,new-account@example.test,Intern,Sensor Stack,31/02/2025,'
  ].join('\n');
  function upload(dryRun) {
    const data = new FormData();
    data.set('file', new Blob([csv]), 'employees.csv');
    data.set('dryRun', String(dryRun));
    data.set('updateExisting', 'true');
    return request('/employees/import', 'CEO', data);
  }
  const preview = await upload(true);
  assert.equal(preview.status, 200, preview.body.message);
  assert.deepEqual(preview.body.data.summary, { totalRows: 3, toCreate: 0, toUpdate: 1, skipped: 0, errors: 2 });
  assert.deepEqual(preview.body.data.errors.map(error => error.row), [3, 4]);
  assert.equal(preview.body.data.managerWarnings[0].row, 2);
  assert.equal((await User.findById(target.id)).designation, undefined);
  const committed = await upload(false);
  assert.equal(committed.status, 200, committed.body.message);
  const updated = await User.findById(target.id);
  assert.equal(updated.designation, 'Updated Designation');
  assert.equal(updated.password, target.password);
  assert.equal(updated.employeeId, 'INT888');
});
