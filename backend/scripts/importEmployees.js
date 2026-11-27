#!/usr/bin/env node
// Import employees from an Excel (.xlsx) or CSV file into the database.
//
//   npm run import:employees -- ./employees.xlsx              # preview only (no changes)
//   npm run import:employees -- ./employees.xlsx --commit     # write to the database
//   npm run import:employees -- ./employees.xlsx --commit --update   # also update existing employees
//   Options: --sheet "Sheet name"   pick a worksheet (default: first)
//
// Uses DATABASE_URL if set (Render/Supabase), otherwise the local PGlite database.
// New employees receive a one-time password setup link from the running CRM.
require('../src/config/env');
const path = require('path');
const fs = require('fs');

function parseArgs(argv) {
  const args = { file: null, commit: false, update: false, sheet: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--commit') args.commit = true;
    else if (a === '--update') args.update = true;
    else if (a === '--sheet') args.sheet = argv[++i];
    else if (a === '--help' || a === '-h') args.help = true;
    else if (!args.file) args.file = a;
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.file) {
    console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(1, 11).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
    process.exit(args.file ? 0 : 1);
  }
  const file = path.resolve(args.file);
  if (!fs.existsSync(file)) throw new Error(`File not found: ${file}`);

  if (!/\.(xlsx|csv)$/i.test(file)) throw new Error('Choose an .xlsx or .csv file.');
  if (fs.statSync(file).size > 5 * 1024 ** 2) throw new Error('File size must be 5 MB or less.');
  const { readEmployeeWorkbook } = require('../src/services/employeeWorkbook');
  const { rows, headerRow, file: { sheet } } = await readEmployeeWorkbook(fs.readFileSync(file), file, args.sheet);
  if (!headerRow || !rows.length) throw new Error('No employee rows found. Include name and email headings.');
  if (rows.length > 2000) throw new Error('Import is limited to 2,000 employee rows.');
  console.log(`Worksheet ${sheet}, header row ${headerRow}, ${rows.length} employee rows.`);

  const connectDB = require('../src/config/db');
  await connectDB();
  const { importEmployees } = require('../src/services/employeeImportService');
  const result = await importEmployees(rows, { dryRun: !args.commit, updateExisting: args.update });

  console.log('\nColumn mapping:');
  Object.entries(result.columnMapping).forEach(([h, f]) => console.log(`  ${h.padEnd(28)} → ${f}`));
  if (result.unmappedColumns.length) {
    console.log(`  (kept as additional info: ${result.unmappedColumns.join(', ')})`);
  }

  const s = result.summary;
  console.log(`\n${result.dryRun ? '🔍 PREVIEW (nothing written)' : '✅ IMPORTED'}: ${s.totalRows} rows → ` +
    `${s.toCreate} create, ${s.toUpdate} update, ${s.skipped} skipped, ${s.errors} errors`);

  if (result.created.length) {
    console.log('\nNew employees:');
    console.table(result.created.map(({ row, employeeId, name, email, role, department }) => ({ row, employeeId, name, email, role, department })));
  }
  if (result.updated.length) { console.log('\nUpdated:'); console.table(result.updated); }
  if (result.skipped.length) {
    console.log(`\nSkipped (already in system${args.update ? '' : '; use --update to overwrite'}):`);
    console.table(result.skipped);
  }
  if (result.errors.length) {
    console.log('\n⚠️  Rows with problems (fix in the sheet and re-run):');
    result.errors.forEach((e) => console.log(`  Row ${e.row} ${e.name || ''} <${e.email || '-'}>: ${e.errors.join('; ')}`));
  }
  if (result.managerWarnings.length) {
    console.log('\nManagers not matched to an existing employee:');
    result.managerWarnings.forEach((w) => console.log(`  ${w.employeeId}: "${w.manager}"`));
  }

  if (!result.dryRun && result.created.length) {
    console.log(`Password setup emails queued for ${result.created.length} employees.`);
  }

  if (result.dryRun) console.log('\nRe-run with --commit to write these changes.');
}

main()
  .then(() => process.exit(0))
  .catch((err) => { console.error('❌ Import failed:', err.message); process.exit(1); });
