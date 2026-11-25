import React, { useEffect, useState } from 'react';
import authService from '../../../services/authService';
import { roleLabel } from '../../../utils/roleLabels';

const apiBase = (process.env.REACT_APP_API_URL || '/api').replace(/\/+$/, '');

export default function MyTeam() {
  const [team, setTeam] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    async function loadTeam() {
      try {
        const response = await fetch(`${apiBase}/team-members/mine`, {
          headers: authService.getAuthHeaders(),
          signal: controller.signal
        });
        if (!response.ok) throw new Error('Could not load your team.');
        const result = await response.json();
        setTeam(result.data);
      } catch {
        if (!controller.signal.aborted) setError('Could not load your team.');
      }
    }
    loadTeam();
    return () => controller.abort();
  }, []);

  return (
    <section className="card border border-base-300 bg-base-100">
      <div className="card-body">
        <h1 className="card-title text-2xl">{team?.department || 'My Team'}</h1>
        {error && <p className="alert alert-error" role="alert">{error}</p>}
        {!team && !error && <span className="loading loading-spinner" role="status" aria-label="Loading your team" />}
        {team?.members.length === 0 && <p>No members are listed for your team.</p>}
        {team?.members.length > 0 && (
          <ul className="divide-y divide-base-300">
            {team.members.map(member => (
              <li key={member.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <span className="font-medium">{member.name}</span>
                <span className="badge badge-outline">{roleLabel(member.role)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
