// src/services/employeeService.js
import authService from './authService';
import { DEPARTMENTS, normalizeDepartment, normalizeDepartmentFields, normalizeDepartments } from '../utils/departments';

class EmployeeService {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes cache
    this.API_BASE_URL = process.env.REACT_APP_API_URL || '/api';
  }

  // Helper method to get cached data
  getCached(key) {
    const cached = this.cache.get(`${authService.getToken()}:${key}`);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    return null;
  }

  // Helper method to set cached data
  setCached(key, data) {
    this.cache.set(`${authService.getToken()}:${key}`, { data, timestamp: Date.now() });
  }

  // Clear specific cache or all cache
  clearCache(key = null) {
    if (key) {
      this.cache.delete(`${authService.getToken()}:${key}`);
    } else {
      this.cache.clear();
    }
  }

  async apiRequest(endpoint, options = {}) {
    const token = authService.getToken();
    const response = await fetch(`${this.API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        Accept: 'application/json',
        ...(typeof options.body === 'string' && { 'Content-Type': 'application/json' }),
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers
      }
    });
    if (response.status === 401) authService.clearSession();
    if (response.status === 204) return null;
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.success === false) {
      throw new Error(data.message || `Request failed with status ${response.status}`);
    }
    return normalizeDepartmentFields(data?.data ?? data?.employees ?? data);
  }

  // ==================== EMPLOYEE CRUD OPERATIONS ====================

  async getAllEmployees(filters = {}) {
    const cacheKey = `all_employees_${JSON.stringify(filters)}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;
    
    const queryParams = new URLSearchParams();
    Object.keys(filters).forEach(key => {
      if (filters[key] !== undefined && filters[key] !== null && filters[key] !== '') {
        queryParams.append(key, filters[key]);
      }
    });
    
    const url = `/employees${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const data = await this.apiRequest(url);
    
    const normalizedData = normalizeDepartmentFields(data);
    this.setCached(cacheKey, normalizedData);
    return normalizedData;
  }

  async getEmployeeById(id) {
    if (!id) return null;
    
    const cacheKey = `employee_${id}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;
    
    const data = await this.apiRequest(`/employees/${id}`);
    this.setCached(cacheKey, data);
    return data;
  }

  async getEmployeeByEmail(email) {
    if (!email) return null;
    
    const cacheKey = `employee_email_${email}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;
    
    const data = await this.apiRequest(`/employees/email/${encodeURIComponent(email)}`);
    this.setCached(cacheKey, data);
    return data;
  }

  async getEmployeeByEmployeeId(employeeId) {
    if (!employeeId) return null;
    
    const cacheKey = `employee_empid_${employeeId}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;
    
    const data = await this.apiRequest(`/employees/employee-id/${employeeId}`);
    this.setCached(cacheKey, data);
    return data;
  }

  async createEmployee(employeeData) {
    if (!employeeData || !(employeeData.name || (employeeData.firstName && employeeData.lastName)) || !employeeData.email || !employeeData.role) {
      throw new Error('Name, email, and role are required');
    }
    
    const data = await this.apiRequest('/employees', {
      method: 'POST',
      body: JSON.stringify(employeeData)
    });
    
    this.clearCache();
    return data;
  }

  async addEmployee(employeeData) {
    return this.createEmployee(employeeData);
  }

  async importEmployees(file, { sheet, dryRun = true, updateExisting = false } = {}) {
    const body = new FormData();
    body.append('file', file);
    if (sheet) body.append('sheet', sheet);
    body.append('dryRun', String(dryRun));
    body.append('updateExisting', String(updateExisting));
    const result = await this.apiRequest('/employees/import', { method: 'POST', body });
    if (!dryRun) this.clearCache();
    return result;
  }

  async accountAction(id, action) {
    const result = await this.apiRequest(`/users/${encodeURIComponent(id)}/${action}`, { method: 'POST' });
    this.clearCache();
    return result;
  }

  async updateEmployee(id, employeeData) {
    if (!id) throw new Error('Employee ID is required');
    
    const data = await this.apiRequest(`/employees/${id}`, {
      method: 'PUT',
      body: JSON.stringify({
        ...employeeData,
        updatedAt: new Date().toISOString()
      })
    });
    
    this.clearCache();
    return data;
  }

  async deleteEmployee(id) {
    if (!id) throw new Error('Employee ID is required');
    
    const data = await this.apiRequest(`/employees/${id}`, {
      method: 'DELETE'
    });
    
    this.clearCache();
    return data;
  }

  async uploadEmployeeDocument(id, file, documentType, googleAccessToken) {
    if (!id) throw new Error('Employee ID is required');
    if (!file) throw new Error('Document file is required');
    if (!documentType) throw new Error('Document type is required');

    const token = authService.getToken();
    const formData = new FormData();
    formData.append('document', file);
    formData.append('documentType', documentType);
    if (googleAccessToken) {
      formData.append('googleAccessToken', googleAccessToken);
    }

    const response = await fetch(`${this.API_BASE_URL}/employees/${id}/documents`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...(googleAccessToken && { 'X-Google-Access-Token': googleAccessToken })
      },
      body: formData
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || `Upload failed with status ${response.status}`);
    }

    this.clearCache();
    return normalizeDepartmentFields(data?.data?.employee ?? data?.employee ?? data);
  }

  // ==================== EMPLOYEE QUERIES ====================

  async getEmployeesByDepartment(department) {
    if (!department) return [];
    
    const cacheKey = `employees_department_${department}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;
    
    const normalizedDepartment = normalizeDepartment(department);
    const data = await this.apiRequest(`/employees/department/${encodeURIComponent(normalizedDepartment)}`);
    const normalizedData = normalizeDepartmentFields(data);
    this.setCached(cacheKey, normalizedData);
    return normalizedData;
  }

  async getEmployeesByRole(role) {
    if (!role) return [];
    
    const cacheKey = `employees_role_${role}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;
    
    const data = await this.apiRequest(`/employees/role/${role}`);
    this.setCached(cacheKey, data);
    return data;
  }

  async getEmployeesByManager(managerId) {
    if (!managerId) return [];
    
    const cacheKey = `employees_manager_${managerId}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;
    
    const data = await this.apiRequest(`/employees/manager/${managerId}`);
    this.setCached(cacheKey, data);
    return data;
  }

  async getEmployeesByStatus(status) {
    if (!status) return [];
    return this.getAllEmployees({ status });
  }

  async getMyTeam() {
    const currentUser = authService.getCurrentUser();
    if (!currentUser || !currentUser.id) return [];
    return this.getEmployeesByManager(currentUser.id);
  }

  // ==================== DEPARTMENT QUERIES ====================

  async getAllDepartments() {
    const cacheKey = 'all_departments';
    const cached = this.getCached(cacheKey);
    if (cached) return cached;
    
    const data = await this.apiRequest('/employees/departments');
    const departments = normalizeDepartments(Array.isArray(data) ? data : DEPARTMENTS);
    this.setCached(cacheKey, departments);
    return departments;
  }

  async getDepartmentStats() {
    const cacheKey = 'department_stats';
    const cached = this.getCached(cacheKey);
    if (cached) return cached;
    
    const employees = await this.getAllEmployees();
    const departments = DEPARTMENTS;
    
    const stats = departments.map(dept => {
      const deptEmployees = employees.filter(emp => emp.department === dept);
      return {
        name: dept,
        total: deptEmployees.length,
        active: deptEmployees.filter(emp => emp.status === 'Active').length,
        managers: deptEmployees.filter(emp => emp.role === 'Manager' || emp.role === 'Team Lead').length,
        members: deptEmployees.filter(emp => emp.role === 'Member').length
      };
    });
    
    this.setCached(cacheKey, stats);
    return stats;
  }

  // ==================== EMPLOYEE STATISTICS ====================

  async getEmployeeStats() {
    const cacheKey = 'employee_stats';
    const cached = this.getCached(cacheKey);
    if (cached) return cached;
    
    try {
      const data = await this.apiRequest('/employees/stats');
      this.setCached(cacheKey, data);
      return data;
    } catch (error) {
      const employees = await this.getAllEmployees();
      const stats = this.calculateStats(employees);
      this.setCached(cacheKey, stats);
      return stats;
    }
  }

  calculateStats(employees) {
    const departments = DEPARTMENTS;
    const roles = [...new Set(employees.map(emp => emp.role).filter(Boolean))];
    
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    return {
      total: employees.length,
      active: employees.filter(emp => emp.status === 'Active').length,
      inactive: employees.filter(emp => emp.status === 'Inactive').length,
      onLeave: employees.filter(emp => emp.status === 'On Leave').length,
      terminated: employees.filter(emp => emp.status === 'Terminated').length,
      departments: departments.length,
      departmentList: departments,
      roles: roles.length,
      roleList: roles,
      newThisMonth: employees.filter(emp => {
        const joinDate = new Date(emp.joinDate);
        return joinDate.getMonth() === currentMonth && 
               joinDate.getFullYear() === currentYear;
      }).length,
      departmentDistribution: departments.map(dept => ({
        department: dept,
        count: employees.filter(emp => emp.department === dept).length
      }))
    };
  }

  // ==================== LEAVE BALANCE METHODS ====================

  async getLeaveBalance(employeeId) {
    if (!employeeId) return null;
    
    const cacheKey = `leave_balance_${employeeId}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;
    
    const data = await this.apiRequest(`/employees/${employeeId}/leave-balance`);
    this.setCached(cacheKey, data);
    return data;
  }

  async updateLeaveBalance(employeeId, leaveType, days) {
    if (!employeeId) throw new Error('Employee ID is required');
    if (!leaveType) throw new Error('Leave type is required');
    if (!days || days <= 0) throw new Error('Days must be positive');
    
    const data = await this.apiRequest(`/employees/${employeeId}/leave-balance`, {
      method: 'PATCH',
      body: JSON.stringify({ leaveType, days })
    });
    
    this.clearCache(`leave_balance_${employeeId}`);
    return data;
  }

  // ==================== SEARCH & FILTER ====================

  async searchEmployees(searchTerm) {
    if (!searchTerm || searchTerm.trim() === '') return [];
    
    const cacheKey = `employees_search_${searchTerm.toLowerCase()}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;
    
    const data = await this.apiRequest(`/employees/search?q=${encodeURIComponent(searchTerm)}`);
    this.setCached(cacheKey, data);
    return data;
  }

  async getEmployeesWithFilters(filters = {}) {
    return this.getAllEmployees(filters);
  }

  // ==================== DASHBOARD SPECIFIC ====================

  async getEmployeesForDashboard() {
    const employees = await this.getAllEmployees();
    const departments = await this.getAllDepartments();
    
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    const newThisMonth = employees.filter(emp => {
      const joinDate = new Date(emp.joinDate);
      return joinDate.getMonth() === currentMonth && 
             joinDate.getFullYear() === currentYear;
    }).length;
    
    const terminatedCount = employees.filter(emp => emp.status === 'Terminated').length;
    const activeCount = employees.filter(emp => emp.status === 'Active').length;
    
    const departmentProgress = departments.map(dept => {
      const deptEmployees = employees.filter(emp => emp.department === dept);
      return {
        name: dept,
        members: deptEmployees.length,
        progress: 0
      };
    });
    
    return {
      totalMembers: employees.length,
      departments: departments.length,
      activeCount,
      newThisMonth,
      terminatedCount,
      departmentProgress,
      employeesByDepartment: departmentProgress
    };
  }
}

export default new EmployeeService();
