import React, { useCallback, useEffect, useState } from 'react';
import employeeService from '../../../services/employeeService';
import { roleLabel } from '../../../utils/roleLabels';
import { DEPARTMENTS } from '../../../utils/departments';
import EmployeeForm from '../EmployeeForm';

export default function TeamsAndRoles({ userRole = 'CEO' }) {
  const [records, setRecords] = useState([]);
  const [stats, setStats] = useState(null);
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [employees, counts] = await Promise.all([
        employeeService.getAllEmployees(), employeeService.apiRequest('/accounts/stats')
      ]);
      setRecords(employees);
      setStats(counts);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);
  const query = search.trim().toLowerCase();
  const employees = records.filter(employee => (!department || employee.department === department) &&
    [employee.name, employee.email, employee.employeeId, employee.department, roleLabel(employee.role)]
      .some(value => value?.toLowerCase().includes(query)));

  return <section className="space-y-4">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-semibold">Teams &amp; Roles</h1>
      <button className="btn btn-neutral" onClick={() => setAdding(true)}>Add employee</button>
    </header>
    {error && <div role="alert" className="alert alert-error">{error}<button className="btn btn-sm" onClick={load}>Retry</button></div>}
    {loading && <p role="status">Loading teams…</p>}
    {stats && <section className="card border border-base-300 bg-base-100"><div className="card-body">
      <h2 className="card-title">Team assignments</h2>
      <p>{stats.totalCreated} employees</p>
      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{stats.byDepartment.map(team => <div key={team.department} className="rounded-box border border-base-300 p-3">
        <dt className="font-semibold">{team.department}</dt>
        <dd>{team.members} employees</dd><dd>Team Lead · {team.lead}</dd>
      </div>)}</dl>
      <div className="flex flex-wrap gap-2" aria-label="Employee counts by role">{Object.entries(stats.byRole).map(([role, count]) =>
        <span key={role} className="badge badge-outline">{roleLabel(role)} · {count}</span>)}</div>
    </div></section>}
    <section className="card border border-base-300 bg-base-100"><div className="card-body">
      <h2 className="card-title">Employees</h2>
      <div className="flex flex-wrap gap-2">
        <input className="input input-bordered" type="search" aria-label="Search employees" placeholder="Search employees"
          value={search} maxLength={100} onChange={e => setSearch(e.target.value)} />
        <select className="select select-bordered" aria-label="Department" value={department} onChange={e => setDepartment(e.target.value)}>
          <option value="">All departments</option>{DEPARTMENTS.map(value => <option key={value}>{value}</option>)}
        </select>
      </div>
      {!loading && <div className="overflow-x-auto"><table className="table">
        <thead><tr><th>Name</th><th>Employee ID</th><th>Department</th><th>Role</th><th>Status</th></tr></thead>
        <tbody>{employees.map(employee => <tr key={employee.id}>
          <td>{employee.name}</td><td>{employee.employeeId}</td><td>{employee.department || '—'}</td>
          <td>{roleLabel(employee.role)}</td><td>{employee.status}</td>
        </tr>)}</tbody>
      </table>{employees.length === 0 && <p className="p-4">No matching employees.</p>}</div>}
    </div></section>
    {adding && <EmployeeForm userRole={userRole} onClose={() => setAdding(false)} onSave={async values => {
      await employeeService.createEmployee(values);
      await load();
    }} />}
  </section>;
}
