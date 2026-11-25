import React from 'react';
import { MoreVertical } from './Icons';

export const Card = ({ 
  title, 
  icon: Icon, 
  children, 
  className = '', 
  onMoreClick,
  loading = false 
}) => {
  if (loading) {
    return (
      <div className={`card bg-base-100 border border-base-300 overflow-hidden ${className}`}>
        <div className="p-6">
          <div className="space-y-4">
            <div className="skeleton h-4 w-1/4"></div>
            <div className="space-y-3">
              <div className="skeleton h-20"></div>
              <div className="skeleton h-20"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`card bg-base-100 border border-base-300 overflow-hidden hover:shadow-lg transition-all duration-300 ${className}`}>
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {Icon && <Icon className="w-5 h-5 text-gray-500" />}
          <h2 className="font-semibold text-gray-900">{title}</h2>
        </div>
        {onMoreClick && (
          <button 
            onClick={onMoreClick}
            className="btn btn-ghost btn-square btn-sm" type="button"
            aria-label="More options"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        )}
      </div>
      <div className="p-6">
        {children}
      </div>
    </div>
  );
};