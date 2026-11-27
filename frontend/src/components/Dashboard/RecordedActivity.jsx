import { useState } from 'react';
import { utils, writeFile } from 'xlsx';
import { displayDateTime } from '../../utils/timeZone';
import { roleLabel } from '../../utils/roleLabels';
import useDashboardData from './useDashboardData';

const actionLabels = { login: 'Signed in', logout: 'Signed out', 'check-in': 'Checked in', 'check-out': 'Checked out', active: 'Active session' };
const columns = ['Employee', 'Employee ID', 'Role', 'Department', 'Activity', 'Time'];

function recordedRow(entry) {
  return [entry.name, entry.employeeId, roleLabel(entry.role), entry.department,
    actionLabels[entry.action], displayDateTime(entry.timestamp)];
}

function spreadsheetSafe(value) {
  const text = String(value ?? '');
  return /^[\s]*[=+\-@]/.test(text) ? `'${text}` : text;
}

function exportCsv(rows) {
  const csv = rows.map(row => row.map(value => `"${spreadsheetSafe(value).replaceAll('"', '""')}"`).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'spaceborn-activity.csv';
  link.click();
  URL.revokeObjectURL(url);
}

function exportExcel(rows) {
  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, utils.aoa_to_sheet(rows), 'Activity');
  writeFile(workbook, 'spaceborn-activity.xlsx');
}

function ActivityTable({ entries, emptyMessage }) {
  if (!entries.length) return <p className="py-4 text-base-content/70">{emptyMessage}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="table">
        <thead><tr>{columns.map(column => <th key={column}>{column}</th>)}</tr></thead>
        <tbody>
          {entries.map(entry => <tr key={entry.id}>
            {recordedRow(entry).map((value, index) => <td key={columns[index]}>{value || '—'}</td>)}
          </tr>)}
        </tbody>
      </table>
    </div>
  );
}

export default function RecordedActivity({ loginManagement = false }) {
  const [days, setDays] = useState('7');
  const [search, setSearch] = useState('');
  const [action, setAction] = useState('');
  const path = loginManagement ? '/dashboard/login-management' : '/dashboard/activity';
  const { data, error, reload } = useDashboardData(`${path}?days=${days}`, 'Could not load recorded activity.');
  const entries = loginManagement ? data?.history : data;
  const term = search.trim().toLowerCase();
  const visible = (Array.isArray(entries) ? entries : []).filter(entry => (
    (!action || entry.action === action)
    && (!term || [entry.name, entry.employeeId, entry.department, roleLabel(entry.role)]
      .some(value => String(value || '').toLowerCase().includes(term)))
  ));
  const rows = [columns, ...visible.map(recordedRow)];

  return (
    <section className="card border border-base-300 bg-base-100">
      <div className="card-body">
        <h1 className="card-title text-2xl">{loginManagement ? 'Login Management' : 'Activity Monitor'}</h1>
        {loginManagement && data && !error && <>
          <h2 className="mt-4 text-lg font-semibold">Active sessions</h2>
          <ActivityTable entries={data.sessions || []} emptyMessage="There are no active sessions in your scope." />
          <h2 className="mt-4 text-lg font-semibold">Login history</h2>
        </>}
        <div className="flex flex-wrap items-end gap-2">
          <label className="grid gap-1"><span className="label">Date range (IST)</span>
            <select className="select" value={days} onChange={event => setDays(event.target.value)}>
              <option value="1">Today</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option>
            </select>
          </label>
          <label className="grid gap-1"><span className="label">Activity</span>
            <select className="select" value={action} onChange={event => setAction(event.target.value)}>
              <option value="">All activity</option><option value="login">Signed in</option><option value="logout">Signed out</option>
              {!loginManagement && <><option value="check-in">Checked in</option><option value="check-out">Checked out</option></>}
            </select>
          </label>
          <label className="grid gap-1"><span className="label">Search activity</span>
            <input className="input" type="search" maxLength={100} value={search} onChange={event => setSearch(event.target.value)} />
          </label>
          <button type="button" className="btn btn-outline" onClick={reload}>Refresh</button>
          {!loginManagement && <>
            <button type="button" className="btn btn-outline" onClick={() => exportExcel(rows)} disabled={!visible.length}>Export Excel</button>
            <button type="button" className="btn btn-outline" onClick={() => exportCsv(rows)} disabled={!visible.length}>Export CSV</button>
          </>}
        </div>
        {error ? <p role="alert" className="alert alert-error">{error}</p>
          : data ? <ActivityTable entries={visible} emptyMessage="No recorded activity matches these filters." />
          : <p role="status">Loading activity…</p>}
      </div>
    </section>
  );
}
