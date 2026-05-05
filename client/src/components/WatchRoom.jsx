/**
 * WatchRoom.jsx — Main watch room orchestrator
 * Ties together: video player, sync, WebRTC, chat, emoji reactions, and room UI.
 */
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import VideoPlayer from './VideoPlayer';
import CameraBubbles from './CameraBubbles';
import ChatPanel from './ChatPanel';
import EmojiReactions from './EmojiReactions';
import Toast from './Toast';
import { useSync } from '../hooks/useSync';
import { useWebRTC } from '../hooks/useWebRTC';
import { SUPPORTED_FORMATS } from '../utils/constants';

export default function WatchRoom({ socket, roomCode, role, roomData, userName }) {
  const [videoFile, setVideoFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [mood, setMood] = useState('default');
  const [showMoodMenu, setShowMoodMenu] = useState(false);
  const videoRef = useRef(null);
  const fileInputRef = useRef(null);

  const MOODS = [
    { id: 'default', icon: '✨', label: 'Default' },
    { id: 'horror', icon: '🎃', label: 'Horror' },
    { id: 'comedy', icon: '😂', label: 'Comedy' },
    { id: 'romance', icon: '💕', label: 'Romance' },
    { id: 'action', icon: '⚡', label: 'Action' },
    { id: 'thriller', icon: '🧠', label: 'Thriller' }
  ];

  // Listen for remote mood changes
  useEffect(() => {
    if (!socket) return;
    const handler = ({ mood: newMood, userName: senderName }) => {
      setMood(newMood);
      const moodInfo = MOODS.find(m => m.id === newMood);
      window.dispatchEvent(new CustomEvent('sync-toast', {
        detail: { message: `${senderName} set the mood to ${moodInfo?.label} ${moodInfo?.icon}`, timeout: 2500 }
      }));
    };
    socket.on('mood-change', handler);
    return () => socket.off('mood-change', handler);
  }, [socket]);

  const changeMood = (newMood) => {
    setMood(newMood);
    setShowMoodMenu(false);
    socket?.emit('mood-change', { roomCode, mood: newMood, userName });
  };

  const remoteName = role === 'host'
    ? roomData?.guest?.name
    : roomData?.host?.name;

  const hasRemoteUser = !!remoteName;

  // Sync hook
  const { emitPlay, emitPause, emitSeek, emitSpeed, emitBuffering } = useSync(
    socket, roomCode, videoRef, userName
  );

  // WebRTC hook — pass hasRemoteUser so it knows when to initiate the P2P connection
  const {
    localStream, remoteStream,
    cameraOn, micOn,
    toggleCamera, toggleMic,
    startMedia,
  } = useWebRTC(socket, roomCode, role, hasRemoteUser);

  // Start camera when entering room
  useEffect(() => {
    startMedia();
  }, [startMedia]);

  // Auto-sync for late joiner
  useEffect(() => {
    if (role === 'guest' && roomData?.playbackState) {
      const { currentTime, playing, speed } = roomData.playbackState;
      // Will sync once video is loaded
      const handleLoaded = () => {
        const video = videoRef.current;
        if (!video) return;
        video.currentTime = currentTime;
        video.playbackRate = speed;
        if (playing) video.play().catch(() => {});
      };
      window.addEventListener('video-loaded', handleLoaded, { once: true });
      return () => window.removeEventListener('video-loaded', handleLoaded);
    }
  }, [role, roomData]);

  // File drop handlers
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) validateAndSetFile(file);
  }, []);

  const handleFileSelect = useCallback((e) => {
    const file = e.target.files[0];
    if (file) validateAndSetFile(file);
  }, []);

  const validateAndSetFile = (file) => {
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (SUPPORTED_FORMATS.includes(ext) || file.type.startsWith('video/')) {
      setVideoFile(file);
    } else {
      window.dispatchEvent(new CustomEvent('sync-toast', {
        detail: { message: `Unsupported format: ${ext}`, type: 'warning' }
      }));
    }
  };

  // Copy room code
  const copyRoomCode = () => {
    const link = `${window.location.origin}?room=${roomCode}`;
    navigator.clipboard.writeText(link).then(() => {
      window.dispatchEvent(new CustomEvent('sync-toast', {
        detail: { message: 'Room link copied!' }
      }));
    });
  };

  return (
    <div className={`mood-${mood}`} style={{
      width: '100vw',
      height: '100vh',
      background: 'var(--bg)',
      position: 'relative',
      overflow: 'hidden',
      transition: 'all 0.8s ease'
    }}>
      <Toast />

      {/* Camera Bubbles — always visible in the room */}
      <CameraBubbles
        localStream={localStream}
        remoteStream={remoteStream}
        userName={userName}
        remoteName={remoteName || 'Waiting...'}
        cameraOn={cameraOn}
        micOn={micOn}
        onToggleCamera={toggleCamera}
        onToggleMic={toggleMic}
      />

      {!videoFile ? (
        /* ── File Picker ─────────────────── */
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            padding: '40px',
          }}
        >
          {/* Room Info Bar */}
          <div style={{
            position: 'absolute',
            top: '20px',
            left: '20px',
            right: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            zIndex: 10,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{
                fontFamily: "'Outfit', sans-serif",
                fontSize: '1.2rem',
                fontWeight: 700,
                background: 'linear-gradient(135deg, #7C3AED, #06B6D4)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}>
                WatchTogether
              </span>
              <div style={{
                background: 'var(--surface)',
                border: '1px solid var(--glass-border)',
                borderRadius: '10px',
                padding: '6px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}>
                <span className="room-code-display" style={{ fontSize: '1rem' }}>
                  {roomCode}
                </span>
                <button
                  onClick={copyRoomCode}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    padding: '2px',
                  }}
                  title="Copy room link"
                >
                  📋
                </button>
              </div>
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '0.85rem',
              color: 'var(--text-muted)',
            }}>
              <span style={{
                width: '8px', height: '8px',
                borderRadius: '50%',
                background: '#22C55E',
                display: 'inline-block',
              }} />
              {userName}
              {remoteName && (
                <>
                  <span style={{ margin: '0 4px' }}>•</span>
                  <span style={{
                    width: '8px', height: '8px',
                    borderRadius: '50%',
                    background: '#22C55E',
                    display: 'inline-block',
                  }} />
                  {remoteName}
                </>
              )}
            </div>
          </div>

          {/* Drop Zone */}
          <div
            className={`file-drop-zone ${isDragging ? 'active' : ''}`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            style={{ maxWidth: '500px', width: '100%' }}
          >
            <div style={{ fontSize: '3rem', marginBottom: '16px' }}>
              {isDragging ? '📥' : '🎬'}
            </div>
            <h2 style={{
              fontFamily: "'Outfit', sans-serif",
              fontSize: '1.4rem',
              fontWeight: 600,
              marginBottom: '8px',
            }}>
              {isDragging ? 'Drop your video here' : 'Select a video file'}
            </h2>
            <p style={{
              color: 'var(--text-muted)',
              fontSize: '0.85rem',
              lineHeight: 1.5,
            }}>
              Drag & drop or click to browse<br />
              Supports MP4, WebM, MOV, MKV, AVI
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
          </div>

          {!remoteName && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              style={{
                color: 'var(--text-muted)',
                fontSize: '0.85rem',
                marginTop: '24px',
                textAlign: 'center',
              }}
            >
              Share the room code <strong style={{ color: 'var(--secondary)' }}>{roomCode}</strong> with your friend to start watching
            </motion.p>
          )}
        </motion.div>
      ) : (
        /* ── Video Player + Overlays ───── */
        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
          <VideoPlayer
            ref={videoRef}
            videoFile={videoFile}
            mood={mood}
            onPlay={(t) => emitPlay(t)}
            onPause={(t) => emitPause(t)}
            onSeek={(t) => emitSeek(t)}
            onSpeedChange={(s) => emitSpeed(s)}
            onBuffering={(b) => emitBuffering(b)}
          />


          {/* Chat */}
          <ChatPanel socket={socket} roomCode={roomCode} userName={userName} />

          {/* Emoji Reactions */}
          <EmojiReactions socket={socket} roomCode={roomCode} userName={userName} />

          {/* Room info overlay (top bar) */}
          <div style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            zIndex: 20,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            {/* Mood Selector */}
            <div style={{ position: 'relative' }}>
              <button 
                className="glass"
                onClick={() => setShowMoodMenu(!showMoodMenu)}
                style={{
                  height: '32px',
                  padding: '0 12px',
                  borderRadius: '16px',
                  border: 'none',
                  color: 'white',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  transition: 'background 0.2s ease'
                }}
              >
                {MOODS.find(m => m.id === mood)?.icon} Mood
              </button>
              
              <motion.div 
                initial={false}
                animate={{ opacity: showMoodMenu ? 1 : 0, scale: showMoodMenu ? 1 : 0.95 }}
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '8px',
                  width: '280px',
                  background: 'rgba(13,13,26,0.85)',
                  backdropFilter: 'blur(30px)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: '16px',
                  padding: '12px',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '8px',
                  pointerEvents: showMoodMenu ? 'auto' : 'none',
                  transformOrigin: 'top right'
                }}
              >
                {MOODS.map(m => (
                  <button
                    key={m.id}
                    onClick={() => changeMood(m.id)}
                    style={{
                      height: '60px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: mood === m.id ? 'rgba(255,255,255,0.08)' : 'transparent',
                      border: `1px solid ${mood === m.id ? 'var(--primary)' : 'rgba(255,255,255,0.04)'}`,
                      borderRadius: '12px',
                      color: 'white',
                      cursor: 'pointer',
                      gap: '4px',
                      transition: 'all 0.2s var(--spring-ease)',
                      boxShadow: mood === m.id ? '0 0 12px var(--glass-border)' : 'none'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.transform = 'scale(1.05)';
                      e.currentTarget.style.borderColor = 'var(--primary)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.transform = 'scale(1)';
                      e.currentTarget.style.borderColor = mood === m.id ? 'var(--primary)' : 'rgba(255,255,255,0.04)';
                    }}
                  >
                    <span style={{ fontSize: '1.5rem' }}>{m.icon}</span>
                    <span style={{ fontSize: '0.65rem' }}>{m.label}</span>
                  </button>
                ))}
              </motion.div>
            </div>

            <div className="glass" style={{
              padding: '6px 14px',
              borderRadius: '10px',
              fontSize: '0.8rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}>
              <span style={{
                width: '6px', height: '6px',
                borderRadius: '50%',
                background: '#22C55E',
                display: 'inline-block',
              }} />
              <span className="room-code-display" style={{ fontSize: '0.75rem' }}>
                {roomCode}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
