import React, { useCallback, useEffect, useState } from 'react';
import employeeService from '../../../services/employeeService';
import { roleLabel } from '../../../utils/roleLabels';
import { displayDate } from '../../../utils/timeZone';
import EmployeeForm from '../EmployeeForm';

export default function Accounts({ user, userRole = user?.role || 'CEO' }) {
  const [accounts, setAccounts] = useState([]);
  const [stats, setStats] = useState(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [form, setForm] = useState(null);
  const reload = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const [records, counts] = await Promise.all([
        employeeService.apiRequest('/accounts/all'), employeeService.apiRequest('/accounts/stats')
      ]);
      setAccounts(records);
      setStats(counts);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { reload(); }, [reload]);

  const term = search.trim().toLowerCase();
  const shown = accounts.filter(account => (!role || account.role === role) &&
    [account.name, account.email, account.employeeId, account.department].some(value => value?.toLowerCase().includes(term)));
  const canManage = account => account.id !== user?.id && (userRole === 'CEO' || !['CEO', 'COO'].includes(account.role));

  async function act(account, action, confirmMessage) {
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    setError('');
    setStatus('');
    setBusy(true);
    try {
      if (action === 'terminate') await employeeService.deleteEmployee(account.id);
      else if (action === 'two-factor') await employeeService.apiRequest(`/auth/two-factor/${encodeURIComponent(account.id)}/reset`, { method: 'POST' });
      else await employeeService.accountAction(account.id, action);
      await reload();
      setStatus({
        activate: 'Employee activated.', deactivate: 'Employee deactivated.', terminate: 'Employee terminated.',
        'reset-password': 'Password reset email sent.', 'setup-email': 'Password setup email queued.', 'two-factor': 'Two-factor authentication reset.'
      }[action]);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return <section className="space-y-4">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-semibold">Accounts</h1>
      <button className="btn btn-neutral" onClick={() => setForm({})}>Add employee</button>
    </header>
    {error && <p className="alert alert-error" role="alert">{error} <button onClick={reload} className="btn btn-sm">Retry</button></p>}
    {status && <p className="alert alert-success" role="status">{status}</p>}
    {stats && <div className="card border border-base-300 bg-base-100"><div className="card-body">
      <dl className="flex flex-wrap gap-6">
        <div><dt>Total accounts</dt><dd className="text-xl font-semibold">{stats.totalCreated}</dd></div>
        <div><dt>Created this month</dt><dd className="text-xl font-semibold">{stats.thisMonth}</dd></div>
        {Object.entries(stats.byRole).map(([key, count]) => <div key={key}><dt>{roleLabel(key)}</dt><dd className="text-xl font-semibold">{count}</dd></div>)}
      </dl>
      {stats.byDepartment.length > 0 && <details>
        <summary className="cursor-pointer">Team assignments</summary>
        <ul className="mt-2 grid gap-2 sm:grid-cols-2">{stats.byDepartment.map(team => <li key={team.department}>
          <strong>{team.department}</strong> · {team.members} employees · {team.lead}
        </li>)}</ul>
      </details>}
    </div></div>}
    <div className="card border border-base-300 bg-base-100"><div className="card-body p-4">
      <div className="flex flex-wrap gap-3">
        <input className="input input-bordered" type="search" aria-label="Search accounts" placeholder="Search accounts"
          value={search} maxLength={100} onChange={e => setSearch(e.target.value)} />
        <select className="select select-bordered" aria-label="Filter by role" value={role} onChange={e => setRole(e.target.value)}>
          <option value="">All roles</option>
          {Object.keys(stats?.byRole || {}).map(key => <option key={key} value={key}>{roleLabel(key)}</option>)}
        </select>
      </div>
      {loading ? <p role="status">Loading accounts…</p> : <div className="overflow-x-auto"><table className="table">
        <thead><tr><th>Employee</th><th>ID</th><th>Role</th><th>Department</th><th>Joined</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>{shown.map(account => <tr key={account.id}>
          <td><div className="font-medium">{account.name}</div><div className="text-sm text-base-content/70">{account.email}</div></td>
          <td>{account.employeeId}</td><td>{roleLabel(account.role)}</td><td>{account.department || '—'}</td>
          <td>{account.joinDate ? displayDate(account.joinDate) : '—'}</td>
          <td><span className={`badge ${account.isActive ? 'badge-success' : 'badge-ghost'}`}>{account.status}</span>
            {account.setupEmailStatus && <p className="mt-1 text-xs">Setup email {account.setupEmailStatus}</p>}</td>
          <td>{canManage(account) && <div className="flex flex-wrap gap-1">
            <button className="btn btn-xs" disabled={busy} onClick={() => setForm({ employee: account })}>Edit</button>
            {account.isActive && <button className="btn btn-xs" disabled={busy} onClick={() => act(account,
              account.setupEmailStatus ? 'setup-email' : 'reset-password')}>
              {account.setupEmailStatus ? 'Resend setup link' : 'Send reset link'}</button>}
            <button className="btn btn-xs" disabled={busy} onClick={() => act(account, account.isActive ? 'deactivate' : 'activate',
              account.isActive ? `Deactivate ${account.name}?` : undefined)}>{account.isActive ? 'Deactivate' : 'Activate'}</button>
            {['CEO', 'COO', 'HR'].includes(userRole) && <button className="btn btn-xs" disabled={busy}
              onClick={() => act(account, 'two-factor', `Reset two-factor authentication for ${account.name}? They will be signed out.`)}>
              Reset two-factor authentication
            </button>}
            <button className="btn btn-xs btn-outline btn-error" disabled={busy}
              onClick={() => act(account, 'terminate', `Terminate ${account.name}? Their employment history will be retained.`)}>Terminate</button>
          </div>}</td>
        </tr>)}</tbody>
      </table>{shown.length === 0 && !error && <p className="p-4 text-center">No accounts found.</p>}</div>}
    </div></div>
    {form && <EmployeeForm employee={form.employee} userRole={userRole} onClose={() => setForm(null)} onSave={async fields => {
      if (form.employee) await employeeService.updateEmployee(form.employee.id, fields);
      else await employeeService.createEmployee(fields);
      await reload();
      setStatus(form.employee ? 'Employee updated.' : 'Employee added. Password setup email queued.');
    }} />}
  </section>;
}
