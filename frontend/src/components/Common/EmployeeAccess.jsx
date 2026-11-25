import React, { useEffect, useState } from 'react';
import authService from '../../services/authService';
import { roleLabel } from '../../utils/roleLabels';

const apiBase = (process.env.REACT_APP_API_URL || '/api').replace(/\/+$/, '');

async function load(path, method = 'GET') {
  const response = await fetch(`${apiBase}${path}`, { method, headers: authService.getAuthHeaders() });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || 'Could not update employee access.');
  return result.data;
}

export default function EmployeeAccess() {
  const [employees, setEmployees] = useState(null);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function refresh() {
    try {
      setEmployees((await load('/employees')).filter(employee => employee.isActive && employee.canDeactivate));
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => { refresh(); }, []);

  async function deactivate() {
    setBusy(true);
    setError('');
    try {
      await load(`/users/${selected.id}/deactivate`, 'POST');
      setSelected(null);
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card border border-base-300 bg-base-100">
      <div className="card-body">
        <h2 className="card-title">Employee access</h2>
        {error && <p className="alert alert-error" role="alert">{error}</p>}
        {!employees && !error && <span className="loading loading-spinner" role="status" aria-label="Loading employees" />}
        {employees?.length === 0 && <p className="text-base-content/70">No active employees to manage.</p>}
        {employees?.length > 0 && (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>Employee</th><th>Department</th><th>Role</th><th>Access</th></tr></thead>
              <tbody>
                {employees.map(employee => (
                  <tr key={employee.id}>
                    <td>{employee.name}</td><td>{employee.department}</td><td>{roleLabel(employee.role)}</td>
                    <td><button className="btn btn-sm btn-outline" type="button" onClick={() => setSelected(employee)}>Deactivate</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {selected && (
          <div className="alert alert-warning mt-2">
            <p>Deactivate {selected.name}’s sign-in access?</p>
            <div className="flex gap-2">
              <button type="button" className="btn btn-sm btn-ghost" disabled={busy} onClick={() => setSelected(null)}>Cancel</button>
              <button type="button" className="btn btn-sm btn-error" disabled={busy} onClick={deactivate}>Deactivate access</button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
