import React, { useEffect, useRef, useState } from 'react';
import { Clock3, Menu, Settings2 } from './Icons';
import authService from '../../services/authService';
import { BUSINESS_TIME_ZONE, displayDate, displayTime } from '../../utils/timeZone';

const timeZones = [...new Set([BUSINESS_TIME_ZONE, 'UTC', ...(Intl.supportedValuesOf?.('timeZone') || [])])];
const apiBase = (process.env.REACT_APP_API_URL || '/api').replace(/\/+$/, '');

export default function ShiftTimer({ user, onLogout, onTimeZoneChange, navigationOpen, onToggleNavigation }) {
  const [now, setNow] = useState(() => new Date());
  const [timeZone, setTimeZone] = useState(user.timeZone || BUSINESS_TIME_ZONE);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const dialog = useRef(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  async function save(event) {
    event.preventDefault();
    setError('');
    setSaving(true);
    try {
      const response = await fetch(`${apiBase}/auth/preferences`, {
        method: 'PATCH',
        headers: authService.getAuthHeaders(),
        body: JSON.stringify({ timeZone })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not save your time zone.');
      onTimeZoneChange(data.data.timeZone);
      dialog.current.close();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function clockOut() {
    setError('');
    try {
      const response = await fetch(`${apiBase}/attendance/clock-out`, {
        method: 'POST', headers: authService.getAuthHeaders()
      });
      if (!response.ok) throw new Error('Could not check out. Try again.');
      await onLogout();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <header className="navbar sticky top-0 z-50 min-h-[73px] flex-wrap justify-between gap-2 border-b border-base-300 bg-base-100 px-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <button className="btn btn-ghost btn-square btn-sm md:hidden" type="button"
          onClick={onToggleNavigation} aria-expanded={navigationOpen} aria-label="Dashboard menu">
          <Menu size={16} aria-hidden="true" />
        </button>
        <span className="flex items-center gap-2">
          <Clock3 size={16} aria-hidden="true" />
          <time className="font-mono tabular-nums" dateTime={now.toISOString()}>
            {displayTime(now, 'en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZoneName: 'short' })}
          </time>
        </span>
        <span className="hidden text-base-content/70 sm:inline">{displayDate(now)}</span>
        <span className="hidden text-base-content/70 md:inline">Shift 8 AM–midnight IST</span>
      </div>
      <div className="flex gap-2">
        <button className="btn btn-ghost btn-sm" type="button" onClick={() => { setError(''); dialog.current.showModal(); }}>
          <Settings2 size={16} aria-hidden="true" /> Time zone
        </button>
        <button className="btn btn-outline btn-sm" type="button" onClick={clockOut}>Check out and sign out</button>
      </div>
      {error && !dialog.current?.open && <p className="alert alert-error w-full py-2" role="alert">{error}</p>}
      <dialog className="modal" ref={dialog} aria-labelledby="time-zone-title">
        <div className="modal-box">
          <h2 id="time-zone-title" className="text-lg font-semibold">Display time zone</h2>
          <p className="mt-2 text-sm text-base-content/70">Company attendance and meeting schedules use India time.</p>
          {error && <p className="alert alert-error mt-3" role="alert">{error}</p>}
          <form onSubmit={save}>
            <label className="mt-4 grid gap-1">
              <span className="label">Time zone</span>
              <select className="select w-full" value={timeZone} onChange={event => setTimeZone(event.target.value)}>
                {timeZones.map(zone => <option key={zone}>{zone}</option>)}
              </select>
            </label>
            <div className="modal-action">
              <button type="button" className="btn btn-ghost" onClick={() => { setError(''); dialog.current.close(); }}>Cancel</button>
              <button type="submit" className="btn btn-neutral" disabled={saving}>Save time zone</button>
            </div>
          </form>
        </div>
      </dialog>
    </header>
  );
}
