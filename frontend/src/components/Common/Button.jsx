import React from 'react';

const variants = {
  primary: 'btn-primary',
  secondary: 'btn-soft',
  outline: 'btn-outline',
  danger: 'btn-error',
  success: 'btn-success',
  warning: 'btn-warning'
};

const sizes = { sm: 'btn-sm', md: 'btn-md', lg: 'btn-lg' };

export function Button({
  children, variant = 'primary', size = 'md', icon: Icon, onClick, className = '',
  disabled = false, loading = false, fullWidth = false, type = 'button'
}) {
  return (
    <button type={type} onClick={onClick} disabled={disabled || loading} aria-busy={loading}
      className={`btn ${variants[variant] || ''} ${sizes[size] || ''} ${fullWidth ? 'w-full' : ''} ${className}`}>
      {loading && <span className="loading loading-spinner loading-sm" aria-hidden="true" />}
      {Icon && !loading && <Icon size={16} aria-hidden="true" />}
      {children}
    </button>
  );
}
