import { Edit } from '../../Common/Icons';
import { AlertCircle as IconAlertCircle, Camera as IconCamera, Check as IconCheck, Info as IconInfo } from '../../Common/Icons';
import { displayDateTime } from '../../../utils/timeZone';
// src/components/Dashboard/Member/MemberProfileView.jsx
import React, { useState } from 'react';
import authService from '../../../services/authService';
import { roleLabel } from '../../../utils/roleLabels';

const MemberProfileView = ({ userData, onUpdate }) => {
  const [formData, setFormData] = useState(userData);
  const [originalData] = useState(userData);
  const [isEditing, setIsEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [profilePhotoPreview, setProfilePhotoPreview] = useState(userData?.profilePhoto || null);
  const [changes, setChanges] = useState({});

  const handleInputChange = (field, value) => {
    setFormData({ ...formData, [field]: value });
    
    // Track changes
    if (value !== originalData[field]) {
      setChanges({ ...changes, [field]: { old: originalData[field], new: value } });
    } else {
      const newChanges = { ...changes };
      delete newChanges[field];
      setChanges(newChanges);
    }
  };

  const handleProfilePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setError('Profile photo must be less than 2MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfilePhotoPreview(reader.result);
        setChanges({ ...changes, profilePhoto: { old: 'Previous Photo', new: 'Updated Photo' } });
      };
      reader.readAsDataURL(file);
    }
  };

  const sendNotificationToManager = async () => {
    try {
      const currentUser = authService.getCurrentUser();
      const changeList = Object.entries(changes).map(([field, data]) => {
        const fieldNames = {
          name: 'Full Name',
          email: 'Email Address',
          phone: 'Phone Number',
          profilePhoto: 'Profile Photo'
        };
        return `• ${fieldNames[field]}: "${data.old}" → "${data.new}"`;
      }).join('\n');

      const notificationData = {
        employeeName: formData.name,
        employeeId: formData.employeeId,
        department: formData.department,
        role: formData.role,
        changes: changes,
        changeList: changeList,
        timestamp: displayDateTime(new Date())
      };

      // Store in localStorage for manager to see
      const existingNotifications = JSON.parse(localStorage.getItem('managerNotifications') || '[]');
      existingNotifications.unshift({
        id: Date.now(),
        type: 'profile_update',
        ...notificationData,
        read: false
      });
      localStorage.setItem('managerNotifications', JSON.stringify(existingNotifications));
      
      console.log('Notification sent to manager:', notificationData);
    } catch (error) {
      console.error('Error sending notification:', error);
    }
  };

  const handleSave = async () => {
    if (formData.phone && !/^[+]?[\d\s-]{10,15}$/.test(formData.phone)) {
      setError('Please enter a valid phone number');
      return;
    }
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setError('Please enter a valid email address');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      const updateData = {
        ...formData,
        profilePhoto: profilePhotoPreview,
        updatedAt: new Date().toISOString()
      };

      await onUpdate(updateData);
      
      if (Object.keys(changes).length > 0) {
        await sendNotificationToManager();
      }
      
      setIsEditing(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError('Failed to save changes. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setFormData(originalData);
    setProfilePhotoPreview(originalData?.profilePhoto);
    setIsEditing(false);
    setError('');
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-4">
          <h2 className="text-xl font-semibold text-white">My Profile</h2>
          <p className="text-purple-100 text-sm">View and edit your personal information</p>
        </div>
        
        <div className="p-6">
          {saved && (
            <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-lg flex items-center space-x-2 border border-green-200">
              <IconCheck className="w-5 h-5" />
              <span>Profile updated successfully! Your manager has been notified.</span>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg flex items-center space-x-2 border border-red-200">
              <IconAlertCircle className="w-5 h-5" />
              <span>{error}</span>
            </div>
          )}

          {/* Profile Photo */}
          <div className="flex items-center space-x-4 pb-4 border-b border-gray-200">
            <div className="relative">
              {profilePhotoPreview ? (
                <img 
                  src={profilePhotoPreview} 
                  alt={formData?.name}
                  className="w-20 h-20 rounded-full object-cover border-2 border-purple-600"
                />
              ) : (
                <div className="w-20 h-20 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                  {formData?.name?.split(' ').map(n => n[0]).join('') || 'U'}
                </div>
              )}
              {isEditing && (
                <label className="absolute bottom-0 right-0 w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center cursor-pointer hover:bg-purple-700">
                  <IconCamera className="w-3 h-3 text-white" />
                  <input type="file" className="file-input hidden" accept="image/*" onChange={handleProfilePhotoChange} />
                </label>
              )}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{formData?.name}</h3>
              <p className="text-gray-500">{roleLabel(formData?.role)} · {formData?.department}</p>
              <p className="text-sm text-gray-400">Employee ID: {formData?.employeeId}</p>
              {!isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="mt-2 text-sm text-purple-600 hover:text-purple-700 flex items-center space-x-1"
                >
                  <Edit className="w-4 h-4" />
                  <span>Edit Profile</span>
                </button>
              )}
            </div>
          </div>

          {/* Form Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              {isEditing ? (
                <input
                  type="text"
                  value={formData.name || ''}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className="input w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              ) : (
                <p className="text-gray-900">{formData?.name}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
              {isEditing ? (
                <input
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className="input w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              ) : (
                <p className="text-gray-900">{formData?.email}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
              {isEditing ? (
                <input
                  type="tel"
                  value={formData.phone || ''}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  className="input w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              ) : (
                <p className="text-gray-900">{formData?.phone || 'Not provided'}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <p className="text-gray-900">{roleLabel(formData?.role)}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
              <p className="text-gray-900">{formData?.department}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Join Date</label>
              <p className="text-gray-900">{formData?.joinDate || 'N/A'}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                {formData?.status || 'Active'}
              </span>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Manager</label>
              <p className="text-gray-900">{formData?.manager || 'N/A'}</p>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 mt-6">
            {isEditing ? (
              <>
                <button
                  onClick={handleCancel}
                  className="btn btn-sm btn-ghost px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="btn btn-sm btn-ghost px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center space-x-2"
                >
                  {isSaving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Changes</span>
                  )}
                </button>
              </>
            ) : null}
          </div>

          {isEditing && (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-xs text-blue-700 flex items-center space-x-2">
                <IconInfo className="w-4 h-4" />
                <span>Your manager will be notified of any changes made to your profile.</span>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MemberProfileView;