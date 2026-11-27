import { fireEvent, render, screen } from '@testing-library/react';
import { utils, writeFile } from 'xlsx';
import RecordedActivity from './RecordedActivity';

vi.mock('xlsx', async importOriginal => ({
  ...(await importOriginal()),
  writeFile: vi.fn()
}));

test('activity exports contain the same recorded, filtered rows as the activity table', async () => {
  vi.stubGlobal('fetch', vi.fn(async url => {
    expect(url).toMatch(/\/dashboard\/activity\?days=7$/);
    return Response.json({ success: true, data: [
      { id: 'signin', name: 'Actual Intern', employeeId: 'INT001', role: 'Member', department: 'Sensor Stack', action: 'login', timestamp: '2026-11-27T08:00:00Z' },
      { id: 'attendance', name: 'Actual Lead', employeeId: 'LD001', role: 'Team Lead', department: 'Sensor Stack', action: 'check-in', timestamp: '2026-11-27T08:10:00Z' }
    ] });
  }));
  const createObjectURL = vi.fn(() => 'blob:activity');
  const URLWithDownload = class extends URL {};
  URLWithDownload.createObjectURL = createObjectURL;
  URLWithDownload.revokeObjectURL = vi.fn();
  vi.stubGlobal('URL', URLWithDownload);
  const download = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

  try {
    render(<RecordedActivity />);
    expect(await screen.findByText('Actual Intern')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Activity'), { target: { value: 'check-in' } });
    expect(screen.queryByText('Actual Intern')).not.toBeInTheDocument();
    expect(screen.getByText('Actual Lead')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Export Excel' }));
    const [workbook, filename] = writeFile.mock.calls[0];
    expect(filename).toBe('spaceborn-activity.xlsx');
    expect(utils.sheet_to_json(workbook.Sheets.Activity)).toEqual([
      expect.objectContaining({ Employee: 'Actual Lead', 'Employee ID': 'LD001', Role: 'Team Lead', Activity: 'Checked in' })
    ]);

    fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));
    const csv = createObjectURL.mock.calls[0][0];
    const text = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsText(csv);
    });
    expect(text).toContain('"Actual Lead","LD001","Team Lead","Sensor Stack","Checked in"');
    expect(text).not.toContain('Actual Intern');
    expect(download).toHaveBeenCalledTimes(1);
  } finally {
    download.mockRestore();
    vi.unstubAllGlobals();
  }
});

test('activity shows a clear error after an API failure and does not render demo records', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 503 })));
  try {
    render(<RecordedActivity />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load recorded activity.');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export Excel' })).toBeDisabled();
  } finally {
    vi.unstubAllGlobals();
  }
});
