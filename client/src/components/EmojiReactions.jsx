/**
 * EmojiReactions.jsx — Floating emoji reaction bar + flying emoji animations
 * Hidden by default, slides in on hover from the left edge.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { REACTION_EMOJIS } from '../utils/constants';
import { randomId } from '../utils/helpers';

export default function EmojiReactions({ socket, roomCode, userName }) {
  const [visible, setVisible] = useState(false);
  const [flyingEmojis, setFlyingEmojis] = useState([]);

  // Send emoji reaction
  const sendEmoji = useCallback((emoji) => {
    // Show locally
    spawnEmoji(emoji);
    // Send to remote
    socket?.emit('emoji-reaction', { roomCode, emoji, userName });
  }, [socket, roomCode, userName]);

  // Spawn a flying emoji on screen
  const spawnEmoji = useCallback((emoji) => {
    const id = randomId();
    const left = 20 + Math.random() * 60; // Random horizontal position (20-80%)
    setFlyingEmojis(prev => [...prev, { id, emoji, left }]);
    setTimeout(() => {
      setFlyingEmojis(prev => prev.filter(e => e.id !== id));
    }, 2100);
  }, []);

  // Listen for remote emoji reactions
  useEffect(() => {
    if (!socket) return;
    const handler = ({ emoji }) => spawnEmoji(emoji);
    socket.on('emoji-reaction', handler);
    return () => socket.off('emoji-reaction', handler);
  }, [socket, spawnEmoji]);

  return (
    <>
      {/* Hover trigger zone */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: '30%',
          bottom: '30%',
          width: '40px',
          zIndex: 19,
        }}
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
      />

      {/* Emoji Bar */}
      <div
        className={`emoji-bar glass ${visible ? 'visible' : ''}`}
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
      >
        {REACTION_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            className="emoji-btn"
            onClick={() => sendEmoji(emoji)}
          >
            {emoji}
          </button>
        ))}
      </div>

      {/* Flying Emojis */}
      {flyingEmojis.map(({ id, emoji, left }) => (
        <div
          key={id}
          className="flying-emoji"
          style={{
            left: `${left}%`,
            bottom: '20%',
          }}
        >
          {emoji}
        </div>
      ))}
    </>
  );
}
