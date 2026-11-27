const { randomUUID } = require('node:crypto');
const { query } = require('../config/db');

async function recordLoginActivity(userId, action) {
  try {
    await query(`
      INSERT INTO login_attempts (id, data)
      SELECT $1, jsonb_build_object(
        'userId', id,
        'action', $3::text,
        'employeeId', data->>'employeeId',
        'name', data->>'fullName',
        'department', data->>'department',
        'role', data->>'role',
        'designation', data->>'designation'
      )
      FROM users WHERE id = $2
    `, [randomUUID(), userId, action]);
  } catch {
    console.error('Could not record sign-in activity.');
  }
}

module.exports = { recordLoginActivity };
