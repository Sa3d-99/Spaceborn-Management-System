import React, { useState } from 'react';
import { requestResetLink } from '../../services/passwordRecoveryService';
import PasswordRecoveryLayout from './PasswordRecoveryLayout';

export default function ForgotPassword({ initialEmployeeId = '', onBackToLogin }) {
  const [employeeId, setEmployeeId] = useState(initialEmployeeId);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    const identifier = employeeId.trim();
    if (!identifier) {
      setError('Employee ID is required');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await requestResetLink(identifier);
      setMessage(result.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <PasswordRecoveryLayout title="Forgot password">
      {message && <p className="alert alert-info" role="status">{message}</p>}
      {error && <p className="alert alert-error" role="alert">{error}</p>}
      {!message && (
        <>
          <p className="text-sm text-base-content/70">Enter the employee ID or email on your CRM account.</p>
          <form className="grid gap-4" onSubmit={submit} noValidate>
            <label className="grid gap-1">
              <span className="label">Employee ID or email</span>
              <input className="input w-full" autoComplete="username" autoCapitalize="none" spellCheck={false}
                value={employeeId} onChange={event => setEmployeeId(event.target.value)} maxLength={254} required />
            </label>
            <button className="btn btn-neutral" type="submit" disabled={loading}>
              {loading && <span className="loading loading-spinner loading-sm" aria-hidden="true" />}
              Send reset link
            </button>
          </form>
        </>
      )}
      <button type="button" className="btn btn-ghost self-start" onClick={onBackToLogin}>Back to sign in</button>
    </PasswordRecoveryLayout>
  );
}
