import React, { useEffect, useState } from 'react';
import reportService from '../../services/reportService';
import { DEPARTMENTS } from '../../utils/departments';
import { businessDate, displayDateTime } from '../../utils/timeZone';
import { roleLabel } from '../../utils/roleLabels';

const reportSections = [
  ['completedTasks', 'Completed work'],
  ['ongoingWork', 'Ongoing work'],
  ['issuesFaced', 'Issues or blockers'],
  ['nextDayPlan', 'Next-day plan']
];

function SubmissionList({ title, employees }) {
  return (
    <section>
      <h2 className="font-semibold">{title} ({employees.length})</h2>
      <ul className="mt-2 space-y-1 text-sm">
        {employees.map(employee => <li key={employee.id}>{employee.name} ({employee.employeeId})</li>)}
      </ul>
    </section>
  );
}

export default function DailyReportReview({ scopedDepartment }) {
  const [date, setDate] = useState(businessDate);
  const [filter, setFilter] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const department = scopedDepartment || filter;

  useEffect(() => {
    const controller = new AbortController();
    if (date) {
      const filters = { date, ...(department && { department }) };
      const options = { signal: controller.signal };
      Promise.all([
        reportService.getAllReports(filters, options),
        reportService.getComplianceReport(filters, options)
      ]).then(([reports, compliance]) => {
        if (!controller.signal.aborted) setData({ reports, compliance });
      }).catch(failure => {
        if (!controller.signal.aborted) setError(failure.message);
      });
    }
    return () => controller.abort();
  }, [date, department]);

  function changeSelection(setValue, value) {
    setData(null);
    setError('');
    setValue(value);
  }

  return (
    <section className="card border border-base-300 bg-base-100">
      <div className="card-body gap-5">
        <h1 className="card-title">Daily reports</h1>
        <div className="flex flex-wrap gap-4">
          <label className="grid gap-1">
            Date (IST)
            <input className="input" type="date" max={businessDate()} value={date}
              onChange={event => changeSelection(setDate, event.target.value)} />
          </label>
          <label className="grid gap-1">
            Department
            <select className="select" value={department} disabled={Boolean(scopedDepartment)}
              onChange={event => changeSelection(setFilter, event.target.value)}>
              {scopedDepartment ? <option>{scopedDepartment}</option> : (
                <>
                  <option value="">All departments</option>
                  {DEPARTMENTS.map(name => <option key={name}>{name}</option>)}
                </>
              )}
            </select>
          </label>
        </div>
        {!date && <p>Select a date to view reports.</p>}
        {error && <p className="alert alert-error" role="alert">{error}</p>}
        {date && !data && !error && <p role="status">Loading reports…</p>}
        {data && (
          <>
            <dl className="flex flex-wrap gap-x-8 gap-y-3">
              <div><dt>Reports</dt><dd className="text-xl font-semibold">{data.reports.length}</dd></div>
              <div><dt>Expected</dt><dd className="text-xl font-semibold">{data.compliance.expectedCount}</dd></div>
              <div><dt>Submission rate</dt><dd className="text-xl font-semibold">{data.compliance.percentage}%</dd></div>
            </dl>
            <div className="grid gap-4 sm:grid-cols-2">
              <SubmissionList title="Submitted" employees={data.compliance.submitted} />
              <SubmissionList title="Missed" employees={data.compliance.missed} />
            </div>
            {data.reports.length === 0 ? <p>No daily reports for this date and department.</p> : (
              <div className="divide-y divide-base-300">
                {data.reports.map(report => (
                  <details key={report.id || report._id} className="py-3">
                    <summary className="cursor-pointer font-medium">{report.userName} · {roleLabel(report.userRole)}</summary>
                    <p className="mt-1 text-sm">{report.department}{report.submittedAt && ` · ${displayDateTime(report.submittedAt)}`}</p>
                    <dl className="mt-3 space-y-3">
                      {reportSections.filter(([field]) => report[field]).map(([field, label]) => (
                        <div key={field}>
                          <dt className="font-medium">{label}</dt>
                          <dd className="whitespace-pre-wrap break-words">{report[field]}</dd>
                        </div>
                      ))}
                    </dl>
                  </details>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
