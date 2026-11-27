const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const { formatResponse } = require('../utils/helpers');

const dashboard = ['Dashboard', 'Dashboard'];
const tasks = ['TaskManagement', 'Task Management'];
const profile = ['MyProfile', 'My Profile'];
const notifications = ['Notifications', 'Notifications'];
const meetings = ['Meetings', 'Meetings'];
const employees = ['EmployeeManagement', 'Employee Database'];
const attendance = ['Attendance', 'Attendance'];
const teams = ['TeamsAndRoles', 'Teams & Roles'];
const resources = ['Resources', 'Resources'];

const management = [
  dashboard, tasks, ['Projects', 'Projects'], teams, ['Accounts', 'Accounts'], employees,
  ['LoginManagement', 'Login Management'], ['TeamReports', 'Team Reports & MVP Roadmaps'],
  ['LeaveManagement', 'Leave Management'], ['Automation', 'System Automation'],
  ['ResourceAllocation', 'Resource Allocation'], attendance, meetings, ['AIInsights', 'AI Insights'], notifications,
  ['ActivityMonitor', 'Activity Monitor'], profile
];
const leadership = [dashboard, tasks, teams, ['MVPRoadmap', 'MVP Roadmap'],
  ['LeaveManagement', 'Leave Management'], resources, meetings, notifications, profile];

function register(path, roles, pages) {
  router.get(path, protect, authorize(...roles), (req, res) => {
    res.json(formatResponse(true, 'Menu loaded.', pages.map(([id, label]) => ({ id, label, enabled: true }))));
  });
}

register('/ceo', ['CEO'], [...management, ['SignupRequests', 'Signup requests']]);
register('/director', ['CEO', 'COO'], management);
register('/manager', ['CEO', 'COO', 'Manager'], management);
register('/team-lead', ['Team Lead'], leadership);
register('/co-lead', ['CO Head', 'Co-Head'], leadership);
register('/member', ['Member'], [dashboard, ['TaskManagement', 'My Tasks'], ['DailyReport', 'Daily Report'],
  ['Leave', 'Leave'], resources, meetings, ['MyTeam', 'My Team'], profile, notifications]);
register('/hr', ['HR', 'Coordinator'], [dashboard, employees, ['ImportEmployees', 'Import from Excel'],
  attendance, ['Leave', 'Leave and Hour Breaks'], ['Resources', 'Resource Requests'], notifications, profile]);

module.exports = router;
