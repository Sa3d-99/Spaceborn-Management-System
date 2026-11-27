import { displayDate } from '../../../utils/timeZone';
// src/components/Dashboard/Member/MemberDashboard.js
import React, { useState } from 'react';
import useDashboardData from '../useDashboardData';
import taskService from '../../../services/taskService';
import {
  getTaskId,
  normalizeTaskList,
} from '../../../utils/taskMapper';
import { roleLabel } from '../../../utils/roleLabels';

const MemberDashboard = ({ user }) => {
  const { data, error, reload } = useDashboardData('/dashboard/member', 'Could not load the dashboard.');
  const [actionError, setActionError] = useState('');
  const memberData = {
    ...data?.profile,
    name: user.name || user.employeeId,
    role: user.role,
    title: [user.department, user.designation].filter(Boolean).join(' · '),
    myTasks: normalizeTaskList(data?.myTasks || []),
    sprintOverview: data?.sprintOverview || {},
    upcomingDeadlines: data?.upcomingDeadlines || []
  };

  async function updateTaskProgress(taskId, newProgress) {
    setActionError('');
    try {
      await taskService.updateTaskProgress(taskId, newProgress);
      reload();
    } catch {
      setActionError('Could not update task progress. Try again.');
    }
  }

  const getStatusColor = (status) => {
    switch(status?.toLowerCase()) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'in progress': return 'bg-yellow-100 text-yellow-800';
      case 'not started': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority) => {
    switch(priority?.toLowerCase()) {
      case 'high': return 'border-red-200 bg-red-50';
      case 'medium': return 'border-yellow-200 bg-yellow-50';
      case 'low': return 'border-green-200 bg-green-50';
      default: return 'border-gray-200 bg-gray-50';
    }
  };

  if (error) return <div className="alert alert-error" role="alert">{error}
    <button className="btn btn-sm" onClick={reload}>Try again</button>
  </div>;
  if (!data) return <p role="status">Loading dashboard…</p>;

  return (
    <div>
      {actionError && <p className="alert alert-error" role="alert">{actionError}</p>}
      {/* Profile Header - Member Theme (Cyan) */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
        <div className="flex items-start space-x-4">
          <div className="w-16 h-16 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-full flex items-center justify-center text-white text-2xl font-bold">
            {memberData.name?.split(' ').filter(Boolean).slice(0, 2).map(part => part[0]).join('')}
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{memberData.name}</h1>
                <p className="text-sm text-cyan-600 font-medium mt-1">{roleLabel(memberData.role)}</p>
                <p className="text-sm text-gray-500">{memberData.title}</p>
              </div>
            </div>
            <p className="text-gray-600 mt-3">{memberData.description}</p>
          </div>
        </div>
      </div>

      {/* My Tasks Section */}
      <div className="bg-white rounded-xl border border-gray-200 mb-8">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">My tasks</h2>
        </div>
        <div className="p-6">
          {memberData.myTasks.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No tasks assigned</p>
          ) : (
            <div className="space-y-4">
              {memberData.myTasks.map((task) => (
                <div key={getTaskId(task)} className={`flex items-center justify-between p-4 rounded-lg ${getPriorityColor(task.priority)}`}>
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <p className="font-medium text-gray-900">{task.title}</p>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(task.status)}`}>
                        {task.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      Due {task.dueDate ? displayDate(task.dueDate, 'en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                    </p>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="w-32">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-600">{task.progress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-cyan-500 rounded-full h-2 transition-all duration-300"
                          style={{ width: `${task.progress}%` }}
                        ></div>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        const newProgress = prompt('Enter new progress (0-100):', task.progress);
                        if (newProgress !== null && !isNaN(newProgress) && newProgress >= 0 && newProgress <= 100) {
                          updateTaskProgress(getTaskId(task), parseInt(newProgress));
                        }
                      }}
                      className="px-3 py-1 bg-cyan-600 text-white text-sm rounded-lg hover:bg-cyan-700 transition"
                    >
                      Update
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Sprint Overview and Upcoming Deadlines */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Sprint Overview */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900">Sprint overview</h2>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Overall progress</span>
                <span className="font-medium">{memberData.sprintOverview.overallProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-cyan-500 rounded-full h-2 transition-all duration-300"
                  style={{ width: `${memberData.sprintOverview.overallProgress}%` }}
                ></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Tasks on time</span>
                <span className="font-medium text-green-600">{memberData.sprintOverview.tasksOnTime}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-green-500 rounded-full h-2 transition-all duration-300"
                  style={{ width: `${memberData.sprintOverview.tasksOnTime}%` }}
                ></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Estimated task hours</span>
                <span className="font-medium text-purple-600">{memberData.sprintOverview.hoursLogged}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-purple-500 rounded-full h-2 transition-all duration-300"
                  style={{ width: `${Math.min(100, memberData.sprintOverview.hoursLogged)}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        {/* Upcoming Deadlines */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900">Upcoming deadlines</h2>
          </div>
          <div className="p-6">
            {memberData.upcomingDeadlines.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No upcoming deadlines</p>
            ) : (
              <div className="space-y-3">
                {memberData.upcomingDeadlines.map((deadline) => (
                  <div 
                    key={deadline.id} 
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      deadline.priority === 'high' ? 'bg-red-50 border-red-200' :
                      deadline.priority === 'medium' ? 'bg-yellow-50 border-yellow-200' :
                      'bg-green-50 border-green-200'
                    }`}
                  >
                    <span className="font-medium text-gray-900">{deadline.name}</span>
                    <div className="flex items-center space-x-3">
                      <span className="text-sm text-gray-600">{deadline.dueDate}</span>
                      {deadline.priority === 'high' && (
                        <span className="px-2 py-0.5 bg-red-200 text-red-800 rounded-full text-xs">Urgent</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MemberDashboard;