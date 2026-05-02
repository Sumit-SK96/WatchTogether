/**
 * LandingPage.jsx — Room creation and joining UI
 * Features animated background, gradient buttons, and room code display.
 */
import React, { useState } from 'react';
import { motion } from 'framer-motion';

export default function LandingPage({ onCreateRoom, onJoinRoom, error }) {
  const [mode, setMode] = useState(null); // null | 'create' | 'join'
  const [name, setName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      await onCreateRoom(name.trim());
    } catch (e) {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!name.trim() || !joinCode.trim()) return;
    setLoading(true);
    try {
      await onJoinRoom(joinCode.trim(), name.trim());
    } catch (e) {
      setLoading(false);
    }
  };

  return (
    <div className="landing-bg" style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
    }}>
      <motion.div
        className="landing-card glass-strong"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.34, 1.56, 0.64, 1] }}
      >
        {/* Logo */}
        <h1 style={{
          fontFamily: "'Outfit', sans-serif",
          fontSize: '2.4rem',
          fontWeight: 800,
          background: 'linear-gradient(135deg, #7C3AED, #06B6D4)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          marginBottom: '8px',
        }}>
          WatchTogether
        </h1>
        <p style={{
          color: 'var(--text-muted)',
          fontSize: '0.95rem',
          marginBottom: '36px',
          fontWeight: 300,
        }}>
          Watch movies in perfect sync with a friend
        </p>

        {/* Error Display */}
        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#EF4444',
            padding: '10px 16px',
            borderRadius: '10px',
            marginBottom: '20px',
            fontSize: '0.85rem',
          }}>
            {error}
          </div>
        )}

        {/* Name Input (always shown) */}
        <div style={{ marginBottom: '20px' }}>
          <input
            className="name-input"
            placeholder="Your display name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={20}
            autoFocus
          />
        </div>

        {!mode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
          >
            <button
              className="btn-gradient"
              onClick={() => setMode('create')}
              disabled={!name.trim()}
              style={{ opacity: name.trim() ? 1 : 0.5 }}
            >
              <span>🎬 Create Room</span>
            </button>
            <button
              className="btn-secondary"
              onClick={() => setMode('join')}
              disabled={!name.trim()}
              style={{ opacity: name.trim() ? 1 : 0.5 }}
            >
              🔗 Join Room
            </button>
          </motion.div>
        )}

        {mode === 'create' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
          >
            <button
              className="btn-gradient"
              onClick={handleCreate}
              disabled={loading || !name.trim()}
            >
              <span>{loading ? 'Creating...' : '🎬 Create Room'}</span>
            </button>
            <button
              className="btn-secondary"
              onClick={() => setMode(null)}
              style={{ fontSize: '0.85rem', padding: '10px' }}
            >
              ← Back
            </button>
          </motion.div>
        )}

        {mode === 'join' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
          >
            <input
              className="room-code-input"
              placeholder="ROOM CODE"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
              maxLength={6}
            />
            <button
              className="btn-gradient"
              onClick={handleJoin}
              disabled={loading || joinCode.length < 6 || !name.trim()}
              style={{ opacity: (joinCode.length === 6 && name.trim()) ? 1 : 0.5 }}
            >
              <span>{loading ? 'Joining...' : '🔗 Join Room'}</span>
            </button>
            <button
              className="btn-secondary"
              onClick={() => setMode(null)}
              style={{ fontSize: '0.85rem', padding: '10px' }}
            >
              ← Back
            </button>
          </motion.div>
        )}

        {/* Footer */}
        <p style={{
          color: 'var(--text-muted)',
          fontSize: '0.7rem',
          marginTop: '32px',
          opacity: 0.6,
        }}>
          No video is uploaded — everything stays on your device
        </p>
      </motion.div>
    </div>
  );
}
