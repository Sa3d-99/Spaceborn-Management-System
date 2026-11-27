import React, { useState, useEffect } from 'react';
import logo from '../../assets/spaceborn-logo.png';
import ForgotPassword from './ForgotPassword';
import ResetPassword from './ResetPassword';
import Signup from './Signup';
import { Eye, EyeOff } from '../Common/Icons';
import { displayTime } from '../../utils/timeZone';
import { normalizeDepartmentFields } from '../../utils/departments';

const apiBase = (process.env.REACT_APP_API_URL || '/api').replace(/\/+$/, '');
const currentPath = () => window.location.pathname.replace(/\/+$/, '') || '/';

const LoginSystem = ({ onLoginSuccess }) => {
  const [employeeId, setEmployeeId] = useState('');
  const [setupEmployeeId, setSetupEmployeeId] = useState(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [challenge, setChallenge] = useState(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [enrolledSession, setEnrolledSession] = useState(null);
  const [pathname, setPathname] = useState(currentPath);

  useEffect(() => {
    const rememberedId = localStorage.getItem('rememberedEmployeeId');
    if (rememberedId) {
      setEmployeeId(rememberedId);
      setRememberMe(true);
    }
  }, []);

  useEffect(() => {
    const syncPath = () => setPathname(currentPath());
    window.addEventListener('popstate', syncPath);
    return () => window.removeEventListener('popstate', syncPath);
  }, []);

  function finishSignIn(data, context) {
    const { user: account, token, expiresAt } = data;
    if (!account || !token) {
      setError('The sign-in service returned an incomplete response. Try again.');
      return;
    }
    const user = normalizeDepartmentFields(account);
    localStorage.setItem('authToken', token);
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('userSession', JSON.stringify({
      ...user,
      isAuthenticated: true,
      timestamp: Date.now(),
      sessionExpiresAt: expiresAt,
      loginTime: displayTime(new Date())
    }));
    if (rememberMe) localStorage.setItem('rememberedEmployeeId', context.identifier);
    else localStorage.removeItem('rememberedEmployeeId');

    if (context.openTeam) navigate('/', true);
    onLoginSuccess(user, context.openTeam);

  }

  async function authenticate(path, credentials, context) {
    setError('');
    setIsLoading(true);
    try {
      const response = await fetch(apiBase + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials)
      });
      const result = await response.json().catch(() => null);
      if (!result) {
        setError('The sign-in service did not respond. Try again when the API is available.');
        return;
      }
      if (!response.ok) {
        setError(result.message || 'Sign-in failed. Try again.');
        if (path === '/auth/two-factor/verify' && response.status === 401 && result.error !== 'INVALID_TWO_FACTOR_CODE') {
          setChallenge(null);
          navigate('/', true);
        }
        return;
      }
      const data = result.data || {};
      if (data.twoFactor) {
        setChallenge({ ...data.twoFactor, ...context });
        setVerificationCode('');
        setPassword('');
        return;
      }
      setChallenge(null);
      setVerificationCode('');
      setPassword('');
      if (data.backupCodes?.length) setEnrolledSession({ data, context });
      else finishSignIn(data, context);
    } catch {
      setError('Could not reach the sign-in service. Check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  }

  const signIn = (identifier, enteredPassword, openTeam = false) => authenticate(
    '/auth/login', { employeeId: identifier.trim(), password: enteredPassword }, { identifier, openTeam }
  );

  const verifyCode = event => {
    event.preventDefault();
    const { challengeToken, identifier, openTeam } = challenge;
    authenticate('/auth/two-factor/verify', { challengeToken, code: verificationCode }, { identifier, openTeam });
  };

  const handleSubmit = event => {
    event.preventDefault();
    if (!employeeId.trim() || !password) {
      setError('Please provide employee ID and password');
      return;
    }
    signIn(employeeId, password, employeeId.trim().toUpperCase() === setupEmployeeId);
  };

  const handleSetupComplete = async (identifier, newPassword) => {
    setSetupEmployeeId(identifier);
    setEmployeeId(identifier);
    await signIn(identifier, newPassword, true);
  };

  const navigate = (path, replace = false) => {
    if (replace) window.history.replaceState(window.history.state, '', path);
    else window.history.pushState(window.history.state, '', path);
    setPathname(path);
  };

  const handleBackToLogin = () => {
    navigate('/', true);
    setError('');
  };

  if (challenge || enrolledSession) {
    return (
      <main className="grid min-h-screen place-items-center bg-base-200 p-4">
        <section className="card w-full max-w-md border border-base-300 bg-base-100">
          <div className="card-body gap-4">
            <h1 className="card-title">{enrolledSession ? 'Save your backup codes' : 'Two-factor authentication'}</h1>
            {error && <p className="alert alert-error" role="alert">{error}</p>}
            {enrolledSession ? (
              <>
                <p>Keep these codes somewhere safe. Each one can be used once if you lose access to your authenticator.</p>
                <ul className="grid grid-cols-2 gap-2 rounded-box bg-base-200 p-3 font-mono">
                  {enrolledSession.data.backupCodes.map(code => <li key={code}>{code}</li>)}
                </ul>
                <button type="button" className="btn btn-neutral"
                  onClick={() => finishSignIn(enrolledSession.data, enrolledSession.context)}>I saved my codes</button>
              </>
            ) : (
              <form className="grid gap-4" onSubmit={verifyCode}>
                {challenge.setup && (
                  <div>
                    <p>Add a time-based account to your authenticator app. Use {challenge.accountLabel} as the account name.</p>
                    <p className="mt-2 break-all rounded-box bg-base-200 p-3 font-mono">{challenge.setupKey}</p>
                  </div>
                )}
                <label className="grid gap-1">
                  {challenge.setup ? 'Authenticator code' : 'Authenticator or backup code'}
                  <input className="input w-full" autoComplete="one-time-code" autoCapitalize="characters"
                    inputMode={challenge.setup ? 'numeric' : 'text'} maxLength={challenge.setup ? 6 : 11} value={verificationCode}
                    onChange={event => setVerificationCode(event.target.value)} required />
                </label>
                <button className="btn btn-neutral" type="submit" disabled={isLoading}>Verify</button>
                <button className="btn btn-ghost" type="button" disabled={isLoading} onClick={() => {
                  setChallenge(null);
                  setVerificationCode('');
                  handleBackToLogin();
                }}>Back to sign in</button>
              </form>
            )}
          </div>
        </section>
      </main>
    );
  }

  if (pathname === '/signup') return <Signup onBack={handleBackToLogin} />;
  if (pathname === '/forgot-password') {
    return <ForgotPassword initialEmployeeId={employeeId} onBackToLogin={handleBackToLogin} />;
  }
  if (pathname === '/reset-password') {
    return <ResetPassword onBackToLogin={handleBackToLogin} onSetupComplete={handleSetupComplete}
      onRequestNewLink={() => navigate('/forgot-password', true)} />;
  }

  return (
    <div className="min-h-screen bg-base-200 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src={logo} alt="Spaceborn" className="h-24 w-auto mx-auto mb-4" />
          <p className="text-gray-500">Workforce & Platform and DevOps Management System</p>
        </div>

        <div className="card block bg-base-100 shadow-sm border border-base-300 p-8">
          <div className="text-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Employee Login</h2>
            <p className="text-sm text-gray-500 mt-1">Shift hours 8:00 AM – 12:00 AM IST</p>
          </div>
          
          {error && (
            <div className="alert alert-error mb-4 text-sm" role="alert">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="login-id">Employee ID or email</label>
              <input
                id="login-id"
                type="text"
                autoComplete="username"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                className="input w-full"
                placeholder="Employee ID or email"
                required
                disabled={isLoading}
                autoCapitalize="none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="login-password">Password</label>
              <div className="relative">
                <input
                  id="login-password"
                  autoComplete="current-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input w-full pr-12"
                  placeholder="Enter your password"
                  required
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="btn btn-ghost btn-sm absolute right-1 top-1/2 -translate-y-1/2"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff /> : <Eye />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={rememberMe}
                  onChange={event => {
                  setRememberMe(event.target.checked);
                  if (!event.target.checked) localStorage.removeItem('rememberedEmployeeId');
                }}
                  className="checkbox checkbox-sm"
                  disabled={isLoading}
                />
                <span className="text-sm text-gray-600">Remember me</span>
              </label>
              <button 
                type="button" 
                className="link link-hover text-sm"
                onClick={() => navigate('/forgot-password')}
                disabled={isLoading}
              >
                Forgot password?
              </button>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn btn-neutral w-full mt-6"
            >
              {isLoading ? (
                <>
                  <span className="loading loading-spinner h-5 w-5 text-white" aria-hidden="true" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <span>Login</span>
              )}
            </button>
          </form>

          <button type="button" className="btn btn-outline w-full mt-3" onClick={() => navigate('/signup')}>Request an account</button>

        </div>


      </div>
    </div>
  );
};

export default LoginSystem;
