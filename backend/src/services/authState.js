const { createHash, randomUUID } = require('node:crypto');
const jwt = require('jsonwebtoken');
const { query } = require('../config/db');
const { getJwtSecret } = require('../utils/jwtSecret');
const { effectiveRole } = require('../utils/terminationPermissions');

const lockDuration = 15 * 60_000;
const failuresBeforeLock = 5;
const resetWindow = 60 * 60_000;
const resetLimit = 3;

function normalizeIdentifier(value) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > (trimmed.includes('@') ? 254 : 64)) return '';
  return trimmed.includes('@') ? trimmed.toLowerCase() : trimmed.toUpperCase();
}

async function findAccount(identifier) {
  const field = identifier.includes('@') ? "LOWER(data->>'email')" : "UPPER(data->>'employeeId')";
  const { rows: [row] } = await query(`SELECT id, data, two_factor FROM users WHERE ${field} = $1 LIMIT 1`, [identifier]);
  return row && { ...row.data, id: row.id, two_factor: row.two_factor };
}

function attemptId(purpose, account, identifier = '') {
  return createHash('sha256').update(JSON.stringify([purpose, account?.id || identifier])).digest('hex');
}

async function lockedUntil(id) {
  const { rows: [row] } = await query("SELECT data->>'lockedUntil' AS until FROM login_attempts WHERE id = $1", [id]);
  return Number(row?.until || 0);
}

async function recordFailure(id) {
  const now = Date.now();
  const { rows: [row] } = await query(`
    INSERT INTO login_attempts (id, data)
      VALUES ($1, jsonb_build_object('failures', 1))
    ON CONFLICT (id) DO UPDATE SET
      data = CASE
        WHEN (login_attempts.data->>'lockedUntil')::bigint > $2 THEN login_attempts.data
        WHEN login_attempts.data ? 'lockedUntil' THEN EXCLUDED.data
        WHEN (login_attempts.data->>'failures')::int + 1 >= $3
          THEN jsonb_build_object('failures', $3::int, 'lockedUntil', $4::bigint)
        ELSE jsonb_build_object('failures', (login_attempts.data->>'failures')::int + 1)
      END, updated_at = NOW()
    RETURNING data->>'lockedUntil' AS until
  `, [id, now, failuresBeforeLock, now + lockDuration]);
  return Number(row?.until || 0);
}

async function clearFailures(id) {
  await query("DELETE FROM login_attempts WHERE id = $1 AND COALESCE((data->>'lockedUntil')::bigint, 0) <= $2", [id, Date.now()]);
}

async function acceptResetRequest(id) {
  const now = Date.now();
  const recent = `jsonb_path_query_array(login_attempts.data->'requests', '$[*] ? (@ > $cutoff)', jsonb_build_object('cutoff', $3::bigint))`;
  const { rows } = await query(`
    INSERT INTO login_attempts (id, data) VALUES ($1, jsonb_build_object('requests', jsonb_build_array($2::bigint)))
    ON CONFLICT (id) DO UPDATE SET
      data = jsonb_build_object('requests', ${recent} || (EXCLUDED.data->'requests')), updated_at = NOW()
    WHERE jsonb_array_length(${recent}) < $4
    RETURNING id
  `, [id, now, now - resetWindow, resetLimit]);
  return rows.length === 1;
}

async function createSession(user, { twoFactor = false } = {}) {
  const sid = randomUUID();
  const token = jwt.sign({
    sid,
    id: user.id,
    employeeId: user.employeeId,
    role: effectiveRole(user),
    pv: user.passwordVersion,
    mfa: twoFactor
  }, getJwtSecret(), { expiresIn: process.env.JWT_EXPIRE || '24h' });
  const since = Date.now();
  const expiresAt = jwt.decode(token).exp * 1000;
  const { rows } = await query(`
    INSERT INTO sessions (id, data)
    SELECT $1, $2::jsonb FROM users WHERE id = $3 AND (data->>'passwordVersion') IS NOT DISTINCT FROM $4
      AND (data->>'isActive') IS DISTINCT FROM 'false'
    RETURNING id
  `, [sid, JSON.stringify({
    userId: user.id, employeeId: user.employeeId,
    passwordVersion: user.passwordVersion, createdAt: since, lastSeen: since, expiresAt
  }), user.id, user.passwordVersion || null]);
  return rows.length ? { token, expiresAt } : null;
}

const activeSession = "NOT (data ? 'revokedAt') AND (data->>'expiresAt')::bigint > $3";

async function verifySession(sid, userId) {
  const { rows } = await query(`
    UPDATE sessions SET data = jsonb_set(data, '{lastSeen}', to_jsonb($3::bigint)), updated_at = NOW()
    WHERE id = $1 AND data->>'userId' = $2 AND ${activeSession}
    RETURNING id
  `, [sid, userId, Date.now()]);
  return rows.length === 1;
}

async function revokeSession(sid, userId) {
  if (sid) {
    await query(`
      UPDATE sessions SET data = jsonb_set(data, '{revokedAt}', to_jsonb($3::bigint)), updated_at = NOW()
      WHERE id = $1 AND data->>'userId' = $2 AND ${activeSession}
    `, [sid, userId, Date.now()]);
  }
  const { rows } = await query(`
    SELECT 1 FROM sessions WHERE data->>'userId' = $1
      AND NOT (data ? 'revokedAt') AND (data->>'expiresAt')::bigint > $2 LIMIT 1
  `, [userId, Date.now()]);
  return rows.length > 0;
}

async function revokeUserSessions(userId) {
  await query(`
    UPDATE sessions SET data = jsonb_set(data, '{revokedAt}', to_jsonb($2::bigint)), updated_at = NOW()
    WHERE data->>'userId' = $1 AND NOT (data ? 'revokedAt')
  `, [userId, Date.now()]);
}

module.exports = {
  normalizeIdentifier, findAccount, attemptId, lockedUntil, recordFailure, clearFailures, acceptResetRequest,
  createSession, verifySession, revokeSession, revokeUserSessions
};
