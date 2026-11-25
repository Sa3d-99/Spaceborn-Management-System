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
    if (url.endsWith('/team-members/mine')) {
      expect(options.headers.Authorization).toBe('Bearer fixture-session');
      return json({ department: member.department, members: [member] });
    }
    return json([]);
  });
  vi.stubGlobal('fetch', fetch);
  window.history.replaceState(null, '', `/reset-password#token=${signupToken}`);
  try {
    render(<App />);
    fireEvent.change(await screen.findByLabelText('New password', { exact: true }), { target: { value: password } });
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: password } });
    fireEvent.click(screen.getByRole('button', { name: 'Update password' }));
    expect(await screen.findByRole('heading', { name: 'Sensor Stack' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'My Team' })).toHaveAttribute('aria-current', 'page');
    expect(window.location.pathname).toBe('/');
  } finally {
    localStorage.clear();
    vi.unstubAllGlobals();
    window.history.replaceState(null, '', '/');
  }
});
