import { displayDate, displayDateTime } from '../../utils/timeZone';
import React, { useState, useEffect } from 'react';
import { Calendar, Gift, Clock, Plus, X, Bell, Send } from './Icons';
import employeeService from '../../services/employeeService';
import authService from '../../services/authService';

const LeaveManagement = ({ user, userRole, userDepartment }) => {
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [breaks, setBreaks] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [showApplyForm, setShowApplyForm] = useState(false);
  const [showHolidayForm, setShowHolidayForm] = useState(false);
  const [showBreakForm, setShowBreakForm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [breakToDelete, setBreakToDelete] = useState(null);
  const [formData, setFormData] = useState({
    startDate: '',
    endDate: '',
    type: 'Sick',
    reason: '',
    halfDay: false,
    halfDayType: 'first',
  });
  const [holidayData, setHolidayData] = useState({
    name: '',
    date: '',
    description: '',
    isRecurring: false
  });
  const [breakData, setBreakData] = useState({
    userId: '',
    date: '',
    hours: 1,
    reason: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [leaveBalance, setLeaveBalance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState([]);
  const [activeTab, setActiveTab] = useState('requests');
  const [showNotification, setShowNotification] = useState(false);
  const [notificationSuccess, setNotificationSuccess] = useState(true);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [breakStats, setBreakStats] = useState({ pending: 0, approved: 0, total: 0 });

  useEffect(() => {
    fetchAllData();
  }, []);

  const showAlert = (message, isSuccess = true) => {
    setNotificationMessage(message);
    setNotificationSuccess(isSuccess);
    setShowNotification(true);
    setTimeout(() => setShowNotification(false), 4000);
  };

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const canReviewLeaves = ['CEO', 'COO', 'Manager'].includes(user.role);
      const [leaves, breaksList, holidaysList, balance, people] = await Promise.all([
        apiGet(canReviewLeaves ? '/leaves/all' : `/leaves/my/${user.id}`),
        apiGet('/hour-breaks'),
        apiGet('/holidays'),
        apiGet(`/leaves/balance/${user.id}`),
        canReviewLeaves ? employeeService.getAllEmployees().catch(() => []) : []
      ]);
      setEmployees(people);
      setLeaveRequests(leaves);
      setBreaks(breaksList);
      setHolidays(holidaysList);
      setLeaveBalance(balance);
      setBreakStats({
        pending: breaksList.filter(record => record.status === 'pending').length,
        approved: breaksList.filter(record => record.status === 'approved').length,
        total: breaksList.length
      });
    } catch (error) {
      showAlert(error.message || 'Could not load leave management.', false);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyLeave = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      await apiPost('/leaves/apply', { ...formData, endDate: formData.halfDay ? formData.startDate : formData.endDate });
      showAlert('Leave request submitted.');
      setShowApplyForm(false);
      setFormData({ startDate: '', endDate: '', type: 'Sick', reason: '', halfDay: false, halfDayType: 'first' });
      await fetchAllData();
    } catch (error) {
      showAlert(error.message || 'Failed to apply for leave.', false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';

  const getAuthHeaders = () => {
    const token = authService.getToken();
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  };

  const apiGet = async endpoint => {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, { headers: getAuthHeaders() });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Request failed');
    return data.data;
  };

  const apiPost = async (endpoint, body) => {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.message || data?.error || 'Request failed');
    return data?.data ?? data;
  };

  const apiPut = async (endpoint, body) => {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.message || data?.error || 'Request failed');
    return data?.data ?? data;
  };

  const apiDelete = async (endpoint) => {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'DELETE',
      headers: {
        ...getAuthHeaders(),
      },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.message || data?.error || 'Request failed');
    return data?.data ?? data;
  };

  // Employee Hour Break Request (backend)
  const handleEmployeeBreakRequest = async (e) => {
    e.preventDefault();
    if (!breakData.date || !breakData.reason) {
      showAlert('Please fill all required fields', false);
      return;
    }

    try {
      await apiPost('/hour-breaks/apply', {
        userId: user.id,
        userName: user.name,
        employeeId: user.employeeId,
        userRole: user.role,
        department: user.department,
        date: breakData.date,
        hours: breakData.hours,
        reason: breakData.reason,
      });

      showAlert(`✅ Hour break request submitted!`);
      setShowBreakForm(false);
      setBreakData({ userId: '', date: '', hours: 1, reason: '' });
      await fetchAllData();
    } catch (error) {
      showAlert(`❌ Failed to submit break request. ${error.message || ''}`.trim(), false);
    }
  };

  // Manager adding break for team member (backend)
  const handleManagerAddBreak = async (e) => {
    e.preventDefault();
    if (!breakData.userId || !breakData.date || !breakData.reason) {
      showAlert('Please fill all required fields', false);
      return;
    }

      const employee = employees.find(emp => String(emp.id) === String(breakData.userId) || String(emp._id) === String(breakData.userId) || emp.employeeId === breakData.userId);
    if (!employee) {
      showAlert('Selected employee not found', false);
      return;
    }

    try {
      await apiPost('/hour-breaks/apply', {
          userId: String(employee.id ?? employee._id),
        userName: employee.name,
        employeeId: employee.employeeId || String(employee.id),
        userRole: employee.role,
        department: employee.department,
        date: breakData.date,
        hours: breakData.hours,
        reason: breakData.reason,
      });

      showAlert(`✅ Hour break request submitted for ${employee.name}!`);
      setShowBreakForm(false);
      setBreakData({ userId: '', date: '', hours: 1, reason: '' });
      await fetchAllData();
    } catch (error) {
      showAlert(`❌ Failed to submit break request. ${error.message || ''}`.trim(), false);
    }
  };

  const reviewLeave = async (id, status) => {
    const comments = status === 'Rejected' ? window.prompt('Reason for rejection:') : '';
    if (comments === null) return;
    try {
      await apiPut(`/leaves/${id}/status`, { status, comments });
      showAlert(`Leave ${status.toLowerCase()}.`);
      await fetchAllData();
    } catch (error) {
      showAlert(error.message, false);
    }
  };

  const handleApproveBreak = async (breakId) => {
    const currentUserObj = authService.getCurrentUser();
    try {
      await apiPut(`/hour-breaks/${breakId}/status`, {
        status: 'approved',
        approvedBy: currentUserObj?.name || currentUserObj?.fullName,
      });
      showAlert(`✅ Hour break approved!`);
      await fetchAllData();
    } catch (error) {
      showAlert(`❌ Failed to approve break. ${error.message || ''}`.trim(), false);
    }
  };

  const handleRejectBreak = async (breakId) => {
    const comments = window.prompt('Reason for rejection:');
    if (!comments) return;
    const currentUserObj = authService.getCurrentUser();
    try {
      await apiPut(`/hour-breaks/${breakId}/status`, {
        status: 'rejected',
        approvedBy: currentUserObj?.name || currentUserObj?.fullName,
        rejectionReason: comments,
      });
      showAlert(`❌ Hour break rejected.`);
      await fetchAllData();
    } catch (error) {
      showAlert(`❌ Failed to reject break. ${error.message || ''}`.trim(), false);
    }
  };

  const handleDeleteBreakClick = (breakId) => {
    setBreakToDelete(breakId);
    setShowDeleteConfirm(true);
  };

  const confirmDeleteBreak = async () => {
    if (!breakToDelete) return;
    try {
      await apiDelete(`/hour-breaks/${breakToDelete}`);
      showAlert(`🗑️ Break request deleted.`);
      await fetchAllData();
      setShowDeleteConfirm(false);
      setBreakToDelete(null);
    } catch (error) {
      showAlert(`❌ Failed to delete break. ${error.message || ''}`.trim(), false);
    }
  };

  const handleDeclareHoliday = async (e) => {
    e.preventDefault();
    if (!holidayData.name || !holidayData.date) {
      showAlert('Please fill in holiday name and date', false);
      return;
    }
    try {
      await apiPost('/holidays', holidayData);
      setShowHolidayForm(false);
      setHolidayData({ name: '', date: '', description: '', isRecurring: false });
      showAlert('Holiday declared.');
      await fetchAllData();
    } catch (error) {
      showAlert(error.message, false);
    }
  };

  const getStatusBadge = (request) => {
    if (request.status === 'Approved') return 'bg-green-100 text-green-800';
    if (request.status === 'Rejected') return 'bg-red-100 text-red-800';
    return 'bg-yellow-100 text-yellow-800';
  };

  const getBreakStatusBadge = (breakItem) => {
    if (breakItem.status === 'approved') return 'bg-green-100 text-green-800';
    if (breakItem.status === 'rejected') return 'bg-red-100 text-red-800';
    return 'bg-yellow-100 text-yellow-800';
  };

  const canApprove = () => ['CEO', 'COO', 'Manager'].includes(user.role);
  const isCEO = userRole === 'CEO';
  const isManager = userRole === 'Manager';
  const isEmployee = !isCEO && !isManager;

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-black mx-auto"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Notification Toast */}
      {showNotification && (
        <div className={`alert fixed top-20 right-4 z-50 w-auto shadow-lg ${notificationSuccess ? 'alert-success' : 'alert-error'}`} role={notificationSuccess ? 'status' : 'alert'}>
          <p className="text-sm text-gray-700">{notificationMessage}</p>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl max-w-md w-full mx-4 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Confirm Delete</h2>
            <p className="text-gray-600 mb-4">Are you sure you want to delete this break request?</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowDeleteConfirm(false)} className="btn btn-sm btn-ghost px-4 py-2 border rounded-lg">Cancel</button>
              <button onClick={confirmDeleteBreak} className="btn btn-sm btn-ghost px-4 py-2 bg-red-600 text-white rounded-lg">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Main Card */}
      <div className="card bg-base-100 shadow-sm border border-base-300 overflow-hidden">
        <div className="bg-gradient-to-r from-black to-gray-800 px-6 py-5">
          <div className="flex justify-between items-center flex-wrap gap-4">
            <div>
              <h2 className="text-xl font-semibold text-white">Leave Management System</h2>
              <p className="text-gray-300 text-sm mt-0.5">
                {isCEO ? 'CEO leave is approved when submitted' :
                 isManager ? 'Review team leave and submit your own requests' :
                 'Submit leave and hour-break requests'}
              </p>
            </div>
            <div className="flex gap-2">
              {isCEO && (
                <button onClick={() => { setShowApplyForm(!showApplyForm); setShowHolidayForm(false); setShowBreakForm(false); }} className="btn btn-sm btn-ghost px-4 py-2 bg-white text-black rounded-lg hover:bg-gray-100 text-sm flex items-center gap-2">
                  <Calendar className="w-4 h-4" /> Take Leave (CEO)
                </button>
              )}
              {isManager && (
                <button onClick={() => { setShowApplyForm(!showApplyForm); setShowHolidayForm(false); setShowBreakForm(false); }} className="btn btn-sm btn-ghost px-4 py-2 bg-white text-black rounded-lg hover:bg-gray-100 text-sm flex items-center gap-2">
                  <Calendar className="w-4 h-4" /> Request Leave
                </button>
              )}
              {isEmployee && (
                <button onClick={() => setShowApplyForm(!showApplyForm)} className="btn btn-sm btn-ghost px-4 py-2 bg-white text-black rounded-lg hover:bg-gray-100 text-sm flex items-center gap-2">
                  <Plus className="w-4 h-4" /> Apply Leave
                </button>
              )}
              {isEmployee && (
                <button onClick={() => setShowBreakForm(!showBreakForm)} className="btn btn-sm btn-ghost px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm flex items-center gap-2">
                  <Clock className="w-4 h-4" /> Request Break
                </button>
              )}
              {(isCEO || isManager) && (
                <button onClick={() => { setShowBreakForm(!showBreakForm); setShowApplyForm(false); setShowHolidayForm(false); }} className="btn btn-sm btn-ghost px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm flex items-center gap-2">
                  <Clock className="w-4 h-4" /> Add Break
                </button>
              )}
              {isCEO && (
                <button onClick={() => { setShowHolidayForm(!showHolidayForm); setShowApplyForm(false); setShowBreakForm(false); }} className="btn btn-sm btn-ghost px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm flex items-center gap-2">
                  <Gift className="w-4 h-4" /> Declare Holiday
                </button>
              )}
            </div>
          </div>
        </div>

        {/* CEO Leave Form */}
        {showApplyForm && isCEO && (
          <div className="p-6 border-b bg-gray-50">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Apply for Leave (CEO)</h3>
              <button onClick={() => setShowApplyForm(false)}><X className="w-5 h-5 text-gray-400 hover:text-gray-600" /></button>
            </div>
            <form onSubmit={handleApplyLeave} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Start Date *</label><input type="date" value={formData.startDate} onChange={(e) => setFormData({...formData, startDate: e.target.value})} className="input w-full px-3 py-2 border rounded-lg" required /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">End Date *</label><input type="date" value={formData.endDate} onChange={(e) => setFormData({...formData, endDate: e.target.value})} className="input w-full px-3 py-2 border rounded-lg" required disabled={formData.halfDay} /></div>
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2"><input type="checkbox" checked={formData.halfDay} onChange={(e) => setFormData({...formData, halfDay: e.target.checked})} /><span className="text-sm">Half Day</span></label>
                {formData.halfDay && (
                  <div className="flex gap-3">
                    <label><input type="radio" value="first" checked={formData.halfDayType === 'first'} onChange={(e) => setFormData({...formData, halfDayType: e.target.value})} /> First Half</label>
                    <label><input type="radio" value="second" checked={formData.halfDayType === 'second'} onChange={(e) => setFormData({...formData, halfDayType: e.target.value})} /> Second Half</label>
                  </div>
                )}
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Leave Type</label><select value={formData.type} onChange={(e) => setFormData({...formData, type: e.target.value})} className="select w-full px-3 py-2 border rounded-lg"><option value="Sick">Sick Leave</option><option value="Casual">Casual Leave</option><option value="Annual">Annual Leave</option></select></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Reason</label><textarea value={formData.reason} onChange={(e) => setFormData({...formData, reason: e.target.value})} rows="3" className="textarea w-full px-3 py-2 border rounded-lg" required /></div>
              <div className="bg-blue-50 p-3 rounded-lg flex items-center gap-2">
                <Bell className="w-5 h-5 text-blue-600" />
                <p className="text-sm text-blue-800">Your leave is approved when it is submitted.</p>
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowApplyForm(false)} className="btn btn-sm btn-ghost px-4 py-2 border rounded-lg">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="btn btn-sm btn-ghost px-6 py-2 bg-black text-white rounded-lg hover:bg-gray-800 flex items-center gap-2">
                  <Send className="w-4 h-4" /> {isSubmitting ? 'Submitting...' : 'Submit & Notify All'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Manager Leave Form */}
        {showApplyForm && isManager && (
          <div className="p-6 border-b bg-gray-50">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Request Leave (Manager)</h3>
              <button onClick={() => setShowApplyForm(false)}><X className="w-5 h-5 text-gray-400 hover:text-gray-600" /></button>
            </div>
            <form onSubmit={handleApplyLeave} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Start Date *</label><input type="date" value={formData.startDate} onChange={(e) => setFormData({...formData, startDate: e.target.value})} className="input w-full px-3 py-2 border rounded-lg" required /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">End Date *</label><input type="date" value={formData.endDate} onChange={(e) => setFormData({...formData, endDate: e.target.value})} className="input w-full px-3 py-2 border rounded-lg" required disabled={formData.halfDay} /></div>
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2"><input type="checkbox" checked={formData.halfDay} onChange={(e) => setFormData({...formData, halfDay: e.target.checked})} /><span className="text-sm">Half Day</span></label>
                {formData.halfDay && (
                  <div className="flex gap-3">
                    <label><input type="radio" value="first" checked={formData.halfDayType === 'first'} onChange={(e) => setFormData({...formData, halfDayType: e.target.value})} /> First Half</label>
                    <label><input type="radio" value="second" checked={formData.halfDayType === 'second'} onChange={(e) => setFormData({...formData, halfDayType: e.target.value})} /> Second Half</label>
                  </div>
                )}
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Leave Type</label><select value={formData.type} onChange={(e) => setFormData({...formData, type: e.target.value})} className="select w-full px-3 py-2 border rounded-lg"><option value="Sick">Sick Leave</option><option value="Casual">Casual Leave</option><option value="Annual">Annual Leave</option></select></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Reason</label><textarea value={formData.reason} onChange={(e) => setFormData({...formData, reason: e.target.value})} rows="3" className="textarea w-full px-3 py-2 border rounded-lg" required /></div>
              <div className="bg-blue-50 p-3 rounded-lg flex items-center gap-2">
                <Bell className="w-5 h-5 text-blue-600" />
                <p className="text-sm text-blue-800">Your leave request will be sent to <strong>CEO for approval</strong>. CEO will be notified.</p>
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowApplyForm(false)} className="btn btn-sm btn-ghost px-4 py-2 border rounded-lg">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="btn btn-sm btn-ghost px-6 py-2 bg-black text-white rounded-lg flex items-center gap-2">
                  <Send className="w-4 h-4" /> {isSubmitting ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Employee Leave Form */}
        {showApplyForm && isEmployee && (
          <div className="p-6 border-b bg-gray-50">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Apply for Leave</h3>
              <button onClick={() => setShowApplyForm(false)}><X className="w-5 h-5 text-gray-400 hover:text-gray-600" /></button>
            </div>
            <form onSubmit={handleApplyLeave} className="space-y-4">
              <div className="grid grid-cols-2 gap-4"><div><label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label><input type="date" value={formData.startDate} onChange={(e) => setFormData({...formData, startDate: e.target.value})} className="input w-full px-3 py-2 border rounded-lg" required /></div><div><label className="block text-sm font-medium text-gray-700 mb-1">End Date</label><input type="date" value={formData.endDate} onChange={(e) => setFormData({...formData, endDate: e.target.value})} className="input w-full px-3 py-2 border rounded-lg" required /></div></div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2"><input type="checkbox" checked={formData.halfDay} onChange={(e) => setFormData({...formData, halfDay: e.target.checked})} /><span className="text-sm">Half Day</span></label>
                {formData.halfDay && (
                  <div className="flex gap-3">
                    <label><input type="radio" value="first" checked={formData.halfDayType === 'first'} onChange={(e) => setFormData({...formData, halfDayType: e.target.value})} /> First Half</label>
                    <label><input type="radio" value="second" checked={formData.halfDayType === 'second'} onChange={(e) => setFormData({...formData, halfDayType: e.target.value})} /> Second Half</label>
                  </div>
                )}
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Leave Type</label><select value={formData.type} onChange={(e) => setFormData({...formData, type: e.target.value})} className="select w-full px-3 py-2 border rounded-lg">{leaveBalance && Object.entries(leaveBalance).map(([type, balance]) => (<option key={type} value={type}>{type} (Available: {balance})</option>))}</select></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Reason</label><textarea value={formData.reason} onChange={(e) => setFormData({...formData, reason: e.target.value})} rows="3" className="textarea w-full px-3 py-2 border rounded-lg" required /></div>
              <div className="bg-blue-50 p-3 rounded-lg"><p className="text-sm text-blue-800">Your request needs approval from your Manager and CEO.</p></div>
              <div className="flex justify-end gap-3"><button type="button" onClick={() => setShowApplyForm(false)} className="btn btn-sm btn-ghost px-4 py-2 border rounded-lg">Cancel</button><button type="submit" disabled={isSubmitting} className="btn btn-sm btn-ghost px-6 py-2 bg-black text-white rounded-lg">Submit Request</button></div>
            </form>
          </div>
        )}

        {/* Employee Break Request Form */}
        {showBreakForm && isEmployee && (
          <div className="p-6 border-b bg-gray-50">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Request Hour Break</h3>
              <button onClick={() => setShowBreakForm(false)}><X className="w-5 h-5 text-gray-400 hover:text-gray-600" /></button>
            </div>
            <form onSubmit={handleEmployeeBreakRequest} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Date *</label><input type="date" value={breakData.date} onChange={(e) => setBreakData({...breakData, date: e.target.value})} className="input w-full px-3 py-2 border rounded-lg" required /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Hours *</label><select value={breakData.hours} onChange={(e) => setBreakData({...breakData, hours: parseFloat(e.target.value)})} className="select w-full px-3 py-2 border rounded-lg"><option value={0.5}>0.5 hours</option><option value={1}>1 hour</option><option value={1.5}>1.5 hours</option><option value={2}>2 hours</option></select></div>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Reason *</label><textarea value={breakData.reason} onChange={(e) => setBreakData({...breakData, reason: e.target.value})} rows="3" className="textarea w-full px-3 py-2 border rounded-lg" required placeholder="Please provide a reason for your break request" /></div>
              <div className="bg-blue-50 p-3 rounded-lg"><p className="text-sm text-blue-800">Your break request will be sent to your Manager for approval.</p></div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowBreakForm(false)} className="btn btn-sm btn-ghost px-4 py-2 border rounded-lg">Cancel</button>
                <button type="submit" className="btn btn-sm btn-ghost px-6 py-2 bg-black text-white rounded-lg">Submit Request</button>
              </div>
            </form>
          </div>
        )}

        {/* Manager Add Break Form */}
        {showBreakForm && (isCEO || isManager) && !isEmployee && (
          <div className="p-6 border-b bg-gray-50">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Add Hour Break for Employee</h3>
              <button onClick={() => setShowBreakForm(false)}><X className="w-5 h-5 text-gray-400 hover:text-gray-600" /></button>
            </div>
            <form onSubmit={isManager ? handleManagerAddBreak : handleManagerAddBreak} className="space-y-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Select Employee</label>
                <select value={breakData.userId} onChange={(e) => setBreakData({...breakData, userId: e.target.value})} className="select w-full px-3 py-2 border rounded-lg" required>
                  <option value="">-- Select Employee --</option>
                  {employees.filter(emp => emp.role !== 'CEO' && (isCEO || userRole === 'Manager' || userRole === 'COO' ? true : emp.department === userDepartment)).map(emp => (<option key={emp.id} value={emp.id}>{emp.name} ({emp.department})</option>))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4"><div><label className="block text-sm font-medium text-gray-700 mb-1">Date</label><input type="date" value={breakData.date} onChange={(e) => setBreakData({...breakData, date: e.target.value})} className="input w-full px-3 py-2 border rounded-lg" required /></div><div><label className="block text-sm font-medium text-gray-700 mb-1">Hours</label><select value={breakData.hours} onChange={(e) => setBreakData({...breakData, hours: parseFloat(e.target.value)})} className="select w-full px-3 py-2 border rounded-lg"><option value={0.5}>0.5 hours</option><option value={1}>1 hour</option><option value={2}>2 hours</option></select></div></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Reason</label><textarea value={breakData.reason} onChange={(e) => setBreakData({...breakData, reason: e.target.value})} rows="2" className="textarea w-full px-3 py-2 border rounded-lg" required /></div>
              <div className="flex justify-end gap-3"><button type="button" onClick={() => setShowBreakForm(false)} className="btn btn-sm btn-ghost px-4 py-2 border rounded-lg">Cancel</button><button type="submit" className="btn btn-sm btn-ghost px-6 py-2 bg-blue-600 text-white rounded-lg">Submit Request</button></div>
            </form>
          </div>
        )}

        {/* Declare Holiday Form */}
        {showHolidayForm && isCEO && (
          <div className="p-6 border-b bg-gray-50">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Declare Holiday</h3>
              <button onClick={() => setShowHolidayForm(false)}><X className="w-5 h-5 text-gray-400 hover:text-gray-600" /></button>
            </div>
            <form onSubmit={handleDeclareHoliday} className="space-y-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Holiday Name</label><input type="text" value={holidayData.name} onChange={(e) => setHolidayData({...holidayData, name: e.target.value})} className="input w-full px-3 py-2 border rounded-lg" required /></div>
              <div className="grid grid-cols-2 gap-4"><div><label className="block text-sm font-medium text-gray-700 mb-1">Date</label><input type="date" value={holidayData.date} onChange={(e) => setHolidayData({...holidayData, date: e.target.value})} className="input w-full px-3 py-2 border rounded-lg" required /></div><div className="flex items-end"><label className="flex items-center gap-2"><input type="checkbox" checked={holidayData.isRecurring} onChange={(e) => setHolidayData({...holidayData, isRecurring: e.target.checked})} /> Recurring Yearly</label></div></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Description</label><textarea value={holidayData.description} onChange={(e) => setHolidayData({...holidayData, description: e.target.value})} rows="2" className="textarea w-full px-3 py-2 border rounded-lg" /></div>
              <div className="flex justify-end gap-3"><button type="button" onClick={() => setShowHolidayForm(false)} className="btn btn-sm btn-ghost px-4 py-2 border rounded-lg">Cancel</button><button type="submit" className="btn btn-sm btn-ghost px-6 py-2 bg-green-600 text-white rounded-lg">Declare Holiday</button></div>
            </form>
          </div>
        )}

        {/* Tabs */}
        <div className="border-b px-6">
          <div className="flex gap-6">
            <button onClick={() => setActiveTab('requests')} className={`py-3 text-sm font-medium ${activeTab === 'requests' ? 'text-black border-b-2 border-black' : 'text-gray-500'}`}>Leave Requests ({leaveRequests.length})</button>
            <button onClick={() => setActiveTab('breaks')} className={`py-3 text-sm font-medium ${activeTab === 'breaks' ? 'text-black border-b-2 border-black' : 'text-gray-500'}`}>Hour Breaks ({breaks.length})</button>
            <button onClick={() => setActiveTab('holidays')} className={`py-3 text-sm font-medium ${activeTab === 'holidays' ? 'text-black border-b-2 border-black' : 'text-gray-500'}`}>Holidays ({holidays.length})</button>
          </div>
        </div>

        {/* Break Statistics */}
        {activeTab === 'breaks' && (
          <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 border-b">
            <div className="text-center p-3 bg-white rounded-lg border"><div className="text-2xl font-bold text-gray-900">{breakStats.total}</div><div className="text-xs text-gray-500">Total Requests</div></div>
            <div className="text-center p-3 bg-white rounded-lg border"><div className="text-2xl font-bold text-yellow-600">{breakStats.pending}</div><div className="text-xs text-gray-500">Pending</div></div>
            <div className="text-center p-3 bg-white rounded-lg border"><div className="text-2xl font-bold text-green-600">{breakStats.approved}</div><div className="text-xs text-gray-500">Approved</div></div>
          </div>
        )}

        {/* Hour Breaks Table */}
        {activeTab === 'breaks' && (
          <div className="overflow-x-auto">
            <table className="table w-full">
              <thead className="bg-gray-50 border-b">
                <tr><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Department</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hours</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reason</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th></tr></thead>
              <tbody className="divide-y">
                {breaks.map(breakItem => (
                  <tr key={breakItem.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4"><div className="flex items-center gap-2"><div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-sm font-medium">{breakItem.userName?.charAt(0)}</div><span>{breakItem.userName}</span></div></td>
                    <td className="px-6 py-4 text-gray-600">{breakItem.department}</td>
                    <td className="px-6 py-4">{displayDate(breakItem.date)}</td>
                    <td className="px-6 py-4"><span className="font-medium">{breakItem.hours} hr</span></td>
                    <td className="px-6 py-4 text-gray-600">{breakItem.reason}</td>
                    <td className="px-6 py-4"><span className={`px-2 py-1 text-xs rounded-full ${getBreakStatusBadge(breakItem)}`}>{breakItem.status}</span></td>
                    <td className="px-6 py-4">
                      {breakItem.status === 'pending' && breakItem.canReview && (
                        <div className="flex gap-2">
                          <button onClick={() => handleApproveBreak(breakItem.id)} className="btn btn-sm btn-success">Approve</button>
                          <button onClick={() => handleRejectBreak(breakItem.id)} className="btn btn-sm btn-error">Reject</button>
                        </div>
                      )}
                      {breakItem.status === 'pending' && String(breakItem.userId) === String(user.id) && (
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => handleDeleteBreakClick(breakItem.id)}>Delete</button>
                      )}
                    </td>
                  </tr>
                ))}
                {breaks.length === 0 && <tr><td colSpan="7" className="px-6 py-8 text-center text-gray-500">No hour break requests found</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {/* Leave Requests Table */}
        {activeTab === 'requests' && (
          <div className="divide-y">
            {leaveRequests.length === 0 ? (
              <div className="p-12 text-center text-gray-500">No leave requests found.</div>
            ) : (
              leaveRequests.map((request) => (
                <div key={request.id} className="p-5 hover:bg-gray-50">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center font-semibold">{request.userName?.charAt(0)}</div>
                        <div><p className="font-semibold">{request.type} Leave • {request.days} days</p>{canApprove() && <p className="text-sm text-gray-500">{request.userName} • {request.employeeId}</p>}</div>
                        <span className={`ml-auto px-2 py-1 text-xs rounded-full ${getStatusBadge(request)}`}>{request.status}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm text-gray-600 mb-2">
                        <div>📅 From: {displayDate(request.startDate)}</div>
                        <div>📅 To: {displayDate(request.endDate)}</div>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-sm"><span className="font-medium">Reason:</span> {request.reason}</p>
                        <p className="text-xs text-gray-400 mt-1">Applied on: {displayDateTime(request.appliedOn)}</p>
                        {request.approvedBy && request.approvedBy.length > 0 && <p className="text-xs text-green-600 mt-1">Approved by: {request.approvedBy.join(', ')}</p>}
                      </div>
                    </div>
                    {request.canReview && request.status === 'Pending' && (
                      <div className="flex gap-2 ml-4">
                        <button onClick={() => reviewLeave(request.id, 'Approved')} className="btn btn-sm btn-success">Approve</button>
                        <button onClick={() => reviewLeave(request.id, 'Rejected')} className="btn btn-sm btn-error">Reject</button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Holidays Tab */}
        {activeTab === 'holidays' && (
          <div className="divide-y">
            {holidays.map(holiday => (
              <div key={holiday.id} className="px-6 py-4 flex justify-between items-center hover:bg-gray-50">
                <div><p className="font-medium text-gray-900">{holiday.name}</p><p className="text-sm text-gray-500">{displayDate(holiday.date)}</p></div>
                {holiday.isRecurring && <span className="text-xs bg-gray-100 px-2 py-1 rounded-full">Recurring</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default LeaveManagement;
