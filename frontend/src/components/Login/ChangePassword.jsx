import { useState } from 'react';
import authService from '../../services/authService';

export function ChangePasswordForm({ onChanged }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (newPassword !== confirmation) {
      setError('The passwords must match.');
      return;
    }
    const length = [...newPassword.normalize('NFC')].length;
    if (length < 8 || length > 64) {
      setError('Use 8 to 64 characters.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      const result = await authService.changePassword(currentPassword, newPassword);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setCurrentPassword('');
      setNewPassword('');
      setConfirmation('');
      await onChanged?.(result.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="grid gap-4" onSubmit={submit}>
      {error && <p className="alert alert-error" role="alert">{error}</p>}
      <label className="grid gap-1">
        <span className="label">Current password</span>
        <input className="input w-full" type="password" autoComplete="current-password"
          value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} required />
      </label>
      <label className="grid gap-1">
        <span className="label">New password</span>
        <input className="input w-full" type="password" autoComplete="new-password"
          value={newPassword} onChange={event => setNewPassword(event.target.value)} required />
      </label>
      <p className="text-sm text-base-content/70">Use 8 to 64 characters. A passphrase works well.</p>
      <label className="grid gap-1">
        <span className="label">Confirm new password</span>
        <input className="input w-full" type="password" autoComplete="new-password"
          value={confirmation} onChange={event => setConfirmation(event.target.value)} required />
      </label>
      <button className="btn btn-neutral justify-self-start" type="submit" disabled={busy}>
        {busy ? 'Changing password…' : 'Change password'}
      </button>
    </form>
  );
}
