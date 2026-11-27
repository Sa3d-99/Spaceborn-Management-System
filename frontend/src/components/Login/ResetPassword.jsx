import React, { useEffect, useState } from 'react';
import { setNewPassword, validateResetLink } from '../../services/passwordRecoveryService';
import PasswordRecoveryLayout from './PasswordRecoveryLayout';

const invalidLink = 'This reset link is invalid or has expired';

function getResetToken() {
  return new URLSearchParams(window.location.hash.slice(1)).get('token');
}

export default function ResetPassword({ onBackToLogin, onRequestNewLink, onSetupComplete }) {
  const [token] = useState(getResetToken);
  const hasToken = /^[a-f0-9]{64}$/.test(token || '');
  const [linkState, setLinkState] = useState(hasToken ? 'checking' : 'invalid');
  const [checkCount, setCheckCount] = useState(0);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (window.location.hash) {
      window.history.replaceState(window.history.state, '', window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (!hasToken) return;
    const controller = new AbortController();
    validateResetLink(token, controller.signal).then(() => {
      if (!controller.signal.aborted) setLinkState('valid');
    }).catch(err => {
      if (controller.signal.aborted) return;
      if (err.code === 'INVALID_RESET_LINK') {
        setLinkState('invalid');
      } else {
        setError(err.message);
        setLinkState('unavailable');
      }
    });
    return () => controller.abort();
  }, [token, hasToken, checkCount]);

  function retryValidation() {
    setError('');
    setLinkState('checking');
    setCheckCount(count => count + 1);
  }

  async function submit(event) {
    event.preventDefault();
    if (password !== confirmation) {
      setError('The passwords must match.');
      return;
    }
    const length = [...password.normalize('NFC')].length;
    if (length < 8 || length > 64) {
      setError('Use 8 to 64 characters.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await setNewPassword(token, password);
      setPassword('');
      setConfirmation('');
      setMessage(result.message);
      if (result.data?.setupEmployeeId) {
        await onSetupComplete?.(result.data.setupEmployeeId, password);
      }
    } catch (err) {
      if (err.code === 'INVALID_RESET_LINK') {
        setPassword('');
        setConfirmation('');
        setLinkState('invalid');
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <PasswordRecoveryLayout title="Choose a new password">
      {linkState === 'checking' && <p className="text-sm text-base-content/70" role="status">Checking your reset link…</p>}
      {linkState === 'invalid' && (
        <>
          <p className="alert alert-error" role="alert">{invalidLink}</p>
          <button type="button" className="btn btn-neutral self-start" onClick={onRequestNewLink}>Request a new link</button>
        </>
      )}
      {error && <p className="alert alert-error" role="alert">{error}</p>}
      {linkState === 'unavailable' && (
        <button type="button" className="btn btn-neutral self-start" onClick={retryValidation}>Check link again</button>
      )}
      {message && <p className="alert alert-success" role="status">{message}</p>}
      {linkState === 'valid' && !message && (
        <form className="grid gap-4" onSubmit={submit}>
          <label className="grid gap-1">
            <span className="label">New password</span>
            <input className="input w-full" type="password" autoComplete="new-password"
              aria-describedby="password-guidance" value={password} onChange={event => setPassword(event.target.value)} required />
          </label>
          <p id="password-guidance" className="text-sm text-base-content/70">Use 8 to 64 characters. A passphrase works well.</p>
          <label className="grid gap-1">
            <span className="label">Confirm new password</span>
            <input className="input w-full" type="password" autoComplete="new-password"
              value={confirmation} onChange={event => setConfirmation(event.target.value)} required />
          </label>
          <button className="btn btn-neutral" type="submit" disabled={loading}>
            {loading && <span className="loading loading-spinner loading-sm" aria-hidden="true" />}
            Update password
          </button>
        </form>
      )}
      <button type="button" className={`btn self-start ${message ? 'btn-neutral' : 'btn-ghost'}`} onClick={onBackToLogin} disabled={loading}>
        {message ? 'Sign in' : 'Back to sign in'}
      </button>
    </PasswordRecoveryLayout>
  );
}
