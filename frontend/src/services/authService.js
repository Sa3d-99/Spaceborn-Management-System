import { displayDateTime } from '../utils/timeZone';
// src/services/authService.js
import { normalizeDepartmentFields } from '../utils/departments';

class AuthService {
  constructor() {
    // Configuration from environment variables
    this.API_BASE_URL = process.env.REACT_APP_API_URL || '/api';
    this.SESSION_TIMEOUT = parseInt(process.env.REACT_APP_SESSION_TIMEOUT) || 8 * 60 * 60 * 1000; // 8 hours
    this.TOKEN_REFRESH_THRESHOLD = parseInt(process.env.REACT_APP_TOKEN_REFRESH_THRESHOLD) || 60 * 60 * 1000; // 1 hour
    this.MAX_LOGIN_ATTEMPTS = parseInt(process.env.REACT_APP_MAX_LOGIN_ATTEMPTS) || 5;
    this.LOCKOUT_DURATION = parseInt(process.env.REACT_APP_LOCKOUT_DURATION) || 15 * 60 * 1000; // 15 minutes
    
    // Track login attempts
    this.loginAttempts = 0;
    this.lockoutUntil = null;
    
    
    // Bind methods
    this.login = this.login.bind(this);
    this.logout = this.logout.bind(this);
    this.verifyToken = this.verifyToken.bind(this);
    this.changePassword = this.changePassword.bind(this);
    this.forgotPassword = this.forgotPassword.bind(this);
    this.refreshToken = this.refreshToken.bind(this);
    this.getActiveSessions = this.getActiveSessions.bind(this);
    this.getLoginHistory = this.getLoginHistory.bind(this);
    this.forceLogout = this.forceLogout.bind(this);
    this.getActiveSessionsCount = this.getActiveSessionsCount.bind(this);
    this.getUserSessions = this.getUserSessions.bind(this);
    

  }

  // Helper method to get auth headers
  getAuthHeaders() {
    const token = this.getToken();
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    };
  }

  // Get token from localStorage
  getToken() {
    return localStorage.getItem('authToken');
  }

  // Get user from localStorage
  getUser() {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        return normalizeDepartmentFields(JSON.parse(userStr));
      } catch (error) {
        console.error('Error parsing user data:', error);
        this.clearSession();
        return null;
      }
    }
    return null;
  }

  // Store session data
  setSession(user, token, rememberMe = false) {
    const sessionDuration = rememberMe ? 30 * 24 * 60 * 60 * 1000 : this.SESSION_TIMEOUT; // 30 days if remember me
    
    if (token) {
      localStorage.setItem('authToken', token);
    }
    if (user) {
      const normalizedUser = normalizeDepartmentFields(user);
      localStorage.setItem('user', JSON.stringify(normalizedUser));
      localStorage.setItem('userSession', JSON.stringify({
        ...normalizedUser,
        isAuthenticated: true,
        timestamp: Date.now(),
        sessionDuration,
        rememberMe
      }));
    }
  }

  // Clear session data
  clearSession() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    localStorage.removeItem('userSession');
  }

  // Check if account is locked
  isAccountLocked() {
    if (this.lockoutUntil && Date.now() < this.lockoutUntil) {
      const remainingMinutes = Math.ceil((this.lockoutUntil - Date.now()) / 60000);
      return { locked: true, remainingMinutes };
    }
    return { locked: false };
  }

  // Reset login attempts
  resetLoginAttempts() {
    this.loginAttempts = 0;
    this.lockoutUntil = null;
  }

  // Generate random password
  generateRandomPassword() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%';
    let password = '';
    for (let i = 0; i < 10; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }

  // Login user with Employee ID
  async login(employeeId, password, rememberMe = false) {
    
    if (!employeeId || !password) {
      return { success: false, error: 'Employee ID and password are required' };
    }

    const lockStatus = this.isAccountLocked();
    if (lockStatus.locked) {
      return { 
        success: false, 
        error: `Too many failed attempts. Account locked for ${lockStatus.remainingMinutes} minutes.` 
      };
    }

    try {
      const response = await fetch(`${this.API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          employeeId: employeeId.toUpperCase().trim(), 
          password, 
          rememberMe 
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        this.loginAttempts++;
        
        if (this.loginAttempts >= this.MAX_LOGIN_ATTEMPTS) {
          this.lockoutUntil = Date.now() + this.LOCKOUT_DURATION;
          throw new Error(`Too many failed attempts. Account locked for ${this.LOCKOUT_DURATION / 60000} minutes.`);
        }
        
        const remainingAttempts = this.MAX_LOGIN_ATTEMPTS - this.loginAttempts;
        switch (response.status) {
          case 401:
            throw new Error(`Invalid Employee ID or Password. ${remainingAttempts} attempts remaining.`);
          case 403:
            throw new Error('Account is locked. Please contact your manager.');
          case 429:
            throw new Error('Too many login attempts. Please try again later.');
          default:
            throw new Error(data.message || 'Login failed');
        }
      }

      this.resetLoginAttempts();

      if (!data.data?.token || !data.data?.user) {
        throw new Error('Invalid response from server');
      }

      if (rememberMe) {
        localStorage.setItem('rememberedEmployeeId', employeeId);
      } else {
        localStorage.removeItem('rememberedEmployeeId');
      }

      const normalizedUser = normalizeDepartmentFields(data.data.user);
      this.setSession(normalizedUser, data.data.token, rememberMe);

      return { 
        success: true, 
        user: normalizedUser,
        message: 'Login successful'
      };
    } catch (error) {
      console.error('Sign-in request failed.');
      return { success: false, error: error.message };
    }
  }

  // Get remembered employee ID
  getRememberedEmployeeId() {
    return localStorage.getItem('rememberedEmployeeId') || '';
  }

  // Logout user
  async logout() {
    
    const token = this.getToken();
    
    try {
      if (token) {
        await fetch(`${this.API_BASE_URL}/auth/logout`, {
          method: 'POST',
          headers: this.getAuthHeaders(),
        }).catch(err => console.error('Logout API error:', err));
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      this.clearSession();
    }
  }

  // Verify token and get user data
  async verifyToken({ signal } = {}) {
    
    const token = this.getToken();
    
    if (!token) {
      return { success: false, error: 'No authentication token found' };
    }

    const storedSession = localStorage.getItem('userSession');
    let session = {};
    if (storedSession) {
      try {
        session = JSON.parse(storedSession);
        if (Number.isFinite(session.sessionExpiresAt) && Date.now() >= session.sessionExpiresAt) {
          this.clearSession();
          return { success: false, error: 'Session expired' };
        }
      } catch (error) {
        console.error('Session parsing error:', error);
        this.clearSession();
        return { success: false, error: 'Invalid session data' };
      }
    }

    try {
      const response = await fetch(`${this.API_BASE_URL.replace(/\/+$/, '')}/auth/verify`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
        signal
      });

      if (signal?.aborted) throw new Error('Session check canceled');
      if (this.getToken() !== token) return { success: false, error: 'Session changed' };
      if (response.status === 401) {
        this.clearSession();
        return { success: false, error: 'Session expired. Sign in again.' };
      }
      if (!response.ok) throw new Error('Token verification failed');

      const data = await response.json();
      const user = data.data ?? data.user;
      if (!data.success || !user?.role) throw new Error('Token verification response is incomplete');
      if (signal?.aborted) throw new Error('Session check canceled');
      if (this.getToken() !== token) return { success: false, error: 'Session changed' };

      const normalizedUser = normalizeDepartmentFields(user);
      localStorage.setItem('user', JSON.stringify(normalizedUser));
      localStorage.setItem('userSession', JSON.stringify({
        ...session,
        ...normalizedUser,
        isAuthenticated: true,
        timestamp: session.timestamp ?? Date.now()
      }));
      return { success: true, user: normalizedUser };
    } catch {
      return { success: false, retryable: true, error: 'Could not verify your session. Try again.' };
    }
  }

  // Change password for current user
  async changePassword(currentPassword, newPassword) {
    
    const token = this.getToken();
    
    if (!token) {
      return { success: false, error: 'Not authenticated' };
    }

    if (!currentPassword || !newPassword) {
      return { success: false, error: 'All password fields are required' };
    }

    if ([...newPassword.normalize('NFC')].length < 8 || [...newPassword.normalize('NFC')].length > 64) {
      return { success: false, error: 'Use 8 to 64 characters for the new password.' };
    }

    if (currentPassword === newPassword) {
      return { success: false, error: 'New password must be different from current password' };
    }
    
    try {
      const response = await fetch(`${this.API_BASE_URL}/auth/change-password`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Current password is incorrect');
        }
        throw new Error(data.message || 'Password change failed');
      }

      return { 
        success: true, 
        message: data.message || 'Password changed successfully' 
      };
    } catch (error) {
      console.error('Password change error:', error);
      return { success: false, error: error.message };
    }
  }

  async forgotPassword(employeeId) {
    try {
      const response = await fetch(`${this.API_BASE_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId })
      });
      const result = await response.json();
      return response.ok ? result : { success: false, error: result.message };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Refresh token
  async refreshToken() {
    
    const token = this.getToken();
    
    if (!token) {
      return { success: false, error: 'No token found' };
    }

    try {
      const response = await fetch(`${this.API_BASE_URL}/auth/refresh-token`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          this.clearSession();
        }
        throw new Error(data.message || 'Token refresh failed');
      }

      if (data.token) {
        localStorage.setItem('authToken', data.token);
        const session = localStorage.getItem('userSession');
        if (session) {
          const sessionData = JSON.parse(session);
          localStorage.setItem('userSession', JSON.stringify({
            ...sessionData,
            timestamp: Date.now()
          }));
        }
        return { success: true, token: data.token };
      }
      
      return { success: false, error: 'No token received' };
    } catch (error) {
      console.error('Token refresh error:', error);
      return { success: false, error: error.message };
    }
  }

  // Get current user from localStorage
  getCurrentUser() {
    return this.getUser();
  }

  // Check if user is authenticated
  isAuthenticated() {
    const token = this.getToken();
    const session = localStorage.getItem('userSession');
    
    if (!token || !session) {
      return false;
    }

    try {
      const sessionData = JSON.parse(session);
      const sessionAge = Date.now() - sessionData.timestamp;
      const timeout = sessionData.rememberMe ? sessionData.sessionDuration : this.SESSION_TIMEOUT;
      
      if (sessionAge >= timeout) {
        this.clearSession();
        return false;
      }
    } catch (error) {
      return false;
    }
    
    return true;
  }

  // Get user role
  getUserRole() {
    const user = this.getUser();
    return user ? user.role : null;
  }

  // Check if user has specific role
  hasRole(role) {
    const userRole = this.getUserRole();
    return userRole === role;
  }

  // Check if user has any of the specified roles
  hasAnyRole(roles) {
    const userRole = this.getUserRole();
    return roles.includes(userRole);
  }

  // Update user data in localStorage
  updateUser(userData) {
    const currentUser = this.getUser();
    if (currentUser) {
      const updatedUser = normalizeDepartmentFields({ ...currentUser, ...userData });
      localStorage.setItem('user', JSON.stringify(updatedUser));
      const session = localStorage.getItem('userSession');
      if (session) {
        const sessionData = JSON.parse(session);
        localStorage.setItem('userSession', JSON.stringify({
          ...sessionData,
          ...updatedUser,
          timestamp: Date.now()
        }));
      }
      return true;
    }
    return false;
  }

  // Get session time remaining in minutes
  getSessionTimeRemaining() {
    const session = localStorage.getItem('userSession');
    if (!session) return 0;
    
    try {
      const sessionData = JSON.parse(session);
      const sessionAge = Date.now() - sessionData.timestamp;
      const timeout = sessionData.rememberMe ? sessionData.sessionDuration : this.SESSION_TIMEOUT;
      const remaining = timeout - sessionAge;
      
      return Math.max(0, Math.floor(remaining / 60000));
    } catch (error) {
      return 0;
    }
  }

  // Check if mock mode is enabled
  isMockMode() {
    return false;
  }

  // Get all mock users (for manager to reset passwords)
  getMockUsers() {
    return {};
  }

  // ========== LOGIN MANAGEMENT METHODS ==========

  // Get all active sessions (Manager/Admin only)
  async getActiveSessions() {
    
    const token = this.getToken();
    if (!token) {
      throw new Error('Not authenticated');
    }
    
    try {
      const response = await fetch(`${this.API_BASE_URL}/auth/sessions/active`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch active sessions');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching active sessions:', error);
      throw error;
    }
  }

  // Get login history
  async getLoginHistory(params = {}) {
    
    const token = this.getToken();
    if (!token) {
      throw new Error('Not authenticated');
    }
    
    try {
      const queryString = new URLSearchParams(params).toString();
      const url = `${this.API_BASE_URL}/auth/login-history${queryString ? `?${queryString}` : ''}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch login history');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching login history:', error);
      throw error;
    }
  }

  // Force logout a user (Manager/Admin only)
  async forceLogout(sessionId) {
    
    const token = this.getToken();
    if (!token) {
      throw new Error('Not authenticated');
    }
    
    const currentUser = this.getCurrentUser();
    if (!currentUser || (currentUser.role !== 'CEO' && currentUser.role !== 'Manager' && currentUser.role !== 'COO')) {
      throw new Error('Only CEO, COO and Managers can force logout users');
    }
    
    try {
      const response = await fetch(`${this.API_BASE_URL}/auth/sessions/${sessionId}/revoke`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to force logout');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error force logging out:', error);
      throw error;
    }
  }

  // Get active sessions count
  async getActiveSessionsCount() {
    
    const token = this.getToken();
    if (!token) {
      return { count: 0 };
    }
    
    try {
      const response = await fetch(`${this.API_BASE_URL}/auth/sessions/active/count`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch sessions count');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching sessions count:', error);
      return { count: 0 };
    }
  }

  // Get session details for a specific user (Manager/Admin only)
  async getUserSessions(employeeId) {
    
    const token = this.getToken();
    if (!token) {
      throw new Error('Not authenticated');
    }
    
    try {
      const response = await fetch(`${this.API_BASE_URL}/auth/users/${employeeId}/sessions`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch user sessions');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching user sessions:', error);
      throw error;
    }
  }
}

export default new AuthService();
