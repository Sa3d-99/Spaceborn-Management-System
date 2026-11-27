import { useState } from 'react';
import authService from '../../services/authService';
import { BUSINESS_TIME_ZONE } from '../../utils/timeZone';

const timeZones = [...new Set([BUSINESS_TIME_ZONE, 'UTC', ...(Intl.supportedValuesOf?.('timeZone') || [])])];
const apiBase = (process.env.REACT_APP_API_URL || '/api').replace(/\/+$/, '');

export default function ProfilePreferences({ user, onTimeZoneChange }) {
  const [timeZone, setTimeZone] = useState(user.timeZone || BUSINESS_TIME_ZONE);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function save(event) {
    event.preventDefault();
    setStatus('');
    setError('');
    setSaving(true);
    try {
      const response = await fetch(`${apiBase}/auth/preferences`, {
        method: 'PATCH',
        headers: authService.getAuthHeaders(),
        body: JSON.stringify({ timeZone })
      });
      const data = await response.json();
      if (!response.ok || data.success === false) throw new Error(data.message || 'Could not save your time zone.');
      onTimeZoneChange(data.data.timeZone);
      setStatus('Time zone saved.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card mx-auto mt-4 max-w-4xl border border-base-300 bg-base-100">
      <div className="card-body">
        <h2 className="card-title">Display preferences</h2>
        <p className="text-sm text-base-content/70">Company attendance and meeting schedules use India time.</p>
        <form onSubmit={save} className="mt-2 flex flex-wrap items-end gap-3">
          <label className="grid gap-1">
            <span className="label">Time zone</span>
            <select className="select w-full" value={timeZone} onChange={event => setTimeZone(event.target.value)}>
              {timeZones.map(zone => <option key={zone}>{zone}</option>)}
            </select>
          </label>
          <button type="submit" className="btn btn-neutral" disabled={saving}>Save time zone</button>
        </form>
        {status && <p role="status">{status}</p>}
        {error && <p role="alert" className="text-error">{error}</p>}
      </div>
    </section>
  );
}
