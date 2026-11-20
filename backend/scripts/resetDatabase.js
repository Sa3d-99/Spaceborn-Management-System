#!/usr/bin/env node
// Empty every table (users, tasks, attendance, leaves, ...). Use this to remove the demo data
// before importing the real team. THIS CANNOT BE UNDONE.
//
//   npm run db:reset -- --yes
//
// Uses DATABASE_URL if set (Render/Supabase), otherwise the local PGlite database.
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

async function main() {
  if (!process.argv.includes('--yes')) {
    console.log('This deletes ALL data in the database (users, tasks, attendance, leaves, ...).');
    console.log(`Target: ${process.env.DATABASE_URL ? 'DATABASE_URL (cloud database)' : 'local PGlite database'}`);
    console.log('Re-run with --yes to confirm:  npm run db:reset -- --yes');
    process.exit(1);
  }
  const db = require('../src/config/db');
  await db.connectDB();
  for (const table of db.TABLES) {
    const res = await db.query(`DELETE FROM ${table}`);
    console.log(`  ${table.padEnd(24)} ${res.affectedRows ?? res.rowCount ?? 0} rows deleted`);
  }
  console.log('\n✅ Database is empty. Next: npm run import:employees -- <sheet.xlsx> --commit');
}

main().then(() => process.exit(0)).catch((e) => { console.error('❌ Reset failed:', e.message); process.exit(1); });
