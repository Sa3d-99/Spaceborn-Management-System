import React, { useState, useEffect } from 'react';
import logo from '../../assets/spaceborn-logo.png';
import ForgotPassword from './ForgotPassword';
import ResetPassword from './ResetPassword';
import Signup from './Signup';
import { Eye, EyeOff } from '../Common/Icons';
import { displayTime } from '../../utils/timeZone';
import { normalizeDepartmentFields } from '../../utils/departments';

const currentPath = () => window.location.pathname.replace(/\/+$/, '') || '/';

const LoginSystem = ({ onLoginSuccess }) => {
  const [employeeId, setEmployeeId] = useState('');
  const [setupEmployeeId, setSetupEmployeeId] = useState(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [lockoutTime, setLockoutTime] = useState(null);
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

  const isAccountLocked = () => {
    if (isLocked && lockoutTime && Date.now() < lockoutTime) {
      const remainingMinutes = Math.ceil((lockoutTime - Date.now()) / 60000);
      return { locked: true, remainingMinutes };
    }
    return { locked: false };
  };

  // Auto-mark attendance on login
  const markAttendance = async (user, token) => {
    try {
      const API_BASE_URL = (process.env.REACT_APP_API_URL || '/api').replace(/\/+$/, '');
      await fetch(`${API_BASE_URL}/attendance/auto-mark`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          userId: String(user.id),
          userName: user.name,
          employeeId: user.employeeId,
          department: user.department,
          role: user.role
        })
      });
    } catch (e) {
      console.log('Attendance mark skipped:', e.message);
    }
  };

  const signIn = async (identifier, enteredPassword, openTeam = false) => {
    const lockStatus = isAccountLocked();
    if (lockStatus.locked) {
      setError(`Too many failed attempts. Account locked for ${lockStatus.remainingMinutes} minutes.`);
      return;
    }
    
    setError('');
    setIsLoading(true);

    const API_BASE_URL = (process.env.REACT_APP_API_URL || '/api').replace(/\/+$/, '');

    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          employeeId: identifier.trim(),
          password: enteredPassword
        }),
      });

      if (!response.headers.get('content-type')?.includes('application/json')) {
        setError('The sign-in service did not respond. Open the CRM from its running server and try again.');
        return;
      }
      const data = await response.json();

      if (!response.ok && response.status !== 401) {
        setError(data.message || 'Sign-in is temporarily unavailable. Try again.');
        return;
      }
      if (!response.ok) {
        const newAttempts = loginAttempts + 1;
        setLoginAttempts(newAttempts);
        
        if (newAttempts >= 5) {
          const lockDuration = 15 * 60 * 1000;
          setLockoutTime(Date.now() + lockDuration);
          setIsLocked(true);
          setError(`Too many failed attempts. Account locked for 15 minutes.`);
        } else {
          setError(data.message || `Invalid sign-in details. ${5 - newAttempts} attempts remaining.`);
        }
        return;
      }

      setLoginAttempts(0);
      setIsLocked(false);
      
      const { user: account, token } = data.data || {};
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
        loginTime: displayTime(new Date())
      }));

      if (rememberMe) {
        localStorage.setItem('rememberedEmployeeId', identifier);
      } else {
        localStorage.removeItem('rememberedEmployeeId');
      }

      if (openTeam) navigate('/', true);
      onLoginSuccess(user, openTeam);
      markAttendance(user, token);
      
    } catch (error) {
      console.error('Login error:', error);
      setError('Could not reach the sign-in service. Check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = event => {
    event.preventDefault();
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

  const lockStatus = isAccountLocked();

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
            <p className="text-sm text-gray-500 mt-1">Enter your credentials to access your dashboard</p>
          </div>
          
          {error && (
            <div className="alert alert-error mb-4 text-sm" role="alert">
              {error}
            </div>
          )}

          {lockStatus.locked && (
            <div className="alert alert-error mb-4 text-sm" role="alert">
              ⚠️ Account locked for {lockStatus.remainingMinutes} minutes due to multiple failed attempts.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
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
                disabled={isLoading || lockStatus.locked}
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
                  disabled={isLoading || lockStatus.locked}
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
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="checkbox checkbox-sm"
                  disabled={isLoading || lockStatus.locked}
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
              disabled={isLoading || lockStatus.locked}
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
