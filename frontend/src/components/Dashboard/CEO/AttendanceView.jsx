import { useState } from 'react';
import authService from '../../../services/authService';
import { DEPARTMENTS } from '../../../utils/departments';
import { roleLabel } from '../../../utils/roleLabels';
import { businessDate, displayTime } from '../../../utils/timeZone';
import useDashboardData from '../useDashboardData';

const apiBase = (process.env.REACT_APP_API_URL || '/api').replace(/\/+$/, '');
const statuses = {
  present: 'Present', absent: 'Absent', late: 'Late',
  'on-leave': 'On leave', 'working-from-home': 'Working from home'
};

function AttendanceEdit({ employee, date, onClose, onSave }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    setPending(true);
    setError('');
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const response = await fetch(`${apiBase}/attendance/mark`, {
        method: 'POST', headers: authService.getAuthHeaders(),
        body: JSON.stringify({
          ...fields, date, userId: employee.userId, employeeId: employee.employeeId,
          userName: employee.name, role: employee.role, department: employee.department
        })
      });
      const body = await response.json();
      if (!response.ok || body.success === false) throw new Error(body.message || 'Could not update attendance.');
      onSave();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setPending(false);
    }
  }

  return (
    <dialog open className="modal modal-open" aria-label="Edit employee attendance">
      <form className="modal-box grid gap-3" onSubmit={submit}>
        <h2 className="text-xl font-semibold">Attendance for {employee.name}</h2>
        {error && <p role="alert" className="alert alert-error">{error}</p>}
        <label className="grid gap-1"><span>Status</span>
          <select className="select" name="status" defaultValue={employee.status}>
            {Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="grid gap-1"><span>Check-in time (IST)</span><input className="input" name="checkInTime" type="time" /></label>
        <label className="grid gap-1"><span>Check-out time (IST)</span><input className="input" name="checkOutTime" type="time" /></label>
        <label className="grid gap-1"><span>Notes</span><textarea className="textarea" name="notes" maxLength={500} /></label>
        <div className="modal-action">
          <button type="button" className="btn btn-ghost" disabled={pending} onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-neutral" disabled={pending}>Save attendance</button>
        </div>
      </form>
    </dialog>
  );
}

function timeLabel(time, legacyTime) {
  return time ? displayTime(time, 'en-IN', { hour: 'numeric', minute: '2-digit' }) : legacyTime || '—';
}

export default function AttendanceView({ userRole = 'CEO' }) {
  const [date, setDate] = useState(businessDate);
  const [department, setDepartment] = useState('');
  const [selected, setSelected] = useState(null);
  const [saved, setSaved] = useState(false);
  const canEdit = ['CEO', 'COO', 'Manager'].includes(userRole);
  const query = new URLSearchParams({ date, ...(department ? { department } : {}) });
  const { data, error, reload } = useDashboardData(`/attendance/roster?${query}`, 'Could not load the attendance roster.');
  const rows = Array.isArray(data) ? data : [];

  return (
    <section className="card border border-base-300 bg-base-100">
      <div className="card-body">
        <h1 className="card-title text-2xl">Attendance</h1>
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1"><span className="label">Business date (IST)</span>
            <input className="input" type="date" value={date} onChange={event => setDate(event.target.value || businessDate())} />
          </label>
          <label className="grid gap-1"><span className="label">Department</span>
            <select className="select" value={department} onChange={event => setDepartment(event.target.value)}>
              <option value="">All departments</option>
              {DEPARTMENTS.map(name => <option key={name}>{name}</option>)}
            </select>
          </label>
          <button type="button" className="btn" onClick={reload}>Refresh</button>
        </div>
        {saved && <p role="status">Attendance saved.</p>}
        {error && <p role="alert" className="alert alert-error">{error}</p>}
        {!error && !data && <p role="status">Loading attendance…</p>}
        {!error && data && <>
          <div className="flex flex-wrap gap-2" aria-label="Attendance totals">
            {Object.entries(statuses).map(([status, label]) => (
              <p key={status} className="badge badge-outline">{label}: {rows.filter(row => row.status === status).length}</p>
            ))}
          </div>
          {rows.length ? <div className="overflow-x-auto">
            <table className="table">
              <thead><tr>
                <th>Employee</th><th>Department</th><th>Role</th><th>Status</th><th>Check in</th><th>Check out</th><th>Hours</th>
                {canEdit && <th>Actions</th>}
              </tr></thead>
              <tbody>{rows.map(employee => <tr key={employee.id}>
                <th scope="row">{employee.name}</th><td>{employee.department}</td><td>{roleLabel(employee.role)}</td>
                <td>{statuses[employee.status] || employee.status}</td>
                <td>{timeLabel(employee.checkInTime, employee.checkIn)}</td>
                <td>{timeLabel(employee.checkOutTime, employee.checkOut)}</td>
                <td>{employee.hoursWorked || 0}</td>
                {canEdit && <td><button type="button" className="btn btn-ghost btn-sm" onClick={() => {
                  setSaved(false);
                  setSelected(employee);
                }}>Edit</button></td>}
              </tr>)}</tbody>
            </table>
          </div> : <p>No employees match this date and department.</p>}
        </>}
      </div>
      {selected && <AttendanceEdit employee={selected} date={date} onClose={() => setSelected(null)} onSave={() => {
        setSelected(null);
        setSaved(true);
        reload();
      }} />}
    </section>
  );
}
