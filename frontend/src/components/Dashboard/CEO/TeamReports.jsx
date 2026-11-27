import { Search as IconSearch } from '../../Common/Icons';
import { displayDate, displayTime } from '../../../utils/timeZone';
// src/components/Dashboard/CEO/TeamReports.jsx
import React, { useState, useEffect } from 'react';
import DailyReportReview from '../../Common/DailyReportReview';
import roadmapService from '../../../services/roadmapService';
import { DEPARTMENTS } from '../../../utils/departments';

const CEOTeamReports = ({ userRole = 'CEO', department, user }) => {
  const [sharedRoadmaps, setSharedRoadmaps] = useState([]);
  const [activeTab, setActiveTab] = useState('daily');
  const [loading, setLoading] = useState(true);
  const [filterDepartment, setFilterDepartment] = useState('all');
  const [selectedRoadmap, setSelectedRoadmap] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [toast, setToast] = useState(null);
  const [roadmapError, setRoadmapError] = useState('');

  useEffect(() => {
    if (activeTab !== 'mvp') return;
    let current = true;
    setLoading(true);
    setRoadmapError('');
    async function loadRoadmaps() {
      const filters = { status: 'shared' };
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
  }, [activeTab]);

  const showToastMessage = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const getFilteredRoadmaps = () => {
    let filtered = [...sharedRoadmaps];
    
    if (filterDepartment !== 'all') {
      filtered = filtered.filter(r => r.department === filterDepartment);
    }
    
    if (searchTerm) {
      filtered = filtered.filter(r => 
        r.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.sharedBy?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.department || '').toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    return filtered;
  };

  const downloadRoadmap = (roadmap) => {
    const content = `MVP ROADMAP REPORT
==================
Title: ${roadmap.title}
Version: ${roadmap.version}
Issued By: ${roadmap.sharedBy?.name || 'Team Lead'}
Department: ${roadmap.department}
Progress: ${roadmap.overallProgress}%

DESCRIPTION
${roadmap.description}

MILESTONES
${roadmap.milestones.map(m => `- ${m.title}: ${m.status} (${m.progress}%)`).join('\n')}

FEATURES
${roadmap.features.map(f => `- ${f.name} [${f.priority}] - ${f.status}`).join('\n')}

RISKS
${roadmap.risks.map(r => `- ${r.description} (Impact: ${r.impact})`).join('\n')}

ATTACHMENTS
${roadmap.attachments?.length ? roadmap.attachments.map(a => `- ${a.name} (${formatAttachmentSize(a)})`).join('\n') : 'None'}
    `;
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${roadmap.title.replace(/\s/g, '_')}_Roadmap.txt`;
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
          <p className="mt-4 text-gray-600">Loading data...</p>
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
                <span>Daily Reports</span>
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

      {/* Filter Bar */}
      {activeTab === 'mvp' && <div className="bg-white rounded-xl shadow-sm border p-4">
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="text-sm text-gray-500">Filter by:</span>
            <select
              value={filterDepartment}
              onChange={(e) => setFilterDepartment(e.target.value)}
              className="select px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">All Departments</option>
              {DEPARTMENTS.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>
          
          {activeTab === 'mvp' && (
            <div className="flex-1 max-w-md">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search roadmaps..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="input w-full px-4 py-1.5 pl-10 border border-gray-300 rounded-lg text-sm"
                />
                <IconSearch className="absolute left-3 top-2 w-4 h-4 text-gray-400" />
              </div>
            </div>
          )}
        </div>
      </div>}

      {activeTab === 'daily' && <DailyReportReview />}
      {activeTab === 'mvp' && roadmapError && <p className="alert alert-error" role="alert">{roadmapError}</p>}

      {/* MVP Roadmaps Tab */}
      {activeTab === 'mvp' && (
        <div className="space-y-6">
          {filteredRoadmaps.length === 0 ? (
            <div className="bg-white rounded-xl border p-12 text-center">
              <div className="text-6xl mb-4">📭</div>
              <p className="text-gray-500">No issued roadmaps available</p>
            </div>
          ) : (
            filteredRoadmaps.map(roadmap => (
              <div key={roadmap.id} className="bg-white rounded-xl border shadow-sm hover:shadow-lg transition-all overflow-hidden">
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">{roadmap.title}</h3>
                      <p className="text-sm text-gray-500 mt-1">Issued by {roadmap.sharedBy?.name || 'Team Lead'} • {roadmap.department}</p>
                    </div>
                    <button
                      onClick={() => downloadRoadmap(roadmap)}
                      className="btn btn-sm btn-ghost px-3 py-1.5 text-sm text-purple-600 hover:bg-purple-50 rounded-lg"
                    >
                      Download
                    </button>
                  </div>
                  <p className="text-gray-600 mb-4">{roadmap.description}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <span className="text-sm text-gray-500">Progress: {roadmap.overallProgress}%</span>
                      <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full bg-purple-600 rounded-full" style={{ width: `${roadmap.overallProgress}%` }}></div>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedRoadmap(roadmap);
                        setShowModal(true);
                      }}
                      className="text-sm text-purple-600 hover:text-purple-700"
                    >
                      View Details →
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Modal */}
      {showModal && selectedRoadmap && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b p-4 flex justify-between items-center">
              <h2 className="text-xl font-bold">{selectedRoadmap.title}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-700">×</button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-gray-600">{selectedRoadmap.description}</p>
              <div>
                <h3 className="font-semibold mb-2">Milestones</h3>
                {selectedRoadmap.milestones.map(m => (
                  <div key={m.id} className="mb-2 p-2 bg-gray-50 rounded">
                    <span className="font-medium">{m.title}</span>
                    <span className={`ml-2 text-xs px-2 py-0.5 rounded ${getMilestoneStatusColor(m.status)}`}>{m.status}</span>
                    <p className="text-sm text-gray-500 mt-1">{m.description}</p>
                  </div>
                ))}
              </div>
              <div>
                <h3 className="font-semibold mb-2">Features</h3>
                {selectedRoadmap.features.map(f => (
                  <div key={f.id} className="flex justify-between items-center p-2 bg-gray-50 rounded mb-1">
                    <span>{f.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${getPriorityBadge(f.priority)}`}>{f.priority}</span>
                  </div>
                ))}
              </div>
              <div>
                <h3 className="font-semibold mb-2">Attachments</h3>
                {selectedRoadmap.attachments?.length > 0 ? (
                  <div className="space-y-2">
                    {selectedRoadmap.attachments.map(attachment => (
                      <div key={attachment.id} className="flex items-center justify-between gap-3 p-2 bg-gray-50 rounded">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{attachment.name}</p>
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
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-slide-up { animation: slideUp 0.3s ease-out; }
      `}</style>
    </div>
  );
};

export default CEOTeamReports;
