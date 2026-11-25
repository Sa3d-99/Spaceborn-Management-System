const apiBase = (process.env.REACT_APP_API_URL || '/api').trim().replace(/\/+$/, '') || '/api';

async function postRecovery(path, body, signal) {
  let response;
  try {
    response = await fetch(`${apiBase}/auth/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal
    });
  } catch {
    throw new Error('Could not reach the password reset service. Try again.');
  }

  const result = await response.json().catch(() => null);
  if (!result) throw new Error('Could not reach the password reset service. Try again.');
  if (!response.ok || result.success === false) {
    const error = new Error(result.message || 'Password reset is temporarily unavailable. Try again.');
    error.code = result.error;
    throw error;
  }
  return result;
}

export const requestResetLink = employeeId => postRecovery('forgot-password', { employeeId });
export const validateResetLink = (token, signal) => postRecovery('reset-password/validate', { token }, signal);
export const setNewPassword = (token, newPassword) => postRecovery('reset-password', { token, newPassword });
