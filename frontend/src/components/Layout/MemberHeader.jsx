import { Bell as IconBell, Search as IconSearch } from '../Common/Icons';
import React from 'react';

const MemberHeader = ({ activeMenu, user }) => {
  const getTitle = () => {
    switch(activeMenu) {
      case 'Dashboard': return 'Dashboard';
      case 'MyTasks': return 'My Tasks';
      case 'DailyReport': return 'Daily Report';
      case 'Attendance': return 'Attendance';
      case 'LeaveRequest': return 'Leave Request';
      case 'MyDocuments': return 'My Documents';
      case 'Performance': return 'Performance';
      default: return 'Dashboard';
    }
  };

  return (
    <header className="bg-white border-b border-gray-200 px-8 py-4 fixed top-0 right-0 left-64 z-40">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">{getTitle()}</h1>
        <div className="flex items-center space-x-4">
          <div className="relative">
            <input 
              type="text" 
              placeholder="Search..." 
              className="input w-80 pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
            <IconSearch className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
          </div>
          <button className="relative p-2 hover:bg-gray-100 rounded-full">
            <IconBell className="w-5 h-5 text-gray-600" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
          </button>
        </div>
      </div>
    </header>
  );
};

export default MemberHeader;