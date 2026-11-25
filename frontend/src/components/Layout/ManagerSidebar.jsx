import { Briefcase as IconBriefcase, CheckCircle as IconCheckCircle, Home as IconHome, Inbox as IconInbox, Plus as IconPlus, User as IconUser, Users as IconUsers } from '../Common/Icons';
import React from 'react';

const ManagerSidebar = ({ activeMenu, setActiveMenu }) => {
  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col h-screen fixed left-0 top-0">
      {/* Logo */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
            <IconPlus className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-xl bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Spaceborn</span>
        </div>
      </div>

      {/* Role Tag */}
      <div className="px-4 py-3 border-b border-gray-100">
        <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded">Manager View</span>
        <p className="text-xs text-gray-500 mt-2">Core Systems Department</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 overflow-y-auto">
        {/* OVERVIEW Section */}
        <div className="mb-6">
          <div className="space-y-1">
            <button onClick={() => setActiveMenu('Dashboard')} className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${activeMenu === 'Dashboard' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-100'}`}>
              <IconHome className="w-5 h-5" />
              <span className="text-sm font-medium">Dashboard</span>
            </button>
            <button onClick={() => setActiveMenu('TeamPerformance')} className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${activeMenu === 'TeamPerformance' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-100'}`}>
              <IconUsers className="w-5 h-5" />
              <span className="text-sm font-medium">Team Performance</span>
            </button>
            <button onClick={() => setActiveMenu('Projects')} className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${activeMenu === 'Projects' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-100'}`}>
              <IconBriefcase className="w-5 h-5" />
              <span className="text-sm font-medium">Projects</span>
            </button>
          </div>
        </div>

        {/* MANAGEMENT Section */}
        <div className="mb-6">
          <div className="space-y-1">
            <button onClick={() => setActiveMenu('TeamMembers')} className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${activeMenu === 'TeamMembers' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-100'}`}>
              <IconUser className="w-5 h-5" />
              <span className="text-sm font-medium">Team Members</span>
            </button>
            <button onClick={() => setActiveMenu('EmployeeManagement')} className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${activeMenu === 'EmployeeManagement' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-100'}`}>
              <IconUser className="w-5 h-5" />
              <span className="text-sm font-medium">Employee Database</span>
            </button>
            <button onClick={() => setActiveMenu('ResourceAllocation')} className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${activeMenu === 'ResourceAllocation' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-100'}`}>
              <IconInbox className="w-5 h-5" />
              <span className="text-sm font-medium">Resources</span>
            </button>
            <button onClick={() => setActiveMenu('Approvals')} className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${activeMenu === 'Approvals' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-100'}`}>
              <IconCheckCircle className="w-5 h-5" />
              <span className="text-sm font-medium">Approvals</span>
            </button>
          </div>
        </div>
      </nav>

      {/* User Profile */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-gray-400 to-gray-600 rounded-full flex items-center justify-center text-white font-semibold">JD</div>
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-900">John Doe</p>
            <p className="text-xs text-gray-500">Core Systems Manager</p>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default ManagerSidebar;