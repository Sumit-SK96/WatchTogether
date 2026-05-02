/**
 * Toast.jsx — Notification toast overlay
 * Listens for 'sync-toast' custom events and displays messages.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { TOAST_TIMEOUT } from '../utils/constants';
import { randomId } from '../utils/helpers';

export default function Toast() {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info') => {
    const id = randomId();
    setToasts(prev => [...prev.slice(-4), { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, TOAST_TIMEOUT);
  }, []);

  useEffect(() => {
    const handler = (e) => addToast(e.detail.message, e.detail.type);
    window.addEventListener('sync-toast', handler);
    return () => window.removeEventListener('sync-toast', handler);
  }, [addToast]);

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map(toast => (
        <div key={toast.id} className={`toast glass ${toast.type || 'info'}`}>
          <span style={{ fontSize: '1rem' }}>
            {toast.type === 'warning' ? '⚠️' : 'ℹ️'}
          </span>
          {toast.message}
        </div>
      ))}
    </div>
  );
}
