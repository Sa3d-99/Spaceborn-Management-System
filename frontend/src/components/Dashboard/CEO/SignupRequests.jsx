import React, { useEffect, useState } from 'react';
import authService from '../../../services/authService';
import { formatDateTime } from '../../../utils/formatters';

const apiBase = (process.env.REACT_APP_API_URL || '/api').replace(/\/+$/, '');
const colors = { pending: 'badge-warning', approved: 'badge-success', rejected: 'badge-error' };
const setupLabels = {
  'missing-account': 'Employee account removed',
  'missing-email': 'Employee email missing',
  'awaiting-password': 'Waiting for password',
  inactive: 'Employee account inactive',
  complete: 'Password created'
};

async function signupRequest(path = '', method = 'GET') {
  const response = await fetch(`${apiBase}/auth/signup-requests${path}`, {
    method, headers: authService.getAuthHeaders()
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || 'Could not load signup requests.');
  return result;
}

export default function SignupRequests() {
  const [requests, setRequests] = useState(null);
  const [working, setWorking] = useState(null);
  const [notice, setNotice] = useState(null);
  const [error, setError] = useState('');

  async function refresh() {
    try {
      setRequests((await signupRequest()).data);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => { refresh(); }, []);

  async function review(id, action) {
    if (action === 'delete' && !window.confirm('Delete this signup request from the queue?')) return;
    setWorking(id);
    setNotice(null);
    setError('');
    try {
      const result = action === 'delete'
        ? await signupRequest(`/${id}`, 'DELETE')
        : await signupRequest(`/${id}/${action}`, 'POST');
      setNotice({ text: result.message, deliveryFailed: result.data?.emailSent === false });
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setWorking(null);
    }
  }

  return (
    <section className="card border border-base-300 bg-base-100">
      <div className="card-body">
        <h1 className="card-title text-2xl">Signup requests</h1>
        {error && <p className="alert alert-error" role="alert">{error}</p>}
        {notice && (
          <p className={`alert ${notice.deliveryFailed ? 'alert-warning' : 'alert-success'}`} role="status">
            {notice.text}
          </p>
        )}
        {!requests && !error && <span className="loading loading-spinner" role="status" aria-label="Loading signup requests" />}
        {requests?.length === 0 && <p className="text-base-content/70">No signup requests yet.</p>}
        {requests?.length > 0 && (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>Applicant</th><th>Department</th><th>Requested</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {requests.map(request => (
                  <tr key={request.id}>
                    <td>
                      <p className="font-semibold">{request.name}</p>
                      <p className="text-sm text-base-content/70">{request.email}</p>
                    </td>
                    <td>{request.department}</td>
                    <td>{formatDateTime(request.requestedAt)}</td>
                    <td>
                      <span className={`badge ${colors[request.status]}`}>{request.status}</span>
                      {request.setupStatus && <p className="mt-1 text-sm text-base-content/70">{setupLabels[request.setupStatus]}</p>}
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-2">
                        {request.status === 'pending' && (
                          <>
                            <button type="button" className="btn btn-sm btn-success" disabled={working !== null}
                              onClick={() => review(request.id, 'approve')}>Approve</button>
                            <button type="button" className="btn btn-sm btn-outline" disabled={working !== null}
                              onClick={() => review(request.id, 'reject')}>Decline</button>
                          </>
                        )}
                        {request.setupStatus === 'missing-account' && (
                          <button type="button" className="btn btn-sm btn-success" disabled={working !== null}
                            onClick={() => review(request.id, 'approve')}>Approve again</button>
                        )}
                        {request.setupStatus === 'awaiting-password' && (
                          <button type="button" className="btn btn-sm btn-ghost" disabled={working !== null}
                            onClick={() => review(request.id, 'resend')}>Resend setup link</button>
                        )}
                        <button type="button" className="btn btn-sm btn-outline btn-error" disabled={working !== null}
                          onClick={() => review(request.id, 'delete')}>Delete request</button>
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
