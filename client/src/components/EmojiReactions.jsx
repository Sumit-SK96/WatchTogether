/**
 * EmojiReactions.jsx — Floating emoji reaction bar + flying emoji animations
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const EMOJIS = ['🔥', '😂', '😱', '❤️', '💀', '👏', '😭', '🤯'];
const MAX_REACTIONS = 8;

export default function EmojiReactions({ socket, roomCode, userName }) {
  const [hovered, setHovered] = useState(false);
  const [flyingReactions, setFlyingReactions] = useState([]);
  const hideTimeoutRef = useRef(null);

  const handleMouseEnter = () => {
    clearTimeout(hideTimeoutRef.current);
    setHovered(true);
  };

  const handleMouseLeave = () => {
    hideTimeoutRef.current = setTimeout(() => setHovered(false), 300);
  };

  const sendReaction = useCallback((emoji) => {
    socket?.emit('reaction', { roomCode, emoji, userName });
  }, [socket, roomCode, userName]);

  // Listen for reactions
  useEffect(() => {
    if (!socket) return;
    const handler = ({ emoji, userName: sender, id }) => {
      setFlyingReactions(prev => {
        const next = [...prev, { id, emoji, sender }];
        if (next.length > MAX_REACTIONS) return next.slice(next.length - MAX_REACTIONS);
        return next;
      });
      setTimeout(() => {
        setFlyingReactions(prev => prev.filter(r => r.id !== id));
      }, 2200);
    };
    socket.on('reaction', handler);
    return () => socket.off('reaction', handler);
  }, [socket]);

  return (
    <>
      <style>{`
        .reaction-trigger-zone {
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 80px;
          z-index: 50;
        }
        .reaction-bar {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          display: flex;
          flex-direction: column;
          gap: 4px;
          background: rgba(13,13,26,0.7);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 999px;
          padding: 8px 4px;
          z-index: 50;
          box-shadow: 0 8px 32px rgba(0,0,0,0.4);
        }
        .reaction-btn {
          width: 36px;
          height: 36px;
          background: transparent;
          border: none;
          font-size: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          border-radius: 50%;
          transition: transform 0.2s var(--spring-ease);
        }
        .reaction-btn:hover {
          transform: scale(1.5);
          filter: drop-shadow(0 0 8px rgba(255,255,255,0.4));
        }
        .reaction-btn:active {
          transform: scale(0.9);
        }
        
        .flying-reaction {
          position: absolute;
          bottom: 40px;
          left: 30px;
          display: flex;
          flex-direction: column;
          align-items: center;
          pointer-events: none;
          z-index: 50;
        }
        .flying-emoji {
          font-size: 32px;
          line-height: 1;
        }
        .flying-sender {
          font-size: 9px;
          color: white;
          opacity: 0.6;
          font-weight: 600;
          margin-top: 4px;
          background: rgba(0,0,0,0.4);
          padding: 2px 6px;
          border-radius: 4px;
        }
      `}</style>

      {/* Hover trigger zone spanning the left edge */}
      <div 
        className="reaction-trigger-zone" 
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      />

      <AnimatePresence>
        {hovered && (
          <motion.div
            className="reaction-bar"
            initial={{ opacity: 0, x: -8, y: '-50%' }}
            animate={{ opacity: 1, x: 0, y: '-50%' }}
            exit={{ opacity: 0, x: -8, y: '-50%' }}
            transition={{ duration: 0.2 }}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            {EMOJIS.map(emoji => (
              <button 
                key={emoji} 
                className="reaction-btn" 
                onClick={(e) => {
                  e.stopPropagation();
                  sendReaction(emoji);
                }}
              >
                {emoji}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Flying Reactions */}
      <AnimatePresence>
        {flyingReactions.map((reaction, i) => {
          // Generate deterministic pseudo-random offset based on ID so it's consistent during render
          const hash = reaction.id.split('-')[1] || Math.random().toString();
          const offsetX = (parseFloat(hash) * 60) - 30; // ±30px
          
          return (
            <motion.div
              key={reaction.id}
              className="flying-reaction"
              initial={{ opacity: 1, y: 0, x: offsetX }}
              animate={{ opacity: [1, 1, 0], y: -180, x: offsetX }}
              transition={{
                duration: 2.2,
                ease: 'easeOut',
                times: [0, 1.4/2.2, 1] // Fade out starts at 1.4s
              }}
            >
              <div className="flying-emoji">{reaction.emoji}</div>
              <div className="flying-sender">{reaction.sender}</div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </>
  );
}
