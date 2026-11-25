import React, { useEffect, useState } from 'react';
import authService from '../../services/authService';

const apiBase = (process.env.REACT_APP_API_URL || '/api').replace(/\/+$/, '');

async function request(path, options) {
  const response = await fetch(`${apiBase}/resources${path}`, { headers: authService.getAuthHeaders(), ...options });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || 'Resource request failed.');
  return result;
}

export default function ResourceReview() {
  const [records, setRecords] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function refresh() {
    try {
      setRecords((await request('/pending')).data);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => { refresh(); }, []);

  async function review(id, action) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await request(`/requests/${id}/${action}`, { method: 'PUT' });
      setMessage(action === 'approve' ? 'Request approved.' : 'Request rejected.');
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card mb-6 border border-base-300 bg-base-100">
      <div className="card-body">
        <h2 className="card-title">Resource requests to review</h2>
        {error && <p className="alert alert-error" role="alert">{error}</p>}
        {message && <p className="alert alert-success" role="status">{message}</p>}
        {!records && !error && <span className="loading loading-spinner" role="status" aria-label="Loading resource requests" />}
        {records?.length === 0 && <p className="text-base-content/70">No pending requests.</p>}
        {records?.length > 0 && (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>Resource</th><th>Requested by</th><th>Reason</th><th>Actions</th></tr></thead>
              <tbody>
                {records.map(item => (
                  <tr key={item.id}>
                    <td>{item.resourceName} × {item.quantity || 1}</td><td>{item.requesterName}</td><td>{item.reason}</td>
                    <td>
                      <div className="flex gap-2">
                        <button type="button" className="btn btn-sm btn-success" disabled={busy} onClick={() => review(item.id, 'approve')}>Approve</button>
                        <button type="button" className="btn btn-sm btn-outline" disabled={busy} onClick={() => review(item.id, 'reject')}>Reject</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
