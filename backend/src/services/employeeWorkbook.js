const { extname } = require('node:path');
const { Readable } = require('node:stream');
const { mapHeaders } = require('./employeeImportService');

const MAX_FILE_SIZE = 5 * 1024 ** 2;
const MAX_WORKBOOK_CONTENT = 25 * 1024 ** 2;
const inputError = (message, status = 400) => Object.assign(new Error(message), { status });

function verifyWorkbookSize(buffer) {
  // XLSX is a ZIP archive. Bound its expanded members before handing it to the workbook reader.
  const end = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (end < 0 || end + 22 > buffer.length) throw inputError('Could not open the .xlsx workbook.');
  const count = buffer.readUInt16LE(end + 10);
  let offset = buffer.readUInt32LE(end + 16);
  let expandedSize = 0;
  for (let index = 0; index < count; index += 1) {
    if (offset + 46 > end || buffer.readUInt32LE(offset) !== 0x02014b50) {
      throw inputError('Could not open the .xlsx workbook.');
    }
    expandedSize += buffer.readUInt32LE(offset + 24);
    if (expandedSize > MAX_WORKBOOK_CONTENT) throw inputError('The workbook expands beyond the spreadsheet processing limit. Split it into smaller files.', 413);
    offset += 46 + buffer.readUInt16LE(offset + 28) + buffer.readUInt16LE(offset + 30) + buffer.readUInt16LE(offset + 32);
  }
}

function cellText(value) {
  if (value == null) return '';
  if (typeof value !== 'object' || value instanceof Date) return value;
  if (Array.isArray(value.richText)) return value.richText.map(item => item.text).join('');
  if (value.result !== undefined) return cellText(value.result);
  return value.text ?? '';
}

async function readEmployeeWorkbook(buffer, name, sheetName) {
  if (buffer.length > MAX_FILE_SIZE) throw inputError('File size must be 5 MB or less.', 413);
  const extension = extname(name).toLowerCase();
  if (!['.xlsx', '.csv'].includes(extension)) throw inputError('Choose an .xlsx or .csv file.');
  const ExcelJS = require('exceljs');
  const workbook = new ExcelJS.Workbook();
  if (extension === '.xlsx') verifyWorkbookSize(buffer);
  try {
    if (extension === '.csv') {
      if (buffer.includes(0)) throw new Error('Invalid CSV text');
      await workbook.csv.read(Readable.from([buffer]), { map: cell => cell });
    } else {
      await workbook.xlsx.load(buffer);
    }
  } catch {
    throw inputError(`Could not read this ${extension} file. Open it in your spreadsheet app and save it again.`);
  }
  const sheetNames = workbook.worksheets.map(sheet => sheet.name);
  const worksheet = sheetName ? workbook.getWorksheet(sheetName) : workbook.worksheets[0];
  if (!worksheet) throw inputError('The selected worksheet was not found.');
  const file = { sheetNames, sheet: worksheet.name };
  let headers;
  let headerRow;
  let rows = [];
  worksheet.eachRow((row, rowNumber) => {
    if (!headers && rowNumber <= 10) {
      const possible = row.values.map(cell => String(cellText(cell)).trim());
      const fields = new Set(Object.values(mapHeaders(possible).mapping));
      if (fields.has('email') && (fields.has('name') || fields.has('firstName') || fields.has('lastName'))) {
        headers = possible;
        headerRow = rowNumber;
      }
      return;
    }
    if (!headers) return;
    const record = Object.create(null);
    record.__row__ = rowNumber;
    let filled = false;
    for (const [column, label] of headers.entries()) {
      if (!label) continue;
      const value = cellText(row.getCell(column).value);
      if (String(value).trim()) filled = true;
      record[label] = value;
    }
    if (filled) rows.push(record);
    if (rows.length > 2000) throw inputError('Import is limited to 2,000 employee rows.');
  });
  if (!headers) rows = [];
  return { rows, file, headerRow };
}

module.exports = { readEmployeeWorkbook };
