// src/components/Dashboard/Manager/ImportEmployeesModal.jsx
// Upload an Excel/CSV of employees -> preview what will happen -> import -> download login credentials.
import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import employeeService from '../../../services/employeeService';
import { roleLabel } from '../../../utils/roleLabels';

const TEMPLATE_HEADERS = [
  'Employee ID', 'Full Name', 'Email', 'Phone', 'Role', 'Designation', 'Department',
  'Team', 'Reporting Manager', 'Date of Joining', 'Date of Birth', 'Gender', 'Blood Group',
  'Work Location', 'Status'
];

const TEMPLATE_EXAMPLE = [
  '', 'Arjun Verma', 'arjun.verma@spaceborn.com', '9876501234', 'Intern', 'Kernel Developer Intern',
  'Core Systems & Kernel', 'Kernel', 'Cedric Compaore', '15/07/2025', '02/03/2001', 'Male', 'B+', 'Remote', 'Active'
];

// Header row = first row (within the first 10) with at least two filled cells, so title rows are skipped.
function readWorkbook(arrayBuffer, sheetName) {
  // Keep dates as Excel serial numbers; the server converts them exactly (Date objects can shift a day across time zones).
  const wb = XLSX.read(arrayBuffer, { type: 'array', cellDates: false });
  const name = sheetName && wb.SheetNames.includes(sheetName) ? sheetName : wb.SheetNames[0];
  const ws = wb.Sheets[name];
  const grid = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '', blankrows: true });
  let headerIdx = grid.findIndex((r, i) => i < 10 && r.filter((c) => String(c).trim() !== '').length >= 2);
  if (headerIdx < 0) headerIdx = 0;
  const headers = (grid[headerIdx] || []).map((h) => String(h).trim());
  const rows = [];
  for (let i = headerIdx + 1; i < grid.length; i++) {
    const line = grid[i];
    if (!line || line.every((c) => String(c).trim() === '')) continue;
    const obj = { __row__: i + 1 };
    headers.forEach((h, col) => {
      if (!h) return;
      obj[h] = line[col];
    });
    rows.push(obj);
  }
  return { rows, sheetNames: wb.SheetNames, sheet: name };
}

const Pill = ({ color, children }) => (
  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${color}`}>{children}</span>
);

const ImportEmployeesModal = ({ onClose, onImported }) => {
  const [file, setFile] = useState(null);
  const [rows, setRows] = useState([]);
  const [sheetNames, setSheetNames] = useState([]);
  const [sheet, setSheet] = useState('');
  const [buffer, setBuffer] = useState(null);
  const [updateExisting, setUpdateExisting] = useState(false);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const runPreview = async (parsedRows, update = updateExisting) => {
    setBusy(true); setError(''); setPreview(null);
    try {
      setPreview(await employeeService.importEmployees(parsedRows, { dryRun: true, updateExisting: update }));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const loadSheet = (buf, name) => {
    const parsed = readWorkbook(buf, name);
    setRows(parsed.rows);
    setSheetNames(parsed.sheetNames);
    setSheet(parsed.sheet);
    if (parsed.rows.length === 0) {
      setError('No employee rows found in this sheet.');
      setPreview(null);
      return;
    }
    runPreview(parsed.rows);
  };

  const handleFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f); setResult(null); setError('');
    try {
      const buf = await f.arrayBuffer();
      setBuffer(buf);
      loadSheet(buf);
    } catch (err) {
      setError(`Could not read file: ${err.message}`);
    }
  };

  const handleImport = async () => {
    setBusy(true); setError('');
    try {
      const res = await employeeService.importEmployees(rows, { dryRun: false, updateExisting });
      setResult(res);
      onImported && onImported(res);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, TEMPLATE_EXAMPLE]);
    ws['!cols'] = TEMPLATE_HEADERS.map((h) => ({ wch: Math.max(14, h.length + 2) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Employees');
    XLSX.writeFile(wb, 'spaceborn_employee_import_template.xlsx');
  };

  const downloadCredentials = () => {
    const ws = XLSX.utils.json_to_sheet(result.credentials.map((c) => ({
      'Employee ID': c.employeeId, Name: c.name, Email: c.email, 'Temporary Password': c.password
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Credentials');
    XLSX.writeFile(wb, `employee_credentials_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const view = result || preview;
  const s = view?.summary;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Import employees from Excel</h2>
            <p className="text-sm text-gray-500">Upload .xlsx or .csv. You'll see a preview before anything is saved.</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>

        <div className="px-6 py-4 overflow-y-auto flex-1 space-y-4">
          {!result && (
            <div className="flex flex-wrap items-center gap-3">
              <label className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 cursor-pointer">
                {file ? 'Choose another file' : 'Choose file'}
                <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />
              </label>
              {file && <span className="text-sm text-gray-700">{file.name} · {rows.length} rows</span>}
              {sheetNames.length > 1 && (
                <select value={sheet} onChange={(e) => loadSheet(buffer, e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
                  {sheetNames.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              )}
              <button onClick={downloadTemplate} className="text-sm text-purple-700 hover:underline ml-auto">
                Download template
              </button>
            </div>
          )}

          {!file && !result && (
            <div className="text-sm text-gray-600 bg-gray-50 rounded-lg p-4">
              Your sheet needs at least a <b>name</b> and <b>email</b> column. Common headings are recognised automatically
              (e.g. "Employee Name", "Official Email ID", "Mobile No", "Dept", "Reporting Manager", "DOJ").
              Add a <b>Role</b> column (CEO, Director, Team Lead, Co-Lead, Project Manager, HR, Intern) to set access levels; otherwise everyone is
              imported as Intern. Columns the system doesn't know are kept as additional info.
            </div>
          )}

          {error && <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>}
          {busy && <div className="text-sm text-gray-500">Working…</div>}

          {view && (
            <>
              <div className="flex flex-wrap gap-2">
                <Pill color="bg-gray-100 text-gray-700">{s.totalRows} rows</Pill>
                <Pill color="bg-green-100 text-green-700">{s.toCreate} {result ? 'created' : 'new'}</Pill>
                <Pill color="bg-blue-100 text-blue-700">{s.toUpdate} {result ? 'updated' : 'to update'}</Pill>
                <Pill color="bg-yellow-100 text-yellow-800">{s.skipped} already exist</Pill>
                <Pill color="bg-red-100 text-red-700">{s.errors} with problems</Pill>
              </div>

              {!result && (
                <details className="text-sm">
                  <summary className="cursor-pointer text-gray-600">How your columns were read</summary>
                  <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-1 text-gray-700">
                    {Object.entries(view.columnMapping).map(([h, f]) => (
                      <div key={h}><span className="text-gray-500">{h}</span> → {f}</div>
                    ))}
                  </div>
                  {view.unmappedColumns.length > 0 && (
                    <p className="mt-2 text-gray-500">Kept as additional info: {view.unmappedColumns.join(', ')}</p>
                  )}
                </details>
              )}

              {view.errors.length > 0 && (
                <div className="border border-red-200 rounded-lg">
                  <div className="px-4 py-2 bg-red-50 text-sm font-medium text-red-800">Rows that won't be imported — fix these in the sheet</div>
                  <ul className="divide-y text-sm max-h-40 overflow-y-auto">
                    {view.errors.map((e) => (
                      <li key={`${e.row}-${e.email}`} className="px-4 py-2">
                        <span className="font-medium">Row {e.row}</span> {e.name} <span className="text-gray-500">{e.email}</span>: {e.errors.join('; ')}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {[...view.created, ...view.updated].length > 0 && (
                <div className="border rounded-lg overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                      <tr>
                        <th className="text-left px-4 py-2">Row</th>
                        <th className="text-left px-4 py-2">Action</th>
                        <th className="text-left px-4 py-2">ID</th>
                        <th className="text-left px-4 py-2">Name</th>
                        <th className="text-left px-4 py-2">Email</th>
                        <th className="text-left px-4 py-2">Role</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {view.created.map((c) => (
                        <tr key={`c${c.row}`}>
                          <td className="px-4 py-2 text-gray-500">{c.row}</td>
                          <td className="px-4 py-2"><Pill color="bg-green-100 text-green-700">{result ? 'Created' : 'New'}</Pill></td>
                          <td className="px-4 py-2 font-mono">{c.employeeId}</td>
                          <td className="px-4 py-2">{c.name}</td>
                          <td className="px-4 py-2 text-gray-600">{c.email}</td>
                          <td className="px-4 py-2">{roleLabel(c.role)}</td>
                        </tr>
                      ))}
                      {view.updated.map((u) => (
                        <tr key={`u${u.row}`}>
                          <td className="px-4 py-2 text-gray-500">{u.row}</td>
                          <td className="px-4 py-2"><Pill color="bg-blue-100 text-blue-700">{result ? 'Updated' : 'Update'}</Pill></td>
                          <td className="px-4 py-2 font-mono">{u.employeeId}</td>
                          <td className="px-4 py-2">{u.name}</td>
                          <td className="px-4 py-2 text-gray-600">{u.email}</td>
                          <td className="px-4 py-2">{roleLabel(u.role)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {result && result.credentials.length > 0 && (
                <div className="p-4 rounded-lg bg-purple-50 text-sm text-purple-900 flex flex-wrap items-center gap-3">
                  <span>
                    {result.credentials.length} new employees have temporary passwords. Download them now — they can't be shown again.
                  </span>
                  <button onClick={downloadCredentials} className="px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
                    Download login credentials
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t flex flex-wrap items-center justify-between gap-3">
          {!result ? (
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={updateExisting} disabled={!rows.length || busy}
                onChange={(e) => { setUpdateExisting(e.target.checked); runPreview(rows, e.target.checked); }} />
              Update employees that already exist (matched by Employee ID or email)
            </label>
          ) : <span />}
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
              {result ? 'Done' : 'Cancel'}
            </button>
            {!result && (
              <button onClick={handleImport}
                disabled={busy || !preview || (preview.summary.toCreate + preview.summary.toUpdate) === 0}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed">
                Import {preview ? preview.summary.toCreate + preview.summary.toUpdate : ''} employees
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImportEmployeesModal;
