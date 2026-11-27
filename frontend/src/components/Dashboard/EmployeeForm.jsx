import React, { useState } from 'react';
import { DEPARTMENTS } from '../../utils/departments';
import { roleLabel } from '../../utils/roleLabels';
import { businessDate } from '../../utils/timeZone';

const roles = ['COO', 'HR', 'Team Lead', 'CO Head', 'Manager', 'Member'];
const namePattern = "[\\p{L}\\p{M}][\\p{L}\\p{M} '\\u2019\\-]*";

export default function EmployeeForm({ employee, userRole, onSave, onClose }) {
  const today = businessDate();
  const latestJoinDate = new Date(Date.parse(today) + 180 * 86400000).toISOString().slice(0, 10);
  const [fields, setFields] = useState(() => ({
    firstName: employee?.firstName || '', lastName: employee?.lastName || '',
    email: employee?.email || '', phone: employee?.phone || '',
    department: employee?.department || '', designation: employee?.designation || '',
    role: employee?.role || 'Member', joinDate: employee?.joinDate || today,
    dateOfBirth: employee?.dateOfBirth || ''
  }));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const availableRoles = roles.filter(role => role !== 'COO' || userRole === 'CEO');
  if (!availableRoles.includes(fields.role)) availableRoles.unshift(fields.role);
  const canSetRole = !employee || ['CEO', 'COO', 'Manager'].includes(userRole);
  const departments = [...new Set([...DEPARTMENTS, fields.department].filter(Boolean))];

  async function submit(event) {
    event.preventDefault();
    setError('');
    setSaving(true);
    try {
      const values = Object.fromEntries(Object.entries(fields).filter(([key, value]) =>
        (key !== 'role' || canSetRole) && (!employee || value !== (employee[key] ?? ''))));
      await onSave(values);
      onClose();
    } catch (err) {
      setError(err.message || 'Could not save the employee.');
    } finally {
      setSaving(false);
    }
  }

  function input(name, label, options) {
    return <label className="form-control gap-1 text-sm">
      <span>{label}</span>
      <input className="input input-bordered w-full" value={fields[name]} {...options}
        onChange={event => setFields(current => ({ ...current, [name]: event.target.value }))} />
    </label>;
  }

  function select(name, label, options, format = value => value) {
    return <label className="form-control gap-1 text-sm">
      <span>{label}</span>
      <select className="select select-bordered w-full" value={fields[name]} required disabled={name === 'role' && !canSetRole}
        onChange={event => setFields(current => ({ ...current, [name]: event.target.value }))}>
        <option value="" disabled>Select {label.toLowerCase()}</option>
        {options.map(value => <option key={value} value={value}>{format(value)}</option>)}
      </select>
    </label>;
  }

  return <div className="modal modal-open" role="dialog" aria-modal="true" aria-labelledby="employee-form-title">
    <form className="modal-box max-w-2xl space-y-4" onSubmit={submit}>
      <h2 className="text-lg font-semibold" id="employee-form-title">{employee ? 'Edit employee' : 'Add employee'}</h2>
      {!employee && <p className="text-sm text-base-content/70">The employee will receive a one-time password setup link by email.</p>}
      {error && <p className="alert alert-error" role="alert">{error}</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        {input('firstName', 'First name', { required: true, minLength: 2, maxLength: 30, pattern: namePattern })}
        {input('lastName', 'Last name', { required: true, maxLength: 30, pattern: namePattern })}
        {input('email', 'Email', { type: 'email', required: true, maxLength: 100 })}
        {input('phone', 'Phone', { type: 'tel', pattern: '\\+?[0-9]{10,15}', title: '10–15 digits, optionally starting with +' })}
        {select('department', 'Department', departments)}
        {select('role', 'Role', availableRoles, roleLabel)}
        {input('designation', 'Designation', { minLength: 2, maxLength: 60 })}
        {input('joinDate', 'Join date', { type: 'date', required: true, min: '2020-01-01', max: latestJoinDate })}
        {input('dateOfBirth', 'Date of birth', { type: 'date', max: fields.joinDate || today })}
      </div>
      <div className="modal-action">
        <button className="btn btn-ghost" type="button" onClick={onClose} disabled={saving}>Cancel</button>
        <button className="btn btn-neutral" disabled={saving}>{saving ? 'Saving…' : employee ? 'Save changes' : 'Add employee'}</button>
      </div>
    </form>
  </div>;
}
