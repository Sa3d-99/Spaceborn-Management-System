const assert = require('node:assert/strict');
const { after, before, mock, test } = require('node:test');
const { PGlite } = require('@electric-sql/pglite');
const dbConfig = require('../src/config/db');

const db = new PGlite();
mock.method(dbConfig, 'getDb', async () => db);
mock.method(dbConfig, 'query', (sql, params) => db.query(sql, params));
mock.method(dbConfig, 'exec', (sql) => db.exec(sql));

const attendance = require('../src/controllers/attendanceController');
const hourBreaks = require('../src/controllers/hourBreakController');
const resources = require('../src/controllers/resourceController');
const Attendance = require('../src/models/Attendance');
const HourBreak = require('../src/models/HourBreak');
const Meeting = require('../src/models/Meeting');
const ResourceRequest = require('../src/models/ResourceRequest');
const User = require('../src/models/User');

before(async () => {
  for (const table of dbConfig.TABLES) {
    await db.exec(`
      CREATE TABLE ${table} (
        id VARCHAR(64) PRIMARY KEY,
        data JSONB NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
  }
});

after(async () => {
  mock.restoreAll();
  await db.close();
});

async function call(handler, req) {
  const response = {
    status(code) {
      this.code = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };
  await handler(req, response);
  return response;
}

async function markAttendance(t, employeeId, instant) {
  const user = await User.create({
    employeeId,
    fullName: 'QA Intern',
    role: 'Member',
    department: 'Core Systems'
  });
  t.mock.timers.enable({ apis: ['Date'], now: new Date(instant) });

  const response = await call(attendance.autoMarkAttendance, {
    user: { ...user, name: user.fullName },
    body: {
      userId: user.id,
      userName: user.fullName,
      employeeId: user.employeeId,
      department: user.department,
      role: user.role
    }
  });
  assert.equal(response.code, 201, response.body?.message);
  return Attendance.findById(response.body.data._id);
}

test('attendance uses the India date when UTC is still on the previous day', async (t) => {
  const record = await markAttendance(t, 'INT001', '2026-11-24T20:00:00Z');
  assert.equal(record.date, '2026-11-25');
});

test('attendance stays present when the employee has no applicable meeting', async (t) => {
  await Meeting.create({
    title: 'Other department standup',
    department: 'Platform and DevOps',
    date: '2026-11-26',
    time: '09:00',
    status: 'upcoming'
  });
  const record = await markAttendance(t, 'INT002', '2026-11-26T15:00:00Z');
  assert.equal(record.status, 'present');
});

test('the first applicable meeting starts the five-minute attendance grace period', async (t) => {
  const date = '2026-11-27';
  await Meeting.create([
    { title: 'Other department standup', department: 'Platform and DevOps', date, time: '08:00', status: 'upcoming' },
    { title: 'Department standup', department: 'Core Systems', date, time: '10:00', status: 'upcoming' },
    { title: 'Company standup', department: 'All', date, time: '09:00', status: 'upcoming' }
  ]);

  await t.test('exactly five minutes after start is present', async (t) => {
    const record = await markAttendance(t, 'INT003', '2026-11-27T03:35:00Z');
    assert.equal(record.status, 'present');
  });

  await t.test('five minutes and one second after start is late', async (t) => {
    const record = await markAttendance(t, 'INT004', '2026-11-27T03:35:01Z');
    assert.equal(record.status, 'late');
  });
});

const approvalCases = [
  { description: 'a peer intern', employeeId: 'INT006', role: 'Member', status: 403 },
  { description: 'a Team Lead in another department', employeeId: 'LD001', role: 'Team Lead', otherDepartment: true, status: 403 },
  { description: 'a Project Manager in another department', employeeId: 'PM001', role: 'Manager', otherDepartment: true, status: 403 },
  { description: 'the intern’s Team Lead', employeeId: 'LD002', role: 'Team Lead', status: 200 },
  { description: 'the intern’s Project Manager', employeeId: 'PM002', role: 'Manager', status: 200 },
  { description: 'HR in another department', employeeId: 'HR001', role: 'HR', otherDepartment: true, status: 200 },
  { description: 'a Director', employeeId: 'DIR001', role: 'COO', otherDepartment: true, status: 200 },
  { description: 'the CEO', employeeId: 'CEO001', role: 'CEO', otherDepartment: true, status: 200 }
];

const workflows = [
  {
    name: 'resource approval',
    model: ResourceRequest,
    handler: resources.approveRequest,
    parameter: 'id',
    status: 'approved',
    fields: (user) => ({
      requester: user.id,
      requesterName: user.fullName,
      requesterRole: user.role,
      resourceName: 'Monitor'
    })
  },
  {
    name: 'resource rejection',
    model: ResourceRequest,
    handler: resources.rejectRequest,
    parameter: 'id',
    status: 'rejected',
    fields: (user) => ({
      requester: user.id,
      requesterName: user.fullName,
      requesterRole: user.role,
      resourceName: 'Monitor'
    })
  },
  {
    name: 'hour-break approval',
    model: HourBreak,
    handler: hourBreaks.updateBreakStatus,
    parameter: 'breakId',
    status: 'approved',
    fields: (user) => ({
      userId: user.id,
      userName: user.fullName,
      userRole: user.role,
      employeeId: user.employeeId,
      date: '2026-11-27',
      hours: 1
    })
  }
];

test('intern request decisions apply approval permissions and preserve denied requests', async (t) => {
  const department = 'Core Systems';
  const team = 'Systems';
  const actors = await Promise.all(approvalCases.map((entry) => User.create({
    employeeId: entry.employeeId,
    fullName: entry.description,
    role: entry.role,
    department: entry.otherDepartment ? 'Platform and DevOps' : department,
    team: entry.otherDepartment ? 'Platform' : team
  })));
  const intern = await User.create({
    employeeId: 'INT005',
    fullName: 'Requesting Intern',
    role: 'Member',
    department,
    team,
    manager: actors.find((user) => user.employeeId === 'PM002').id
  });

  for (const workflow of workflows) {
    for (const [index, entry] of approvalCases.entries()) {
      await t.test(`${workflow.name} by ${entry.description}`, async () => {
        const actor = actors[index];
        const request = await workflow.model.create({
          ...workflow.fields(intern),
          department,
          status: 'pending'
        });
        const response = await call(workflow.handler, {
          params: { [workflow.parameter]: request.id },
          body: { status: workflow.status, rejectionReason: 'QA review' },
          user: { ...actor, name: actor.fullName }
        });

        assert.equal(response.code, entry.status, response.body?.message);
        const stored = await workflow.model.findById(request.id);
        assert.equal(stored.status, entry.status === 200 ? workflow.status : 'pending');
      });
    }

    await t.test(`${workflow.name} is denied for the requester`, async () => {
      const hr = actors.find((user) => user.role === 'HR');
      const request = await workflow.model.create({
        ...workflow.fields(hr),
        department: hr.department,
        status: 'pending'
      });
      const response = await call(workflow.handler, {
        params: { [workflow.parameter]: request.id },
        body: { status: workflow.status, rejectionReason: 'QA review' },
        user: { ...hr, name: hr.fullName }
      });

      assert.equal(response.code, 403, response.body?.message);
      assert.equal((await workflow.model.findById(request.id)).status, 'pending');
    });
  }
});
