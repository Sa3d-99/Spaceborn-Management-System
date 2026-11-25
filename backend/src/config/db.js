const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');

let db = null;
let isConnected = false;

const TABLES = [
  'users',
  'attendance',
  'leaves',
  'leave_balances',
  'tasks',
  'projects',
  'roadmaps',
  'meetings',
  'reports',
  'notifications',
  'resources',
  'resource_requests',
  'executive_decisions',
  'holidays',
  'hour_breaks',
  'login_attempts',
  'password_reset_requests',
  'sessions'
];

async function getDb() {
  if (db) return db;
  await connectDB();
  return db;
}

async function query(text, params = []) {
  const client = await getDb();
  return client.query(text, params);
}

async function exec(sql) {
  const client = await getDb();
  if (typeof client.exec === 'function') {
    return client.exec(sql);
  }
  return client.query(sql);
}

async function connectDB() {
  if (isConnected && db) return db;

  const databaseUrl = process.env.DATABASE_URL;

  if (process.env.VERCEL && !databaseUrl) {
    throw new Error('DATABASE_URL is required on Vercel; the local PGlite database is not persistent there.');
  }

  if (databaseUrl) {
    console.log('🔌 Connecting to PostgreSQL via DATABASE_URL (Render / Cloud)...');
    db = new Pool({
      connectionString: databaseUrl,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      // Keep idle and concurrent connections small on memory-constrained hosts.
      max: Number(process.env.PG_POOL_MAX) || 2,
      idleTimeoutMillis: 10000
    });
  } else {
    // PGlite includes a WASM runtime; don't load it in cloud deployments using pg.
    const { PGlite } = require('@electric-sql/pglite');
    const dataDir = process.env.PGLITE_DATA_DIR || path.resolve(__dirname, '../../data/spaceborn_pgdata');
    if (dataDir !== 'memory://' && !fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    console.log(`💾 Starting embedded PGlite database at ${dataDir}...`);
    db = new PGlite(dataDir);
  }

  // Create tables
  for (const table of TABLES) {
    await exec(`
      CREATE TABLE IF NOT EXISTS ${table} (
        id VARCHAR(64) PRIMARY KEY,
        data JSONB NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_${table}_data ON ${table} USING gin (data);
    `);
  }

  await exec(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS password_reset_digest TEXT,
      ADD COLUMN IF NOT EXISTS password_reset_expires_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS password_reset_requested_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS password_reset_identity JSONB;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_password_reset_digest ON users (password_reset_digest)
      WHERE password_reset_digest IS NOT NULL;
    CREATE SEQUENCE IF NOT EXISTS signup_employee_ids;
    CREATE TABLE IF NOT EXISTS signup_requests (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      full_name TEXT NOT NULL,
      department TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
      requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_notification_attempt TIMESTAMPTZ,
      admin_notified_at TIMESTAMPTZ,
      reviewed_at TIMESTAMPTZ,
      reviewed_by TEXT,
      user_id TEXT,
      employee_id TEXT
    );
  `);

  isConnected = true;
  console.log('✅ PostgreSQL Schema Initialized (18 Tables Ready)');

  // Demo data (John Doe, Jane Smith, ...) is only created when SEED_DEMO_DATA=true.
  // Real staff are loaded with: npm run import:employees -- <sheet.xlsx> --commit
  try {
    const userRes = await query('SELECT count(*) as count FROM users');
    const count = parseInt(userRes.rows[0]?.count || 0, 10);
    if (count === 0) {
      if (process.env.SEED_DEMO_DATA === 'true') {
        console.log('🌱 No users found. Seeding demo users (SEED_DEMO_DATA=true)...');
        const seed = require('../../seed');
        if (typeof seed.runSeed === 'function') {
          await seed.runSeed();
        }
      } else {
        console.log('ℹ️  No users yet. Load your team with: npm run import:employees -- <sheet.xlsx> --commit');
      }
    }
  } catch (err) {
    console.warn('⚠️ Startup user check warning:', err.message);
  }

  return db;
}

module.exports = connectDB;
module.exports.getDb = getDb;
module.exports.query = query;
module.exports.exec = exec;
module.exports.connectDB = connectDB;
module.exports.TABLES = TABLES;
