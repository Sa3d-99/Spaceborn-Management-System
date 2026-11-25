const { createHash, randomBytes, randomUUID } = require('node:crypto');
const { query } = require('../config/db');
const { hashPassword } = require('../utils/passwords');
const { sendEmail } = require('./emailService');
const { passwordResetMessage } = require('../email/passwordReset');

const resetIdentity = "jsonb_build_array(data->>'email', data->>'passwordVersion')";
const activeAccount = "(data->>'isActive') IS DISTINCT FROM 'false'";
const expiresInMinutes = 30;
const resetTokenFormat = /^[a-f0-9]{64}$/;
const validReset = `
  password_reset_digest = $1 AND password_reset_expires_at > NOW()
  AND password_reset_identity = ${resetIdentity} AND ${activeAccount}
`;
const hashToken = token => createHash('sha256').update(token).digest('hex');
const isResetToken = token => typeof token === 'string' && resetTokenFormat.test(token);

function emailResetLink(employeeId, settings) {
  if (employeeId.includes('@')) {
    return emailPasswordLink("LOWER(data->>'email')", employeeId.toLowerCase(), settings);
  }
  return emailPasswordLink("UPPER(data->>'employeeId')", employeeId.toUpperCase(), settings);
}

function emailSetupLink(userId, settings) {
  return emailPasswordLink('id', userId, settings, true);
}

async function emailPasswordLink(accountLookup, identifier, settings, onboarding = false) {
  const token = randomBytes(32).toString('hex');
  const digest = hashToken(token);
  const { rows: [account] } = await query(`
    UPDATE users
    SET password_reset_digest = $2,
        password_reset_expires_at = NOW() + ($3::int * INTERVAL '1 minute'),
        password_reset_requested_at = NOW(),
        password_reset_identity = ${resetIdentity}
    WHERE id = (
      SELECT id FROM users
      WHERE ${accountLookup} = $1 AND ${activeAccount}
        AND COALESCE(data->>'email', '') <> ''
      LIMIT 1
    )
      AND ${activeAccount}
      AND (NOT $4::boolean OR COALESCE(data->>'password', '') = '')
      AND (password_reset_requested_at IS NULL OR password_reset_requested_at <= NOW() - INTERVAL '60 seconds')
    RETURNING data->>'email' AS email, data->>'employeeId' AS "employeeId"
  `, [identifier, digest, expiresInMinutes, onboarding]);
  if (!account) return 'unavailable';

  const url = new URL('/reset-password', settings.origin);
  url.hash = `token=${token}`;
  const message = passwordResetMessage(url, expiresInMinutes, onboarding ? account.employeeId : undefined);
  try {
    await sendEmail(settings, { to: account.email, ...message });
    return 'sent';
  } catch (error) {
    await query('UPDATE users SET password_reset_digest = NULL WHERE password_reset_digest = $1', [digest]);
    console.error(onboarding ? 'Signup setup email delivery failed:' : 'Password reset email delivery failed:', error.message);
    return 'failed';
  }
}

async function isResetLinkValid(token) {
  if (!isResetToken(token)) return false;
  const result = await query(`SELECT id FROM users WHERE ${validReset}`, [hashToken(token)]);
  return result.rows.length === 1;
}

async function redeemResetLink(token, password) {
  if (!await isResetLinkValid(token)) return null;

  const passwordData = {
    password: await hashPassword(password),
    passwordVersion: randomUUID(),
    passwordChangedAt: Date.now()
  };
  const { rows: [updated] } = await query(`
    WITH candidate AS (
      SELECT id,
        CASE WHEN COALESCE(data->>'password', '') = '' AND (
          data ? 'signupDepartment' OR EXISTS (
            SELECT 1 FROM signup_requests WHERE user_id = users.id AND status = 'approved'
          )
        ) THEN data->>'employeeId' END AS setup_employee_id,
        COALESCE(data->>'department', data->>'signupDepartment') AS department
      FROM users WHERE ${validReset}
    )
    UPDATE users
    SET data = (data - 'signupDepartment') || $2::jsonb ||
        CASE WHEN candidate.setup_employee_id IS NOT NULL AND candidate.department IS NOT NULL
          THEN jsonb_build_object('department', candidate.department) ELSE '{}'::jsonb END,
        updated_at = NOW(),
        password_reset_digest = NULL, password_reset_expires_at = NULL, password_reset_identity = NULL
    FROM candidate
    WHERE users.id = candidate.id AND ${validReset}
    RETURNING candidate.setup_employee_id AS "setupEmployeeId"
  `, [hashToken(token), JSON.stringify(passwordData)]);
  return updated || null;
}

module.exports = { emailResetLink, emailSetupLink, isResetToken, isResetLinkValid, redeemResetLink };
