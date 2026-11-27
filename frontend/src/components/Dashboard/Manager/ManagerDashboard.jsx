import { roleLabel } from '../../../utils/roleLabels';
import useDashboardData from '../useDashboardData';

export default function ManagerDashboard({ user, onNavigate }) {
  const { data, error, reload } = useDashboardData('/dashboard/manager', 'Could not load the dashboard.');

  if (error) return <div className="alert alert-error" role="alert">{error}
    <button className="btn btn-sm" onClick={reload}>Try again</button>
  </div>;
  if (!data) return <p role="status">Loading dashboard…</p>;

  const stats = data.stats || {};
  const teamHealth = data.teamHealth || {};
  const topPerformers = Array.isArray(data.topPerformers) ? data.topPerformers.filter(person => person.tasks > 0) : [];
  const dashboardData = Object.fromEntries(['departmentProgress', 'upcomingMeetings', 'resourceRequests', 'actionItems', 'recentActivity']
    .map(key => [key, Array.isArray(data[key]) ? data[key] : []]));
  const formatRelativeTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  const managerName = user?.name || 'Project Manager';

  const renderOverview = () => (
    <>
      {/* Manager Profile Section */}
      <div className="bg-white rounded-xl border p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900">{managerName}</h2>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className="text-sm font-medium text-blue-700 bg-blue-100 px-2 py-0.5 rounded">{roleLabel(user?.role || 'Manager')}</span>
          <span className="text-sm text-gray-500">{user.department || 'All departments'}</span>
          <span className="text-sm text-gray-500">•</span>
          <span className="text-sm text-gray-500">{stats.teamMembers} Team Members</span>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <p className="text-sm text-gray-500">Team Tasks</p>
          <p className="text-2xl font-bold text-gray-900">{stats.totalTasks}</p>
          <p className="text-xs text-green-600 mt-1">{stats.completedTasks} completed</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <p className="text-sm text-gray-500">Task completion</p>
          <p className="text-2xl font-bold text-blue-600">{stats.sprintVelocity}%</p>
          <p className="text-xs text-gray-400 mt-1">Team average</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <p className="text-sm text-gray-500">Open Tasks</p>
          <p className="text-2xl font-bold text-gray-900">{stats.projectsActive}</p>
          <p className="text-xs text-gray-400 mt-1">In progress</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <p className="text-sm text-gray-500">Pending Approvals</p>
          <p className="text-2xl font-bold text-yellow-600">{stats.pendingApprovals}</p>
          <p className="text-xs text-gray-400 mt-1">Action required</p>
        </div>
        <button type="button" className="btn btn-outline self-start justify-start"
          onClick={() => onNavigate('LoginManagement')}>View active sessions</button>
      </div>

      {/* Team Health & Top Performers Row */}
      <div className="grid gap-6 mb-8 lg:grid-cols-2">
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="px-6 py-4 border-b bg-gray-50">
            <h3 className="font-semibold text-gray-900">Team headcount & health</h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-gray-900">{stats.teamMembers}</div>
                <div className="text-xs text-gray-500">Team Members</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">{teamHealth.newJoinees}</div>
                <div className="text-xs text-gray-500">New this month</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-red-600">{teamHealth.terminated}</div>
                <div className="text-xs text-gray-500">Terminated</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-orange-600">{teamHealth.onLeave}</div>
                <div className="text-xs text-gray-500">On Leave</div>
              </div>
            </div>

          </div>
        </div>

        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="px-6 py-4 border-b bg-gray-50">
            <h3 className="font-semibold text-gray-900">Top Performers — This Month</h3>
          </div>
          <div className="p-5 space-y-4">
            {topPerformers.length === 0 && (
              <p className="text-sm text-gray-500">No completed tasks yet this month.</p>
            )}
            {topPerformers.map((performer, idx) => (
              <div key={idx} className="flex justify-between items-center hover:bg-gray-50 p-2 rounded-lg transition">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm ${
                      idx === 0 ? 'bg-gradient-to-br from-yellow-500 to-amber-600' :
                      idx === 1 ? 'bg-gradient-to-br from-gray-400 to-gray-500' :
                      idx === 2 ? 'bg-gradient-to-br from-amber-600 to-orange-600' :
                      'bg-gradient-to-br from-blue-500 to-purple-500'
                    }`}>
                      {performer.initials}
                    </div>
                    {idx === 0 && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-500 rounded-full flex items-center justify-center text-[10px] text-white font-bold">👑</div>
                    )}
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">{performer.name}</div>
                    <div className="text-xs text-gray-500">{roleLabel(performer.role)} · {performer.department}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-blue-600">{performer.tasks}</div>
                  <div className="text-xs text-gray-400">tasks</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Department Progress */}
      <div className="bg-white rounded-xl border border-gray-200 mb-8">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h2 className="font-semibold text-gray-900">Department progress</h2>
          </div>
        </div>
        <div className="p-6 space-y-5">
          {dashboardData.departmentProgress.map((dept, i) => (
            <div key={i}>
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium text-gray-900">{dept.name}</span>
                <div className="flex items-center space-x-4">
                  <span className="text-sm text-gray-500">{dept.members} members</span>
                  <span className="text-sm font-semibold text-blue-600">{dept.progress}%</span>
                </div>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2.5">
                <div className="bg-blue-600 rounded-full h-2.5 transition-all duration-500" style={{ width: `${dept.progress}%` }}></div>
              </div>
              {dept.completedTasks && (
                <div className="flex justify-between mt-1 text-xs text-gray-400">
                  <span>{dept.completedTasks} completed</span>
                  <span>{dept.pendingTasks} pending</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Three Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Upcoming Meetings */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900">Upcoming meetings</h2>
          </div>
          <div className="p-6 space-y-4">
            {dashboardData.upcomingMeetings.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No upcoming meetings</p>
            ) : (
              dashboardData.upcomingMeetings.map((meeting, i) => (
                <div key={i} className="flex items-start space-x-3">
                  <div className="text-center min-w-[50px]">
                    <div className="text-xl font-bold text-gray-900">{meeting.date}</div>
                    <div className="text-xs text-gray-500">{meeting.month}</div>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{meeting.title}</p>
                    <p className="text-xs text-gray-500">{meeting.dept} · {meeting.time}</p>
                    {meeting.duration && <p className="text-xs text-gray-400">{meeting.duration}</p>}
                    <span className="text-xs text-yellow-600 mt-1 inline-block">{meeting.status}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Resource Requests */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900">Resource requests</h2>
          </div>
          <div className="p-6 space-y-4">
            {dashboardData.resourceRequests.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No pending requests</p>
            ) : (
              dashboardData.resourceRequests.map((request, i) => (
                <div key={i} className="flex items-start space-x-3">
                  <div className="text-center min-w-[50px]">
                    <div className="text-xl font-bold text-gray-900">{request.date}</div>
                    <div className="text-xs text-gray-500">{request.month}</div>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{request.item}</p>
                    <p className="text-xs text-gray-500">{request.requester}</p>
                    <div className="flex items-center space-x-2 mt-1">
                      <span className={`text-xs ${request.status === 'pending' ? 'text-yellow-600' : 'text-green-600'}`}>
                        {request.status === 'pending' ? 'Pending' : 'Approved'}
                      </span>
                      {request.status === 'pending' && (
                        <button
                          onClick={() => onNavigate('ResourceAllocation')}
                          className="text-xs text-blue-600 hover:text-blue-700"
                        >
                          Review
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Action Items */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900">Your action items</h2>
          </div>
          <div className="p-6 space-y-3">
            {dashboardData.actionItems.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No action items</p>
            ) : (
              dashboardData.actionItems.map((item, idx) => (
                <div key={idx} className="flex items-start space-x-3">
                  <div className="flex-1">
                    <p className={`text-sm ${item.status === 'completed' ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                      {item.title}
                    </p>
                    <p className="text-xs text-gray-500">Due: {item.due}</p>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    item.priority === 'High' ? 'bg-red-100 text-red-700' : 
                    item.priority === 'Medium' ? 'bg-yellow-100 text-yellow-700' : 
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {item.priority}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">Recent activity</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {dashboardData.recentActivity.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">No recent activity</div>
          ) : (
            dashboardData.recentActivity.map((activity, i) => (
              <div key={i} className="flex justify-between items-center px-6 py-3 hover:bg-gray-50 transition">
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <p className="text-sm text-gray-700">{activity.action}</p>
                  <span className="text-xs text-gray-400">by {activity.user || activity.requester || 'Team'}</span>
                </div>
                <p className="text-xs text-gray-400">{formatRelativeTime(activity.time)}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );

  return <section>
    <h1 className="mb-4 text-2xl font-semibold">Dashboard</h1>
    {renderOverview()}
  </section>;
}
