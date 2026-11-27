const { query } = require('../config/db');
const { normalizeDepartment } = require('../config/departments');
const { businessDate, businessInstant } = require('../utils/businessTime');
const { formatResponse } = require('../utils/helpers');
const { effectiveRole } = require('../utils/terminationPermissions');

const dayMillis = 86_400_000;
const activityTypes = new Set(['login', 'logout']);

function numberOfDays(value) {
  const days = Number(value);
  return Number.isInteger(days) && days >= 1 && days <= 90 ? days : 7;
}

function inScope(actor, entry) {
  if (actor.role !== 'Manager') return true;
  return Boolean(actor.department) && normalizeDepartment(actor.department) === normalizeDepartment(entry.department);
}

function eventFor(record, id, action, timestamp) {
  return {
    id, action, timestamp,
    employeeId: record.employeeId,
    name: record.userName || record.name || record.fullName || record.employeeId || 'Employee',
    role: effectiveRole(record),
    department: record.department
  };
}

async function loginHistory(actor, firstDate) {
  const { rows } = await query(`
    SELECT id, data, created_at FROM login_attempts
    WHERE created_at >= $1::timestamptz AND data->>'action' IN ('login', 'logout')
    ORDER BY created_at DESC
  `, [businessInstant(firstDate, '00:00').toISOString()]);
  return rows.filter(row => activityTypes.has(row.data.action) && inScope(actor, row.data))
    .map(row => eventFor(row.data, row.id, row.data.action, row.created_at));
}

function attendanceInstant(record, field) {
  return record[`${field}Time`] || (record[field] ? businessInstant(record.date, record[field]) : null);
}

exports.getActivity = async (req, res) => {
  const firstDate = businessDate(new Date(Date.now() - (numberOfDays(req.query.days) - 1) * dayMillis));
  const [history, { rows }] = await Promise.all([
    loginHistory(req.user, firstDate),
    query("SELECT id, data FROM attendance WHERE data->>'date' >= $1", [firstDate])
  ]);
  const attendance = rows.filter(row => inScope(req.user, row.data)).flatMap(({ id, data }) => (
    [['checkIn', 'check-in'], ['checkOut', 'check-out']].flatMap(([field, action]) => {
      const timestamp = attendanceInstant(data, field);
      return timestamp && Number.isFinite(new Date(timestamp).getTime())
        ? [eventFor(data, `${id}-${action}`, action, timestamp)]
        : [];
    })
  ));
  const activity = [...history, ...attendance].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  res.json(formatResponse(true, 'Activity loaded.', activity));
};

exports.getLoginManagement = async (req, res) => {
  const firstDate = businessDate(new Date(Date.now() - (numberOfDays(req.query.days) - 1) * dayMillis));
  const [history, { rows }] = await Promise.all([
    loginHistory(req.user, firstDate),
    query(`
      SELECT s.id, s.data, s.created_at,
             u.data->>'fullName' AS name, u.data->>'employeeId' AS "employeeId",
             u.data->>'role' AS role, u.data->>'designation' AS designation,
             u.data->>'department' AS department
      FROM sessions s JOIN users u ON u.id = s.data->>'userId'
      WHERE u.data->>'isActive' IS DISTINCT FROM 'false' AND s.data->>'revokedAt' IS NULL
            AND CASE WHEN s.data->>'expiresAt' ~ '^[0-9]+$' THEN (s.data->>'expiresAt')::bigint END > $1
      ORDER BY s.created_at DESC
    `, [Date.now()])
  ]);
  const sessions = rows.filter(entry => inScope(req.user, entry)).map(row => ({
    ...eventFor(row, row.id, 'active', row.created_at),
    lastSeen: Number(row.data.lastSeen) || null
  }));
  res.json(formatResponse(true, 'Login activity loaded.', { sessions, history }));
};

exports.getMyAttendance = async (req, res) => {
  const { rows: [row] } = await query(`
    SELECT data FROM attendance
    WHERE data->>'date' = $1
    AND (data->>'userId' = $2 OR ($3 <> '' AND data->>'employeeId' = $3))
    ORDER BY updated_at DESC LIMIT 1
  `, [businessDate(), req.user.id, req.user.employeeId || '']);
  const record = row?.data;
  const attendance = record && {
    date: record.date,
    employeeId: req.user.employeeId,
    checkInTime: attendanceInstant(record, 'checkIn'),
    checkOutTime: attendanceInstant(record, 'checkOut'),
    hoursWorked: record.hoursWorked || 0,
    status: record.status
  };
  res.json(formatResponse(true, 'Attendance loaded.', attendance || null));
};
