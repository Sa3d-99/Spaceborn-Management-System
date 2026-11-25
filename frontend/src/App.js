import { BarChart3 as IconBarChart3, Bell as IconBell, Briefcase as IconBriefcase, Calendar as IconCalendar, Clock as IconClock, FileText as IconFileText, Home as IconHome, Idea as IconIdea, Inbox as IconInbox, Tasks as IconTasks, User as IconUser, UserPlus as IconUserPlus, Lock as IconLock, Users as IconUsers, Zap as IconZap } from './components/Common/Icons';
// src/App.js
import React, { useState, useEffect } from 'react';
import spacebornLogo from './assets/spaceborn-logo.png';
import ShiftTimer from './components/Common/ShiftTimer';
import ResourceReview from './components/Common/ResourceReview';
import EmployeeAccess from './components/Common/EmployeeAccess';
import { setDisplayTimeZone } from './utils/timeZone';
import LoginSystem from './components/Login/LoginSystem';
import LogoutButton from './components/Login/LogoutButton';
import SessionManager from './components/Login/SessionManager';
import ProtectedRoute from './components/Login/ProtectedRoute';
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
import ManagerActivityMonitor from './components/Dashboard/Manager/ActivityMonitor';
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
import COOActivityMonitor from './components/Dashboard/COO/ActivityMonitor';
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
import { roleLabel } from './utils/roleLabels';

function App() {
  const [user, setUser] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeMenu, setActiveMenu] = useState('Dashboard');
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [completedActions, setCompletedActions] = useState([]);
  const [managerActiveMenu, setManagerActiveMenu] = useState('Dashboard');
  const [teamLeadActiveMenu, setTeamLeadActiveMenu] = useState('Dashboard');
  const [memberActiveMenu, setMemberActiveMenu] = useState('Dashboard');
  const [showNotificationsPanel, setShowNotificationsPanel] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [employees, setEmployees] = useState([]);

  // Fetch employees using employeeService
  const fetchEmployees = async () => {
    try {
      const data = await employeeService.getAllEmployees();
      setEmployees(data);
    } catch (error) {
      console.error('Error fetching employees:', error);
      setEmployees([
        { id: 1, name: 'John Doe', role: 'CEO', department: 'Platform and DevOps', email: 'john.doe@spaceborn.com', employeeId: 'CEO001', phone: '+1 (555) 000-0001', joinDate: '2020-01-15', status: 'Active', manager: 'N/A' },
        { id: 2, name: 'Jane Smith', role: 'Manager', department: 'Platform and DevOps', email: 'jane.smith@spaceborn.com', employeeId: 'MGR001', phone: '+1 (555) 000-0002', joinDate: '2020-03-20', status: 'Active', manager: 'John Doe' },
        { id: 3, name: 'Mike Johnson', role: 'Team Lead', department: 'Core Systems', email: 'mike.johnson@spaceborn.com', employeeId: 'LD001', phone: '+1 (555) 000-0003', joinDate: '2021-02-10', status: 'Active', manager: 'Jane Smith' },
        { id: 4, name: 'Ravi Das', role: 'Member', department: 'Core Systems', email: 'ravi.das@spaceborn.com', employeeId: 'EMP001', phone: '+1 (555) 000-0004', joinDate: '2022-06-01', status: 'Active', manager: 'Mike Johnson' },
        { id: 5, name: 'Priya Sharma', role: 'Member', department: 'Core Systems', email: 'priya.sharma@spaceborn.com', employeeId: 'EMP002', phone: '+1 (555) 000-0005', joinDate: '2022-08-15', status: 'Active', manager: 'Mike Johnson' },
        { id: 6, name: 'Alex Chen', role: 'Member', department: 'Core Systems', email: 'alex.chen@spaceborn.com', employeeId: 'EMP003', phone: '+1 (555) 000-0006', joinDate: '2023-01-10', status: 'Active', manager: 'Mike Johnson' },
        { id: 7, name: 'Sarah Williams', role: 'Team Lead', department: 'Robotics & Simulation', email: 'sarah.williams@spaceborn.com', employeeId: 'LD002', phone: '+1 (555) 000-0007', joinDate: '2021-05-20', status: 'Active', manager: 'Jane Smith' },
        { id: 8, name: 'David Brown', role: 'Member', department: 'Robotics & Simulation', email: 'david.brown@spaceborn.com', employeeId: 'EMP004', phone: '+1 (555) 000-0008', joinDate: '2022-09-01', status: 'Active', manager: 'Sarah Williams' },
        { id: 9, name: 'Emily Davis', role: 'Member', department: 'Robotics & Simulation', email: 'emily.davis@spaceborn.com', employeeId: 'EMP005', phone: '+1 (555) 000-0009', joinDate: '2023-03-15', status: 'Active', manager: 'Sarah Williams' },
        { id: 10, name: 'Anil Mehta', role: 'Team Lead', department: 'Hardware & Integration', email: 'anil.mehta@spaceborn.com', employeeId: 'LD003', phone: '+1 (555) 000-0010', joinDate: '2021-06-10', status: 'Active', manager: 'Jane Smith' },
      ]);
    }
  };

  const getUserDepartment = () => {
    if (!user) return null;
    return user.department || null;
  };

  // Check for existing session on mount - DISABLED for dev mode
  useEffect(() => {
    const checkExistingSession = () => {
      const savedUser = localStorage.getItem('user');
      const session = localStorage.getItem('userSession');
      
      if (savedUser && session) {
        try {
          const userData = normalizeDepartmentFields(JSON.parse(savedUser));
          const sessionData = JSON.parse(session);
          const sessionAge = Date.now() - sessionData.timestamp;
          const SESSION_TIMEOUT = 8 * 60 * 60 * 1000;
          
          if (sessionAge < SESSION_TIMEOUT) {
            console.log('Found existing session for:', userData.name);
            setUser(userData);
            setIsLoggedIn(true);
            fetchEmployees();
          } else {
            localStorage.removeItem('user');
            localStorage.removeItem('userSession');
            localStorage.removeItem('rememberedEmployeeId');
          }
        } catch (error) {
          console.error('Error parsing session:', error);
        }
      }
    };
    
    // COMMENT THIS LINE TO DISABLE AUTO-LOGIN - Forces login page every time
    // checkExistingSession();  // <-- COMMENT THIS FOR DEV MODE (forces login)
  }, []);

  const handleTimeZoneChange = timeZone => {
    const updated = { ...user, timeZone };
    setDisplayTimeZone(timeZone);
    localStorage.setItem('user', JSON.stringify(updated));
    setUser(updated);
  };

  const handleLoginSuccess = async (userData, openTeam = false) => {
    console.log('Login success received in App:', userData);
    
    if (!userData || !userData.role) {
      console.error('Invalid user data received:', userData);
      return;
    }
    
    const normalizedUserData = normalizeDepartmentFields(userData);
    setDisplayTimeZone(normalizedUserData.timeZone);
    localStorage.setItem('user', JSON.stringify(normalizedUserData));
    setUser(normalizedUserData);
    setIsLoggedIn(true);
    setActiveMenu(userData.role === 'CEO' && window.location.pathname === '/signup-requests' ? 'SignupRequests' : 'Dashboard');
    if (openTeam && userData.role === 'Member') setMemberActiveMenu('MyTeam');
    await fetchEmployees();
  };

  const handleLogout = async () => {
    await authService.logout();
    localStorage.removeItem('userSession');
    localStorage.removeItem('user');
    localStorage.removeItem('authToken');
    localStorage.removeItem('rememberedEmployeeId');
    
    setUser(null);
    setIsLoggedIn(false);
    setEmployees([]);
    setActiveMenu('Dashboard');
    setManagerActiveMenu('Dashboard');
    setTeamLeadActiveMenu('Dashboard');
    setMemberActiveMenu('Dashboard');
  };

  const handleSessionExpired = () => {
    alert('Your session has expired. Please login again.');
    handleLogout();
  };

  const getFilteredEmployees = () => {
    if (!user) return [];
    
    if (user.role === 'CEO' || user.role === 'Manager' || user.role === 'COO') {
      return employees;
    }
    if (user.role === 'Team Lead' || user.role === 'Co-Head' || user.role === 'CO Head') {
      const userDept = getUserDepartment();
      return employees.filter(emp => emp.department === userDept);
    }
    
    if (user.role === 'Member') {
      return employees.filter(emp => emp.id === user.id || emp.email === user.email);
    }
    
    return [];
  };

  const getAccessLevelText = () => {
    if (!user) return '';
    if (user.role === 'CEO') return 'Full company access — Viewing all employees';
    if (user.role === 'Manager') return 'Full company access — Viewing all employees';
    if (user.role === 'COO') return 'Full company access - Viewing all employees';
    if (user.role === 'Team Lead' || user.role === 'Co-Head' || user.role === 'CO Head') {
      const dept = getUserDepartment();
      return `Department-level access — Viewing ${dept} team (${getFilteredEmployees().length} members)`;
    }
    if (user.role === 'Member') {
      return `Personal access — Viewing and editing your own profile only`;
    }
    return '';
  };

  const handleUpdateEmployee = async (updatedEmployee) => {
    try {
      const result = await employeeService.updateEmployee(updatedEmployee.id, updatedEmployee);
      if (result) {
        setEmployees(prevEmployees => 
          prevEmployees.map(emp => 
            emp.id === updatedEmployee.id ? result : emp
          )
        );
        if (user && user.id === updatedEmployee.id) {
          setUser(result);
        }
      }
      return result;
    } catch (error) {
      console.error('Error updating employee:', error);
      setEmployees(prevEmployees => 
        prevEmployees.map(emp => 
          emp.id === updatedEmployee.id ? updatedEmployee : emp
        )
      );
      if (user && user.id === updatedEmployee.id) {
        setUser(updatedEmployee);
      }
      return updatedEmployee;
    }
  };

  const handleAddEmployee = async (newEmployee) => {
    try {
      const result = await employeeService.addEmployee(newEmployee);
      if (result) {
        setEmployees(prev => [...prev, result]);
      }
      return result;
    } catch (error) {
      console.error('Error adding employee:', error);
      const tempEmployee = { ...newEmployee, id: Date.now() };
      setEmployees(prev => [...prev, tempEmployee]);
      return tempEmployee;
    }
  };

  const handleDeleteEmployee = async (employeeId) => {
    try {
      await employeeService.deleteEmployee(employeeId);
      setEmployees(prev => prev.filter(emp => String(emp.id || emp._id) !== String(employeeId)));
      return true;
    } catch (error) {
      console.error('Error deleting employee:', error);
      return false;
    }
  };

  // Show login page if not logged in
  if (!isLoggedIn || !user) {
    return <LoginSystem onLoginSuccess={handleLoginSuccess} />;
  }

  // ==================== CEO DASHBOARD ====================
  if (user.role === 'CEO') {
    return (
      <ProtectedRoute user={user} requiredRoles={['CEO']}>
        <div className="min-h-screen bg-gray-50 flex flex-col">
          <ShiftTimer user={user} onLogout={handleLogout} onTimeZoneChange={handleTimeZoneChange}
            navigationOpen={navigationOpen} onToggleNavigation={() => setNavigationOpen(open => !open)} />
          <div className="flex flex-1">
            <aside className={`fixed bottom-0 left-0 top-[88px] md:top-[73px] z-40 flex w-64 flex-col overflow-y-auto border-r border-base-300 bg-base-100 ${navigationOpen ? '' : 'max-md:hidden'}`}>
              <div className="p-6 border-b border-gray-200 flex justify-center">
                <img src={spacebornLogo} alt="Spaceborn" className="h-16 w-auto object-contain" />
              </div>
              <div className="px-4 py-3 border-b border-gray-100">
                <span className="badge badge-outline">{roleLabel(user.role)}</span>
              </div>
              <nav aria-label="Dashboard navigation" onClick={event => { if (event.target.closest('button')) setNavigationOpen(false); }} className="flex-1 p-4">
                {/* OVERVIEW Section */}
                <div className="mb-6">
                  <div className="space-y-1">
                    <button onClick={() => setActiveMenu('Dashboard')} aria-current={activeMenu === 'Dashboard' ? 'page' : undefined} className={`btn btn-ghost btn-sm w-full justify-start gap-3 px-3 text-left transition-all ${activeMenu === 'Dashboard' ? 'bg-purple-50 text-purple-700' : 'text-gray-700 hover:bg-gray-100'}`}>
                      <IconHome className="w-5 h-5" />
                      <span className="text-sm font-medium">Dashboard</span>
                    </button>
                    <button onClick={() => setActiveMenu('TaskManagement')} aria-current={activeMenu === 'TaskManagement' ? 'page' : undefined} className={`btn btn-ghost btn-sm w-full justify-start gap-3 px-3 text-left ${activeMenu === 'TaskManagement' ? 'bg-purple-50 text-purple-700' : 'text-gray-700 hover:bg-gray-100'}`}>
                      <IconTasks className="w-5 h-5" />
                      <span className="text-sm font-medium">Task Management</span>
                    </button>
                    <button onClick={() => setActiveMenu('Projects')} aria-current={activeMenu === 'Projects' ? 'page' : undefined} className={`btn btn-ghost btn-sm w-full justify-start gap-3 px-3 text-left ${activeMenu === 'Projects' ? 'bg-purple-50 text-purple-700' : 'text-gray-700 hover:bg-gray-100'}`}>
                      <IconBriefcase className="w-5 h-5" />
                      <span className="text-sm font-medium">Projects</span>
                    </button>
                  </div>
                </div>

                {/* MANAGEMENT Section */}
                <div className="mb-6">
                  <div className="space-y-1">
                    <button onClick={() => setActiveMenu('TeamsAndRoles')} aria-current={activeMenu === 'TeamsAndRoles' ? 'page' : undefined} className={`btn btn-ghost btn-sm w-full justify-start gap-3 px-3 text-left ${activeMenu === 'TeamsAndRoles' ? 'bg-purple-50 text-purple-700' : 'text-gray-700 hover:bg-gray-100'}`}>
                      <IconUsers className="w-5 h-5" />
                      <span className="text-sm font-medium">Teams & Roles</span>
                    </button>
                    <button type="button" onClick={() => setActiveMenu('SignupRequests')}
                      className={`btn btn-sm w-full justify-start ${activeMenu === 'SignupRequests' ? 'btn-active' : 'btn-ghost'}`}>
                      <IconUserPlus className="h-5 w-5" /> Signup requests
                    </button>
                    <button onClick={() => setActiveMenu('Accounts')} aria-current={activeMenu === 'Accounts' ? 'page' : undefined} className={`btn btn-ghost btn-sm w-full justify-start gap-3 px-3 text-left ${activeMenu === 'Accounts' ? 'bg-purple-50 text-purple-700' : 'text-gray-700 hover:bg-gray-100'}`}>
                      <IconUser className="w-5 h-5" />
                      <span className="text-sm font-medium">Accounts</span>
                    </button>
                    <button onClick={() => setActiveMenu('EmployeeManagement')} aria-current={activeMenu === 'EmployeeManagement' ? 'page' : undefined} className={`btn btn-ghost btn-sm w-full justify-start gap-3 px-3 text-left ${activeMenu === 'EmployeeManagement' ? 'bg-purple-50 text-purple-700' : 'text-gray-700 hover:bg-gray-100'}`}>
                      <IconUser className="w-5 h-5" />
                      <span className="text-sm font-medium">Employee Database</span>
                    </button>
                  </div>
                </div>

                {/* REPORTS Section */}
                <div className="mb-6">
                  <div className="space-y-1">
                    <button onClick={() => setActiveMenu('TeamReports')} aria-current={activeMenu === 'TeamReports' ? 'page' : undefined} className={`btn btn-ghost btn-sm w-full justify-start gap-3 px-3 text-left ${activeMenu === 'TeamReports' ? 'bg-purple-50 text-purple-700' : 'text-gray-700 hover:bg-gray-100'}`}>
                      <IconFileText className="w-5 h-5" />
                      <span className="text-sm font-medium">Team Reports & MVP Roadmaps</span>
                    </button>
                    <button onClick={() => setActiveMenu('LeaveManagement')} aria-current={activeMenu === 'LeaveManagement' ? 'page' : undefined} className={`btn btn-ghost btn-sm w-full justify-start gap-3 px-3 text-left ${activeMenu === 'LeaveManagement' ? 'bg-purple-50 text-purple-700' : 'text-gray-700 hover:bg-gray-100'}`}>
                      <IconCalendar className="w-5 h-5" />
                      <span className="text-sm font-medium">Leave Management</span>
                    </button>
                  </div>
                </div>

                {/* AUTOMATION Section */}
                <div className="mb-6">
                  <div className="space-y-1">
                    <button onClick={() => setActiveMenu('Automation')} aria-current={activeMenu === 'Automation' ? 'page' : undefined} className={`btn btn-ghost btn-sm w-full justify-start gap-3 px-3 text-left ${activeMenu === 'Automation' ? 'bg-purple-50 text-purple-700' : 'text-gray-700 hover:bg-gray-100'}`}>
                      <IconZap className="w-5 h-5" />
                      <span className="text-sm font-medium">System Automation</span>
                    </button>
                  </div>
                </div>

                {/* RESOURCES Section */}
                <div className="mb-6">
                  <div className="space-y-1">
                    <button onClick={() => setActiveMenu('ResourceAllocation')} aria-current={activeMenu === 'ResourceAllocation' ? 'page' : undefined} className={`btn btn-ghost btn-sm w-full justify-start gap-3 px-3 text-left ${activeMenu === 'ResourceAllocation' ? 'bg-purple-50 text-purple-700' : 'text-gray-700 hover:bg-gray-100'}`}>
                      <IconInbox className="w-5 h-5" />
                      <span className="text-sm font-medium">Resource Allocation</span>
                    </button>
                  </div>
                </div>

                {/* ATTENDANCE Section */}
                <div className="mb-6">
                  <div className="space-y-1">
                    <button onClick={() => setActiveMenu('Attendance')} aria-current={activeMenu === 'Attendance' ? 'page' : undefined} className={`btn btn-ghost btn-sm w-full justify-start gap-3 px-3 text-left ${activeMenu === 'Attendance' ? 'bg-purple-50 text-purple-700' : 'text-gray-700 hover:bg-gray-100'}`}>
                      <IconClock className="w-5 h-5" />
                      <span className="text-sm font-medium">Attendance</span>
                    </button>
                  </div>
                </div>

                {/* TOOLS Section */}
                <div className="mb-6">
                  <div className="space-y-1">
                    <button onClick={() => setActiveMenu('Meetings')} aria-current={activeMenu === 'Meetings' ? 'page' : undefined} className={`btn btn-ghost btn-sm w-full justify-start gap-3 px-3 text-left ${activeMenu === 'Meetings' ? 'bg-purple-50 text-purple-700' : 'text-gray-700 hover:bg-gray-100'}`}>
                      <IconCalendar className="w-5 h-5" />
                      <span className="text-sm font-medium">Meetings</span>
                    </button>
                    <button onClick={() => setActiveMenu('AIInsights')} aria-current={activeMenu === 'AIInsights' ? 'page' : undefined} className={`btn btn-ghost btn-sm w-full justify-start gap-3 px-3 text-left ${activeMenu === 'AIInsights' ? 'bg-purple-50 text-purple-700' : 'text-gray-700 hover:bg-gray-100'}`}>
                      <IconIdea className="w-5 h-5" />
                      <span className="text-sm font-medium">AI Insights</span>
                    </button>
                    <button onClick={() => setActiveMenu('Notifications')} aria-current={activeMenu === 'Notifications' ? 'page' : undefined} className={`btn btn-ghost btn-sm w-full justify-start gap-3 px-3 text-left ${activeMenu === 'Notifications' ? 'bg-purple-50 text-purple-700' : 'text-gray-700 hover:bg-gray-100'}`}>
                      <IconBell className="w-5 h-5" />
                      <span className="text-sm font-medium">Notifications</span>
                    </button>
                  </div>
                </div>

                {/* SYSTEM Section */}
                <div className="mb-6">
                  <div className="space-y-1">
                    <button onClick={() => setActiveMenu('ActivityMonitor')} aria-current={activeMenu === 'ActivityMonitor' ? 'page' : undefined} className={`btn btn-ghost btn-sm w-full justify-start gap-3 px-3 text-left ${activeMenu === 'ActivityMonitor' ? 'bg-purple-50 text-purple-700' : 'text-gray-700 hover:bg-gray-100'}`}>
                      <IconBarChart3 className="w-5 h-5" />
                      <span className="text-sm font-medium">Activity Monitor</span>
                    </button>
                  </div>
                </div>
              </nav>
              <div className="p-4 border-t border-gray-200">
                <LogoutButton onLogout={handleLogout} />
              </div>
            </aside>
            <main className="min-w-0 flex-1 overflow-y-auto md:ml-64">
              <div className="p-4 sm:p-8">
                {activeMenu === 'SignupRequests' && <SignupRequests />}
                {activeMenu === 'Dashboard' && <CEODashboard user={user} onLogout={handleLogout} />}
                {activeMenu === 'TaskManagement' && <TaskManagement userRole={user.role} />}
                {activeMenu === 'Projects' && <Projects userRole={user.role} />}
                {activeMenu === 'TeamsAndRoles' && <TeamsAndRoles userRole={user.role} />}
                {activeMenu === 'Accounts' && <Accounts userRole={user.role} />}
                {activeMenu === 'EmployeeManagement' && (
                  <EmployeeManagement 
                    employees={getFilteredEmployees()}
                    userRole={user.role}
                    accessLevel={getAccessLevelText()}
                    userDepartment={getUserDepartment()}
                    canEdit={true}
                    canDelete={user.role !== 'Manager'}
                    canAdd={true}
                    onUpdateEmployee={handleUpdateEmployee}
                    onAddEmployee={handleAddEmployee}
                    onDeleteEmployee={handleDeleteEmployee}
                    onImportComplete={fetchEmployees}
                  />
                )}
                {activeMenu === 'TeamReports' && <CEOTeamReports userRole={user.role} department={getUserDepartment()} user={user} />}
                {activeMenu === 'LeaveManagement' && (
                  <LeaveManagement 
                    user={user}
                    userRole={user.role}
                    userDepartment={user.department}
                  />
                )}
                {activeMenu === 'Automation' && <AutomationDashboard user={user} userRole={user.role} />}
                {activeMenu === 'ResourceAllocation' && <ResourceAllocation userRole={user.role} />}
                {activeMenu === 'Attendance' && <AttendanceView userRole={user.role} />}
                {activeMenu === 'Meetings' && <Meetings userRole={user.role} />}
                {activeMenu === 'AIInsights' && <AIInsights userRole={user.role} />}
                {activeMenu === 'Notifications' && <Notifications userRole={user.role} />}
                {activeMenu === 'ActivityMonitor' && <ActivityMonitor userRole={user.role} />}
              </div>
            </main>
          </div>
          <SessionManager user={user} onSessionExpired={handleSessionExpired} />
        </div>
      </ProtectedRoute>
    );
  }

  // ==================== MANAGER / COO DASHBOARD ====================
  if (user.role === 'Manager' || user.role === 'COO') {
    const isCOO = user.role === 'COO';
    const managerFeatureRole = 'Manager';
    const managerDisplayRole = user.role;
    const DashboardComponent = isCOO ? COODashboard : ManagerDashboard;
    const TaskManagementComponent = isCOO ? COOTaskManagement : ManagerTaskManagement;
    const ProjectsComponent = isCOO ? COOProjects : ManagerProjects;
    const TeamsAndRolesComponent = isCOO ? COOTeamsAndRoles : ManagerTeamsAndRoles;
    const AccountsComponent = isCOO ? COOAccounts : ManagerAccounts;
    const EmployeeManagementComponent = isCOO ? COOEmployeeManagement : EmployeeManagement;
    const TeamReportsComponent = isCOO ? COOTeamReports : ManagerTeamReports;
    const AutomationDashboardComponent = isCOO ? COOAutomationDashboard : ManagerAutomationDashboard;
    const AttendanceViewComponent = isCOO ? COOAttendanceView : ManagerAttendanceView;
    const MeetingsComponent = isCOO ? COOMeetings : ManagerMeetings;
    const AIInsightsComponent = isCOO ? COOAIInsights : ManagerAIInsights;
    const NotificationsComponent = isCOO ? COONotifications : ManagerNotifications;
    const ActivityMonitorComponent = isCOO ? COOActivityMonitor : ManagerActivityMonitor;

    return (
      <ProtectedRoute user={user} requiredRoles={['Manager', 'COO']}>
        <div className="min-h-screen bg-gray-50 flex flex-col">
          <ShiftTimer user={user} onLogout={handleLogout} onTimeZoneChange={handleTimeZoneChange}
            navigationOpen={navigationOpen} onToggleNavigation={() => setNavigationOpen(open => !open)} />
          <div className="flex flex-1">
            <aside className={`fixed bottom-0 left-0 top-[88px] md:top-[73px] z-40 flex w-64 flex-col overflow-y-auto border-r border-base-300 bg-base-100 ${navigationOpen ? '' : 'max-md:hidden'}`}>
              <div className="p-6 border-b border-gray-200 flex justify-center">
                <img src={spacebornLogo} alt="Spaceborn" className="h-16 w-auto object-contain" />
              </div>
              <div className="px-4 py-3 border-b border-gray-100">
                <span className="badge badge-outline">{roleLabel(user.role)}</span>
              </div>
              <nav aria-label="Dashboard navigation" onClick={event => { if (event.target.closest('button')) setNavigationOpen(false); }} className="flex-1 p-4 overflow-y-auto">
                <div className="mb-6">
                  <div className="space-y-1">
                    <button onClick={() => setManagerActiveMenu('Dashboard')} aria-current={managerActiveMenu === 'Dashboard' ? 'page' : undefined} className={`btn btn-ghost btn-sm w-full justify-start gap-3 px-3 text-left ${managerActiveMenu === 'Dashboard' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-100'}`}>
                      <IconHome className="w-5 h-5" />
                      <span className="text-sm font-medium">Dashboard</span>
                    </button>
                    <button onClick={() => setManagerActiveMenu('TaskManagement')} aria-current={managerActiveMenu === 'TaskManagement' ? 'page' : undefined} className={`btn btn-ghost btn-sm w-full justify-start gap-3 px-3 text-left ${managerActiveMenu === 'TaskManagement' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-100'}`}>
                      <IconTasks className="w-5 h-5" />
                      <span className="text-sm font-medium">Task Management</span>
                    </button>
                    <button onClick={() => setManagerActiveMenu('Projects')} aria-current={managerActiveMenu === 'Projects' ? 'page' : undefined} className={`btn btn-ghost btn-sm w-full justify-start gap-3 px-3 text-left ${managerActiveMenu === 'Projects' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-100'}`}>
                      <IconBriefcase className="w-5 h-5" />
                      <span className="text-sm font-medium">Projects</span>
                    </button>
                  </div>
                </div>
                <div className="mb-6">
                  <div className="space-y-1">
                    <button onClick={() => setManagerActiveMenu('TeamsAndRoles')} aria-current={managerActiveMenu === 'TeamsAndRoles' ? 'page' : undefined} className={`btn btn-ghost btn-sm w-full justify-start gap-3 px-3 text-left ${managerActiveMenu === 'TeamsAndRoles' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-100'}`}>
                      <IconUsers className="w-5 h-5" />
                      <span className="text-sm font-medium">Teams & Roles</span>
                    </button>
                    <button onClick={() => setManagerActiveMenu('ResourceAllocation')} aria-current={managerActiveMenu === 'ResourceAllocation' ? 'page' : undefined} className={`btn btn-ghost btn-sm w-full justify-start gap-3 px-3 text-left ${managerActiveMenu === 'ResourceAllocation' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-100'}`}>
                        <IconInbox className="w-5 h-5" />
                      <span className="text-sm font-medium">Resource Allocation</span>
                    </button>
                    <button onClick={() => setManagerActiveMenu('Accounts')} aria-current={managerActiveMenu === 'Accounts' ? 'page' : undefined} className={`btn btn-ghost btn-sm w-full justify-start gap-3 px-3 text-left ${managerActiveMenu === 'Accounts' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-100'}`}>
                      <IconUser className="w-5 h-5" />
                      <span className="text-sm font-medium">Accounts</span>
                    </button>
                    <button onClick={() => setManagerActiveMenu('EmployeeManagement')} aria-current={managerActiveMenu === 'EmployeeManagement' ? 'page' : undefined} className={`btn btn-ghost btn-sm w-full justify-start gap-3 px-3 text-left ${managerActiveMenu === 'EmployeeManagement' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-100'}`}>
                      <IconUser className="w-5 h-5" />
                      <span className="text-sm font-medium">Employee Database</span>
                    </button>
                  </div>
                </div>
                <div className="mb-6">
                  <div className="space-y-1">
                    <button onClick={() => setManagerActiveMenu('TeamReports')} aria-current={managerActiveMenu === 'TeamReports' ? 'page' : undefined} className={`btn btn-ghost btn-sm w-full justify-start gap-3 px-3 text-left ${managerActiveMenu === 'TeamReports' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-100'}`}>
                      <IconFileText className="w-5 h-5" />
                      <span className="text-sm font-medium">Team Reports & MVP Roadmaps</span>
                    </button>
                    <button onClick={() => setManagerActiveMenu('LeaveManagement')} aria-current={managerActiveMenu === 'LeaveManagement' ? 'page' : undefined} className={`btn btn-ghost btn-sm w-full justify-start gap-3 px-3 text-left ${managerActiveMenu === 'LeaveManagement' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-100'}`}>
                      <IconCalendar className="w-5 h-5" />
                      <span className="text-sm font-medium">Leave Management</span>
                    </button>
                  </div>
                </div>
                <div className="mb-6">
                  <div className="space-y-1">
                    <button onClick={() => setManagerActiveMenu('Automation')} aria-current={managerActiveMenu === 'Automation' ? 'page' : undefined} className={`btn btn-ghost btn-sm w-full justify-start gap-3 px-3 text-left ${managerActiveMenu === 'Automation' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-100'}`}>
                      <IconZap className="w-5 h-5" />
                      <span className="text-sm font-medium">Team Automation</span>
                    </button>
                  </div>
                </div>
                <div className="mb-6">
                  <div className="space-y-1">
                    <button onClick={() => setManagerActiveMenu('Attendance')} aria-current={managerActiveMenu === 'Attendance' ? 'page' : undefined} className={`btn btn-ghost btn-sm w-full justify-start gap-3 px-3 text-left ${managerActiveMenu === 'Attendance' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-100'}`}>
                      <IconClock className="w-5 h-5" />
                      <span className="text-sm font-medium">Attendance</span>
                    </button>
                  </div>
                </div>
                <div className="mb-6">
                  <div className="space-y-1">
                    <button onClick={() => setManagerActiveMenu('Meetings')} aria-current={managerActiveMenu === 'Meetings' ? 'page' : undefined} className={`btn btn-ghost btn-sm w-full justify-start gap-3 px-3 text-left ${managerActiveMenu === 'Meetings' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-100'}`}>
                      <IconCalendar className="w-5 h-5" />
                      <span className="text-sm font-medium">Meetings</span>
                    </button>
                    <button onClick={() => setManagerActiveMenu('AIInsights')} aria-current={managerActiveMenu === 'AIInsights' ? 'page' : undefined} className={`btn btn-ghost btn-sm w-full justify-start gap-3 px-3 text-left ${managerActiveMenu === 'AIInsights' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-100'}`}>
                      <IconIdea className="w-5 h-5" />
                      <span className="text-sm font-medium">AI Insights</span>
                    </button>
                    <button onClick={() => setManagerActiveMenu('Notifications')} aria-current={managerActiveMenu === 'Notifications' ? 'page' : undefined} className={`btn btn-ghost btn-sm w-full justify-start gap-3 px-3 text-left ${managerActiveMenu === 'Notifications' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-100'}`}>
                      <IconBell className="w-5 h-5" />
                      <span className="text-sm font-medium">Notifications</span>
                    </button>
                  </div>
                </div>
                <div className="mb-6">
                  <div className="space-y-1">
                    <button onClick={() => setManagerActiveMenu('ActivityMonitor')} aria-current={managerActiveMenu === 'ActivityMonitor' ? 'page' : undefined} className={`btn btn-ghost btn-sm w-full justify-start gap-3 px-3 text-left ${managerActiveMenu === 'ActivityMonitor' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-100'}`}>
                      <IconBarChart3 className="w-5 h-5" />
                      <span className="text-sm font-medium">Activity Monitor</span>
                    </button>
                  </div>
                </div>
              </nav>
              <div className="p-4 border-t border-gray-200">
                <LogoutButton onLogout={handleLogout} />
              </div>
            </aside>
            <main className="min-w-0 flex-1 overflow-y-auto md:ml-64">
              <div className="p-4 sm:p-8">
                {managerActiveMenu === 'Dashboard' && <DashboardComponent user={user} onLogout={handleLogout} />}
                {managerActiveMenu === 'TaskManagement' && <TaskManagementComponent userRole={managerFeatureRole} />}
                {managerActiveMenu === 'Projects' && <ProjectsComponent userRole={managerFeatureRole} />}
                {managerActiveMenu === 'TeamsAndRoles' && <TeamsAndRolesComponent userRole={managerFeatureRole} />}
                {managerActiveMenu === 'ResourceAllocation' && (isCOO ? <COOResourceAllocation userRole={managerFeatureRole} /> : <ResourceReview />)}
                {managerActiveMenu === 'Accounts' && <AccountsComponent userRole={managerDisplayRole} />}
                {managerActiveMenu === 'EmployeeManagement' && (
                  <EmployeeManagementComponent 
                    employees={getFilteredEmployees()}
                    userRole={user.role}
                    accessLevel={getAccessLevelText()}
                    userDepartment={getUserDepartment()}
                    canEdit={true}
                    canDelete={user.role !== 'Manager'}
                    canAdd={true}
                    onUpdateEmployee={handleUpdateEmployee}
                    onAddEmployee={handleAddEmployee}
                    onDeleteEmployee={handleDeleteEmployee}
                    onImportComplete={fetchEmployees}
                  />
                )}
                {managerActiveMenu === 'TeamReports' && <TeamReportsComponent userRole={managerDisplayRole} department={null} user={user} />}
                {managerActiveMenu === 'LeaveManagement' && (
                  <LeaveManagement 
                    user={user}
                    userRole={managerDisplayRole}
                    userDepartment={null}
                  />
                )}
                {managerActiveMenu === 'Automation' && <AutomationDashboardComponent user={user} userRole={managerFeatureRole} />}
                {managerActiveMenu === 'Attendance' && <AttendanceViewComponent userRole={managerFeatureRole} />}
                {managerActiveMenu === 'Meetings' && <MeetingsComponent userRole={managerFeatureRole} />}
                {managerActiveMenu === 'AIInsights' && <AIInsightsComponent userRole={managerFeatureRole} />}
                {managerActiveMenu === 'Notifications' && <NotificationsComponent userRole={managerFeatureRole} />}
                {managerActiveMenu === 'ActivityMonitor' && <ActivityMonitorComponent userRole={managerFeatureRole} />}
              </div>
            </main>
          </div>
          <SessionManager user={user} onSessionExpired={handleSessionExpired} />
        </div>
      </ProtectedRoute>
    );
  }

  // ==================== TEAM LEAD DASHBOARD ====================
  if (user.role === 'Team Lead' || user.role === 'Co-Head' || user.role === 'CO Head') {
    return (
      <ProtectedRoute user={user} requiredRoles={['Team Lead', 'Co-Head', 'CO Head']}>
        <div className="min-h-screen bg-gray-50 flex flex-col">
          <ShiftTimer user={user} onLogout={handleLogout} onTimeZoneChange={handleTimeZoneChange}
            navigationOpen={navigationOpen} onToggleNavigation={() => setNavigationOpen(open => !open)} />
          <div className="flex flex-1">
            <aside className={`fixed bottom-0 left-0 top-[88px] md:top-[73px] z-40 flex w-64 flex-col overflow-y-auto border-r border-base-300 bg-base-100 ${navigationOpen ? '' : 'max-md:hidden'}`}>
              <div className="p-6 border-b border-gray-200 flex justify-center">
                <img src={spacebornLogo} alt="Spaceborn" className="h-16 w-auto object-contain" />
              </div>
              <div className="px-4 py-3 border-b border-gray-100">
                <span className="badge badge-outline">{roleLabel(user.role)}</span>
              </div>
              <nav aria-label="Dashboard navigation" onClick={event => { if (event.target.closest('button')) setNavigationOpen(false); }} className="flex-1 p-4 overflow-y-auto">
                <div className="mb-6">
                  <div className="space-y-1">
                    <button onClick={() => setTeamLeadActiveMenu('Dashboard')} aria-current={teamLeadActiveMenu === 'Dashboard' ? 'page' : undefined} className={`btn btn-ghost btn-sm w-full justify-start gap-3 px-3 text-left ${teamLeadActiveMenu === 'Dashboard' ? 'bg-green-50 text-green-600' : 'text-gray-700 hover:bg-gray-100'}`}>
                      <IconHome className="w-5 h-5" />
                      <span className="text-sm font-medium">Dashboard</span>
                    </button>
                    <button onClick={() => setTeamLeadActiveMenu('TaskManagement')} aria-current={teamLeadActiveMenu === 'TaskManagement' ? 'page' : undefined} className={`btn btn-ghost btn-sm w-full justify-start gap-3 px-3 text-left ${teamLeadActiveMenu === 'TaskManagement' ? 'bg-green-50 text-green-600' : 'text-gray-700 hover:bg-gray-100'}`}>
                      <IconTasks className="w-5 h-5" />
                      <span className="text-sm font-medium">Task Management</span>
                    </button>
                  </div>
                </div>
                <div className="mb-6">
                  <div className="space-y-1">
                    <button onClick={() => setTeamLeadActiveMenu('TeamsAndRoles')} aria-current={teamLeadActiveMenu === 'TeamsAndRoles' ? 'page' : undefined} className={`btn btn-ghost btn-sm w-full justify-start gap-3 px-3 text-left ${teamLeadActiveMenu === 'TeamsAndRoles' ? 'bg-green-50 text-green-600' : 'text-gray-700 hover:bg-gray-100'}`}>
                      <IconUsers className="w-5 h-5" />
                      <span className="text-sm font-medium">Teams & Roles</span>
                    </button>
                    {user.role === 'Team Lead' && (
                      <button type="button" className={`btn btn-sm w-full justify-start ${teamLeadActiveMenu === 'EmployeeAccess' ? 'btn-active' : 'btn-ghost'}`}
                        onClick={() => setTeamLeadActiveMenu('EmployeeAccess')}><IconLock className="h-5 w-5" /> Employee access</button>
                    )}
                    <button onClick={() => setTeamLeadActiveMenu('Resources')} aria-current={teamLeadActiveMenu === 'Resources' ? 'page' : undefined} className={`btn btn-ghost btn-sm w-full justify-start gap-3 px-3 text-left ${teamLeadActiveMenu === 'Resources' ? 'bg-green-50 text-green-600' : 'text-gray-700 hover:bg-gray-100'}`}>
                      <IconInbox className="w-5 h-5" />
                      <span className="text-sm font-medium">Resources</span>
                    </button>
                    <button onClick={() => setTeamLeadActiveMenu('MVPRoadmap')} aria-current={teamLeadActiveMenu === 'MVPRoadmap' ? 'page' : undefined} className={`btn btn-ghost btn-sm w-full justify-start gap-3 px-3 text-left ${teamLeadActiveMenu === 'MVPRoadmap' ? 'bg-green-50 text-green-600' : 'text-gray-700 hover:bg-gray-100'}`}>
                      <IconBarChart3 className="w-5 h-5" />
                      <span className="text-sm font-medium">MVP Roadmap</span>
                    </button>
                  </div>
                </div>
                <div className="mb-6">
                  <div className="space-y-1">
                    <button onClick={() => setTeamLeadActiveMenu('Meetings')} aria-current={teamLeadActiveMenu === 'Meetings' ? 'page' : undefined} className={`btn btn-ghost btn-sm w-full justify-start gap-3 px-3 text-left ${teamLeadActiveMenu === 'Meetings' ? 'bg-green-50 text-green-600' : 'text-gray-700 hover:bg-gray-100'}`}>
                      <IconCalendar className="w-5 h-5" />
                      <span className="text-sm font-medium">Meetings</span>
                    </button>
                    <button onClick={() => setTeamLeadActiveMenu('Notifications')} aria-current={teamLeadActiveMenu === 'Notifications' ? 'page' : undefined} className={`btn btn-ghost btn-sm w-full justify-start gap-3 px-3 text-left ${teamLeadActiveMenu === 'Notifications' ? 'bg-green-50 text-green-600' : 'text-gray-700 hover:bg-gray-100'}`}>
                      <IconBell className="w-5 h-5" />
                      <span className="text-sm font-medium">Notifications</span>
                    </button>
                    <button onClick={() => setTeamLeadActiveMenu('LeaveManagement')} aria-current={teamLeadActiveMenu === 'LeaveManagement' ? 'page' : undefined} className={`btn btn-ghost btn-sm w-full justify-start gap-3 px-3 text-left ${teamLeadActiveMenu === 'LeaveManagement' ? 'bg-green-50 text-green-600' : 'text-gray-700 hover:bg-gray-100'}`}>
                      <IconCalendar className="w-5 h-5" />
                      <span className="text-sm font-medium">Leave & Breaks</span>
                    </button>
                  </div>
                </div>
              </nav>
              <div className="p-4 border-t border-gray-200">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-black rounded-full flex items-center justify-center text-white font-semibold">
                    {user.name?.split(' ').map(n => n[0]).join('') || 'U'}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{user.name}</p>
                    <p className="text-xs text-gray-500">{roleLabel(user.role)} · {getUserDepartment()}</p>
                  </div>
                  <LogoutButton onLogout={handleLogout} />
                </div>
              </div>
            </aside>
            <main className="min-w-0 flex-1 overflow-y-auto md:ml-64">
              <div className="p-4 sm:p-8">
                {teamLeadActiveMenu === 'Dashboard' && <TeamLeadDashboard user={user} onLogout={handleLogout} />}
                {teamLeadActiveMenu === 'TaskManagement' && <TeamLeadTaskManagement userRole={user.role} />}
                {teamLeadActiveMenu === 'TeamsAndRoles' && <TeamLeadTeamsAndRoles userRole={user.role} />}
                {teamLeadActiveMenu === 'EmployeeAccess' && user.role === 'Team Lead' && <EmployeeAccess />}
                {teamLeadActiveMenu === 'Resources' && <>
                  {user.role === 'Team Lead' && <ResourceReview />}
                  <TeamLeadResources userRole={user.role} />
                </>}
                {teamLeadActiveMenu === 'MVPRoadmap' && <MVPRoadmap userRole={user.role} />}
                {teamLeadActiveMenu === 'Meetings' && <TeamLeadMeetings userRole={user.role} />}
                {teamLeadActiveMenu === 'Notifications' && <TeamLeadNotifications userRole={user.role} />}
                {teamLeadActiveMenu === 'LeaveManagement' && (
                  <LeaveManagement 
                    user={user}
                    userRole={user.role}
                    userDepartment={user.department}
                  />
                )}
              </div>
            </main>
          </div>
          <SessionManager user={user} onSessionExpired={handleSessionExpired} />
        </div>
      </ProtectedRoute>
    );
  }

  // ==================== MEMBER DASHBOARD ====================
  if (['Member', 'HR', 'Coordinator'].includes(user.role)) {
    const memberData = user;
    
    return (
      <ProtectedRoute user={user} requiredRoles={['Member', 'HR', 'Coordinator']}>
        <div className="min-h-screen bg-gray-50 flex flex-col">
          <ShiftTimer user={user} onLogout={handleLogout} onTimeZoneChange={handleTimeZoneChange}
            navigationOpen={navigationOpen} onToggleNavigation={() => setNavigationOpen(open => !open)} />
          <div className="flex flex-1">
            <aside className={`fixed bottom-0 left-0 top-[88px] md:top-[73px] z-40 flex w-64 flex-col overflow-y-auto border-r border-base-300 bg-base-100 ${navigationOpen ? '' : 'max-md:hidden'}`}>
              <div className="p-6 border-b border-gray-200 flex justify-center">
                <img src={spacebornLogo} alt="Spaceborn" className="h-16 w-auto object-contain" />
              </div>
              <div className="px-4 py-3 border-b border-gray-100">
                <span className="badge badge-outline">{roleLabel(user.role)}</span>
              </div>
              <nav aria-label="Dashboard navigation" onClick={event => { if (event.target.closest('button')) setNavigationOpen(false); }} className="flex-1 p-4 overflow-y-auto">
                <div className="mb-6">
                  <div className="space-y-1">
                    <button onClick={() => setMemberActiveMenu('Dashboard')} aria-current={memberActiveMenu === 'Dashboard' ? 'page' : undefined} className={`btn btn-ghost btn-sm w-full justify-start gap-3 px-3 text-left ${memberActiveMenu === 'Dashboard' ? 'bg-gray-100 text-black' : 'text-gray-700 hover:bg-gray-100'}`}>
                      <IconHome className="w-5 h-5" />
                      <span className="text-sm font-medium">Dashboard</span>
                    </button>
                    <button onClick={() => setMemberActiveMenu('MyProfile')} aria-current={memberActiveMenu === 'MyProfile' ? 'page' : undefined} className={`btn btn-ghost btn-sm w-full justify-start gap-3 px-3 text-left ${memberActiveMenu === 'MyProfile' ? 'bg-gray-100 text-black' : 'text-gray-700 hover:bg-gray-100'}`}>
                      <IconUser className="w-5 h-5" />
                      <span className="text-sm font-medium">My Profile</span>
                    </button>
                    {user.role === 'Member' && (
                      <button type="button" onClick={() => setMemberActiveMenu('MyTeam')} aria-current={memberActiveMenu === 'MyTeam' ? 'page' : undefined}
                        className={`btn btn-ghost btn-sm w-full justify-start gap-3 px-3 text-left ${memberActiveMenu === 'MyTeam' ? 'bg-gray-100 text-black' : 'text-gray-700 hover:bg-gray-100'}`}>
                        <IconUsers className="w-5 h-5" />
                        <span className="text-sm font-medium">My Team</span>
                      </button>
                    )}
                  </div>
                </div>
                <div className="mb-6">
                  <div className="space-y-1">
                    <button onClick={() => setMemberActiveMenu('DailyReport')} aria-current={memberActiveMenu === 'DailyReport' ? 'page' : undefined} className={`btn btn-ghost btn-sm w-full justify-start gap-3 px-3 text-left ${memberActiveMenu === 'DailyReport' ? 'bg-gray-100 text-black' : 'text-gray-700 hover:bg-gray-100'}`}>
                      <IconFileText className="w-5 h-5" />
                      <span className="text-sm font-medium">Daily Report</span>
                    </button>
                    <button onClick={() => setMemberActiveMenu('Leave')} aria-current={memberActiveMenu === 'Leave' ? 'page' : undefined} className={`btn btn-ghost btn-sm w-full justify-start gap-3 px-3 text-left ${memberActiveMenu === 'Leave' ? 'bg-gray-100 text-black' : 'text-gray-700 hover:bg-gray-100'}`}>
                      <IconCalendar className="w-5 h-5" />
                      <span className="text-sm font-medium">Leave</span>
                    </button>
                  </div>
                </div>
                <div className="mb-6">
                  <div className="space-y-1">
                    <button onClick={() => setMemberActiveMenu('TaskManagement')} aria-current={memberActiveMenu === 'TaskManagement' ? 'page' : undefined} className={`btn btn-ghost btn-sm w-full justify-start gap-3 px-3 text-left ${memberActiveMenu === 'TaskManagement' ? 'bg-gray-100 text-black' : 'text-gray-700 hover:bg-gray-100'}`}>
                      <IconTasks className="w-5 h-5" />
                      <span className="text-sm font-medium">My Tasks</span>
                    </button>
                  </div>
                </div>
                <div className="mb-6">
                  <div className="space-y-1">
                    {['HR', 'Coordinator'].includes(user.role) && (
                      <button type="button" className={`btn btn-sm w-full justify-start ${memberActiveMenu === 'EmployeeAccess' ? 'btn-active' : 'btn-ghost'}`}
                        onClick={() => setMemberActiveMenu('EmployeeAccess')}><IconLock className="h-5 w-5" /> Employee access</button>
                    )}
                    <button onClick={() => setMemberActiveMenu('Resources')} aria-current={memberActiveMenu === 'Resources' ? 'page' : undefined} className={`btn btn-ghost btn-sm w-full justify-start gap-3 px-3 text-left ${memberActiveMenu === 'Resources' ? 'bg-gray-100 text-black' : 'text-gray-700 hover:bg-gray-100'}`}>
                      <IconInbox className="w-5 h-5" />
                      <span className="text-sm font-medium">Resources</span>
                    </button>
                  </div>
                </div>
                <div className="mb-6">
                  <div className="space-y-1">
                    <button onClick={() => setMemberActiveMenu('Meetings')} aria-current={memberActiveMenu === 'Meetings' ? 'page' : undefined} className={`btn btn-ghost btn-sm w-full justify-start gap-3 px-3 text-left ${memberActiveMenu === 'Meetings' ? 'bg-gray-100 text-black' : 'text-gray-700 hover:bg-gray-100'}`}>
                      <IconCalendar className="w-5 h-5" />
                      <span className="text-sm font-medium">Meetings</span>
                    </button>
                    <button onClick={() => setMemberActiveMenu('Notifications')} aria-current={memberActiveMenu === 'Notifications' ? 'page' : undefined} className={`btn btn-ghost btn-sm w-full justify-start gap-3 px-3 text-left ${memberActiveMenu === 'Notifications' ? 'bg-gray-100 text-black' : 'text-gray-700 hover:bg-gray-100'}`}>
                      <IconBell className="w-5 h-5" />
                      <span className="text-sm font-medium">Notifications</span>
                    </button>
                  </div>
                </div>
              </nav>
              <div className="p-4 border-t border-gray-200">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-black rounded-full flex items-center justify-center text-white font-semibold">
                    {user.name?.split(' ').map(n => n[0]).join('') || 'U'}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{user.name}</p>
                    <p className="text-xs text-gray-500">{roleLabel(user.role)} · {user.department}</p>
                  </div>
                  <LogoutButton onLogout={handleLogout} />
                </div>
              </div>
            </aside>
            <main className="min-w-0 flex-1 overflow-y-auto md:ml-64">
              <div className="p-4 sm:p-8">
                {memberActiveMenu === 'Dashboard' && <MemberDashboard user={user} onLogout={handleLogout} />}
                {memberActiveMenu === 'MyTeam' && <MyTeam />}
                {memberActiveMenu === 'MyProfile' && memberData && (
                  <MemberProfileView 
                    userData={memberData}
                    onUpdate={handleUpdateEmployee}
                  />
                )}
                {memberActiveMenu === 'DailyReport' && (
                  <DailyWorkReport 
                    user={user}
                    onReportSubmitted={() => console.log('Report submitted')}
                  />
                )}
                {memberActiveMenu === 'Leave' && (
                  <LeaveManagement 
                    user={user}
                    userRole={user.role}
                    userDepartment={user.department}
                  />
                )}
                {memberActiveMenu === 'TaskManagement' && <MemberTaskManagement userRole={user.role} />}
                {memberActiveMenu === 'EmployeeAccess' && ['HR', 'Coordinator'].includes(user.role) && <EmployeeAccess />}
                {memberActiveMenu === 'Resources' && <>
                  {['HR', 'Coordinator'].includes(user.role) && <ResourceReview />}
                  <MemberResources userRole={user.role} />
                </>}
                {memberActiveMenu === 'Meetings' && <MemberMeetings userRole={user.role} />}
                {memberActiveMenu === 'Notifications' && <MemberNotifications userRole={user.role} />}
              </div>
            </main>
          </div>
          <SessionManager user={user} onSessionExpired={handleSessionExpired} />
        </div>
      </ProtectedRoute>
    );
  }

  return null;
}

export default App;
