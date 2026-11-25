const { randomBytes } = require('node:crypto');

const developmentSecret = randomBytes(32).toString('hex');

function getJwtSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (process.env.NODE_ENV === 'production') throw new Error('JWT_SECRET is required in production.');
  return developmentSecret;
}

module.exports = { getJwtSecret };
