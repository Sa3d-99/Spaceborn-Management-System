const { randomUUID } = require('node:crypto');
const { query } = require('../config/db');
const { emailSettings } = require('./emailService');
const passwordLinks = require('./passwordResetService');

const activeUnfinishedAccount = `
  (data->>'isActive') IS DISTINCT FROM 'false'
  AND data->>'mustChangePassword' = 'true' AND COALESCE(data->>'password', '') = ''
`;

async function queueEmployeeSetupEmail(userId) {
  const result = await query(`
    UPDATE users
    SET data = (data - 'setupEmailClaimId' - 'setupEmailClaimedAt') || '{"setupEmailStatus":"pending"}',
        updated_at = NOW()
    WHERE id = $1 AND ${activeUnfinishedAccount}
      AND COALESCE(data->>'setupEmailStatus', '') NOT IN ('pending', 'sending')
      AND (password_reset_requested_at IS NULL OR password_reset_requested_at <= NOW() - INTERVAL '60 seconds')
    RETURNING id
  `, [userId]);
  return result.rows.length > 0;
}

async function processEmployeeSetupEmails(settings = emailSettings()) {
  if (!settings) return;
  const claimId = randomUUID();
  const { rows: accounts } = await query(`
    WITH candidates AS (
      SELECT id FROM users WHERE ${activeUnfinishedAccount}
        AND ( data->>'setupEmailStatus' = 'pending' OR
          (data->>'setupEmailStatus' = 'sending'
            AND (data->>'setupEmailClaimedAt')::timestamptz <= NOW() - INTERVAL '2 minutes')
        )
      ORDER BY updated_at, id LIMIT 100 FOR UPDATE SKIP LOCKED
    )
    UPDATE users SET data = data || jsonb_build_object(
      'setupEmailStatus', 'sending', 'setupEmailClaimId', $1::text, 'setupEmailClaimedAt', NOW()
    ), updated_at = NOW()
    FROM candidates WHERE users.id = candidates.id RETURNING users.id
  `, [claimId]);
  if (!accounts.length) return;

  const results = await Promise.allSettled(accounts.map(async ({ id }) => {
    const issued = await passwordLinks.issueSetupLink(id, settings);
    return issued && { id, ...issued };
  }));
  const batch = results.flatMap(result => result.status === 'fulfilled' && result.value ? [result.value] : []);
  let sent = [];
  if (batch.length) {
    try {
      const response = await fetch('https://api.resend.com/emails/batch', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${settings.apiKey}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': `employee-setup-${claimId}`
        },
        body: JSON.stringify(batch.map(({ email, message }) => ({
          from: settings.from, to: [email], ...message
        }))),
        signal: AbortSignal.timeout(5000)
      });
      if (!response.ok) throw new Error(`Resend HTTP ${response.status}`);
      const receipt = await response.json();
      if (receipt.data?.length !== batch.length || receipt.data.some(entry => !entry.id)) {
        throw new Error('Resend returned an incomplete batch receipt');
      }
      sent = batch.map(({ id }) => id);
    } catch (error) {
      console.error('Employee setup email batch failed:', error.message);
      await Promise.allSettled(batch.map(({ digest }) => passwordLinks.invalidatePasswordLink(digest)));
    }
  }

  await query(`
    UPDATE users SET data = (data - 'setupEmailClaimId' - 'setupEmailClaimedAt') ||
      jsonb_build_object('setupEmailStatus', CASE WHEN id = ANY($2::text[]) THEN 'sent' ELSE 'failed' END),
      updated_at = NOW()
    WHERE data->>'setupEmailClaimId' = $1
  `, [claimId, sent]);
}

function startEmployeeSetupEmailWorker() {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await processEmployeeSetupEmails();
    } catch (error) {
      console.error('Employee setup email worker failed:', error.code || error.name);
    } finally {
      running = false;
    }
  };
  const timer = setInterval(tick, 1500);
  timer.unref();
  void tick();
  return () => clearInterval(timer);
}

module.exports = { queueEmployeeSetupEmail, processEmployeeSetupEmails, startEmployeeSetupEmailWorker };
