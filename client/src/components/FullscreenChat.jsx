import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function FullscreenChat({ socket, roomCode, userName, chatMessages = [], controlsVisible }) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isFaded, setIsFaded] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(false);
  
  const fadeTimeoutRef = useRef(null);

  // Auto-fade logic
  useEffect(() => {
    if (!isOpen) return;
    
    // Reset fade state
    setIsFaded(false);
    clearTimeout(fadeTimeoutRef.current);
    
    // Set new timeout for 12 seconds
    fadeTimeoutRef.current = setTimeout(() => {
      setIsFaded(true);
    }, 12000);

    return () => clearTimeout(fadeTimeoutRef.current);
  }, [chatMessages, isOpen]); // re-run when new message arrives or when opened

  // Initial load flag
  useEffect(() => {
    if (isOpen) {
      setIsInitialLoad(true);
      const t = setTimeout(() => setIsInitialLoad(false), 600); // Wait for stagger animations
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  const sendMessage = () => {
    const text = input.trim();
    if (!text || !socket) return;
    socket.emit('chat-message', { roomCode, message: text, userName });
    setInput('');
  };

  const handleKeyDown = (e) => {
    // Prevent Space from pausing video
    if (e.key === ' ') {
      e.stopPropagation();
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Get up to 10 most recent messages
  const visibleMessages = useMemo(() => {
    return chatMessages.slice(-10);
  }, [chatMessages]);

  return (
    <>
      <style>{`
        .fs-chat-toggle {
          position: fixed;
          bottom: 72px;
          right: 24px;
          width: 36px;
          height: 36px;
          border-radius: 10px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.08);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          z-index: 10001; /* Above video and camera bubbles if needed, but spec says below bubbles (9999). Toggle can be higher or same. Let's stick to 9999 */
          transition: all 150ms ease;
          opacity: var(--opacity-val, 1);
          pointer-events: auto;
        }
        .fs-chat-toggle:hover {
          background: rgba(255,255,255,0.10);
        }
        .fs-chat-toggle svg {
          width: 16px;
          height: 16px;
          fill: rgba(255,255,255,0.5);
          transition: fill 150ms ease;
        }
        .fs-chat-toggle:hover svg {
          fill: rgba(255,255,255,0.85);
        }
        .fs-chat-dot {
          position: absolute;
          top: -2px;
          right: -2px;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #7C3AED;
        }

        .fs-chat-overlay {
          position: fixed;
          right: 0px;
          bottom: 80px;
          width: 280px;
          z-index: 9999;
          pointer-events: none;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          padding: 0 0 0 12px;
        }
        
        @media (max-width: 768px) {
          .fs-chat-overlay {
            width: 220px;
          }
          .fs-msg-name { font-size: 9px !important; }
          .fs-msg-text { font-size: 11px !important; }
          .fs-input { height: 36px !important; }
        }

        .fs-msg-list {
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          gap: 5px;
          margin-bottom: 8px;
          max-height: 60vh;
          overflow: hidden;
          padding-right: 12px; /* Scrollbar space if it was there, but no scrollbar allowed */
        }

        .fs-msg-bubble {
          background: rgba(10,10,15,0.28);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          border-radius: 8px;
          padding: 5px 10px;
          border: 1px solid rgba(255,255,255,0.05);
          max-width: 100%;
          width: fit-content;
          transition: all 1.5s ease;
        }

        .fs-msg-bubble.faded {
          background: rgba(10,10,15,0.12);
        }
        .fs-msg-bubble.faded .fs-msg-text {
          color: rgba(255,255,255,0.3);
        }
        .fs-msg-bubble.faded .fs-msg-name {
          color: rgba(167,139,250,0.4); /* Faded violet */
        }

        .fs-msg-name {
          font-size: 11px;
          font-weight: 600;
          color: rgba(167,139,250,0.9);
          letter-spacing: 0.3px;
          margin-right: 6px;
          white-space: nowrap;
          transition: color 1.5s ease;
        }

        .fs-msg-text {
          font-size: 13px;
          font-weight: 400;
          color: rgba(255,255,255,0.82);
          line-height: 1.5;
          word-wrap: break-word;
          transition: color 1.5s ease;
        }

        .fs-input-container {
          pointer-events: auto;
          width: 100%;
          padding-right: 12px;
          position: relative;
          transition: opacity 0.3s ease;
        }

        .fs-input {
          height: 38px;
          width: 100%;
          background: rgba(10,10,15,0.45);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 10px;
          padding: 0 40px 0 12px;
          font-size: 12px;
          color: rgba(255,255,255,0.85);
          caret-color: #7C3AED;
          outline: none;
          transition: all 150ms ease;
        }
        .fs-input::placeholder {
          color: rgba(255,255,255,0.25);
        }
        .fs-input:focus {
          border-color: rgba(124,58,237,0.4);
          background: rgba(10,10,15,0.55);
        }

        .fs-send-btn {
          position: absolute;
          right: 20px; /* 12px padding + 8px right */
          top: 50%;
          transform: translateY(-50%);
          width: 22px;
          height: 22px;
          border-radius: 6px;
          background: transparent;
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 150ms ease;
        }
        .fs-send-btn svg {
          width: 12px;
          height: 12px;
          fill: rgba(255,255,255,0.3);
          transition: fill 150ms ease;
        }
        .fs-send-btn.active svg {
          fill: rgba(124,58,237,0.9);
        }
        .fs-send-btn.active:hover {
          background: rgba(124,58,237,0.15);
        }
      `}</style>

      {/* Toggle Button */}
      <div 
        className="fs-chat-toggle"
        style={{ '--opacity-val': controlsVisible ? 1 : 0 }}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
      >
        {isOpen && <div className="fs-chat-dot" />}
        <svg viewBox="0 0 24 24">
          <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
        </svg>
      </div>

      {/* Chat Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            className="fs-chat-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="fs-msg-list">
              <AnimatePresence mode="popLayout">
                {visibleMessages.map((msg, index) => {
                  // Determine if this is part of the initial history load
                  const isHistoryItem = isInitialLoad;
                  const staggerDelay = isHistoryItem ? index * 0.04 : 0;
                  const initialOpacity = isHistoryItem ? 0.45 : 0;

                  return (
                    <motion.div
                      key={msg.id || `${msg.timestamp}-${msg.sender}-${index}`}
                      layout
                      initial={{ opacity: initialOpacity, x: 16 }}
                      animate={{ 
                        opacity: isFaded ? 1 : (isHistoryItem && isInitialLoad ? 0.45 : 1), 
                        x: 0 
                      }}
                      exit={{ opacity: 0, y: -12 }}
                      transition={{ 
                        x: { type: 'spring', damping: 25, stiffness: 300, delay: staggerDelay },
                        opacity: { duration: 0.22, ease: [0.22, 1, 0.36, 1], delay: staggerDelay },
                        y: { duration: 0.3 },
                        layout: { duration: 0.3 }
                      }}
                      className={`fs-msg-bubble ${isFaded ? 'faded' : ''}`}
                    >
                      <span className="fs-msg-name">{msg.sender}</span>
                      <span className="fs-msg-text">
                        {/* Render simple text. If gif, just show [GIF] or ignore to keep it minimal as requested, 
                            but the prompt says "Ghost Feed", we'll just render text or [Media] */}
                        {msg.text && msg.text.includes('tenor.com') ? '[GIF]' : msg.text}
                      </span>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>

            <div 
              className="fs-input-container"
              style={{ opacity: controlsVisible ? 1 : 0.4 }}
              onMouseEnter={(e) => {
                // Return to full opacity on mouse move/enter
                e.currentTarget.style.opacity = '1';
              }}
              onMouseLeave={(e) => {
                if (!controlsVisible) e.currentTarget.style.opacity = '0.4';
              }}
            >
              <input
                className="fs-input"
                placeholder="Say something..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                onClick={(e) => e.stopPropagation()} // Stop click from passing to video
              />
              <button 
                className={`fs-send-btn ${input.trim() ? 'active' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  sendMessage();
                }}
              >
                <svg viewBox="0 0 24 24">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                </svg>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
