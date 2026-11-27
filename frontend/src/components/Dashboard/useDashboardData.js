import { useEffect, useState } from 'react';
import authService from '../../services/authService';

const apiBase = (process.env.REACT_APP_API_URL || '/api').replace(/\/+$/, '');

export default function useDashboardData(path, errorMessage) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const token = authService.getToken();
    setData(null);
    setError('');
    fetch(`${apiBase}${path}`, { headers: authService.getAuthHeaders(), signal: controller.signal })
      .then(async response => {
        if (response.status === 401 && !controller.signal.aborted && token && token === authService.getToken()) {
          window.dispatchEvent(new Event('spaceborn:session-rejected'));
          return;
        }
        if (!response.ok) throw new Error(errorMessage);
        const body = await response.json();
        if (body.success === false) throw new Error(errorMessage);
        if (!controller.signal.aborted) setData(body.data ?? body);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(errorMessage);
      });
    return () => controller.abort();
  }, [path, revision, errorMessage]);

  return { data, error, reload: () => setRevision(value => value + 1) };
}
