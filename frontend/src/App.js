import React, { useState, useEffect, useCallback } from 'react';
import ShiftTimer from './components/Common/ShiftTimer';
import ResourceReview from './components/Common/ResourceReview';
import { setDisplayTimeZone } from './utils/timeZone';
import LoginSystem from './components/Login/LoginSystem';
import SessionManager from './components/Login/SessionManager';
import authService from './services/authService';
import employeeService from './services/employeeService';
import { normalizeDepartmentFields } from './utils/departments';

// Common Components
import DailyWorkReport from './components/Common/DailyWorkReport';
import LeaveManagement from './components/Common/LeaveManagement';

// CEO Imports
import CEODashboard from './components/Dashboard/CEO/CEODashboard';
import SignupRequests from './components/Dashboard/CEO/SignupRequests';
import TaskManagement from './components/Dashboard/CEO/TaskManagement';
import Projects from './components/Dashboard/CEO/Projects';
import TeamsAndRoles from './components/Dashboard/CEO/TeamsAndRoles';
import Accounts from './components/Dashboard/CEO/Accounts';
import Meetings from './components/Dashboard/CEO/Meetings';
import AIInsights from './components/Dashboard/CEO/AIInsights';
import Notifications from './components/Dashboard/CEO/Notifications.jsx';
import ActivityMonitor from './components/Dashboard/CEO/ActivityMonitor';
import ResourceAllocation from './components/Dashboard/CEO/ResourceAllocation';
import AttendanceView from './components/Dashboard/CEO/AttendanceView';
import CEOTeamReports from './components/Dashboard/CEO/TeamReports';
import AutomationDashboard from './components/Dashboard/CEO/AutomationDashboard';

// Manager Imports
import ManagerDashboard from './components/Dashboard/Manager/ManagerDashboard';
import ManagerTaskManagement from './components/Dashboard/Manager/TaskManagement.jsx';
import ManagerProjects from './components/Dashboard/Manager/Projects';
import ManagerTeamsAndRoles from './components/Dashboard/Manager/TeamsAndRoles';
import ManagerAccounts from './components/Dashboard/Manager/Accounts';
import ManagerMeetings from './components/Dashboard/Manager/Meetings';
import ManagerAIInsights from './components/Dashboard/Manager/AIInsights';
import ManagerNotifications from './components/Dashboard/Manager/Notifications.jsx';
import EmployeeManagement from './components/Dashboard/Manager/EmployeeManagement';
import ManagerTeamReports from './components/Dashboard/Manager/TeamReports';
import ManagerAttendanceView from './components/Dashboard/Manager/AttendanceView';
import ManagerAutomationDashboard from './components/Dashboard/Manager/AutomationDashboard';

// COO Imports
import COODashboard from './components/Dashboard/COO/COODashboard';
import COOTaskManagement from './components/Dashboard/COO/TaskManagement.jsx';
import COOProjects from './components/Dashboard/COO/Projects';
import COOTeamsAndRoles from './components/Dashboard/COO/TeamsAndRoles';
import COOResourceAllocation from './components/Dashboard/COO/ResourceAllocation';
import COOAccounts from './components/Dashboard/COO/Accounts';
import COOMeetings from './components/Dashboard/COO/Meetings';
import COOAIInsights from './components/Dashboard/COO/AIInsights';
import COONotifications from './components/Dashboard/COO/Notifications.jsx';
import COOEmployeeManagement from './components/Dashboard/COO/EmployeeManagement';
import COOTeamReports from './components/Dashboard/COO/TeamReports';
import COOAttendanceView from './components/Dashboard/COO/AttendanceView';
import COOAutomationDashboard from './components/Dashboard/COO/AutomationDashboard';

// Team Lead Imports
import TeamLeadDashboard from './components/Dashboard/TeamLead/TeamLeadDashboard';
import TeamLeadTaskManagement from './components/Dashboard/TeamLead/TaskManagement.jsx';
import TeamLeadTeamsAndRoles from './components/Dashboard/TeamLead/TeamsAndRoles';

import TeamLeadResources from './components/Dashboard/TeamLead/Resources';
import TeamLeadMeetings from './components/Dashboard/TeamLead/Meetings';
import TeamLeadNotifications from './components/Dashboard/TeamLead/Notifications.jsx';
import MVPRoadmap from './components/Dashboard/TeamLead/MVPRoadmap';

// Member Imports
import MemberDashboard from './components/Dashboard/Member/MemberDashboard';
import MyTeam from './components/Dashboard/Member/MyTeam';
import MemberTaskManagement from './components/Dashboard/Member/TaskManagement';
import MemberResources from './components/Dashboard/Member/Resources';
import MemberMeetings from './components/Dashboard/Member/Meetings';
import MemberNotifications from './components/Dashboard/Member/Notifications.jsx';
import MemberProfileView from './components/Dashboard/Member/MemberProfileView';
import DashboardNavigation, { menuSections } from './components/Layout/DashboardNavigation';
import LoginManagement from './components/Dashboard/Manager/LoginManagement';
import ImportEmployeesModal from './components/Dashboard/Manager/ImportEmployeesModal';
import ProfilePreferences from './components/Common/ProfilePreferences';
import { ChangePasswordForm } from './components/Login/ChangePassword.jsx';
import { roleLabel } from './utils/roleLabels';

const publicAuthPages = new Set(['/signup', '/forgot-password', '/reset-password']);
const dashboardMenuKey = user => `spaceborn:dashboard:${user.id}:${user.role}:${window.location.pathname}`;

function menuSlot(role) {
  if (role === 'CEO') return 'executive';
  if (role === 'COO' || role === 'Manager') return 'manager';
  if (role === 'Team Lead' || roleLabel(role) === 'Co-Lead') return 'teamLead';
  return 'member';
}

function permittedSection(user, section) {
  if (menuSections(user.role).includes(section)) return section;
  return user.role === 'CEO' && window.location.pathname === '/signup-requests' ? 'SignupRequests' : 'Dashboard';
}

function readDashboardMenu(user) {
  const key = dashboardMenuKey(user);
  try {
    if (window.history.state?.crmMenu?.key === key) return window.history.state.crmMenu.section;
    const saved = JSON.parse(sessionStorage.getItem(key));
    return typeof saved === 'string' ? saved : saved?.[menuSlot(user.role)];
  } catch {
    return undefined;
  }
}

function rememberDashboardMenu(user, section, action) {
  const key = dashboardMenuKey(user);
  window.history[action]({ ...window.history.state, crmMenu: { key, section } }, '', window.location.href);
  try {
    sessionStorage.setItem(key, JSON.stringify(section));
  } catch {
    // Browser history still supports navigation when storage is unavailable.
  }
}

const managementComponents = {
  CEO: {
    Dashboard: CEODashboard, TaskManagement, Projects, TeamsAndRoles, Accounts,
    TeamReports: CEOTeamReports, Automation: AutomationDashboard, Attendance: AttendanceView,
    Meetings, AIInsights, Notifications, ResourceAllocation
  },
  COO: {
    Dashboard: COODashboard, TaskManagement: COOTaskManagement, Projects: COOProjects,
    TeamsAndRoles: COOTeamsAndRoles, Accounts: COOAccounts, TeamReports: COOTeamReports,
    Automation: COOAutomationDashboard, Attendance: COOAttendanceView, Meetings: COOMeetings,
    AIInsights: COOAIInsights, Notifications: COONotifications, ResourceAllocation: COOResourceAllocation
  },
  Manager: {
    Dashboard: ManagerDashboard, TaskManagement: ManagerTaskManagement, Projects: ManagerProjects,
    TeamsAndRoles: ManagerTeamsAndRoles, Accounts: ManagerAccounts, TeamReports: ManagerTeamReports,
    Automation: ManagerAutomationDashboard, Attendance: ManagerAttendanceView, Meetings: ManagerMeetings,
    AIInsights: ManagerAIInsights, Notifications: ManagerNotifications, ResourceAllocation: ResourceReview
  }
};
const leadComponents = {
  Dashboard: TeamLeadDashboard, TaskManagement: TeamLeadTaskManagement, TeamsAndRoles: TeamLeadTeamsAndRoles,
  MVPRoadmap, Meetings: TeamLeadMeetings, Notifications: TeamLeadNotifications
};
const memberComponents = {
  Dashboard: MemberDashboard, TaskManagement: MemberTaskManagement, DailyReport: DailyWorkReport,
  MyTeam, Resources: MemberResources, Meetings: MemberMeetings, Notifications: MemberNotifications
};

function ProfileSummary({ user }) {
  return (
    <section className="card max-w-4xl border border-base-300 bg-base-100">
      <div className="card-body">
        <h2 className="card-title">{user.name}</h2>
        <p>{roleLabel(user.role)}</p>
        {user.department && <p className="text-base-content/70">{user.department}</p>}
      </div>
    </section>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [sessionRestore, setSessionRestore] = useState(() => {
    const path = window.location.pathname.replace(/\/+$/, '');
    return authService.getToken() && !publicAuthPages.has(path) ? 'checking' : 'ready';
  });
  const [activeMenu, setActiveMenu] = useState('Dashboard');
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [employeeError, setEmployeeError] = useState('');
  const [employeesLoading, setEmployeesLoading] = useState(false);

  const fetchEmployees = useCallback(async () => {
    setEmployeesLoading(true);
    setEmployeeError('');
    try {
      const data = await employeeService.getAllEmployees();
      if (!Array.isArray(data)) throw new Error('Employee data was unavailable.');
      setEmployees(data);
    } catch {
      setEmployeeError('Could not load employee records. Try again.');
    } finally {
      setEmployeesLoading(false);
    }
  }, []);

  const handleLoginSuccess = useCallback((userData, openTeam = false, restoredSection) => {
    if (!userData?.role) return;
    const normalized = normalizeDepartmentFields(userData);
    const section = permittedSection(normalized, openTeam && normalized.role === 'Member' ? 'MyTeam' : restoredSection);
    setDisplayTimeZone(normalized.timeZone);
    localStorage.setItem('user', JSON.stringify(normalized));
    setUser(normalized);
    setActiveMenu(section);
    rememberDashboardMenu(normalized, section, 'replaceState');
  }, []);

  useEffect(() => {
    if (sessionRestore !== 'checking') return;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    let canceled = false;

    async function restoreSession() {
      try {
        const result = await authService.verifyToken({ signal: controller.signal });
        if (canceled) return;
        if (result.success) handleLoginSuccess(result.user, false, readDashboardMenu(result.user));
        setSessionRestore(result.retryable ? 'unavailable' : 'ready');
      } catch {
        if (!canceled) setSessionRestore('unavailable');
      } finally {
        clearTimeout(timeout);
      }
    }

    restoreSession();
    return () => {
      canceled = true;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [sessionRestore, handleLoginSuccess]);

  useEffect(() => {
    if (!user) return;
    const restoreHistory = event => {
      const key = dashboardMenuKey(user);
      const section = permittedSection(user, event.state?.crmMenu?.key === key ? event.state.crmMenu.section : undefined);
      setActiveMenu(section);
      setNavigationOpen(false);
      rememberDashboardMenu(user, section, 'replaceState');
    };
    window.addEventListener('popstate', restoreHistory);
    return () => window.removeEventListener('popstate', restoreHistory);
  }, [user]);

  useEffect(() => {
    if (user && !user.mustChangePassword && activeMenu === 'EmployeeManagement') fetchEmployees();
  }, [user, activeMenu, fetchEmployees]);

  function navigate(section) {
    const selection = permittedSection(user, section);
    setNavigationOpen(false);
    if (selection === activeMenu) return;
    rememberDashboardMenu(user, selection, 'pushState');
    setActiveMenu(selection);
  }

  const clearWorkspace = useCallback(() => {
    if (user) {
      sessionStorage.removeItem(dashboardMenuKey(user));
      const state = { ...window.history.state };
      delete state.crmMenu;
      window.history.replaceState(state, '', window.location.href);
    }
    authService.clearSession();
    setUser(null);
    setEmployees([]);
    setActiveMenu('Dashboard');
    setNavigationOpen(false);
  }, [user]);

  const handleLogout = useCallback(async () => {
    try {
      await authService.logout();
    } finally {
      clearWorkspace();
    }
  }, [clearWorkspace]);

  useEffect(() => {
    if (!user) return;
    window.addEventListener('spaceborn:session-rejected', clearWorkspace);
    return () => window.removeEventListener('spaceborn:session-rejected', clearWorkspace);
  }, [user, clearWorkspace]);

  function handleTimeZoneChange(timeZone) {
    const updated = { ...user, timeZone };
    setDisplayTimeZone(timeZone);
    localStorage.setItem('user', JSON.stringify(updated));
    setUser(updated);
  }

  async function handleUpdateEmployee(updatedEmployee) {
    const { id, ...fields } = updatedEmployee;
    const result = await employeeService.updateEmployee(id, fields);
    setEmployees(records => records.map(record => record.id === id ? { ...record, ...result } : record));
    if (user.id === updatedEmployee.id) {
      const updated = { ...user, ...result };
      localStorage.setItem('user', JSON.stringify(updated));
      setUser(updated);
    }
    return result;
  }

  async function handleAddEmployee(employee) {
    const result = await employeeService.addEmployee(employee);
    if (result) setEmployees(records => [...records, result]);
    return result;
  }

  async function handleDeleteEmployee(id) {
    await employeeService.deleteEmployee(id);
    setEmployees(records => records.filter(record => String(record.id || record._id) !== String(id)));
    return true;
  }

  function renderSection() {
    const role = user.role;
    const hr = role === 'HR' || role === 'Coordinator';
    const lead = role === 'Team Lead' || roleLabel(role) === 'Co-Lead';
    const department = user.department || null;

    switch (activeMenu) {
      case 'SignupRequests':
        return <SignupRequests />;
      case 'LoginManagement':
        return <LoginManagement />;
      case 'ActivityMonitor':
        return <ActivityMonitor userRole={role} />;
      case 'MyProfile':
        return <>
          {role === 'Member'
            ? <MemberProfileView userData={user} onUpdate={handleUpdateEmployee} />
            : <ProfileSummary user={user} />}
          <ProfilePreferences user={user} onTimeZoneChange={handleTimeZoneChange} />
          <section className="card mx-auto mt-4 max-w-4xl border border-base-300 bg-base-100">
            <div className="card-body">
              <h2 className="card-title">Change password</h2>
              <ChangePasswordForm onChanged={handleLogout} />
            </div>
          </section>
        </>;
      case 'EmployeeManagement': {
        if (employeesLoading) return <p role="status">Loading employees…</p>;
        if (employeeError) return <div role="alert" className="alert alert-error">{employeeError}
          <button type="button" className="btn btn-sm" onClick={fetchEmployees}>Try again</button>
        </div>;
        const EmployeePage = role === 'COO' ? COOEmployeeManagement : EmployeeManagement;
        return <EmployeePage employees={employees} userRole={role} userDepartment={department}
          canEdit canAdd canDelete onUpdateEmployee={handleUpdateEmployee}
          onAddEmployee={handleAddEmployee} onDeleteEmployee={handleDeleteEmployee} onImportComplete={fetchEmployees} />;
      }
      case 'ImportEmployees':
        return <ImportEmployeesModal onClose={() => navigate('EmployeeManagement')} onImported={fetchEmployees} />;
      case 'Leave':
      case 'LeaveManagement':
        return <LeaveManagement user={user} userRole={role}
          userDepartment={role === 'Manager' || role === 'COO' ? null : department} />;
      case 'Resources':
        if (hr) return <ResourceReview />;
        if (lead) return <>
          {role === 'Team Lead' && <ResourceReview />}
          <TeamLeadResources userRole={role} />
        </>;
        break;
      case 'Dashboard':
        if (hr) return <section className="space-y-4"><h1 className="text-2xl font-semibold">Dashboard</h1><ProfileSummary user={user} /></section>;
        break;
      case 'Attendance':
        if (hr) return <ManagerAttendanceView userRole={role} />;
        break;
      default:
        break;
    }

    const sections = managementComponents[role] || (lead ? leadComponents : hr ? { Notifications: MemberNotifications } : memberComponents);
    const Page = sections[activeMenu];
    const featureRole = role === 'COO' && !['Dashboard', 'Accounts', 'TeamReports'].includes(activeMenu) ? 'Manager' : role;
    return Page ? <Page user={user} userRole={featureRole} department={role === 'CEO' ? department : null}
      onLogout={handleLogout} onNavigate={navigate} /> : null;
  }

  if (sessionRestore !== 'ready') {
    return (
      <main className="grid min-h-screen place-items-center bg-base-200 p-4">
        {sessionRestore === 'checking' ? (
          <p className="flex items-center gap-3" role="status">
            <span className="loading loading-spinner" aria-hidden="true" /> Checking your session…
          </p>
        ) : (
          <section className="card border border-base-300 bg-base-100">
            <div className="card-body">
              <p role="alert">Could not verify your session.</p>
              <button type="button" className="btn btn-neutral self-start" onClick={() => setSessionRestore('checking')}>Try again</button>
            </div>
          </section>
        )}
      </main>
    );
  }

  if (!user) return <LoginSystem onLoginSuccess={handleLoginSuccess} />;

  if (user.mustChangePassword) {
    return (
      <main className="grid min-h-dvh place-items-center bg-base-200 p-4">
        <section className="card w-full max-w-md border border-base-300 bg-base-100">
          <div className="card-body">
            <h1 className="card-title">Change your temporary password</h1>
            <ChangePasswordForm onChanged={handleLogout} />
            <button type="button" className="btn btn-ghost self-start" onClick={handleLogout}>Sign out</button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-base-200">
      <ShiftTimer user={user} onLogout={handleLogout} navigationOpen={navigationOpen}
        onToggleNavigation={() => setNavigationOpen(open => !open)} />
      <div className="relative flex min-h-0 flex-1">
        <DashboardNavigation user={user} active={activeMenu} open={navigationOpen}
          onNavigate={navigate} onLogout={handleLogout} />
        <main className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-8">
          {renderSection()}
        </main>
      </div>
      <SessionManager user={user} onSessionExpired={clearWorkspace} />
    </div>
  );
}

export default App;
