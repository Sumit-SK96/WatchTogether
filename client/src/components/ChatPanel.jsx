/**
 * ChatPanel.jsx — Collapsible chat overlay that slides in from the right
 * Does NOT reduce video area — purely overlay.
 */
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function ChatPanel({ socket, roomCode, userName }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);

  // Listen for chat messages
  useEffect(() => {
    if (!socket) return;
    const handler = (msg) => {
      setMessages(prev => [...prev, msg]);
    };
    socket.on('chat-message', handler);
    return () => socket.off('chat-message', handler);
  }, [socket]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = () => {
    const text = input.trim();
    if (!text || !socket) return;
    socket.emit('chat-message', { roomCode, message: text, userName });
    setInput('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={() => setOpen(!open)}
        style={{
          position: 'absolute',
          right: open ? '324px' : '12px',
          top: '50%',
          transform: 'translateY(-50%)',
          zIndex: 26,
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(10px)',
          border: '1px solid var(--glass-border)',
          color: 'var(--text)',
          width: '36px',
          height: '36px',
          borderRadius: '10px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.1rem',
          transition: 'all 0.3s var(--spring-ease)',
        }}
        title={open ? 'Close chat' : 'Open chat'}
      >
        💬
      </button>

      {/* Chat Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            className="chat-panel glass-strong"
            initial={{ x: 320, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 320, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            {/* Header */}
            <div style={{
              padding: '16px',
              borderBottom: '1px solid var(--glass-border)',
              fontWeight: 600,
              fontSize: '0.9rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
              💬 Chat
            </div>

            {/* Messages */}
            <div className="chat-messages">
              {messages.length === 0 && (
                <p style={{
                  color: 'var(--text-muted)',
                  textAlign: 'center',
                  fontSize: '0.8rem',
                  marginTop: '40px',
                }}>
                  No messages yet. Say hi! 👋
                </p>
              )}
              {messages.map((msg, i) => (
                <div key={i} className={`chat-msg ${msg.sender === userName ? 'own' : 'other'}`}>
                  {msg.sender !== userName && (
                    <div className="sender">{msg.sender}</div>
                  )}
                  {msg.text}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="chat-input-container">
              <input
                className="chat-input"
                placeholder="Type a message..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                maxLength={500}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
