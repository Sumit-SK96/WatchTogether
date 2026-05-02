/**
 * LoadingScreen.jsx — Animated loading screen with pulsing logo
 */
import React from 'react';

export default function LoadingScreen() {
  return (
    <div className="loading-screen">
      <div className="loading-logo">WatchTogether</div>
      <p style={{
        color: 'var(--text-muted)',
        marginTop: '12px',
        fontSize: '0.9rem',
        fontWeight: 300,
      }}>
        Connecting to server...
      </p>
      <div className="loading-dots">
        <div className="loading-dot" />
        <div className="loading-dot" />
        <div className="loading-dot" />
      </div>
    </div>
  );
}
