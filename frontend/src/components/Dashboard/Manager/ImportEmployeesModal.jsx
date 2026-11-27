// src/components/Dashboard/Manager/ImportEmployeesModal.jsx
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

const Pill = ({ color, children }) => (
  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${color}`}>{children}</span>
);

const ImportEmployeesModal = ({ onClose, onImported }) => {
  const [file, setFile] = useState(null);
  const [sheetNames, setSheetNames] = useState([]);
  const [sheet, setSheet] = useState('');
  const [updateExisting, setUpdateExisting] = useState(false);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const runPreview = async (selectedFile, selectedSheet, update = updateExisting) => {
    setBusy(true);
    setError('');
    setPreview(null);
    try {
      const data = await employeeService.importEmployees(selectedFile, { sheet: selectedSheet, updateExisting: update });
      setPreview(data);
      setSheetNames(data.sheetNames || []);
      setSheet(data.sheet || '');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleFile = async event => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;
    setFile(null);
    setPreview(null);
    setSheetNames([]);
    setResult(null);
    if (!/\.(xlsx|csv)$/i.test(selectedFile.name)) {
      setError('Choose an .xlsx or .csv file.');
      return;
    }
    if (selectedFile.size > 5 * 1024 ** 2) {
      setError('File size must be 5 MB or less.');
      return;
    }
    setFile(selectedFile);
    await runPreview(selectedFile);
  };

  const handleImport = async () => {
    setBusy(true);
    setError('');
    try {
      const data = await employeeService.importEmployees(file, { sheet, dryRun: false, updateExisting });
      setResult(data);
      onImported?.(data);
    } catch (err) {
      setError(err.message);
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

  const view = result || preview;
  const s = view?.summary;

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="employee-import-title" className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 id="employee-import-title" className="text-lg font-semibold text-gray-900">Import employees from Excel</h2>
            <p className="text-sm text-gray-500">Upload .xlsx or .csv. You'll see a preview before anything is saved.</p>
          </div>
          <button aria-label="Close import" onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>

        <div className="px-6 py-4 overflow-y-auto flex-1 space-y-4">
          {!result && (
            <div className="flex flex-wrap items-center gap-3">
              <label className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 cursor-pointer">
                {file ? 'Choose another file' : 'Choose file'}
                <input type="file" accept=".xlsx,.csv" disabled={busy} className="file-input hidden" onChange={handleFile} />
              </label>
              {file && <span className="text-sm text-gray-700">{file.name}</span>}
              {sheetNames.length > 1 && (
                <select aria-label="Worksheet" value={sheet} disabled={busy} onChange={e => runPreview(file, e.target.value)}
                  className="select px-3 py-2 border border-gray-300 rounded-lg text-sm">
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

          {error && <div role="alert" className="alert alert-error">{error}</div>}
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
                  <table className="table w-full text-sm">
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

              {result && result.created.length > 0 && <p className="alert alert-info" role="status">
                Password setup emails queued for {result.created.length} new employees.
              </p>}
              {view.managerWarnings?.length > 0 && <details className="text-sm">
                <summary className="cursor-pointer">Reporting manager warnings</summary>
                <ul className="mt-2">{view.managerWarnings.map(warning => <li key={warning.row}>
                  Row {warning.row} · {warning.manager} · {warning.warning}
                </li>)}</ul>
              </details>}
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t flex flex-wrap items-center justify-between gap-3">
          {!result ? (
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={updateExisting} disabled={!file || busy}
                onChange={(e) => { setUpdateExisting(e.target.checked); runPreview(file, sheet, e.target.checked); }} />
              Update employees that already exist (matched by Employee ID or email)
            </label>
          ) : <span />}
          <div className="flex gap-2">
            <button onClick={onClose} className="btn btn-sm btn-ghost px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
              {result ? 'Done' : 'Cancel'}
            </button>
            {!result && (
              <button onClick={handleImport}
                disabled={busy || !preview || (preview.summary.toCreate + preview.summary.toUpdate) === 0}
                className="btn btn-sm btn-ghost px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed">
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
