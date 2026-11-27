import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import ForgotPassword from './ForgotPassword';
import ResetPassword from './ResetPassword';

const token = 'a'.repeat(64);
const password = 'a new private test passphrase';
const json = (body, status = 200) => new Response(JSON.stringify(body), { status });

function renderReset(hash = `#token=${token}`) {
  window.history.replaceState(null, '', '/reset-password' + hash);
  const onBackToLogin = vi.fn();
  const onRequestNewLink = vi.fn();
  render(<ResetPassword onBackToLogin={onBackToLogin} onRequestNewLink={onRequestNewLink} />);
  return { onBackToLogin, onRequestNewLink };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState(null, '', '/');
});

test('requesting a reset uses the entered identity and shows the generic email confirmation', async () => {
  const message = 'Request received. Only active, registered CRM accounts receive a reset link at their saved email address.';
  const fetch = vi.fn().mockResolvedValue(json({ success: true, message }, 202));
  vi.stubGlobal('fetch', fetch);
  render(<ForgotPassword initialEmployeeId=" employee@example.test " onBackToLogin={vi.fn()} />);

  fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }));
  expect(await screen.findByRole('status')).toHaveTextContent(message);
  expect(screen.getByRole('status')).toHaveClass('alert-info');
  expect(fetch.mock.calls[0][0]).toMatch(/\/auth\/forgot-password$/);
  expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ employeeId: 'employee@example.test' });
});

test('missing and rejected reset links offer a new request without showing password fields', async () => {
  const fetch = vi.fn().mockResolvedValue(json({ success: false, error: 'INVALID_RESET_LINK' }, 400));
  vi.stubGlobal('fetch', fetch);

  renderReset('');
  expect(screen.getByRole('alert')).toHaveTextContent('invalid or has expired');
  expect(fetch).not.toHaveBeenCalled();
  cleanup();

  const { onRequestNewLink } = renderReset();
  expect(await screen.findByRole('alert')).toHaveTextContent('invalid or has expired');
  expect(screen.queryByLabelText('New password', { exact: true })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Request a new link' }));
  expect(onRequestNewLink).toHaveBeenCalledOnce();
});

test('a valid link is removed from the address bar and requires matching passwords before submission', async () => {
  const fetch = vi.fn()
    .mockResolvedValueOnce(json({ success: true, message: 'Reset link is valid.' }))
    .mockResolvedValueOnce(json({ success: true, message: 'Password updated. Sign in with your new password.' }));
  vi.stubGlobal('fetch', fetch);
  const { onBackToLogin } = renderReset();

  fireEvent.change(await screen.findByLabelText('New password', { exact: true }), { target: { value: password } });
  expect(window.location.hash).toBe('');
  fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'a different passphrase' } });
  fireEvent.click(screen.getByRole('button', { name: 'Update password' }));
  expect(screen.getByRole('alert')).toHaveTextContent('The passwords must match.');
  expect(fetch).toHaveBeenCalledTimes(1);

  fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: password } });
  fireEvent.click(screen.getByRole('button', { name: 'Update password' }));
  expect(await screen.findByRole('status')).toHaveTextContent('Password updated');
  expect(fetch.mock.calls[1][0]).toMatch(/\/auth\/reset-password$/);
  expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({ token, newPassword: password });
  fireEvent.click(screen.getByRole('button', { name: 'Sign in', exact: true }));
  expect(onBackToLogin).toHaveBeenCalledOnce();
});
