const assert = require('node:assert/strict');
const { once } = require('node:events');
const { after, before, test } = require('node:test');

delete process.env.DATABASE_URL;
delete process.env.VERCEL;
process.env.PGLITE_DATA_DIR = 'memory://';
process.env.SEED_DEMO_DATA = 'false';
process.env.JWT_SECRET = 'task-integration-test-secret';
process.env.TZ = 'UTC';

const connectDB = require('../src/config/db');
const User = require('../src/models/User');
const Task = require('../src/models/Task');
const app = require('../src/app');

const utcEvening = new Date('2026-11-24T20:00:00Z');
const businessToday = '2026-11-25';
const businessYesterday = '2026-11-24';
const department = 'Core Systems & Kernel';
let server;
let database;
let ceo;
let assignee;

before(async () => {
  database = await connectDB();
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  ceo = await User.create({ employeeId: 'CEO001', fullName: 'Task Reviewer', role: 'CEO', department });
  assignee = await User.create({ employeeId: 'INT001', fullName: 'Task Assignee', role: 'Member', department });
});

after(async () => {
  if (server) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  if (database) await database.close();
});

async function request(method, path = '', body, actor = ceo) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (actor) headers.Authorization = `Bearer ${actor.getSignedJwtToken()}`;

  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/tasks${path}`, {
    method,
    headers,
    body: JSON.stringify(body)
  });
  return { status: response.status, body: await response.json() };
}

function taskFields(title, dueDate) {
  return { title, dueDate, department, assignedTo: assignee.id, createdBy: ceo.id };
}

test('task creation accepts today but rejects yesterday once the India business date has rolled over', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: utcEvening });

  const today = await request('POST', '', taskFields('Task due today', businessToday));
  assert.equal(today.status, 201, today.body.message);
  assert.equal(today.body.data.dueDate, businessToday);

  const yesterday = await request('POST', '', taskFields('Task due yesterday', businessYesterday));
  assert.equal(yesterday.status, 400, yesterday.body.message);
  assert.equal(await Task.findOne({ title: 'Task due yesterday' }), null);
});

test('task creation rejects a date that would roll over into the next month', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: utcEvening });

  const result = await request('POST', '', taskFields('Impossible date', '2027-02-30'));
  assert.equal(result.status, 400, result.body.message);
  assert.equal(await Task.findOne({ title: 'Impossible date' }), null);
});

test('task creation still supports tasks without a due date', async () => {
  const omitted = await request('POST', '', taskFields('Undated task'));
  const empty = await request('POST', '', taskFields('Task with a blank date', ''));

  assert.equal(omitted.status, 201, omitted.body.message);
  assert.equal(empty.status, 201, empty.body.message);
  assert.ok(!omitted.body.data.dueDate);
  assert.ok(!empty.body.data.dueDate);
});

test('an authorized editor can update an overdue task without rescheduling it', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: utcEvening });
  const overdueDate = '2026-11-23';
  const task = await Task.create(taskFields('Existing overdue task', overdueDate));

  const untouchedDate = await request('PUT', `/${task.id}`, { title: 'Updated overdue task' });
  assert.equal(untouchedDate.status, 200, untouchedDate.body.message);
  assert.equal(untouchedDate.body.data.title, 'Updated overdue task');
  assert.equal(untouchedDate.body.data.dueDate, overdueDate);

  const sameDate = await request('PUT', `/${task.id}`, { description: 'Edited from the full form', dueDate: overdueDate });
  assert.equal(sameDate.status, 200, sameDate.body.message);
  assert.equal(sameDate.body.data.dueDate, overdueDate);

  const rescheduleToPast = await request('PUT', `/${task.id}`, { dueDate: businessYesterday });
  assert.equal(rescheduleToPast.status, 400, rescheduleToPast.body.message);
  assert.equal((await Task.findById(task.id)).dueDate, overdueDate);
});

test('an authorized editor can edit and delete a task through the API', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: utcEvening });
  const created = await request('POST', '', taskFields('Original task', businessToday));
  assert.equal(created.status, 201, created.body.message);
  const path = `/${created.body.data.id || created.body.data._id}`;

  assert.equal((await request('PUT', path, { title: 'Anonymous edit' }, null)).status, 401);
  assert.equal((await request('DELETE', path, undefined, null)).status, 401);

  const edited = await request('PUT', path, { title: 'Edited task', dueDate: '2026-11-26' });
  assert.equal(edited.status, 200, edited.body.message);
  const persisted = await request('GET', path);
  assert.equal(persisted.body.data.title, 'Edited task');
  assert.equal(persisted.body.data.dueDate, '2026-11-26');

  const removed = await request('DELETE', path);
  assert.equal(removed.status, 200, removed.body.message);
  assert.equal((await request('GET', path)).status, 404);
});

test('new tasks use the server creation instant, and assignees cannot remove or edit their assigned task', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: utcEvening });
  const created = await request('POST', '', {
    ...taskFields('Server timestamp', businessToday),
    createdAt: '2020-01-01T00:00:00.000Z'
  });
  assert.equal(created.status, 201, created.body.message);
  assert.equal(created.body.data.createdAt, utcEvening.toISOString());
  const path = `/${created.body.data.id}`;
  assert.equal((await request('PUT', path, { title: 'Changed' }, assignee)).status, 403);
  assert.equal((await request('DELETE', path, undefined, assignee)).status, 403);
  assert.equal((await request('PATCH', `${path}/progress`, { progress: 50 }, assignee)).status, 200);
  const current = await request('GET', path);
  assert.equal(current.body.data.title, 'Server timestamp');
  assert.equal(current.body.data.progress, 50);
});
