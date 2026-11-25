import React from 'react';

export default function ProtectedRoute({ children, user, requiredRoles = [] }) {
  if (user && (!requiredRoles.length || requiredRoles.includes(user.role))) {
    return children;
  }

  return (
    <main className="grid min-h-screen place-items-center bg-base-200 p-4">
      <p className="alert alert-error max-w-md" role="alert">
        {user ? 'Your role does not have access to this page.' : 'Sign in to continue.'}
      </p>
    </main>
  );
}
