const { canTerminateUser } = require('../utils/terminationPermissions');
const { randomBytes } = require('node:crypto');
const { allocateEmployeeIds, rememberEmployeeId, withEmployeeIdentityLock } = require('../utils/employeeIds');

const emailOwner = async (client, email, excludedId = '') => {
  const result = await client.query(
    "SELECT id FROM users WHERE lower(btrim(data->>'email')) = $1 AND id <> $2 LIMIT 1",
    [email, excludedId]
  );
  return result.rows[0]?.id;
};

function newEmployee(fields, employeeId) {
  const id = randomBytes(12).toString('hex');
  const now = new Date().toISOString();
  return {
    ...fields,
    id,
    _id: id,
    employeeId,
    isOnline: false,
    mustChangePassword: true,
    setupEmailStatus: 'pending',
    createdAt: now,
    updatedAt: now
  };
}

async function insertEmployees(client, employees) {
  if (!employees.length) return;
  await client.query(`
    INSERT INTO users (id, data)
    SELECT employee->>'id', employee FROM jsonb_array_elements($1::jsonb) AS employee
  `, [JSON.stringify(employees)]);
}

async function updateEmployees(client, updates) {
  if (!updates.length) return;
  await client.query(`
    UPDATE users SET data = users.data || (incoming.employee - 'userIdForUpdate'), updated_at = NOW()
    FROM jsonb_array_elements($1::jsonb) AS incoming(employee)
    WHERE users.id = incoming.employee->>'userIdForUpdate'
  `, [JSON.stringify(updates)]);
}

async function removeEmployee(targetId, actor) {
  return withEmployeeIdentityLock(async client => {
    const { rows: [existing] } = await client.query('SELECT data FROM users WHERE id = $1', [targetId]);
    if (!existing) return { status: 404 };
    const target = { ...existing.data, id: targetId };
    if (!canTerminateUser(actor, target)) return { status: 403 };
    await rememberEmployeeId(client, target.employeeId);
    await client.query('DELETE FROM users WHERE id = $1', [targetId]);

    const marker = JSON.stringify({
      formerEmployee: true,
      formerEmployeeName: target.fullName || [target.firstName, target.lastName].filter(Boolean).join(' '),
      formerEmployeeId: target.employeeId
    });
    for (const table of ['attendance', 'leaves', 'reports', 'hour_breaks']) {
      await client.query(`
        UPDATE ${table} SET data = data || $3::jsonb, updated_at = NOW()
        WHERE data->>'userId' = $1 OR ($2 <> '' AND data->>'employeeId' = $2)
      `, [target.id, target.employeeId || '', marker]);
    }
    await client.query(`
      UPDATE tasks SET data = data || $2::jsonb, updated_at = NOW() WHERE data->>'assignedTo' = $1
    `, [target.id, marker]);
    await client.query(`
      DELETE FROM notifications
      WHERE data->>'userId' = $1 OR data->>'toUserId' = $1
        OR ($2 <> '' AND (data->>'userId' = $2 OR data->>'toUserId' = $2))
    `, [target.id, target.employeeId || '']);
    await client.query("DELETE FROM sessions WHERE data->>'userId' = $1", [target.id]);
    return { status: 200, target };
  });
}

module.exports = {
  allocateEmployeeIds, rememberEmployeeId, withEmployeeIdentityLock, emailOwner,
  newEmployee, insertEmployees, updateEmployees, removeEmployee
};
