import spacebornLogo from '../../assets/spaceborn-logo.png';
import { Activity, Bell, Briefcase, Calendar, Clock, Database, FileText, Home, Idea, Inbox,
  Lock, LogOut, Tasks, Upload, User, UserPlus, Users, Zap } from '../Common/Icons';
import { roleLabel } from '../../utils/roleLabels';

const management = ['Dashboard', 'TaskManagement', 'Projects', 'TeamsAndRoles', 'Accounts',
  'EmployeeManagement', 'LoginManagement', 'TeamReports', 'LeaveManagement', 'Automation',
  'ResourceAllocation', 'Attendance', 'Meetings', 'AIInsights', 'Notifications', 'ActivityMonitor', 'MyProfile'];
const leadership = ['Dashboard', 'TaskManagement', 'TeamsAndRoles', 'MVPRoadmap', 'LeaveManagement',
  'Resources', 'Meetings', 'Notifications', 'MyProfile'];
const member = ['Dashboard', 'TaskManagement', 'DailyReport', 'Leave', 'Resources', 'Meetings', 'MyTeam', 'MyProfile', 'Notifications'];
const hr = ['Dashboard', 'EmployeeManagement', 'ImportEmployees', 'Attendance', 'Leave', 'Resources', 'Notifications', 'MyProfile'];
const ceo = [...management.slice(0, 4), 'SignupRequests', ...management.slice(4)];
const levels = ['CEO', 'COO', 'Team Lead', 'CO Head', 'Manager', 'Member'];

const pages = {
  Dashboard: ['Dashboard', Home],
  TaskManagement: ['Task Management', Tasks],
  Projects: ['Projects', Briefcase],
  TeamsAndRoles: ['Teams & Roles', Users],
  SignupRequests: ['Signup requests', UserPlus],
  Accounts: ['Accounts', User],
  EmployeeManagement: ['Employee Database', Database],
  ImportEmployees: ['Import from Excel', Upload],
  LoginManagement: ['Login Management', Lock],
  TeamReports: ['Team Reports & MVP Roadmaps', FileText],
  LeaveManagement: ['Leave Management', Calendar],
  Automation: ['System Automation', Zap],
  ResourceAllocation: ['Resource Allocation', Inbox],
  Attendance: ['Attendance', Clock],
  Meetings: ['Meetings', Calendar],
  AIInsights: ['AI Insights', Idea],
  Notifications: ['Notifications', Bell],
  ActivityMonitor: ['Activity Monitor', Activity],
  MyProfile: ['My Profile', User],
  MVPRoadmap: ['MVP Roadmap', FileText],
  Resources: ['Resources', Inbox],
  Leave: ['Leave', Calendar],
  DailyReport: ['Daily Report', FileText],
  MyTeam: ['My Team', Users]
};

export function menuSections(role) {
  if (role === 'CEO') return ceo;
  if (role === 'COO' || role === 'Manager') return management;
  if (role === 'Team Lead' || roleLabel(role) === 'Co-Lead') return leadership;
  if (role === 'HR' || role === 'Coordinator') return hr;
  if (role === 'Member') return member;
  return [];
}

function labelFor(id, role) {
  if (role === 'HR' || role === 'Coordinator') {
    if (id === 'Leave') return 'Leave and Hour Breaks';
    if (id === 'Resources') return 'Resource Requests';
  }
  return id === 'TaskManagement' && role === 'Member' ? 'My Tasks' : pages[id][0];
}

export default function DashboardNavigation({ user, active, open, onNavigate, onLogout }) {
  const role = roleLabel(user.role);
  const initials = (user.name || '').split(' ').filter(Boolean).slice(0, 2).map(part => part[0].toUpperCase()).join('');

  return (
    <aside className={`absolute inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col border-r border-base-300 bg-base-100 md:relative ${open ? '' : 'max-md:hidden'}`}>
      <div className="shrink-0 border-b border-base-300 px-4 py-3">
        <button type="button" className="mx-auto block rounded p-1 focus-visible:outline-2"
          onClick={() => onNavigate('Dashboard')} aria-label="Spaceborn dashboard">
          <img src={spacebornLogo} alt="" className="h-12 w-auto object-contain" />
        </button>
        <ul aria-label="Company role levels" className="mt-2 flex flex-wrap gap-1">
          {levels.map(level => <li key={level}
            className={`badge badge-xs ${roleLabel(level) === role ? 'badge-neutral' : 'badge-outline'}`}>
            {roleLabel(level)}
          </li>)}
        </ul>
      </div>
      <nav aria-label="Dashboard navigation" className="min-h-0 flex-1 overflow-y-auto p-3">
        {menuSections(user.role).map(id => {
          const Icon = pages[id][1];
          return (
            <button type="button" key={id} onClick={() => onNavigate(id)} aria-current={active === id ? 'page' : undefined}
              className={`btn btn-ghost min-h-9 w-full justify-start gap-2 px-2 text-left font-medium ${active === id ? 'btn-active' : ''}`}>
              <Icon size={16} className="w-5 shrink-0" aria-hidden="true" />
              <span className="min-w-0 whitespace-normal">{labelFor(id, user.role)}</span>
            </button>
          );
        })}
      </nav>
      <div className="shrink-0 border-t border-base-300 p-3">
        <div className="mb-2 flex min-w-0 items-center gap-2">
          <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full bg-neutral text-sm font-semibold text-neutral-content">{initials}</span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium" title={user.name}>{user.name}</p>
            <p className="truncate text-xs text-base-content/70" title={user.department}>
              {[role, user.department].filter(Boolean).join(' · ')}
            </p>
          </div>
        </div>
        <button type="button" className="btn btn-outline btn-error btn-sm w-full" onClick={onLogout}>
          <LogOut size={14} aria-hidden="true" /> Logout
        </button>
      </div>
    </aside>
  );
}
