const { createHash, randomBytes } = require('node:crypto');
const { query } = require('../config/db');
const { newPasswordFields } = require('../utils/passwords');
const { emailSettings, sendEmail } = require('./emailService');
const { passwordResetMessage } = require('../email/passwordReset');
const { revokeUserSessions } = require('./authState');
const Notification = require('../models/Notification');

const resetIdentity = "jsonb_build_array(data->>'email', data->>'passwordVersion')";
const activeAccount = "(data->>'isActive') IS DISTINCT FROM 'false'";
const resetExpiryMinutes = 15;
const setupExpiryMinutes = 30;
const resetTokenFormat = /^[a-f0-9]{64}$/;
const validReset = `
  password_reset_digest = $1 AND password_reset_expires_at > NOW()
  AND password_reset_identity = ${resetIdentity} AND ${activeAccount}
`;
const hashToken = token => createHash('sha256').update(token).digest('hex');
const isResetToken = token => typeof token === 'string' && resetTokenFormat.test(token);

async function issuePasswordLink(userId, settings, setup = false) {
  const expiresInMinutes = setup ? setupExpiryMinutes : resetExpiryMinutes;
  const token = randomBytes(32).toString('hex');
  const digest = hashToken(token);
  const { rows: [account] } = await query(`
    UPDATE users
    SET password_reset_digest = $2,
        password_reset_expires_at = NOW() + ($3::int * INTERVAL '1 minute'),
        password_reset_requested_at = NOW(),
        password_reset_identity = ${resetIdentity}
    WHERE id = $1
      AND ${activeAccount} AND COALESCE(data->>'email', '') <> ''
      AND (NOT $4::boolean OR (
        COALESCE(data->>'password', '') = '' AND
        (password_reset_requested_at IS NULL OR password_reset_requested_at <= NOW() - INTERVAL '60 seconds')
      ))
    RETURNING data->>'email' AS email, data->>'employeeId' AS "employeeId",
        (data ? 'signupDepartment' OR EXISTS (
          SELECT 1 FROM signup_requests WHERE user_id = users.id AND status = 'approved'
        )) AS "fromSignup"
  `, [userId, digest, expiresInMinutes, setup]);
  if (!account) return null;

  const url = new URL('/reset-password', settings.origin);
  url.hash = `token=${token}`;
  const message = passwordResetMessage(url, expiresInMinutes, setup ? account.employeeId : undefined);
  if (setup && !account.fromSignup) message.subject = 'Create your Spaceborn password';
  return { digest, email: account.email, message };
}

function issueSetupLink(userId, settings) {
  return issuePasswordLink(userId, settings, true);
}

async function invalidatePasswordLink(digest) {
  await query('UPDATE users SET password_reset_digest = NULL WHERE password_reset_digest = $1', [digest]);
}

async function emailPasswordLink(userId, settings, setup = false) {
  const link = await issuePasswordLink(userId, settings, setup);
  if (!link) return 'unavailable';
  try {
    await sendEmail(settings, { to: link.email, ...link.message });
    return 'sent';
  } catch {
    await invalidatePasswordLink(link.digest);
    console.error(setup ? 'Password setup email delivery failed.' : 'Password reset email delivery failed.');
    return 'failed';
  }
}

function emailResetLink(userId, settings) {
  return emailPasswordLink(userId, settings);
}

function emailSetupLink(userId, settings) {
  return emailPasswordLink(userId, settings, true);
}

async function getResetAccount(token) {
  if (!isResetToken(token)) return null;
  const { rows: [account] } = await query(`
    SELECT id, data->>'firstName' AS "firstName", data->>'lastName' AS "lastName",
      data->>'employeeId' AS "employeeId"
    FROM users WHERE ${validReset}
  `, [hashToken(token)]);
  return account || null;
}

async function isResetLinkValid(token) {
  return Boolean(await getResetAccount(token));
}

async function sendResetConfirmation(account) {
  const settings = emailSettings();
  const message = 'Your Spaceborn password was reset and previous sessions were signed out. Contact HR immediately if you did not make this change.';
  const results = await Promise.allSettled([
    revokeUserSessions(account.id),
    Notification.create({
      userId: account.id,
      title: 'Password reset completed',
      message,
      category: 'System',
      priority: 'high'
    }),
    settings && account.email ? sendEmail(settings, {
      to: account.email,
      subject: 'Your Spaceborn password was reset',
      text: message
    }) : Promise.resolve()
  ]);
  if (results.some(result => result.status === 'rejected')) console.error('Password reset follow-up failed.');
}

async function redeemResetLink(token, password) {
  const passwordData = await newPasswordFields(password);
  const { rows: [updated] } = await query(`
    WITH candidate AS (
      SELECT id,
        CASE WHEN COALESCE(data->>'password', '') = '' THEN data->>'employeeId' END AS setup_employee_id,
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
    RETURNING users.id, data->>'email' AS email, candidate.setup_employee_id AS "setupEmployeeId"
  `, [hashToken(token), JSON.stringify(passwordData)]);
  if (!updated) return null;
  if (updated.setupEmployeeId) return { setupEmployeeId: updated.setupEmployeeId };
  await sendResetConfirmation(updated);
  return {};
}

module.exports = {
  emailResetLink, emailAdminResetLink: emailResetLink, emailSetupLink, issueSetupLink, invalidatePasswordLink,
  isResetLinkValid, getResetAccount, redeemResetLink
};
