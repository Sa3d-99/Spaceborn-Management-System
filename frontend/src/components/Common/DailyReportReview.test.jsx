import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import DailyReportReview from './DailyReportReview';
import { businessDate } from '../../utils/timeZone';

test('BUG-063/064 shows scoped report counts and compliance for the selected day', async () => {
  const calls = [];
  vi.stubGlobal('fetch', vi.fn(async path => {
    const request = new URL(path, 'https://crm.example.test');
    calls.push(request);
    const submitted = [{ id: 'intel01', name: 'Reporting Employee', employeeId: 'INT001' }];
    const missed = [{ id: 'intel02', name: 'Missing Employee', employeeId: 'INT002' }];
    const data = request.pathname.endsWith('/compliance')
      ? { expectedCount: 2, percentage: 50, submitted, missed }
      : [{ id: 'report1', userName: 'Reporting Employee', userRole: 'Member', completedTasks: 'Validated the new report.' }];
    return Response.json({ success: true, data });
  }));
  try {
    render(<DailyReportReview />);
    expect(await screen.findByRole('heading', { name: 'Submitted (1)' })).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText('Missing Employee (INT002)')).toBeInTheDocument();
    expect(calls[0].searchParams.get('date')).toBe(businessDate());
    fireEvent.change(screen.getByLabelText('Department'), { target: { value: 'Sensor Stack' } });
    expect(await screen.findByRole('heading', { name: 'Submitted (1)' })).toBeInTheDocument();
    expect(calls.slice(-2).map(call => call.searchParams.get('department'))).toEqual(['Sensor Stack', 'Sensor Stack']);
  } finally {
    vi.unstubAllGlobals();
  }
});
