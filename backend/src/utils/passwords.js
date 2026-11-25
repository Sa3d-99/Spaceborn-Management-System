const { randomBytes, scrypt, timingSafeEqual } = require('node:crypto');
const { promisify } = require('node:util');
const bcrypt = require('bcryptjs');

const deriveKey = promisify(scrypt);
const scryptOptions = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
const commonPasswords = new Set([
  'passwordpassword', 'passwordpassword123', '123456789012345', '1234567890123456',
  'qwertyuiopasdfgh', 'qwertyuiopasdfghjkl', 'letmeinletmeinletmein',
  'iloveyouiloveyou', 'spacebornspaceborn', 'correct horse battery staple'
]);

function passwordError(password) {
  if (typeof password !== 'string') return 'Enter a password with at least 15 characters.';
  const normalized = password.normalize('NFC');
  const length = [...normalized].length;
  if (length < 15 || length > 128) return 'Use 15 to 128 characters.';
  if (!normalized.trim() || commonPasswords.has(normalized.toLowerCase())) {
    return 'Choose a password that is less common.';
  }
  return null;
}

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const key = await deriveKey(password.normalize('NFC'), salt, 64, scryptOptions);
  return `scrypt:${salt}:${key.toString('hex')}`;
}

async function verifyPassword(password, stored) {
  if (typeof password !== 'string' || !password || password.length > 4096 || !stored) return false;
  if (stored.startsWith('$2')) return bcrypt.compare(password, stored);
  const [algorithm, salt, digest] = stored.split(':');
  if (algorithm !== 'scrypt' || !/^[a-f0-9]{32}$/.test(salt) || !/^[a-f0-9]{128}$/.test(digest)) return false;
  const key = await deriveKey(password.normalize('NFC'), salt, 64, scryptOptions);
  return timingSafeEqual(key, Buffer.from(digest, 'hex'));
}

const generatePassword = () => randomBytes(18).toString('base64url');

module.exports = { passwordError, hashPassword, verifyPassword, generatePassword };
