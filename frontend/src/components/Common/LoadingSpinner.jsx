import React from 'react';

const sizes = { sm: 'loading-sm', md: 'loading-md', lg: 'loading-lg' };
const colors = { blue: 'text-primary', white: 'text-white', gray: 'text-base-content/70' };

export function LoadingSpinner({ size = 'md', color = 'blue' }) {
  return (
    <div className="flex items-center justify-center" role="status" aria-label="Loading">
      <span className={`loading loading-spinner ${sizes[size]} ${colors[color]}`} aria-hidden="true" />
    </div>
  );
}
