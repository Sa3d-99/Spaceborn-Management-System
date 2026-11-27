import { displayDateTime } from '../../utils/timeZone';
import useDashboardData from './useDashboardData';

export default function OperationsOverview({ user, automation = false, onNavigate }) {
  const role = user?.role || 'Manager';
  const { data, error, reload } = useDashboardData(
    role === 'CEO' ? '/dashboard/ceo' : '/dashboard/manager',
    'Could not load operations data.'
  );
  const departments = Array.isArray(data?.departmentProgress) ? data.departmentProgress : [];
  const activity = Array.isArray(data?.recentActivity) ? data.recentActivity : [];

  return (
    <section className="card border border-base-300 bg-base-100">
      <div className="card-body">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="card-title text-2xl">{automation ? 'System Automation' : 'AI Insights'}</h1>
          <button type="button" className="btn btn-outline" onClick={reload}>Refresh</button>
        </div>
        {automation ? (
          <p className="text-sm text-base-content/70">Automation schedules and email settings are not managed from this dashboard.</p>
        ) : (
          <p className="text-sm text-base-content/70">AI analysis is unavailable. This view shows recorded department progress.</p>
        )}
        {error && <p role="alert" className="alert alert-error">{error}</p>}
        {!error && !data && <p role="status">Loading operations data…</p>}
        {!error && data && (automation ? (
          <>
            <h2 className="mt-3 text-lg font-semibold">Recent recorded activity</h2>
            {activity.length ? (
              <ul className="divide-y divide-base-300">
                {activity.map((event, index) => <li className="flex flex-wrap justify-between gap-2 py-3" key={`${event.time}-${index}`}>
                  <span>{event.action}</span>
                  <time dateTime={event.time} className="text-sm text-base-content/70">{displayDateTime(event.time)}</time>
                </li>)}
              </ul>
            ) : <p>No activity has been recorded.</p>}
            <button type="button" className="btn btn-outline self-start" onClick={() => onNavigate?.('ActivityMonitor')}>Open Activity Monitor</button>
          </>
        ) : (
          <>
            <h2 className="mt-3 text-lg font-semibold">Department progress</h2>
            {departments.length ? (
              <ul className="grid gap-3">
                {departments.map(department => <li key={department.name}>
                  <div className="flex justify-between gap-2"><span>{department.name}</span><span>{department.progress}%</span></div>
                  <progress className="progress" value={department.progress} max="100" aria-label={department.name} />
                </li>)}
              </ul>
            ) : <p>No department progress has been recorded.</p>}
          </>
        ))}
      </div>
    </section>
  );
}
