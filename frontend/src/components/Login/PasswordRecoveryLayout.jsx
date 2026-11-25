import React, { useEffect } from 'react';
import logo from '../../assets/spaceborn-logo.png';

export default function PasswordRecoveryLayout({ title, children }) {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = `${title} | Spaceborn`;
    return () => { document.title = previousTitle; };
  }, [title]);

  return (
    <main className="grid min-h-screen place-items-center bg-base-200 p-4">
      <div className="w-full max-w-md">
        <img src={logo} alt="Spaceborn" className="mx-auto mb-6 h-20 w-auto object-contain" />
        <section className="card border border-base-300 bg-base-100 shadow-sm">
          <div className="card-body gap-4">
            <h1 className="card-title text-2xl">{title}</h1>
            {children}
          </div>
        </section>
      </div>
    </main>
  );
}
