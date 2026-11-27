const { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } = require('node:crypto');
const { promisify } = require('node:util');
const bcrypt = require('bcryptjs');

const deriveKey = promisify(scrypt);
const scryptOptions = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
const commonPasswords = new Set([
  'password', 'password1', 'password123', 'password1234', 'passwordpassword',
  'passwordpassword123', '12345678', '123456789', '1234567890', '123456789012345',
  '1234567890123456', '0123456789', 'qwerty123', 'qwertyuiop', 'qwertyuiopasdfgh',
  'qwertyuiopasdfghjkl', 'iloveyou', 'iloveyouiloveyou', 'letmeinletmeinletmein',
  'admin123', 'admin1234', 'welcome1', 'welcome123', 'trustno1', 'passw0rd',
  'football', 'baseball', 'sunshine', 'princess', 'qazwsxedc', 'correct horse battery staple'
]);

function passwordError(password, account = {}) {
  if (typeof password !== 'string') return 'Use 8 to 64 characters.';
  const normalized = password.normalize('NFC');
  const points = [...normalized];
  if (points.length < 8 || points.length > 64) return 'Use 8 to 64 characters.';
  if (/\p{Cc}/u.test(normalized)) return 'Use printable characters in your password.';

  const comparable = normalized.normalize('NFKC').toLowerCase();
  const sequential = [1, -1].some(step => points.slice(1).every(
    (character, index) => character.codePointAt(0) - points[index].codePointAt(0) === step
  ));
  if (!normalized.trim() || commonPasswords.has(comparable) || /^(.+)\1+$/u.test(comparable) || sequential) {
    return 'Choose a password that is less common or predictable.';
  }
  if (['spaceborn', account.firstName, account.lastName, account.employeeId].some(value =>
    typeof value === 'string' && value.trim() && comparable.includes(value.trim().normalize('NFKC').toLowerCase())
  )) {
    return 'Your password cannot contain your name, employee ID, or Spaceborn.';
  }
  return null;
}

function passwordHashAlgorithm(password) {
  return Buffer.byteLength(password.normalize('NFC'), 'utf8') > 72 ? 'bcrypt-sha384' : 'bcrypt';
}

function bcryptInput(password, algorithm) {
  if (!algorithm) return password;
  const normalized = password.normalize('NFC');
  // bcrypt accepts at most 72 bytes. Encode a fixed-length digest for longer Unicode passwords.
  return algorithm === 'bcrypt-sha384'
    ? createHash('sha384').update(normalized).digest('base64')
    : normalized;
}

function hashPassword(password) {
  return bcrypt.hash(bcryptInput(password, passwordHashAlgorithm(password)), 12);
}

async function newPasswordFields(password) {
  return {
    password: await hashPassword(password),
    passwordAlgorithm: passwordHashAlgorithm(password),
    passwordVersion: randomUUID(),
    passwordChangedAt: Date.now(),
    mustChangePassword: false
  };
}

async function verifyPassword(password, stored, algorithm) {
  if (typeof password !== 'string' || !password || password.length > 4096 || typeof stored !== 'string') return false;
  if (stored.startsWith('$2')) return bcrypt.compare(bcryptInput(password, algorithm), stored);
  const [kind, salt, digest] = stored.split(':');
  if (kind !== 'scrypt' || !/^[a-f0-9]{32}$/.test(salt) || !/^[a-f0-9]{128}$/.test(digest)) return false;
  const key = await deriveKey(password.normalize('NFC'), salt, 64, scryptOptions);
  return timingSafeEqual(key, Buffer.from(digest, 'hex'));
}

const generatePassword = () => randomBytes(18).toString('base64url');

module.exports = { passwordError, hashPassword, passwordHashAlgorithm, newPasswordFields, verifyPassword, generatePassword };
