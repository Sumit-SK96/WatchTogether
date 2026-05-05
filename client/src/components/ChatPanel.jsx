/**
 * ChatPanel.jsx — Collapsible chat overlay that slides in from the right
 */
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import EmojiPicker from './EmojiPicker';
import GifPicker from './GifPicker';
import { playChime, playFunnySound } from '../utils/audio';

const FUNNY_SOUNDS = [
  { type: 'duck', emoji: '🦆', label: 'Duck' },
  { type: 'horn', emoji: '📯', label: 'Air Horn' },
  { type: 'party', emoji: '🎉', label: 'Party' },
  { type: 'whoosh', emoji: '💨', label: 'Whoosh' },
  { type: 'meme', emoji: '😂', label: 'Meme' },
];

export default function ChatPanel({ socket, roomCode, userName }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [pulseBadge, setPulseBadge] = useState(false);
  
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [showSoundTray, setShowSoundTray] = useState(false);

  const messagesEndRef = useRef(null);
  const pulseTimeoutRef = useRef(null);

  // Close panels on outside click or Escape
  useEffect(() => {
    const handleClosePanels = (e) => {
      if (e.key === 'Escape') {
        setShowEmojiPicker(false);
        setShowGifPicker(false);
        setShowSoundTray(false);
      }
    };
    const handleClick = () => {
      setShowEmojiPicker(false);
      setShowGifPicker(false);
      setShowSoundTray(false);
    };
    window.addEventListener('keydown', handleClosePanels);
    window.addEventListener('click', handleClick);
    return () => {
      window.removeEventListener('keydown', handleClosePanels);
      window.removeEventListener('click', handleClick);
    };
  }, []);

  // Listen for chat messages
  useEffect(() => {
    if (!socket) return;
    const handler = (msg) => {
      setMessages(prev => [...prev, msg]);
      
      // If chat is closed and it's not our own message
      if (!open && msg.sender !== userName) {
        setUnreadCount(c => c + 1);
        playChime();
        
        setPulseBadge(true);
        clearTimeout(pulseTimeoutRef.current);
        pulseTimeoutRef.current = setTimeout(() => setPulseBadge(false), 500);
      }
    };
    socket.on('chat-message', handler);
    return () => socket.off('chat-message', handler);
  }, [socket, open, userName]);

  // Listen for funny sounds
  useEffect(() => {
    if (!socket) return;
    const handler = ({ soundType, userName: senderName }) => {
      playFunnySound(soundType);
      
      const soundEmoji = FUNNY_SOUNDS.find(s => s.type === soundType)?.emoji;
      window.dispatchEvent(new CustomEvent('sync-toast', {
        detail: { message: `${senderName} sent a ${soundEmoji}`, timeout: 2000 }
      }));
    };
    socket.on('funny-sound', handler);
    return () => socket.off('funny-sound', handler);
  }, [socket]);

  // Reset unread on open
  useEffect(() => {
    if (open) {
      setUnreadCount(0);
    }
  }, [open]);

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

  const sendGif = (url) => {
    if (!socket) return;
    socket.emit('chat-message', { roomCode, message: url, userName });
    setShowGifPicker(false);
  };

  const sendFunnySound = (type) => {
    playFunnySound(type); // Play locally
    socket.emit('funny-sound', { roomCode, soundType: type, userName });
    setShowSoundTray(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Determine if a message is a Tenor GIF url
  const isGifUrl = (text) => text.includes('tenor.com') && text.endsWith('.gif');

  const displayBadgeCount = unreadCount > 9 ? '9+' : unreadCount;

  return (
    <>
      <style>{`
        .chat-btn-container {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          z-index: 26;
          transition: right 0.3s var(--spring-ease);
        }
        .chat-btn {
          background: var(--glass-bg);
          backdrop-filter: blur(20px);
          border: 1px solid var(--glass-border);
          color: var(--text);
          width: 44px;
          height: 44px;
          border-radius: 12px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.2rem;
          transition: all 0.2s var(--spring-ease);
          box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        }
        .chat-btn:hover {
          transform: scale(1.05);
        }
        .chat-btn:active {
          transform: scale(0.96);
        }
        .unread-badge {
          position: absolute;
          top: -4px;
          right: -4px;
          background: var(--primary);
          color: white;
          font-family: 'JetBrains Mono', monospace;
          font-size: 10px;
          font-weight: bold;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        }
        .badge-pulse {
          animation: badgePulse 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        @keyframes badgePulse {
          0% { box-shadow: 0 0 0 0 rgba(124, 58, 237, 0.7); }
          50% { box-shadow: 0 0 0 12px rgba(124, 58, 237, 0); }
          100% { box-shadow: 0 0 0 0 rgba(124, 58, 237, 0); }
        }
        
        .chat-msg-own {
          align-self: flex-end;
          background: #1E1B4B;
          color: white;
          border-bottom-right-radius: 4px !important;
        }
        .chat-msg-other {
          align-self: flex-start;
          background: #13131A;
          color: var(--text);
          border: 1px solid rgba(255,255,255,0.06);
          border-bottom-left-radius: 4px !important;
        }
        .rich-input-row {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px;
          border-top: 1px solid rgba(255,255,255,0.06);
          position: relative;
        }
        .action-icon-btn {
          background: transparent;
          border: none;
          color: var(--text-muted);
          width: 32px;
          height: 32px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          font-size: 1.1rem;
          transition: all 0.15s ease;
        }
        .action-icon-btn:hover {
          color: var(--text);
          background: rgba(255,255,255,0.05);
        }
        .action-icon-btn:active {
          transform: scale(0.96);
        }
        .send-btn {
          background: var(--primary);
          color: white;
          border: none;
          width: 32px;
          height: 32px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .send-btn:hover {
          background: var(--primary-light);
          transform: scale(1.05);
        }
        .send-btn:active {
          transform: scale(0.96);
        }
        .funny-sound-tray {
          position: absolute;
          bottom: 100%;
          left: 12px;
          margin-bottom: 12px;
          background: rgba(13,13,26,0.85);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255,255,255,0.06);
          padding: 8px;
          border-radius: 9999px;
          display: flex;
          gap: 8px;
          z-index: 50;
        }
        .sound-btn {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.05);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.3rem;
          cursor: pointer;
          transition: all 0.2s var(--spring-ease);
        }
        .sound-btn:hover {
          transform: scale(1.15);
          background: rgba(124, 58, 237, 0.2);
          border-color: var(--primary);
        }
        .sound-btn:active {
          transform: scale(0.9);
        }
      `}</style>

      {/* Toggle Button */}
      <div 
        className="chat-btn-container"
        style={{ right: open ? '336px' : '16px' }}
      >
        <button className="chat-btn" onClick={() => setOpen(!open)}>
          💬
        </button>
        <AnimatePresence>
          {!open && unreadCount > 0 && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className={`unread-badge ${pulseBadge ? 'badge-pulse' : ''}`}
            >
              {displayBadgeCount}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Chat Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            className="glass-panel"
            style={{
              position: 'absolute',
              top: '16px',
              bottom: '16px',
              right: '16px',
              width: '320px',
              zIndex: 25,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
            }}
            initial={{ x: 340, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 340, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            {/* Header */}
            <div style={{
              padding: '16px',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              fontWeight: 600,
              fontSize: '0.95rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
              💬 Chat
            </div>

            {/* Messages */}
            <div className="chat-messages" style={{
              flex: 1,
              overflowY: 'auto',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
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
              {messages.map((msg, i) => {
                const isOwn = msg.sender === userName;
                const isGif = isGifUrl(msg.text);
                const showSender = !isOwn && (i === 0 || messages[i-1].sender !== msg.sender);

                return (
                  <motion.div 
                    key={i} 
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    style={{
                      alignSelf: isOwn ? 'flex-end' : 'flex-start',
                      maxWidth: '75%',
                      display: 'flex',
                      flexDirection: 'column'
                    }}
                  >
                    {showSender && (
                      <span style={{ fontSize: '10px', color: '#64748B', marginBottom: '4px', marginLeft: '4px' }}>
                        {msg.sender}
                      </span>
                    )}
                    <div 
                      className={isOwn ? 'chat-msg-own' : 'chat-msg-other'}
                      style={{
                        padding: isGif ? '4px' : '10px 14px',
                        borderRadius: '14px',
                        fontSize: '0.85rem',
                        lineHeight: 1.4,
                        wordWrap: 'break-word',
                        position: 'relative'
                      }}
                      title={new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    >
                      {isGif ? (
                        <img src={msg.text} alt="gif" style={{ width: '100%', maxWidth: '200px', borderRadius: '12px', display: 'block' }} />
                      ) : (
                        msg.text
                      )}
                    </div>
                  </motion.div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Row */}
            <div className="rich-input-row" onClick={e => e.stopPropagation()}>
              <AnimatePresence>
                {showSoundTray && (
                  <motion.div 
                    className="funny-sound-tray"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    transition={{ duration: 0.2 }}
                  >
                    {FUNNY_SOUNDS.map(sound => (
                      <button 
                        key={sound.type} 
                        className="sound-btn" 
                        title={sound.label}
                        onClick={(e) => {
                          e.stopPropagation();
                          sendFunnySound(sound.type);
                        }}
                      >
                        {sound.emoji}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              {showEmojiPicker && (
                <EmojiPicker 
                  onSelect={(emoji) => setInput(i => i + emoji)} 
                  onClose={() => setShowEmojiPicker(false)} 
                />
              )}
              {showGifPicker && (
                <GifPicker 
                  onSelect={sendGif} 
                  onClose={() => setShowGifPicker(false)} 
                />
              )}

              <button 
                type="button"
                className="action-icon-btn" 
                title="Funny Sounds"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowSoundTray(!showSoundTray);
                  setShowEmojiPicker(false);
                  setShowGifPicker(false);
                }}
              >
                🎵
              </button>
              <button 
                type="button"
                className="action-icon-btn" 
                title="Emoji"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowEmojiPicker(!showEmojiPicker);
                  setShowGifPicker(false);
                  setShowSoundTray(false);
                }}
              >
                😀
              </button>
              
              <input
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text)',
                  fontSize: '0.85rem',
                  outline: 'none'
                }}
                placeholder="Message..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                maxLength={500}
              />
              
              <button 
                type="button"
                className="action-icon-btn" 
                title="GIF"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowGifPicker(!showGifPicker);
                  setShowEmojiPicker(false);
                  setShowSoundTray(false);
                }}
              >
                GIF
              </button>
              <button 
                type="button"
                className="send-btn" 
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  sendMessage();
                }}
              >
                ➤
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
