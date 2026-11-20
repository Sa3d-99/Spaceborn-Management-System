#!/usr/bin/env node
// Import employees from an Excel (.xlsx) or CSV file into the database.
//
//   npm run import:employees -- ./employees.xlsx              # preview only (no changes)
//   npm run import:employees -- ./employees.xlsx --commit     # write to the database
//   npm run import:employees -- ./employees.xlsx --commit --update   # also update existing employees
//   Options: --sheet "Sheet name"   pick a worksheet (default: first)
//
// Uses DATABASE_URL if set (Render/Supabase), otherwise the local PGlite database.
// New employees get a random temporary password; these are written to
// employee-credentials-<timestamp>.csv next to the input file. Share them privately, then delete the file.
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
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

const cellValue = (v) => {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v;
  if (typeof v === 'object') {
    if (v.text !== undefined) return v.text;
    if (v.result !== undefined) return v.result;
    if (Array.isArray(v.richText)) return v.richText.map((t) => t.text).join('');
    if (v.hyperlink) return v.text || v.hyperlink.replace(/^mailto:/, '');
  }
  return v;
};

async function readRows(file, sheetName) {
  const ExcelJS = require('exceljs');
  const wb = new ExcelJS.Workbook();
  const ext = path.extname(file).toLowerCase();
  let ws;
  if (ext === '.csv') ws = await wb.csv.readFile(file);
  else if (ext === '.xlsx' || ext === '.xlsm') {
    await wb.xlsx.readFile(file);
    ws = sheetName ? wb.getWorksheet(sheetName) : wb.worksheets[0];
    if (!ws) throw new Error(`Worksheet "${sheetName}" not found. Available: ${wb.worksheets.map((w) => w.name).join(', ')}`);
  } else {
    throw new Error('Unsupported file type. Save the sheet as .xlsx or .csv (old .xls is not supported).');
  }

  // Header row = first row with at least two non-empty cells (handles title rows above the table).
  let headerRowNum = 1;
  for (let r = 1; r <= Math.min(ws.rowCount, 10); r++) {
    const vals = (ws.getRow(r).values || []).filter((v) => String(cellValue(v)).trim() !== '');
    if (vals.length >= 2) { headerRowNum = r; break; }
  }
  const headerRow = ws.getRow(headerRowNum);
  const headers = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, col) => { headers[col] = String(cellValue(cell.value)).trim(); });

  const rows = [];
  for (let r = headerRowNum + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const obj = { __row__: r }; // real sheet row number for error messages
    let any = false;
    headers.forEach((h, col) => {
      if (!h) return;
      const v = cellValue(row.getCell(col).value);
      if (String(v).trim() !== '') any = true;
      obj[h] = v;
    });
    if (any) rows.push(obj);
  }
  return { rows, sheet: ws.name, headerRowNum };
}

const csvEscape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.file) {
    console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(1, 11).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
    process.exit(args.file ? 0 : 1);
  }
  const file = path.resolve(args.file);
  if (!fs.existsSync(file)) throw new Error(`File not found: ${file}`);

  const { rows, sheet, headerRowNum } = await readRows(file, args.sheet);
  console.log(`📄 ${path.basename(file)} — sheet "${sheet}", header on row ${headerRowNum}, ${rows.length} data rows`);

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

  if (!result.dryRun && result.credentials.length) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const out = path.join(path.dirname(file), `employee-credentials-${stamp}.csv`);
    const lines = ['Employee ID,Name,Email,Temporary Password',
      ...result.credentials.map((c) => [c.employeeId, c.name, c.email, c.password].map(csvEscape).join(','))];
    fs.writeFileSync(out, lines.join('\n'), { mode: 0o600 });
    console.log(`\n🔑 Login credentials for ${result.credentials.length} new employees saved to:\n   ${out}\n   Share privately and delete this file afterwards.`);
  }

  if (result.dryRun) console.log('\nRe-run with --commit to write these changes.');
}

main()
  .then(() => process.exit(0))
  .catch((err) => { console.error('❌ Import failed:', err.message); process.exit(1); });
