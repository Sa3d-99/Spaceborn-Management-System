import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import App from './App';

test('shows the employee login when there is no active session', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: 'Employee Login' })).toBeInTheDocument();
});

test('a new signup opens its own team after password creation', async () => {
  const signupToken = 'a'.repeat(64);
  const password = 'a new team member passphrase';
  const member = { id: 'member-1', employeeId: 'INTS01', name: 'New Member', role: 'Member', department: 'Sensor Stack' };
  const json = (data, message) => new Response(JSON.stringify({ success: true, message, data }), {
    headers: { 'Content-Type': 'application/json' }
  });
  const fetch = vi.fn(async (url, options) => {
    if (url.endsWith('/reset-password/validate')) return json(null);
    if (url.endsWith('/reset-password')) return json({ setupEmployeeId: member.employeeId }, 'Password created.');
    if (url.endsWith('/auth/login')) {
      expect(JSON.parse(options.body)).toEqual({ employeeId: member.employeeId, password });
      return json({ token: 'fixture-session', user: member });
    }
    if (url.endsWith('/auth/verify')) {
      expect(options.headers.Authorization).toBe('Bearer fixture-session');
      return json(member);
    }
    if (url.endsWith('/team-members/mine')) {
      expect(options.headers.Authorization).toBe('Bearer fixture-session');
      return json({ department: member.department, members: [member] });
    }
    return json([]);
  });
  vi.stubGlobal('fetch', fetch);
  localStorage.setItem('authToken', 'previous-session');
  window.history.replaceState(null, '', `/reset-password#token=${signupToken}`);
  try {
    const initial = render(<App />);
    fireEvent.change(await screen.findByLabelText('New password', { exact: true }), { target: { value: password } });
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: password } });
    fireEvent.click(screen.getByRole('button', { name: 'Update password' }));
    expect(await screen.findByRole('heading', { name: 'Sensor Stack' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'My Team' })).toHaveAttribute('aria-current', 'page');
    expect(window.location.pathname).toBe('/');

    initial.unmount();
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Sensor Stack' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'My Team' })).toHaveAttribute('aria-current', 'page');
    expect(fetch.mock.calls.filter(([url]) => url.endsWith('/auth/login'))).toHaveLength(1);
    expect(fetch.mock.calls.some(([url]) => url.endsWith('/attendance/auto-mark'))).toBe(false);
  } finally {
    localStorage.clear();
    sessionStorage.clear();
    vi.unstubAllGlobals();
    window.history.replaceState(null, '', '/');
  }
});

test('a rejected session returns to login and clears the saved authentication', async () => {
  localStorage.setItem('authToken', 'fixture-rejected-token');
  localStorage.setItem('user', JSON.stringify({ id: 'fixture', role: 'CEO' }));
  localStorage.setItem('userSession', JSON.stringify({ timestamp: Date.now() }));
  const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 401 }));
  vi.stubGlobal('fetch', fetch);
  try {
    render(<App />);
    expect(screen.queryByRole('heading', { name: 'Employee Login' })).not.toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Employee Login' })).toBeInTheDocument();
    expect(fetch.mock.calls[0][0]).toMatch(/\/auth\/verify$/);
    expect(localStorage.getItem('authToken')).toBeNull();
    expect(screen.queryByRole('navigation', { name: 'Dashboard navigation' })).not.toBeInTheDocument();
  } finally {
    localStorage.clear();
    vi.unstubAllGlobals();
  }
});

test('a temporary session check failure offers retry and keeps the saved token', async () => {
  localStorage.setItem('authToken', 'fixture-retry-token');
  const fetch = vi.fn()
    .mockResolvedValueOnce(new Response(null, { status: 503 }))
    .mockResolvedValueOnce(new Response(null, { status: 401 }));
  vi.stubGlobal('fetch', fetch);
  try {
    render(<App />);
    const retry = await screen.findByRole('button', { name: 'Try again' });
    expect(localStorage.getItem('authToken')).toBe('fixture-retry-token');
    fireEvent.click(retry);
    expect(await screen.findByRole('heading', { name: 'Employee Login' })).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(localStorage.getItem('authToken')).toBeNull();
  } finally {
    localStorage.clear();
    vi.unstubAllGlobals();
  }
});

test('the HR dashboard shows the HR menu and one complete sidebar account block', async () => {
  const user = { id: 'hr-test', employeeId: 'HR099', name: 'HR Reviewer', role: 'HR', department: 'Operations & Management' };
  vi.stubGlobal('fetch', vi.fn(async (url) => Response.json({
    success: true, data: url.endsWith('/auth/verify') ? user : null
  })));
  localStorage.setItem('authToken', 'fixture-hr-session');
  window.history.replaceState(null, '', '/');
  try {
    render(<App />);
    const sidebar = await screen.findByRole('complementary');
    expect(within(sidebar).getByRole('button', { name: 'Employee Database' })).toBeInTheDocument();
    expect(within(sidebar).getByRole('button', { name: 'Import from Excel' })).toBeInTheDocument();
    expect(within(sidebar).getByRole('button', { name: 'Attendance' })).toBeInTheDocument();
    expect(within(sidebar).queryByRole('button', { name: 'My Tasks' })).not.toBeInTheDocument();
    expect(within(sidebar).getAllByText(user.name)).toHaveLength(1);
    expect(within(sidebar).getByRole('button', { name: 'Logout' })).toBeInTheDocument();
    expect(within(within(sidebar).getByRole('list', { name: 'Company role levels' }))
      .getAllByRole('listitem').map(item => item.textContent)).toEqual(
      ['CEO', 'Director', 'Team Lead', 'Co-Lead', 'Project Manager', 'Intern']
    );
    expect(within(screen.getByRole('main')).getByText(user.name)).toBeInTheDocument();
    expect(within(screen.getByRole('main')).getByText(user.department)).toBeInTheDocument();
  } finally {
    localStorage.clear();
    sessionStorage.clear();
    vi.unstubAllGlobals();
    window.history.replaceState(null, '', '/');
  }
});

test('the header shows self attendance and the time-zone control belongs to My Profile', async () => {
  const user = { id: 'intern-header', employeeId: 'INT099', name: 'Header Reviewer', role: 'Member', timeZone: 'UTC' };
  const fetch = vi.fn(async (url, options) => {
    let data = null;
    if (url.endsWith('/auth/verify')) data = user;
    if (url.endsWith('/dashboard/member')) data = { myTasks: [], profile: {}, sprintOverview: {}, upcomingDeadlines: [] };
    if (url.endsWith('/attendance/auto-mark')) {
      expect(options.method).toBe('POST');
      data = { checkInTime: new Date(Date.now() - 5_400_000).toISOString(), status: 'present' };
    }
    if (url.endsWith('/auth/preferences')) {
      expect(JSON.parse(options.body)).toEqual({ timeZone: 'Asia/Kolkata' });
      data = { timeZone: 'Asia/Kolkata' };
    }
    return Response.json({ success: true, data });
  });
  vi.stubGlobal('fetch', fetch);
  localStorage.setItem('authToken', 'fixture-attendance-session');
  window.history.replaceState(null, '', '/');
  try {
    render(<App />);
    const header = await screen.findByRole('banner');
    expect(within(header).getByText('Online')).toBeInTheDocument();
    expect(within(header).getByText('Active Working Hours: 0h 00m')).toBeInTheDocument();
    expect(within(header).queryByLabelText('Time zone')).not.toBeInTheDocument();
    fireEvent.click(within(header).getByRole('button', { name: 'Mark Attendance' }));
    expect(await within(header).findByText(/Active Working Hours: (?:1h 29m|1h 30m)/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'My Profile' }));
    expect(screen.getByRole('heading', { name: 'Change password' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Time zone'), { target: { value: 'Asia/Kolkata' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save time zone' }));
    expect(await screen.findByText('Time zone saved.')).toBeInTheDocument();
  } finally {
    localStorage.clear();
    sessionStorage.clear();
    vi.unstubAllGlobals();
    window.history.replaceState(null, '', '/');
  }
});

test('legacy temporary credentials gate restored sessions before the dashboard loads', async () => {
  const user = { id: 'temporary-member', employeeId: 'INT100', name: 'Temporary Member', role: 'Member', mustChangePassword: true };
  const fetch = vi.fn(async () => Response.json({ success: true, data: user }));
  vi.stubGlobal('fetch', fetch);
  localStorage.setItem('authToken', 'fixture-temporary-session');
  window.history.replaceState(null, '', '/');
  try {
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Change your temporary password' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Dashboard navigation' })).not.toBeInTheDocument();
    expect(fetch.mock.calls.map(([url]) => url)).toEqual([expect.stringMatching(/\/auth\/verify$/)]);
  } finally {
    localStorage.clear();
    sessionStorage.clear();
    vi.unstubAllGlobals();
    window.history.replaceState(null, '', '/');
  }
});

test('a session rejected while a dashboard is opening returns to sign-in without a logout request', async () => {
  const user = { id: 'manager-revoked', employeeId: 'PM098', name: 'Manager Fixture', role: 'Manager' };
  const fetch = vi.fn(async url => {
    if (url.endsWith('/dashboard/manager')) return new Response(null, { status: 401 });
    return Response.json({ success: true, data: url.endsWith('/auth/verify') ? user : null });
  });
  vi.stubGlobal('fetch', fetch);
  localStorage.setItem('authToken', 'fixture-revoked-session');
  localStorage.setItem('rememberedEmployeeId', user.employeeId);
  window.history.replaceState(null, '', '/');
  try {
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Employee Login' })).toBeInTheDocument();
    expect(localStorage.getItem('authToken')).toBeNull();
    expect(localStorage.getItem('rememberedEmployeeId')).toBe(user.employeeId);
    expect(fetch.mock.calls.some(([url]) => url.endsWith('/auth/logout'))).toBe(false);
  } finally {
    localStorage.clear();
    sessionStorage.clear();
    vi.unstubAllGlobals();
    window.history.replaceState(null, '', '/');
  }
});

test('dashboard sections follow the logo and browser history while keeping the verified session', async () => {
  const user = { id: 'manager-test', employeeId: 'PM099', name: 'Project Reviewer', role: 'Manager' };
  vi.stubGlobal('fetch', vi.fn(async (url) => Response.json({
    success: true, data: url.endsWith('/auth/verify') ? user : []
  })));
  localStorage.setItem('authToken', 'fixture-manager-session');
  window.history.replaceState(null, '', '/');
  try {
    render(<App />);
    const navigation = await screen.findByRole('navigation', { name: 'Dashboard navigation' });
    const login = within(navigation).getByRole('button', { name: 'Login Management' });
    const dashboard = within(navigation).getByRole('button', { name: 'Dashboard' });
    fireEvent.click(login);
    expect(login).toHaveAttribute('aria-current', 'page');
    fireEvent.click(screen.getByRole('button', { name: 'Spaceborn dashboard' }));
    expect(dashboard).toHaveAttribute('aria-current', 'page');
    window.history.back();
    await waitFor(() => expect(login).toHaveAttribute('aria-current', 'page'));
    window.history.forward();
    await waitFor(() => expect(dashboard).toHaveAttribute('aria-current', 'page'));
  } finally {
    localStorage.clear();
    sessionStorage.clear();
    vi.unstubAllGlobals();
    window.history.replaceState(null, '', '/');
  }
});
