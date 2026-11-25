import React, { useState } from 'react';
import { DEPARTMENTS } from '../../utils/departments';

const apiBase = (process.env.REACT_APP_API_URL || '/api').replace(/\/+$/, '');

export default function Signup({ onBack }) {
  const [form, setForm] = useState({ name: '', email: '', department: '' });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  function update(event) {
    const { name, value } = event.target;
    setForm(previous => ({ ...previous, [name]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${apiBase}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      setMessage(data.message);
    } catch (err) {
      setError(err.message || 'Could not submit your request.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-base-200 p-4">
      <section className="card w-full max-w-md border border-base-300 bg-base-100 shadow-sm">
        <div className="card-body gap-4">
          <h1 className="card-title text-2xl">Request a Spaceborn account</h1>
          {message ? <p className="alert alert-success" role="status">{message}</p> : (
            <>
              <p className="text-base-content/70">An administrator will review your request. If approved, you’ll receive a link to set your password.</p>
              {error && <p className="alert alert-error" role="alert">{error}</p>}
              <form className="grid gap-4" onSubmit={submit}>
                <label className="grid gap-1">
                  <span className="label">Full name</span>
                  <input className="input w-full" name="name" required minLength={2} maxLength={120}
                    autoComplete="name" value={form.name} onChange={update} />
                </label>
                <label className="grid gap-1">
                  <span className="label">Work email</span>
                  <input className="input w-full" name="email" type="email" required maxLength={254}
                    autoComplete="email" value={form.email} onChange={update} />
                </label>
                <label className="grid gap-1">
                  <span className="label">Department</span>
                  <select className="select w-full" name="department" required value={form.department} onChange={update}>
                    <option value="" disabled>Select a department</option>
                    {DEPARTMENTS.map(department => <option key={department}>{department}</option>)}
                  </select>
                </label>
                <button className="btn btn-neutral" type="submit" disabled={loading}>
                  {loading && <span className="loading loading-spinner loading-sm" aria-hidden="true" />}
                  Request account
                </button>
              </form>
            </>
          )}
          <button className="btn btn-ghost self-start" type="button" onClick={onBack}>Back to sign in</button>
        </div>
      </section>
    </main>
  );
}
