import { fireEvent, render, screen } from '@testing-library/react';
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
    expect(fetch.mock.calls.filter(([url]) => url.endsWith('/attendance/auto-mark'))).toHaveLength(1);
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
