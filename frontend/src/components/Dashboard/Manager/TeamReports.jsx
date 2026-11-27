import { Clock as IconClock, Download as IconDownload, Search as IconSearch, X as IconX } from '../../Common/Icons';
import { displayDate, displayDateTime, displayTime } from '../../../utils/timeZone';
// src/components/Dashboard/Manager/TeamReports.jsx
import React, { useState, useEffect } from 'react';
import DailyReportReview from '../../Common/DailyReportReview';
import roadmapService from '../../../services/roadmapService';
import { roleLabel } from '../../../utils/roleLabels';

const ManagerTeamReports = ({ userRole = 'Manager', department, user }) => {
  const isExecutiveViewer = userRole === 'COO';
  const roadmapAudienceText = isExecutiveViewer ? 'Director View' : 'Project Manager View';
  const issuedByText = isExecutiveViewer ? 'team leads' : 'your team lead';
  const [sharedRoadmaps, setSharedRoadmaps] = useState([]);
  const [activeTab, setActiveTab] = useState('daily');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRoadmap, setSelectedRoadmap] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [toast, setToast] = useState(null);
  const reportDepartment = isExecutiveViewer ? undefined : (department || user?.department);
  const [roadmapError, setRoadmapError] = useState('');

  useEffect(() => {
    if (activeTab !== 'mvp') return;
    let current = true;
    setLoading(true);
    setRoadmapError('');
    async function loadRoadmaps() {
      const filters = { status: 'shared' };
      if (reportDepartment) filters.department = reportDepartment;
      try {
        const roadmaps = await roadmapService.getAllRoadmaps(filters);
        if (current) setSharedRoadmaps(roadmaps);
      } catch (error) {
        if (current) setRoadmapError(error.message || 'Could not load roadmaps.');
      } finally {
        if (current) setLoading(false);
      }
    }
    loadRoadmaps();
    return () => { current = false; };
  }, [activeTab, reportDepartment]);

  const showToastMessage = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const getFilteredRoadmaps = () => {
    let filtered = [...sharedRoadmaps];
    
    if (searchTerm) {
      filtered = filtered.filter(r => 
        r.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.sharedBy?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.department || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.description || '').toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    return filtered;
  };

  const downloadRoadmap = (roadmap) => {
    const content = `MVP ROADMAP REPORT - ${roadmapAudienceText.toUpperCase()}
===================================

BASIC INFORMATION
-----------------
Title: ${roadmap.title}
Version: ${roadmap.version}
Status: ${roadmap.status.toUpperCase()}
Department: ${roadmap.department}
Lead: ${roadmap.sharedBy?.name || 'Team Lead'} (${roadmap.sharedBy?.role || 'Team Lead'})
Issued On: ${displayDateTime(roadmap.sharedAt)}

DESCRIPTION
-----------
${roadmap.description}

TIMELINE
--------
Start Date: ${displayDate(roadmap.startDate)}
Target Date: ${displayDate(roadmap.targetDate)}
Overall Progress: ${roadmap.overallProgress}%
Last Updated: ${displayDate(roadmap.lastUpdated)}

MILESTONES
----------
${roadmap.milestones.map(m => `✓ ${m.title}
   Due: ${displayDate(m.dueDate)}
   Status: ${m.status}
   Progress: ${m.progress}%
   Description: ${m.description}
`).join('\n')}

FEATURES
--------
${roadmap.features.map(f => `• ${f.name}
   Priority: ${f.priority.toUpperCase()}
   Status: ${f.status}
   ${f.completionDate ? `Completed: ${displayDate(f.completionDate)}` : ''}
   ${f.expectedCompletion ? `Expected: ${displayDate(f.expectedCompletion)}` : ''}
`).join('\n')}

RISKS & MITIGATION
-----------------
${roadmap.risks.map(r => `⚠ ${r.description}
   Impact: ${r.impact.toUpperCase()}
   Status: ${r.status}
   Mitigation: ${r.mitigation}
   Owner: ${r.owner || 'Not assigned'}
`).join('\n')}

Report Generated: ${displayDateTime(new Date())}
    `;
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${roadmap.title.replace(/\s/g, '_')}_Roadmap_Manager_View.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showToastMessage('Roadmap downloaded successfully', 'success');
  };

  const getMilestoneStatusColor = (status) => {
    const colors = {
      completed: 'bg-green-100 text-green-700',
      'in-progress': 'bg-blue-100 text-blue-700',
      planned: 'bg-gray-100 text-gray-700'
    };
    return colors[status] || colors.planned;
  };

  const getPriorityBadge = (priority) => {
    const badges = {
      high: 'bg-red-100 text-red-700',
      medium: 'bg-yellow-100 text-yellow-700',
      low: 'bg-green-100 text-green-700'
    };
    return badges[priority] || badges.medium;
  };

  const formatAttachmentSize = (attachment) => {
    if (attachment.displaySize) return attachment.displaySize;
    if (typeof attachment.size === 'number') return `${(attachment.size / (1024 * 1024)).toFixed(2)} MB`;
    return attachment.size || 'Unknown size';
  };

  const downloadAttachment = async (roadmap, attachment) => {
    const success = await roadmapService.downloadAttachment(roadmap.id || roadmap._id, attachment.id, attachment.name);
    showToastMessage(
      success ? `${attachment.name} downloaded successfully` : `Could not download ${attachment.name}`,
      success ? 'success' : 'error'
    );
  };

  const filteredRoadmaps = getFilteredRoadmaps();

  if (activeTab === 'mvp' && loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-200 border-t-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading team data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 animate-slide-up">
          <div className={`px-4 py-3 rounded-lg shadow-lg text-white ${
            toast.type === 'success' ? 'bg-green-600' : 
            toast.type === 'error' ? 'bg-red-600' : 'bg-blue-600'
          }`}>
            {toast.message}
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="border-b">
          <div className="flex">
            <button
              onClick={() => setActiveTab('daily')}
              className={`px-6 py-3 text-sm font-medium transition-all duration-200 ${
                activeTab === 'daily'
                  ? 'border-b-2 border-purple-600 text-purple-600 bg-purple-50/30'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span className="flex items-center space-x-2">
                <span>📊</span>
                <span>Team Reports</span>
              </span>
            </button>
            <button
              onClick={() => setActiveTab('mvp')}
              className={`px-6 py-3 text-sm font-medium transition-all duration-200 ${
                activeTab === 'mvp'
                  ? 'border-b-2 border-purple-600 text-purple-600 bg-purple-50/30'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span className="flex items-center space-x-2">
                <span>🚀</span>
                <span>MVP Roadmaps</span>
                {sharedRoadmaps.length > 0 && (
                  <span className="ml-2 px-2 py-0.5 text-xs bg-purple-100 text-purple-700 rounded-full">
                    {sharedRoadmaps.length}
                  </span>
                )}
              </span>
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'daily' && <DailyReportReview scopedDepartment={reportDepartment} />}
      {activeTab === 'mvp' && roadmapError && <p className="alert alert-error" role="alert">{roadmapError}</p>}

      {/* MVP Roadmaps Tab */}
      {activeTab === 'mvp' && (
        <div className="space-y-6">
          {/* Search Bar */}
          <div className="bg-white rounded-xl shadow-sm border p-4">
            <div className="relative">
              <input
                type="text"
                placeholder="Search roadmaps by title or lead..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
              />
              <IconSearch className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            </div>
          </div>

          {filteredRoadmaps.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">📭</span>
              </div>
              <p className="text-gray-500 text-lg">No issued roadmaps available</p>
              <p className="text-sm text-gray-400 mt-1">Roadmaps issued by {issuedByText} will appear here</p>
            </div>
          ) : (
            filteredRoadmaps.map(roadmap => (
              <div key={roadmap.id} className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-lg transition-all duration-200 overflow-hidden">
                <div className="p-6">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center flex-wrap gap-3 mb-2">
                        <h3 className="text-xl font-bold text-gray-900">{roadmap.title}</h3>
                        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">v{roadmap.version}</span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          roadmap.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                        }`}>
                          {roadmap.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 line-clamp-2">{roadmap.description}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => {
                          setSelectedRoadmap(roadmap);
                          setShowModal(true);
                        }}
                        className="btn btn-sm btn-ghost px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors"
                      >
                        View Details
                      </button>
                      <button
                        onClick={() => downloadRoadmap(roadmap)}
                        className="p-2 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                        title="Download Roadmap"
                      >
                        <IconDownload className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {/* Issued Info Bar */}
                  <div className="mb-4 p-3 bg-purple-50 rounded-lg flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center space-x-4 flex-wrap gap-3">
                      <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center text-white text-xs font-semibold">
                          {roadmap.sharedBy?.avatar || 'TL'}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{roadmap.sharedBy?.name || 'Team Lead'}</p>
                          <p className="text-xs text-gray-500">{roleLabel(roadmap.sharedBy?.role || 'Team Lead')}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <IconClock className="w-4 h-4 text-purple-600" />
                        <span className="text-sm text-gray-600">Issued: {displayDate(roadmap.sharedAt)}</span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <p className="text-sm text-gray-500">Overall Progress</p>
                        <div className="flex items-center space-x-2">
                          <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div className="h-full bg-purple-600 rounded-full transition-all" style={{ width: `${roadmap.overallProgress}%` }}></div>
                          </div>
                          <span className="text-sm font-semibold text-purple-600">{roadmap.overallProgress}%</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Quick Stats Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                      <p className="text-2xl font-bold text-blue-600">{roadmap.milestones.length}</p>
                      <p className="text-xs text-gray-600">Total Milestones</p>
                    </div>
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <p className="text-2xl font-bold text-green-600">
                        {roadmap.milestones.filter(m => m.status === 'completed').length}
                      </p>
                      <p className="text-xs text-gray-600">Completed</p>
                    </div>
                    <div className="text-center p-3 bg-purple-50 rounded-lg">
                      <p className="text-2xl font-bold text-purple-600">{roadmap.features.length}</p>
                      <p className="text-xs text-gray-600">Features</p>
                    </div>
                    <div className="text-center p-3 bg-orange-50 rounded-lg">
                      <p className="text-2xl font-bold text-orange-600">{roadmap.risks.length}</p>
                      <p className="text-xs text-gray-600">Active Risks</p>
                    </div>
                  </div>

                  {/* Timeline Preview */}
                  <div className="pt-3 border-t border-gray-100">
                    <div className="flex items-center justify-between text-sm text-gray-600">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium">Start:</span>
                        <span>{displayDate(roadmap.startDate)}</span>
                      </div>
                      <div className="flex-1 mx-4 h-px bg-gray-200"></div>
                      <div className="flex items-center space-x-2">
                        <span className="font-medium">Target:</span>
                        <span>{displayDate(roadmap.targetDate)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Roadmap Details Modal */}
      {showModal && selectedRoadmap && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto animate-slide-up">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{selectedRoadmap.title}</h2>
                <div className="flex items-center space-x-3 mt-1">
                  <p className="text-sm text-gray-500">Version {selectedRoadmap.version}</p>
                  <span className="text-gray-300">|</span>
                  <p className="text-sm text-gray-500">Issued by {selectedRoadmap.sharedBy?.name || 'Team Lead'}</p>
                  <span className="text-gray-300">|</span>
                  <p className="text-sm text-gray-500">{displayDate(selectedRoadmap.sharedAt)}</p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <IconX className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              {/* Description */}
              <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-5">
                <h3 className="font-semibold text-gray-900 mb-2">📋 Description</h3>
                <p className="text-gray-700">{selectedRoadmap.description}</p>
              </div>

              {/* Progress Overview */}
              <div className="bg-gray-50 rounded-xl p-5">
                <h3 className="font-semibold text-gray-900 mb-3">📊 Progress Overview</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Overall Completion</p>
                    <div className="flex items-center space-x-3">
                      <div className="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full bg-purple-600 rounded-full transition-all" style={{ width: `${selectedRoadmap.overallProgress}%` }}></div>
                      </div>
                      <span className="text-lg font-bold text-purple-600">{selectedRoadmap.overallProgress}%</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Timeline Status</p>
                    <div className="flex items-center justify-between text-sm">
                      <span>Start: {displayDate(selectedRoadmap.startDate)}</span>
                      <span className="text-gray-400">→</span>
                      <span>Target: {displayDate(selectedRoadmap.targetDate)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Milestones */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">🎯 Milestones</h3>
                <div className="space-y-3">
                  {selectedRoadmap.milestones.map(milestone => (
                    <div key={milestone.id} className="border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-gray-900">{milestone.title}</h4>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getMilestoneStatusColor(milestone.status)}`}>
                          {milestone.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{milestone.description}</p>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">Due: {displayDate(milestone.dueDate)}</span>
                        <div className="flex items-center space-x-2">
                          <span className="text-gray-500">Progress:</span>
                          <div className="w-24 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div className="h-full bg-purple-600 rounded-full" style={{ width: `${milestone.progress}%` }}></div>
                          </div>
                          <span className="text-sm font-medium">{milestone.progress}%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Features */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">✨ Features</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {selectedRoadmap.features.map(feature => (
                    <div key={feature.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">{feature.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {feature.status === 'completed' ? `Completed: ${displayDate(feature.completionDate)}` :
                           feature.expectedCompletion ? `Expected: ${displayDate(feature.expectedCompletion)}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${getPriorityBadge(feature.priority)}`}>
                          {feature.priority}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          feature.status === 'completed' ? 'bg-green-100 text-green-700' :
                          feature.status === 'in-progress' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                        }`}>
                          {feature.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Risks */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">⚠️ Risks & Mitigation</h3>
                <div className="space-y-3">
                  {selectedRoadmap.risks.map(risk => (
                    <div key={risk.id} className="border border-orange-200 bg-orange-50 rounded-xl p-4">
                      <p className="font-medium text-gray-900">{risk.description}</p>
                      <div className="flex flex-wrap gap-3 mt-2 text-sm">
                        <span className="text-orange-700">Impact: {risk.impact.toUpperCase()}</span>
                        <span className="text-gray-500">Status: {risk.status}</span>
                        {risk.owner && <span className="text-gray-500">Owner: {risk.owner}</span>}
                      </div>
                      <p className="text-sm text-gray-600 mt-2">Mitigation: {risk.mitigation}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Attachments */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Attachments</h3>
                {selectedRoadmap.attachments?.length > 0 ? (
                  <div className="space-y-2">
                    {selectedRoadmap.attachments.map(attachment => (
                      <div key={attachment.id} className="flex items-center justify-between gap-3 border border-gray-200 rounded-xl p-3">
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 truncate">{attachment.name}</p>
                          <p className="text-xs text-gray-500">{formatAttachmentSize(attachment)}</p>
                        </div>
                        <button
                          onClick={() => downloadAttachment(selectedRoadmap, attachment)}
                          className="btn btn-sm btn-ghost shrink-0 px-3 py-1.5 text-sm text-purple-600 hover:bg-purple-50 rounded-lg"
                        >
                          Download
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No files attached.</p>
                )}
              </div>

              {/* Weekly Updates */}
              {selectedRoadmap.weeklyUpdates && selectedRoadmap.weeklyUpdates.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">📈 Weekly Progress Updates</h3>
                  <div className="space-y-3">
                    {selectedRoadmap.weeklyUpdates.map((update, idx) => (
                      <div key={idx} className="border border-gray-200 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium text-gray-900">Week {update.week} - {displayDate(update.date)}</h4>
                          <div className="flex items-center space-x-2">
                            <span className="text-sm text-gray-500">Progress:</span>
                            <span className="font-semibold text-purple-600">{update.progress}%</span>
                            <span className="text-sm text-gray-500">Team Health:</span>
                            <span className="font-semibold text-green-600">{update.teamHealth}%</span>
                          </div>
                        </div>
                        {update.completedFeatures.length > 0 && (
                          <p className="text-sm text-gray-600">✅ Completed: {update.completedFeatures.join(', ')}</p>
                        )}
                        <p className="text-sm text-gray-600">📅 Next Plan: {update.nextWeekPlan.join(', ')}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-end">
              <button
                onClick={() => downloadRoadmap(selectedRoadmap)}
                className="btn btn-sm btn-ghost px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center space-x-2"
              >
                <IconDownload className="w-4 h-4" />
                <span>Download Full Report</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-slide-up {
          animation: slideUp 0.3s ease-out;
        }
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
    </div>
  );
};

export default ManagerTeamReports;
