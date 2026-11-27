import { useEffect, useState } from 'react';
import { Clock3, Menu } from './Icons';
import authService from '../../services/authService';
import { businessDate, displayDate, displayTime } from '../../utils/timeZone';

const apiBase = (process.env.REACT_APP_API_URL || '/api').replace(/\/+$/, '');

function workingTime(attendance, now) {
  const start = Date.parse(attendance?.checkInTime);
  if (!Number.isFinite(start)) return '0h 00m';
  const end = Date.parse(attendance.checkOutTime) || (attendance.checkOut ? NaN : now.getTime());
  const minutes = Number.isFinite(end) ? Math.floor((end - start) / 60_000) : (Number(attendance.hoursWorked) || 0) * 60;
  const total = Math.max(0, Math.round(minutes));
  return `${Math.floor(total / 60)}h ${String(total % 60).padStart(2, '0')}m`;
}

export default function ShiftTimer({ user, onLogout, navigationOpen, onToggleNavigation }) {
  const [now, setNow] = useState(() => new Date());
  const [attendance, setAttendance] = useState(null);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [online, setOnline] = useState(() => navigator.onLine);
  const date = businessDate(now);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${apiBase}/dashboard/my-attendance`, { headers: authService.getAuthHeaders(), signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error('Could not load today’s attendance.');
        const body = await response.json();
        if (!controller.signal.aborted) setAttendance(body.data || null);
      })
      .catch(error => {
        if (!controller.signal.aborted) setError(error.message);
      });
    return () => controller.abort();
  }, [user.id, date]);

  async function attendanceAction(action, message) {
    setError('');
    setPending(true);
    try {
      const response = await fetch(`${apiBase}/attendance/${action}`, {
        method: 'POST', headers: authService.getAuthHeaders()
      });
      const body = await response.json();
      if (!response.ok || body.success === false) throw new Error(body.message || message);
      if (action === 'clock-out') await onLogout();
      else setAttendance(body.data);
    } catch (err) {
      setError(err.message || message);
    } finally {
      setPending(false);
    }
  }

  return (
    <header className="navbar z-50 min-h-[73px] shrink-0 flex-wrap justify-between gap-2 border-b border-base-300 bg-base-100 px-4 shadow-sm">
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
        <span className="text-base-content/70">{displayDate(now)}</span>
        <span className="text-base-content/70">Shift 8 AM–midnight IST</span>
        <span className="flex items-center gap-1">
          <span aria-hidden="true" className={`size-2 rounded-full ${online ? 'bg-success' : 'bg-error'}`} />
          {online ? 'Online' : 'Offline'}
        </span>
        <span className="tabular-nums">Active Working Hours: {workingTime(attendance, now)}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-neutral btn-sm" type="button" disabled={!online || pending || Boolean(attendance?.checkInTime)}
          onClick={() => attendanceAction('auto-mark', 'Could not mark attendance. Try again.')}>Mark Attendance</button>
        <button className="btn btn-outline btn-sm" type="button" disabled={!online || pending}
          onClick={() => attendanceAction('clock-out', 'Could not check out. Try again.')}>Check out and sign out</button>
      </div>
      {error && <p className="alert alert-error w-full py-2" role="alert">{error}</p>}
    </header>
  );
}
