const { randomBytes } = require('node:crypto');
const { query } = require('../config/db');
const { DEPARTMENTS } = require('../config/departments');
const { emailSettings, sendEmail } = require('../services/emailService');
const { emailSetupLink } = require('../services/passwordResetService');
const { formatResponse } = require('../utils/helpers');

const validEmail = email => email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const dto = row => ({
  id: row.id,
  name: row.full_name,
  email: row.email,
  department: row.department,
  status: row.status,
  requestedAt: row.requested_at,
  reviewedAt: row.reviewed_at,
  employeeId: row.employee_id
});

async function adminEmail() {
  const configuredEmail = process.env.SIGNUP_ADMIN_EMAIL?.trim();
  if (configuredEmail && validEmail(configuredEmail)) return configuredEmail;
  const { rows: [admin] } = await query(`
    SELECT data->>'email' AS email FROM users
    WHERE data->>'role' = 'CEO'
      AND (data->>'isActive') IS DISTINCT FROM 'false'
      AND COALESCE(data->>'email', '') <> ''
    ORDER BY created_at
    LIMIT 1
  `);
  return admin?.email && validEmail(admin.email) ? admin.email : null;
}

exports.signup = async (req, res) => {
  const { name, email, department } = req.body || {};
  const fullName = typeof name === 'string' ? name.trim() : '';
  const address = typeof email === 'string' ? email.trim().toLowerCase() : '';
  if (fullName.length < 2 || fullName.length > 120 || !validEmail(address) || !DEPARTMENTS.includes(department)) {
    return res.status(400).json(formatResponse(false, 'Enter your name, a valid email address and your department.'));
  }
  const settings = emailSettings();
  const admin = settings && await adminEmail();
  if (!admin) return res.status(503).json(formatResponse(false, 'Signup is unavailable. Contact your CRM administrator.'));

  const { rows: [request] } = await query(`
    INSERT INTO signup_requests (id, email, full_name, department, last_notification_attempt)
    SELECT $1, $2, $3, $4, NOW()
    WHERE NOT EXISTS (SELECT 1 FROM users WHERE LOWER(data->>'email') = $2)
    ON CONFLICT (email) DO UPDATE SET last_notification_attempt = NOW()
    WHERE signup_requests.status = 'pending' AND signup_requests.admin_notified_at IS NULL
      AND signup_requests.last_notification_attempt < NOW() - INTERVAL '60 seconds'
    RETURNING id, email, full_name, department
  `, [randomBytes(12).toString('hex'), address, fullName, department]);

  if (request) {
    try {
      await sendEmail(settings, {
        to: admin,
        subject: 'Spaceborn CRM signup awaiting approval',
        text: `${request.full_name} (${request.email}) requested a Spaceborn CRM account for ${request.department}.\n\nSign in as an administrator to review the request: ${settings.origin}/signup-requests`
      });
      await query('UPDATE signup_requests SET admin_notified_at = NOW() WHERE id = $1', [request.id]);
    } catch (error) {
      console.error('Signup admin email delivery failed:', error.message);
    }
  }

  return res.status(202).json(formatResponse(true, 'If eligible, your request will be reviewed. Approved applicants receive an email to set their password.'));
};

exports.list = async (_req, res) => {
  const { rows } = await query("SELECT * FROM signup_requests ORDER BY (status = 'pending') DESC, requested_at DESC");
  return res.json(formatResponse(true, 'Signup requests fetched.', rows.map(dto)));
};

exports.approve = async (req, res) => {
  const settings = emailSettings();
  if (!settings) return res.status(503).json(formatResponse(false, 'Configure Resend before approving signup requests.'));

  const userId = randomBytes(12).toString('hex');
  const { rows: [account] } = await query(`
    WITH approved AS (
      UPDATE signup_requests
      SET status = 'approved', reviewed_by = $2, reviewed_at = NOW(), user_id = $3,
          employee_id = 'INTS' || nextval('signup_employee_ids')::text
      WHERE id = $1 AND status = 'pending'
        AND NOT EXISTS (SELECT 1 FROM users WHERE LOWER(data->>'email') = signup_requests.email)
      RETURNING email, full_name, department, employee_id
    )
    INSERT INTO users (id, data)
    SELECT $3, jsonb_build_object(
      '_id', $3::text, 'id', $3::text, 'email', email, 'employeeId', employee_id,
      'fullName', full_name, 'firstName', split_part(full_name, ' ', 1),
      'lastName', trim(substring(full_name FROM length(split_part(full_name, ' ', 1)) + 1)),
      'department', department, 'role', 'Member', 'isActive', true,
      'isOnline', false, 'createdAt', NOW(), 'updatedAt', NOW()
    ) FROM approved RETURNING data->>'employeeId' AS "employeeId"
  `, [req.params.id, req.user.id, userId]);
  if (!account) return res.status(409).json(formatResponse(false, 'This request already has a decision or the email belongs to an existing account.'));

  const emailSent = (await emailSetupLink(userId, settings)) === 'sent';
  const message = emailSent
    ? 'Signup approved and setup email sent.'
    : 'Signup approved, but the setup email could not be sent. Check the Resend settings, then select Resend setup link.';
  return res.json(formatResponse(true, message, { ...account, emailSent }));
};

exports.resend = async (req, res) => {
  const settings = emailSettings();
  if (!settings) return res.status(503).json(formatResponse(false, 'Signup email is unavailable.'));
  const { rows: [request] } = await query(
    "SELECT user_id FROM signup_requests WHERE id = $1 AND status = 'approved'", [req.params.id]
  );
  if (!request?.user_id) return res.status(404).json(formatResponse(false, 'Approved signup request not found.'));
  const delivery = await emailSetupLink(request.user_id, settings);
  if (delivery === 'unavailable') {
    return res.status(409).json(formatResponse(false, 'Check that the account is active and try again after a minute.'));
  }
  if (delivery === 'failed') {
    return res.status(502).json(formatResponse(false, 'Resend could not send the setup email. Check the Resend settings and try again.'));
  }
  return res.json(formatResponse(true, 'Setup email sent.'));
};

exports.reject = async (req, res) => {
  const { rows: [request] } = await query(`
    UPDATE signup_requests SET status = 'rejected', reviewed_by = $2, reviewed_at = NOW()
    WHERE id = $1 AND status = 'pending' RETURNING *
  `, [req.params.id, req.user.id]);
  if (!request) return res.status(409).json(formatResponse(false, 'This request already has a decision.'));
  return res.json(formatResponse(true, 'Signup request declined.', dto(request)));
};
