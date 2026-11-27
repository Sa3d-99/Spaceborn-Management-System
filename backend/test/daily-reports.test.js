const assert = require('node:assert/strict');
const { once } = require('node:events');
const { after, before, test } = require('node:test');

delete process.env.DATABASE_URL;
delete process.env.VERCEL;
process.env.PGLITE_DATA_DIR = 'memory://';
process.env.SEED_DEMO_DATA = 'false';
process.env.JWT_SECRET = 'daily-report-integration-test-secret';

const connectDB = require('../src/config/db');
const User = require('../src/models/User');
const Task = require('../src/models/Task');
const Notification = require('../src/models/Notification');
const { businessDate } = require('../src/utils/businessTime');
const app = require('../src/app');

let database;
let server;

before(async () => {
  database = await connectDB();
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
});

after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  if (database) await database.close();
});

test('BUG-009 all daily report routes require authentication', async () => {
  for (const [method, path] of [
    ['GET', '/reports'], ['GET', '/reports/user/fixture'], ['GET', '/reports/user/fixture/today'],
    ['GET', '/reports/department/Sensor%20Stack'], ['GET', '/reports/compliance'],
    ['POST', '/reports'], ['PUT', '/reports/fixture'], ['DELETE', '/reports/fixture']
  ]) {
    const result = await fetch(`http://127.0.0.1:${server.address().port}/api${path}`, { method });
    assert.equal(result.status, 401, `${method} ${path} requires sign-in`);
  }
});

async function authenticatedRequest(path, user, { method = 'GET', body } = {}) {
  const headers = { Authorization: `Bearer ${user.getSignedJwtToken()}` };
  if (body) headers['Content-Type'] = 'application/json';
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api${path}`, {
    method, headers, body: JSON.stringify(body)
  });
  return { status: response.status, body: await response.json() };
}

const reportBody = () => ({
  date: businessDate(),
  completedTasks: 'Verified the sensor telemetry.',
  nextDayPlan: 'Prepare the next integration test.'
});

test('BUG-023/029/034/064/129 reports use authenticated owners, scope reads and upsert the IST day', async () => {
  const [member, teammate, lead, outsider] = await Promise.all([
    User.create({ employeeId: 'INT011', fullName: 'Sensor Reporter', role: 'Member', department: 'Sensor Stack' }),
    User.create({ employeeId: 'INT012', fullName: 'Sensor Teammate', role: 'Member', department: 'Sensor Stack' }),
    User.create({ employeeId: 'LD011', fullName: 'Sensor Lead', role: 'Team Lead', department: 'Sensor Stack' }),
    User.create({ employeeId: 'INT021', fullName: 'Neural Reporter', role: 'Member', department: 'Neural AI' })
  ]);
  const body = reportBody();
  for (const override of [{ completedTasks: 'short' }, { nextDayPlan: '' }, { date: '2020-01-01' }, { date: '9999-12-31' }]) {
    assert.equal((await authenticatedRequest('/reports', member, { method: 'POST', body: { ...body, ...override } })).status, 400);
  }
  const results = await Promise.all([
    authenticatedRequest('/reports', member, { method: 'POST', body: { ...body, userId: outsider.id, department: outsider.department } }),
    authenticatedRequest('/reports', member, { method: 'POST', body })
  ]);
  assert.deepEqual(results.map(result => result.status).sort(), [200, 201]);
  const report = results[0].body.data;
  const list = await authenticatedRequest(`/reports?date=${body.date}&department=Sensor%20Stack`, lead);
  assert.deepEqual(list.body.data.map(entry => entry.id), [report.id]);
  assert.equal(results[1].body.data.id, report.id);
  assert.equal(report.userId, member.id);
  assert.equal(report.department, member.department);
  assert.equal((await authenticatedRequest(`/reports/user/${member.id}`, teammate)).status, 403);
  assert.equal((await authenticatedRequest(`/reports/${report.id}`, teammate, { method: 'DELETE' })).status, 403);
  assert.equal((await authenticatedRequest(`/reports/user/${member.id}`, lead)).status, 200);
  assert.equal((await authenticatedRequest(`/reports/user/${outsider.id}`, lead)).status, 403);
  const compliance = await authenticatedRequest(`/reports/compliance?date=${body.date}`, lead);
  assert.equal(compliance.status, 200);
  assert.deepEqual(compliance.body.data.submitted.map(employee => employee.employeeId), [member.employeeId]);
  assert.ok(compliance.body.data.missed.some(employee => employee.employeeId === teammate.employeeId));
  assert.ok(!compliance.body.data.missed.some(employee => employee.employeeId === outsider.employeeId));
  const alerts = await Notification.find({ userId: lead.id });
  assert.equal(alerts.filter(alert => alert.details?.reportId === report.id).length, 1);
  assert.equal(await Notification.countDocuments({ userId: outsider.id }), 0);

  const leadReport = { highlights: body.completedTasks, tomorrowPlan: body.nextDayPlan };
  const sendLead = report => authenticatedRequest('/team-lead/daily-report', lead, { method: 'POST', body: report });
  assert.equal((await sendLead({})).status, 400);
  const initial = await sendLead(leadReport);
  assert.equal(initial.status, 201);
  const repeat = await sendLead({ ...leadReport, highlights: 'Revised the lead report.' });
  assert.equal(repeat.status, 200);
  assert.equal(repeat.body.data.id, initial.body.data.id);
});

test('BUG-115 persists and reads task daily logs on tasks without an existing log array', async () => {
  const employee = await User.create({ employeeId: 'INT031', fullName: 'Task Owner', role: 'Member', department: 'Sensor Stack' });
  const task = await Task.create({ title: 'Check telemetry', assignedTo: employee.id, department: 'Sensor Stack' });
  const data = { taskId: task.id, notes: 'Confirmed the capture.', progress: 50, hoursSpent: 1.5 };
  const submit = body => authenticatedRequest('/tasks/daily-logs', employee, { method: 'POST', body });
  assert.equal((await submit({ ...data, hoursSpent: 0 })).status, 400);
  assert.equal((await submit({ ...data, hoursSpent: 17 })).status, 400);
  const saved = await submit(data);
  assert.equal(saved.status, 201);
  const fetched = await authenticatedRequest('/tasks/daily-logs', employee);
  assert.equal(fetched.status, 200);
  assert.ok(fetched.body.data.logs.some(log => log.id === saved.body.data.id && log.hoursSpent === 1.5));
});
