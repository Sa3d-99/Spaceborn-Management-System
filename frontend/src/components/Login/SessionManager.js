import { useEffect, useRef } from 'react';
import authService from '../../services/authService';

export default function SessionManager({ user, onSessionExpired, checkInterval = 60_000 }) {
  const onExpired = useRef(onSessionExpired);
  onExpired.current = onSessionExpired;

  useEffect(() => {
    if (!user) return;
    let current = true;
    let checking = false;

    async function checkSession() {
      if (!current || checking) return;
      checking = true;
      try {
        const verification = await authService.verifyToken({ signal: AbortSignal.timeout(8000) });
        if (current && !verification.success && !verification.retryable) {
          current = false;
          onExpired.current();
        }
      } finally {
        checking = false;
      }
    }

    function checkWhenVisible() {
      if (document.visibilityState === 'visible') checkSession();
    }

    function checkWhenTokenChanges(event) {
      if (event.key === 'authToken') checkSession();
    }

    const timer = setInterval(checkSession, checkInterval);
    window.addEventListener('storage', checkWhenTokenChanges);
    document.addEventListener('visibilitychange', checkWhenVisible);
    return () => {
      current = false;
      clearInterval(timer);
      window.removeEventListener('storage', checkWhenTokenChanges);
      document.removeEventListener('visibilitychange', checkWhenVisible);
    };
  }, [user, checkInterval]);

  return null;
}
