const { getDb } = require('../config/db');
const { effectiveRole } = require('./terminationPermissions');

const prefixes = {
  CEO: 'CEO', COO: 'DIR', Manager: 'PM', 'Team Lead': 'LD', 'CO Head': 'COH', HR: 'HR', Member: 'INT'
};

async function withEmployeeIdentityLock(callback) {
  const database = await getDb();
  const run = async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext('spaceborn.employee.identities'))");
    return callback(client);
  };
  if (typeof database.transaction === 'function') return database.transaction(run);

  const client = await database.connect();
  try {
    await client.query('BEGIN');
    const result = await run(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function allocateEmployeeIds(role, count = 1, client) {
  if (!client) return withEmployeeIdentityLock(db => allocateEmployeeIds(role, count, db));
  const prefix = prefixes[effectiveRole({ role })];
  if (!prefix || !Number.isInteger(count) || count < 1 || count > 2000) throw new Error('Invalid employee ID allocation');
  const { rows: [counter] } = await client.query(`
    INSERT INTO employee_id_counters (prefix, last_value)
    SELECT $1, COALESCE(MAX(SUBSTRING(UPPER(data->>'employeeId') FROM LENGTH($1) + 1)::bigint), 0) + $2::int
    FROM users
    WHERE UPPER(data->>'employeeId') ~ ('^' || $1 || '[0-9]{1,12}$')
    ON CONFLICT (prefix) DO UPDATE
    SET last_value = GREATEST(employee_id_counters.last_value + $2::int, EXCLUDED.last_value)
    RETURNING last_value
  `, [prefix, count]);
  const firstValue = BigInt(counter.last_value) - BigInt(count - 1);
  return Array.from({ length: count }, (_unused, index) =>
    prefix + String(firstValue + BigInt(index)).padStart(3, '0'));
}

async function rememberEmployeeId(client, employeeId) {
  const parts = /^(CEO|DIR|PM|LD|COH|HR|INT)(\d{1,12})$/i.exec(employeeId);
  if (!parts) return;
  await client.query(`
    INSERT INTO employee_id_counters (prefix, last_value) VALUES ($1, $2)
    ON CONFLICT (prefix) DO UPDATE
    SET last_value = GREATEST(employee_id_counters.last_value, EXCLUDED.last_value)
  `, [parts[1].toUpperCase(), parts[2]]);
}

module.exports = { allocateEmployeeIds, rememberEmployeeId, withEmployeeIdentityLock };
