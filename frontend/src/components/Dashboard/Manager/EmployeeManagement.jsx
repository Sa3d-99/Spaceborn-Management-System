import { Upload, Folder as IconFolder, Plus as IconPlus, Search as IconSearch } from '../../Common/Icons';
import { displayDateTime } from '../../../utils/timeZone';
import React, { useState } from 'react';
import { DEPARTMENTS, normalizeDepartment } from '../../../utils/departments';
import EmployeeForm from '../EmployeeForm';
import employeeService from '../../../services/employeeService';
import { useGoogleLogin } from '@react-oauth/google';
import ImportEmployeesModal from './ImportEmployeesModal';
import { roleLabel } from '../../../utils/roleLabels';

const EmployeeManagement = ({ 
  employees = [], 
  userRole, 
  canEdit, 
  canDelete, 
  canAdd,
  onUpdateEmployee,
  onAddEmployee,
  onDeleteEmployee,
  onImportComplete
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [showAddEmployeeModal, setShowAddEmployeeModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showDocumentUpload, setShowDocumentUpload] = useState(false);
  const [uploadingDocType, setUploadingDocType] = useState('');
  const [activeTab, setActiveTab] = useState('personal');
  const [driveToken, setDriveToken] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [detailError, setDetailError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [detailsBusy, setDetailsBusy] = useState(false);

  // Google Login for Drive access
  const login = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setDriveToken(tokenResponse);
    },
    scope: 'https://www.googleapis.com/auth/drive.file',
  });

  const allEmployees = employees;

  // Get unique departments
  const departments = DEPARTMENTS;
  
  // Calculate stats dynamically
  const activeCount = allEmployees.filter(e => e.isActive !== false).length;
  const onLeaveCount = allEmployees.filter(e => e.status === 'On Leave' || e.employmentStatus === 'On Leave').length;
  const ndaSignedCount = allEmployees.filter(e => e.ndaSigned || e.documents?.nda?.signed).length;
  const onboardedCount = allEmployees.filter(e => e.isOnboarded).length;

  const stats = {
    total: allEmployees.length,
    active: activeCount,
    onLeave: onLeaveCount,
    ndaSigned: ndaSignedCount,
    onboarded: onboardedCount
  };

  const roleCounts = allEmployees.reduce((acc, emp) => {
    const role = emp.role || 'Member';
    acc[role] = (acc[role] || 0) + 1;
    return acc;
  }, {});

  // Filter employees
  const filteredEmployees = allEmployees.filter(emp => {
    const matchesSearch = 
      emp.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.employeeId?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesDepartment = departmentFilter === 'all' || normalizeDepartment(emp.department) === departmentFilter;
    const matchesStatus = statusFilter === 'all' || emp.employmentStatus === statusFilter;
    
    return matchesSearch && matchesDepartment && matchesStatus;
  });

  const handleViewEmployee = async employee => {
    setSelectedEmployee(employee);
    setShowEmployeeModal(true);
    setActiveTab('personal');
    setDetailError('');
    setDetailsBusy(true);
    try {
      setSelectedEmployee(await employeeService.getEmployeeById(employee.id));
    } catch (error) {
      setDetailError(error.message);
    } finally {
      setDetailsBusy(false);
    }
  };

  const handleResetPassword = async employee => {
    setFeedback('');
    const action = employee.setupEmailStatus ? 'setup-email' : 'reset-password';
    try {
      await employeeService.accountAction(employee.id, action);
      setFeedback(action === 'setup-email' ? 'Password setup email queued.' : 'Password reset email sent.');
    } catch (error) {
      setFeedback(error.message);
    }
  };

  const handleTwoFactorReset = async employee => {
    if (!window.confirm(`Reset two-factor authentication for ${employee.name}? They will be signed out.`)) return;
    try {
      await employeeService.apiRequest(`/auth/two-factor/${encodeURIComponent(employee.id)}/reset`, { method: 'POST' });
      setFeedback('Two-factor authentication reset.');
    } catch (error) {
      setFeedback(error.message);
    }
  };

  const handleAccountStatus = async employee => {
    const active = !employee.isActive;
    if (!active && !window.confirm(`Deactivate ${employee.name}?`)) return;
    try {
      await employeeService.accountAction(employee.id, active ? 'activate' : 'deactivate');
      await onImportComplete?.();
      setFeedback(active ? 'Employee activated.' : 'Employee deactivated.');
    } catch (error) {
      setFeedback(error.message);
    }
  };

  const handleTerminate = async employee => {
    if (!window.confirm(`Terminate ${employee.name}? Their employment history will be retained.`)) return;
    try {
      await onDeleteEmployee(employee.id);
      setFeedback(`${employee.name} has been terminated.`);
    } catch (error) {
      setFeedback(error.message);
    }
  };

  const handleDocumentUpload = async (file, documentType) => {
    if (!selectedEmployee) return;
    if (!driveToken) {
      login();
      alert('Please connect to Google Drive first');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setDetailError('File size must be 10 MB or less.');
      return;
    }

    setUploadProgress(0);
    const interval = setInterval(() => {
      setUploadProgress(prev => Math.min(prev + 10, 90));
    }, 200);

    try {
      const updatedEmployee = await employeeService.uploadEmployeeDocument(
        selectedEmployee.id || selectedEmployee._id,
        file,
        documentType,
        driveToken.access_token
      );
      
      setUploadProgress(100);
      setSelectedEmployee(updatedEmployee);
      setShowDocumentUpload(false);
      setUploadProgress(null);
      alert(`${documentType} uploaded successfully!`);
      clearInterval(interval);
    } catch (error) {
      console.error('Upload error:', error);
      setDetailError(error.message || 'Upload failed. Please try again.');
      setUploadProgress(null);
      clearInterval(interval);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      active: 'bg-green-100 text-green-700',
      'on-leave': 'bg-yellow-100 text-yellow-700',
      inactive: 'bg-gray-100 text-gray-700',
      terminated: 'bg-red-100 text-red-700',
      suspended: 'bg-orange-100 text-orange-700'
    };
    return badges[status] || badges.active;
  };

  const getRoleBadge = (role) => {
    const badges = {
      CEO: 'bg-purple-100 text-purple-700',
      COO: 'bg-blue-100 text-blue-700',
      Manager: 'bg-blue-100 text-blue-700',
      'Co-Head': 'bg-teal-100 text-teal-700',
      'CO Head': 'bg-teal-100 text-teal-700',
      'Team Lead': 'bg-green-100 text-green-700',
      Member: 'bg-cyan-100 text-cyan-700'
    };
    return badges[role] || 'bg-gray-100 text-gray-700';
  };

  return (
    <div className="space-y-6">
      {feedback && <p className="alert" role="status">{feedback}</p>}
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Employee Master Database</h1>
        <p className="text-gray-500 mt-1">Centralized secure employee record system</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-5 gap-4">
        <div className="bg-white rounded-xl p-4 border shadow-sm hover:shadow-md transition-shadow">
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
          <div className="text-sm text-gray-600">Total Employees</div>
        </div>
        <div className="bg-white rounded-xl p-4 border shadow-sm hover:shadow-md transition-shadow">
          <div className="text-2xl font-bold text-green-600">{stats.active}</div>
          <div className="text-sm text-gray-600">Active</div>
        </div>
        <div className="bg-white rounded-xl p-4 border shadow-sm hover:shadow-md transition-shadow">
          <div className="text-2xl font-bold text-yellow-600">{stats.onLeave}</div>
          <div className="text-sm text-gray-600">On Leave</div>
        </div>
        <div className="bg-white rounded-xl p-4 border shadow-sm hover:shadow-md transition-shadow">
          <div className="text-2xl font-bold text-purple-600">{stats.ndaSigned}</div>
          <div className="text-sm text-gray-600">NDA Signed</div>
        </div>
        <div className="bg-white rounded-xl p-4 border shadow-sm hover:shadow-md transition-shadow">
          <div className="text-2xl font-bold text-blue-600">{stats.onboarded}</div>
          <div className="text-sm text-gray-600">Onboarded</div>
        </div>
      </div>

      {/* Role Summary */}
      <div className="bg-white rounded-xl border shadow-sm p-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-gray-500 mr-2">Employees by Role:</span>
          {Object.entries(roleCounts).map(([role, count]) => (
            <span key={role} className={`px-2 py-1 rounded ${getRoleBadge(role)}`}>
              {roleLabel(role)} ({count})
            </span>
          ))}
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-xl border shadow-sm p-4">
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <input
                type="text"
                placeholder="Search by name, email or employee ID..."
                value={searchTerm}
                maxLength={100}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <IconSearch className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            </div>
          </div>
          
          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="select px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
          >
            <option value="all">All Departments</option>
            {departments.map(dept => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>
          
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="select px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="on-leave">On Leave</option>
            <option value="inactive">Inactive</option>
            <option value="terminated">Terminated</option>
          </select>
          
          {canAdd && (
            <button
              onClick={() => setShowImportModal(true)}
              className="btn btn-sm btn-ghost px-4 py-2 border border-purple-600 text-purple-700 rounded-lg hover:bg-purple-50 transition-colors flex items-center space-x-2"
            >
              <Upload className="w-5 h-5" />
              <span>Import from Excel</span>
            </button>
          )}

          {canAdd && (
            <button
              onClick={() => setShowAddEmployeeModal(true)}
              className="btn btn-sm btn-ghost px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center space-x-2"
            >
              <IconPlus className="w-5 h-5" />
              <span>Add Employee</span>
            </button>
          )}
        </div>
      </div>

      {/* Employee Table */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">EMPLOYEE</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">DEPARTMENT</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">ROLE</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">STATUS</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">JOIN DATE</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredEmployees.map((employee) => (
                <tr key={employee.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${employee.isOnline ? 'bg-green-500' : 'bg-gray-400'}`} />
                      <button
                        onClick={() => handleViewEmployee(employee)}
                        className="font-medium text-purple-600 hover:text-purple-700 hover:underline"
                      >
                        {employee.name}
                      </button>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">{employee.isOnline ? 'Online now' : `Last seen ${employee.lastSeen ? displayDateTime(employee.lastSeen) : 'recently'}`}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{employee.employeeId || employee.id}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{employee.department}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getRoleBadge(employee.role || employee.designation)}`}>
                      {roleLabel(employee.role) || employee.designation}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadge(employee.employmentStatus)}`}>
                      {employee.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{employee.joinDate || employee.createdAt}</td>
                  <td className="px-6 py-4">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleViewEmployee(employee)}
                        className="btn btn-sm btn-ghost px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded transition-colors"
                      >
                        View
                      </button>
                      {employee.canResetPassword && employee.isActive && <button
                        onClick={() => handleResetPassword(employee)}
                        className="btn btn-sm btn-ghost px-2 py-1 text-xs text-orange-600 hover:bg-orange-50 rounded transition-colors"
                      >
                        {employee.setupEmailStatus ? 'Resend setup link' : 'Send reset link'}
                      </button>}
                      {employee.canTerminate && ['CEO', 'COO', 'HR'].includes(userRole) && (
                        <button className="btn btn-sm btn-ghost" onClick={() => handleTwoFactorReset(employee)}>
                          Reset two-factor authentication
                        </button>
                      )}
                      {employee.canDeactivate && <button className="btn btn-sm btn-ghost" onClick={() => handleAccountStatus(employee)}>
                        {employee.isActive ? 'Deactivate' : 'Activate'}
                      </button>}
                      {canDelete && employee.canTerminate && (
                        <button
                          onClick={() => handleTerminate(employee)}
                          className="btn btn-sm btn-ghost px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded transition-colors"
                        >
                          Terminate
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {filteredEmployees.length === 0 && (
          <div className="text-center py-12">
            <div className="text-4xl mb-2">📭</div>
            <p className="text-gray-500">No employees found</p>
          </div>
        )}
      </div>

      {/* Employee Details Modal */}
      {showEmployeeModal && selectedEmployee && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            {detailError && <p className="alert alert-error" role="alert">{detailError}</p>}
            {detailsBusy && <p className="px-6 py-2" role="status">Loading employee details…</p>}
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 z-10">
              <div className="flex justify-between items-start">
                <div className="flex items-center space-x-4">
                  {selectedEmployee.profilePhoto?.fileUrl ? (
                    <img 
                      src={selectedEmployee.profilePhoto.viewUrl} 
                      alt={selectedEmployee.name}
                      className="w-16 h-16 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-16 h-16 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center text-white text-xl font-bold">
                      {selectedEmployee.name?.charAt(0)}
                    </div>
                  )}
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">{selectedEmployee.name}</h2>
                    <p className="text-gray-500">{selectedEmployee.designation || roleLabel(selectedEmployee.role)} · {selectedEmployee.department}</p>
                    <p className="text-sm text-gray-400">ID: {selectedEmployee.employeeId || selectedEmployee.id}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setShowDocumentUpload(true)}
                    className="btn btn-sm btn-ghost px-3 py-1 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                  >
                    Upload to Drive
                  </button>
                  <button onClick={() => setShowEmployeeModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
                </div>
              </div>
              
              {/* Tabs */}
              <div className="flex space-x-6 mt-4 border-b">
                {['personal', 'professional', 'documents', 'banking', 'performance'].map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-1 py-2 text-sm font-medium capitalize transition-colors ${
                      activeTab === tab 
                        ? 'text-purple-600 border-b-2 border-purple-600' 
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6">
              {/* Personal Information Tab */}
              {activeTab === 'personal' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-3 flex items-center space-x-2">
                        <span>👤</span>
                        <span>Personal Information</span>
                      </h3>
                      <div className="space-y-3">
                        <div>
                          <label className="text-sm text-gray-500">Full Name</label>
                          <p className="text-gray-900">{selectedEmployee.name}</p>
                        </div>
                        <div>
                          <label className="text-sm text-gray-500">Email Address</label>
                          <p className="text-gray-900">{selectedEmployee.email}</p>
                        </div>
                        <div>
                          <label className="text-sm text-gray-500">Phone Number</label>
                          <p className="text-gray-900">{selectedEmployee.phone}</p>
                        </div>
                        <div>
                          <label className="text-sm text-gray-500">Date of Birth</label>
                          <p className="text-gray-900">{selectedEmployee.dateOfBirth}</p>
                        </div>
                        <div>
                          <label className="text-sm text-gray-500">Gender</label>
                          <p className="text-gray-900">{selectedEmployee.gender}</p>
                        </div>
                        <div>
                          <label className="text-sm text-gray-500">Blood Group</label>
                          <p className="text-gray-900">{selectedEmployee.bloodGroup}</p>
                        </div>
                        <div>
                          <label className="text-sm text-gray-500">Nationality</label>
                          <p className="text-gray-900">{selectedEmployee.nationality || 'Indian'}</p>
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-3 flex items-center space-x-2">
                        <span>📍</span>
                        <span>Address</span>
                      </h3>
                      <div className="space-y-3">
                        <div>
                          <label className="text-sm text-gray-500">Street</label>
                          <p className="text-gray-900">{selectedEmployee.address?.street}</p>
                        </div>
                        <div>
                          <label className="text-sm text-gray-500">City</label>
                          <p className="text-gray-900">{selectedEmployee.address?.city}</p>
                        </div>
                        <div>
                          <label className="text-sm text-gray-500">State</label>
                          <p className="text-gray-900">{selectedEmployee.address?.state}</p>
                        </div>
                        <div>
                          <label className="text-sm text-gray-500">Zip Code</label>
                          <p className="text-gray-900">{selectedEmployee.address?.zipCode}</p>
                        </div>
                        <div>
                          <label className="text-sm text-gray-500">Country</label>
                          <p className="text-gray-900">{selectedEmployee.address?.country}</p>
                        </div>
                      </div>
                      
                      <h3 className="font-semibold text-gray-900 mt-6 mb-3 flex items-center space-x-2">
                        <span>🚨</span>
                        <span>Emergency Contact</span>
                      </h3>
                      <div className="space-y-3">
                        <div>
                          <label className="text-sm text-gray-500">Name</label>
                          <p className="text-gray-900">{selectedEmployee.emergencyContact?.name}</p>
                        </div>
                        <div>
                          <label className="text-sm text-gray-500">Relation</label>
                          <p className="text-gray-900">{selectedEmployee.emergencyContact?.relation}</p>
                        </div>
                        <div>
                          <label className="text-sm text-gray-500">Phone</label>
                          <p className="text-gray-900">{selectedEmployee.emergencyContact?.phone}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Education */}
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-3 flex items-center space-x-2">
                      <span>🎓</span>
                      <span>Education Details</span>
                    </h3>
                    <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm text-gray-500">College/University</label>
                          <p className="text-gray-900 font-medium">{selectedEmployee.education?.college}</p>
                        </div>
                        <div>
                          <label className="text-sm text-gray-500">Degree</label>
                          <p className="text-gray-900">{selectedEmployee.education?.degree}</p>
                        </div>
                        <div>
                          <label className="text-sm text-gray-500">Specialization</label>
                          <p className="text-gray-900">{selectedEmployee.education?.specialization}</p>
                        </div>
                        <div>
                          <label className="text-sm text-gray-500">Graduation Year</label>
                          <p className="text-gray-900">{selectedEmployee.education?.graduationYear}</p>
                        </div>
                        <div>
                          <label className="text-sm text-gray-500">CGPA/Percentage</label>
                          <p className="text-gray-900">{selectedEmployee.education?.cgpa}</p>
                        </div>
                      </div>
                      {selectedEmployee.education?.documents?.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <label className="text-sm text-gray-500 mb-2 block">Educational Documents</label>
                          <div className="flex flex-wrap gap-2">
                            {selectedEmployee.education.documents.map((doc, idx) => (
                              <a key={idx} href={doc.viewUrl} target="_blank" className="text-sm text-purple-600 hover:underline">
                                {doc.name}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Professional Information Tab */}
              {activeTab === 'professional' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-3">💼 Employment Details</h3>
                      <div className="space-y-3">
                        <div>
                          <label className="text-sm text-gray-500">Designation</label>
                          <p className="text-gray-900">{selectedEmployee.designation || roleLabel(selectedEmployee.role)}</p>
                        </div>
                        <div>
                          <label className="text-sm text-gray-500">Department</label>
                          <p className="text-gray-900">{selectedEmployee.department}</p>
                        </div>
                        <div>
                          <label className="text-sm text-gray-500">Reporting Manager</label>
                          <p className="text-gray-900">{selectedEmployee.manager || 'Unassigned'}</p>
                        </div>
                        <div>
                          <label className="text-sm text-gray-500">Join Date</label>
                          <p className="text-gray-900">{selectedEmployee.joinDate}</p>
                        </div>
                        <div>
                          <label className="text-sm text-gray-500">Work Location</label>
                          <p className="text-gray-900">{selectedEmployee.workLocation}</p>
                        </div>
                        <div>
                          <label className="text-sm text-gray-500">Employment Status</label>
                          <span className={`ml-2 px-2 py-1 text-xs font-medium rounded-full ${getStatusBadge(selectedEmployee.employmentStatus)}`}>
                            {selectedEmployee.status}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-3">🛠️ Skills & Expertise</h3>
                      <div className="flex flex-wrap gap-2">
                        {selectedEmployee.skills?.map(skill => (
                          <span key={skill} className="px-2 py-1 bg-purple-100 text-purple-700 rounded-lg text-sm">
                            {skill}
                          </span>
                        ))}
                      </div>
                      
                      <h3 className="font-semibold text-gray-900 mt-6 mb-3">🔐 Login Credentials</h3>
                      <div className="space-y-3">
                        <div>
                          <label className="text-sm text-gray-500">Employee ID</label>
                          <p className="text-gray-900 font-mono">{selectedEmployee.employeeId || '—'}</p>
                        </div>
                        <div>
                          <label className="text-sm text-gray-500">Last Login</label>
                          <p className="text-gray-900">{selectedEmployee.lastLogin ? displayDateTime(selectedEmployee.lastLogin) : 'Never'}</p>
                        </div>
                        <div>
                          <label className="text-sm text-gray-500">Login Count</label>
                          <p className="text-gray-900">{selectedEmployee.credentials?.loginCount || 0}</p>
                        </div>
                        <div>
                          <label className="text-sm text-gray-500">Password Setup</label>
                          <p className="text-gray-900">{selectedEmployee.setupEmailStatus || 'Completed'}</p>
                        </div>
                    {selectedEmployee.leaveBalance && <dl className="mt-3 grid gap-2 sm:grid-cols-3">
                      {Object.entries(selectedEmployee.leaveBalance).map(([type, days]) => <div key={type}>
                        <dt className="text-sm text-gray-500">{type} leave</dt><dd>{days} days</dd>
                      </div>)}
                    </dl>}
                      </div>
                    </div>
                  </div>

                  {/* Resume */}
                  {selectedEmployee.resume && (
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-3">📄 Resume/CV</h3>
                      <div className="border rounded-lg p-4 flex justify-between items-center">
                        <div>
                          <p className="font-medium">{selectedEmployee.resume.fileName}</p>
                          <p className="text-sm text-gray-500">Uploaded: {selectedEmployee.resume.uploaded} · Version: {selectedEmployee.resume.version}</p>
                        </div>
                        <a href={selectedEmployee.resume.viewUrl} target="_blank" className="text-purple-600 hover:underline">
                          View Resume →
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Documents Tab */}
              {activeTab === 'documents' && (
                <div className="space-y-6">
                  {/* Government IDs */}
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-3">🪪 Government IDs</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="border rounded-lg p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium">Aadhaar Card</p>
                            <p className="text-sm text-gray-500">Number: {selectedEmployee.aadhaar?.number || 'Not provided'}</p>
                            <p className="text-sm text-gray-500">Verified: {selectedEmployee.aadhaar?.verified ? '✓ Yes' : '✗ No'}</p>
                          </div>
                          {selectedEmployee.aadhaar?.viewUrl && (
                            <a href={selectedEmployee.aadhaar.viewUrl} target="_blank" className="text-purple-600 text-sm hover:underline">
                              View
                            </a>
                          )}
                        </div>
                      </div>
                      <div className="border rounded-lg p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium">PAN Card</p>
                            <p className="text-sm text-gray-500">Number: {selectedEmployee.pan?.number || 'Not provided'}</p>
                            <p className="text-sm text-gray-500">Verified: {selectedEmployee.pan?.verified ? '✓ Yes' : '✗ No'}</p>
                          </div>
                          {selectedEmployee.pan?.viewUrl && (
                            <a href={selectedEmployee.pan.viewUrl} target="_blank" className="text-purple-600 text-sm hover:underline">
                              View
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Legal Agreements */}
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-3">📋 Legal Agreements</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                        <div>
                          <p className="font-medium">NDA Agreement</p>
                          <p className="text-sm text-gray-500">Signed: {selectedEmployee.nda?.signedDate || 'Not signed'}</p>
                        </div>
                        <span className={`text-sm ${selectedEmployee.nda?.signed ? 'text-green-600' : 'text-red-600'}`}>
                          {selectedEmployee.nda?.signed ? '✓ Signed' : '✗ Not Signed'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                        <div>
                          <p className="font-medium">Code of Conduct</p>
                          <p className="text-sm text-gray-500">Accepted: {selectedEmployee.codeOfConduct?.signedDate || 'Not accepted'}</p>
                        </div>
                        <span className={`text-sm ${selectedEmployee.codeOfConduct?.signed ? 'text-green-600' : 'text-red-600'}`}>
                          {selectedEmployee.codeOfConduct?.signed ? '✓ Accepted' : '✗ Not Accepted'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                        <div>
                          <p className="font-medium">IP Agreement</p>
                          <p className="text-sm text-gray-500">Signed: {selectedEmployee.ipAgreement?.signedDate || 'Not signed'}</p>
                        </div>
                        <span className={`text-sm ${selectedEmployee.ipAgreement?.signed ? 'text-green-600' : 'text-red-600'}`}>
                          {selectedEmployee.ipAgreement?.signed ? '✓ Signed' : '✗ Not Signed'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Onboarding Documents */}
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-3">📎 Onboarding Documents</h3>
                    <div className="space-y-2">
                      {selectedEmployee.onboardingDocs?.map((doc, idx) => (
                        <div key={idx} className="flex justify-between items-center p-3 border rounded-lg">
                          <div>
                            <p className="font-medium">{doc.name}</p>
                            <p className="text-xs text-gray-500">Uploaded: {doc.uploaded}</p>
                          </div>
                          <a href={doc.viewUrl} target="_blank" className="text-sm text-purple-600 hover:underline">
                            View Document →
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Drive Integration Button */}
                  <div className="pt-4 border-t">
                    <button
                      onClick={() => {
                        if (!driveToken) login();
                        setShowDocumentUpload(true);
                      }}
                      className="btn btn-sm btn-ghost w-full px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center justify-center space-x-2"
                    >
                      <IconFolder className="w-5 h-5" />
                      <span>{driveToken ? 'Upload Document to Google Drive' : 'Connect Google Drive to Upload'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Banking Tab */}
              {activeTab === 'banking' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-3">🏦 Bank Details</h3>
                      <div className="space-y-3">
                        <div>
                          <label className="text-sm text-gray-500">Account Holder Name</label>
                          <p className="text-gray-900">{selectedEmployee.bankDetails?.accountHolderName}</p>
                        </div>
                        <div>
                          <label className="text-sm text-gray-500">Account Number</label>
                          <p className="text-gray-900 font-mono">{selectedEmployee.bankDetails?.accountNumber}</p>
                        </div>
                        <div>
                          <label className="text-sm text-gray-500">IFSC Code</label>
                          <p className="text-gray-900">{selectedEmployee.bankDetails?.ifscCode}</p>
                        </div>
                        <div>
                          <label className="text-sm text-gray-500">Bank Name</label>
                          <p className="text-gray-900">{selectedEmployee.bankDetails?.bankName}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Performance Tab */}
              {activeTab === 'performance' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-3">⭐ Performance Review</h3>
                      <div className="space-y-3">
                        <div>
                          <label className="text-sm text-gray-500">Current Rating</label>
                          <div className="flex items-center space-x-2">
                            <span className="text-2xl font-bold text-purple-600">{selectedEmployee.performance?.rating}</span>
                            <span className="text-sm text-gray-500">/ 5.0</span>
                          </div>
                        </div>
                        <div>
                          <label className="text-sm text-gray-500">Last Review Date</label>
                          <p className="text-gray-900">{selectedEmployee.performance?.lastReview}</p>
                        </div>
                        <div>
                          <label className="text-sm text-gray-500">Next Review Date</label>
                          <p className="text-gray-900">{selectedEmployee.performance?.nextReview}</p>
                        </div>
                        <div>
                          <label className="text-sm text-gray-500">Manager's Comments</label>
                          <p className="text-gray-900 italic">{selectedEmployee.performance?.comments || 'No comments yet'}</p>
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-3">🏆 Achievements</h3>
                      <ul className="list-disc list-inside space-y-2">
                        {selectedEmployee.performance?.achievements?.map((achievement, idx) => (
                          <li key={idx} className="text-gray-700">{achievement}</li>
                        ))}
                        {(!selectedEmployee.performance?.achievements || selectedEmployee.performance.achievements.length === 0) && (
                          <li className="text-gray-500">No achievements recorded yet</li>
                        )}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-end space-x-3">
              <button
                onClick={() => setShowEmployeeModal(false)}
                className="btn btn-sm btn-ghost px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Close
              </button>
              {canEdit && selectedEmployee.canTerminate && (
                <button
                  disabled={detailsBusy}
                  onClick={() => setEditingEmployee(selectedEmployee)}
                  className="btn btn-sm btn-ghost px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  Edit employee
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {showImportModal && (
        <ImportEmployeesModal
          onClose={() => setShowImportModal(false)}
          onImported={() => onImportComplete && onImportComplete()}
        />
      )}

      {editingEmployee && <EmployeeForm employee={editingEmployee} userRole={userRole} onClose={() => setEditingEmployee(null)}
        onSave={async fields => {
          const updated = await onUpdateEmployee({ ...fields, id: editingEmployee.id });
          setSelectedEmployee({ ...selectedEmployee, ...updated });
          setFeedback('Employee updated.');
        }} />}

      {/* Add Employee Modal */}
      {showAddEmployeeModal && <EmployeeForm userRole={userRole} onClose={() => setShowAddEmployeeModal(false)}
        onSave={async fields => {
          await onAddEmployee(fields);
          setFeedback('Employee added. Password setup email queued.');
        }} />}

      {/* Document Upload Modal */}
      {showDocumentUpload && selectedEmployee && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-gray-900">Upload Document to Drive</h3>
                <button onClick={() => setShowDocumentUpload(false)} className="text-gray-400 hover:text-gray-600">×</button>
              </div>
              
              <p className="text-sm text-gray-600 mb-4">
                Uploading for: <span className="font-medium">{selectedEmployee.name}</span>
              </p>
              
              <select
                value={uploadingDocType}
                onChange={(e) => setUploadingDocType(e.target.value)}
                className="select w-full px-3 py-2 border rounded-lg mb-4 focus:ring-2 focus:ring-purple-500"
              >
                <option value="">Select Document Type</option>
                <option value="profile_photo">Profile Photo</option>
                <option value="aadhaar">Aadhaar Card</option>
                <option value="pan">PAN Card</option>
                <option value="resume">Resume/CV</option>
                <option value="education">Education Document</option>
                <option value="nda">NDA Agreement</option>
                <option value="code_of_conduct">Code of Conduct</option>
                <option value="ip_agreement">IP Agreement</option>
                <option value="onboarding">Onboarding Document</option>
              </select>
              
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                onChange={(e) => {
                  if (e.target.files[0] && uploadingDocType) {
                    handleDocumentUpload(e.target.files[0], uploadingDocType);
                  } else if (!uploadingDocType) {
                    alert('Please select a document type first');
                  }
                }}
                className="file-input w-full"
              />
              
              {uploadProgress !== null && (
                <div className="mt-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span>Uploading...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-purple-600 rounded-full h-2 transition-all" style={{ width: `${uploadProgress}%` }}></div>
                  </div>
                </div>
              )}
              
              {!driveToken && (
                <button
                  onClick={login}
                  className="btn btn-sm btn-ghost mt-4 w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Connect Google Drive First
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeManagement;
