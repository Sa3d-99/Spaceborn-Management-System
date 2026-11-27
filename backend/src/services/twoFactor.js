const {
  createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes, randomUUID, timingSafeEqual
} = require('node:crypto');
const jwt = require('jsonwebtoken');
const { query } = require('../config/db');
const { getJwtSecret } = require('../utils/jwtSecret');
const { effectiveRole } = require('../utils/terminationPermissions');
const { revokeUserSessions } = require('./authState');

const challengePurpose = 'spaceborn-two-factor';
const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

const twoFactorRequired = account => Boolean(account.two_factor || process.env.REQUIRE_TWO_FACTOR_AUTH === 'true');

function encryptionKey() {
  return hkdfSync('sha256', process.env.TWO_FACTOR_ENCRYPTION_KEY || getJwtSecret(), '', 'spaceborn-totp-v1', 32);
}

function encryptSecret(secret) {
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), nonce);
  const encrypted = Buffer.concat([cipher.update(secret), cipher.final()]);
  return [nonce, cipher.getAuthTag(), encrypted].map(value => value.toString('base64url')).join('.');
}

function decryptSecret(payload) {
  const [nonce, tag, encrypted] = payload.split('.').map(value => Buffer.from(value, 'base64url'));
  const cipher = createDecipheriv('aes-256-gcm', encryptionKey(), nonce);
  cipher.setAuthTag(tag);
  return Buffer.concat([cipher.update(encrypted), cipher.final()]);
}

function encodeBase32(bytes) {
  const bits = [...bytes].map(byte => byte.toString(2).padStart(8, '0')).join('');
  return bits.match(/.{1,5}/g).map(chunk => alphabet[Number.parseInt(chunk.padEnd(5, '0'), 2)]).join('');
}

function totpCode(secret, counter) {
  const time = Buffer.alloc(8);
  time.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac('sha1', secret).update(time).digest();
  const offset = digest[digest.length - 1] & 15;
  return String((digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, '0');
}

const digestBackupCode = code => createHmac('sha256', encryptionKey()).update(code).digest('hex');

function startChallenge(account) {
  const setup = !account.two_factor;
  const secret = setup ? randomBytes(20) : null;
  const token = jwt.sign({
    purpose: challengePurpose,
    userId: account.id,
    passwordVersion: account.passwordVersion,
    setup,
    secret: secret ? encryptSecret(secret) : undefined
  }, getJwtSecret(), { audience: challengePurpose, expiresIn: '5m' });

  return {
    challengeToken: token,
    setup,
    ...(secret ? { setupKey: encodeBase32(secret), accountLabel: account.employeeId } : {})
  };
}

function verifyChallenge(token) {
  if (typeof token !== 'string' || token.length > 4096) return null;
  try {
    const challenge = jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'], audience: challengePurpose });
    return challenge.purpose === challengePurpose && typeof challenge.userId === 'string' ? challenge : null;
  } catch {
    return null;
  }
}

async function getChallengeAccount(challenge) {
  const { rows: [row] } = await query('SELECT id, data, two_factor FROM users WHERE id = $1', [challenge.userId]);
  if (!row || row.data.isActive === false || row.data.passwordVersion !== challenge.passwordVersion) return null;
  if (challenge.setup === Boolean(row.two_factor)) return null;
  return { ...row.data, id: row.id, two_factor: row.two_factor };
}

async function acceptCode(account, challenge, enteredCode) {
  const oldConfig = account.two_factor;
  const code = typeof enteredCode === 'string' ? enteredCode.trim().toUpperCase() : '';
  const config = oldConfig ? { ...oldConfig } : { secret: challenge.secret };
  let backupCodes;
  if (/^\d{6}$/.test(code)) {
    const counter = Math.floor(Date.now() / 30_000);
    if (counter <= (config.lastCounter ?? -1)) return null;
    const expected = totpCode(decryptSecret(config.secret), counter);
    if (!timingSafeEqual(Buffer.from(expected), Buffer.from(code))) return null;
    config.lastCounter = counter;
    if (challenge.setup) {
      backupCodes = Array.from({ length: 10 }, () => randomBytes(5).toString('hex').toUpperCase());
      config.backupCodes = backupCodes.map(digestBackupCode);
    }
  } else if (oldConfig && /^[0-9A-F]{5}-?[0-9A-F]{5}$/.test(code)) {
    const hash = digestBackupCode(code.replace('-', ''));
    if (!config.backupCodes.includes(hash)) return null;
    config.backupCodes = config.backupCodes.filter(entry => entry !== hash);
  } else {
    return null;
  }

  const { rows } = await query(`
    UPDATE users SET two_factor = $2, updated_at = NOW()
    WHERE id = $1 AND two_factor IS NOT DISTINCT FROM $3::jsonb
      AND (data->>'passwordVersion') IS NOT DISTINCT FROM $4
      AND (data->>'isActive') IS DISTINCT FROM 'false'
    RETURNING id
  `, [account.id, JSON.stringify(config), oldConfig ? JSON.stringify(oldConfig) : null, account.passwordVersion || null]);
  return rows.length ? { backupCodes: backupCodes?.map(value => `${value.slice(0, 5)}-${value.slice(5)}`) } : null;
}

async function resetTwoFactor(actor, id) {
  const { rows: [row] } = await query('SELECT data FROM users WHERE id = $1', [id]);
  if (!row) return 'missing';
  const target = effectiveRole(row.data);
  const allowed = actor.role === 'CEO' || (actor.role === 'COO' && target !== 'CEO') ||
    (actor.role === 'HR' && !['CEO', 'COO'].includes(target));
  if (!allowed || actor.id === id) return 'forbidden';
  const { rows } = await query(`
    UPDATE users SET two_factor = NULL,
      data = data || jsonb_build_object('passwordVersion', $2::text, 'isOnline', false), updated_at = NOW()
    WHERE id = $1 AND (data->>'role') IS NOT DISTINCT FROM $3
    RETURNING id
  `, [id, randomUUID(), row.data.role || null]);
  if (!rows.length) return 'conflict';
  await revokeUserSessions(id);
  return 'reset';
}

module.exports = { twoFactorRequired, startChallenge, verifyChallenge, getChallengeAccount, acceptCode, resetTwoFactor, totpCode };
