// src/services/reportService.js
const API_BASE_URL = (process.env.REACT_APP_API_URL || '/api').replace(/\/+$/, '');

const apiRequest = async (endpoint, options = {}) => {
  const token = localStorage.getItem('authToken');
  
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
    },
  };
  
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...defaultOptions,
    ...options,
    headers: { ...defaultOptions.headers, ...options.headers },
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'API request failed' }));
    const failure = new Error(error.message || `HTTP ${response.status}: ${response.statusText}`);
    failure.status = response.status;
    throw failure;
  }
  
  const data = await response.json();
  return data.data || data;
};

export const reportService = {
  submitReport: async (reportData) => {
    return apiRequest('/reports', {
      method: 'POST',
      body: JSON.stringify(reportData),
    });
  },

  getTodayReport: async (userId) => {
    try {
      return await apiRequest(`/reports/user/${userId}/today`);
    } catch (e) {
      if (e.status === 404) return null;
      throw e;
    }
  },

  getUserReports: async (userId) => {
    return apiRequest(`/reports/user/${userId}`);
  },

  getReportsByDepartment: async (department) => {
    return apiRequest(`/reports/department/${encodeURIComponent(department)}`);
  },

  getAllReports: async (filters = {}, options = {}) => {
    const query = new URLSearchParams(filters).toString();
    return apiRequest(`/reports${query ? '?' + query : ''}`, options);
  },

  updateReport: async (reportId, updatedData) => {
    return apiRequest(`/reports/${reportId}`, {
      method: 'PUT',
      body: JSON.stringify(updatedData),
    });
  },

  deleteReport: async (reportId) => {
    return apiRequest(`/reports/${reportId}`, {
      method: 'DELETE',
    });
  },

  getComplianceReport: async (filters = { scope: 'mine' }, options = {}) => {
    return apiRequest(`/reports/compliance?${new URLSearchParams(filters)}`, options);
  },
};

export default reportService;
