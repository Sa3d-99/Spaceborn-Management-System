import React from 'react';
import { TrendingUp, TrendingDown } from './Icons';

export const StatCard = ({ 
  icon: Icon, 
  label, 
  value, 
  trend, 
  trendValue, 
  color,
  onClick 
}) => {
  const colors = {
    blue: 'bg-blue-50 text-blue-600',
    purple: 'bg-purple-50 text-purple-600',
    green: 'bg-green-50 text-green-600',
    orange: 'bg-orange-50 text-orange-600',
    red: 'bg-red-50 text-red-600',
    yellow: 'bg-yellow-50 text-yellow-600'
  };

  const Element = onClick ? 'button' : 'div';
  return (
    <Element
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`stat rounded-box border border-base-300 bg-base-100 p-6 text-left ${onClick ? 'cursor-pointer hover:shadow-md' : ''}`}
    >
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 rounded-lg ${colors[color]} transition-all group-hover:scale-110`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
      <p className="stat-value text-2xl">{value}</p>
      <p className="stat-title mt-1 text-sm">{label}</p>
      {trend && (
        <div className={`flex items-center space-x-1 mt-2 text-xs ${trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
          {trend === 'up' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          <span>{trendValue}</span>
        </div>
      )}
    </Element>
  );
};