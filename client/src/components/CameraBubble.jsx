/**
 * CameraBubble.jsx — Draggable camera bubble
 * Shows live video from local or remote stream, with mute/camera controls.
 *
 * FIXES (v2):
 *  - Removed duplicate scaleX(-1) (was in both CSS and inline style)
 *  - Better stream attachment with retry on play failure
 *  - Debounced track checking to avoid excessive state updates
 *  - Proper video element lifecycle management
 */
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { BUBBLE_SIZE_DEFAULT, BUBBLE_SIZE_EXPANDED } from '../utils/constants';

export default function CameraBubble({
  stream,
  name,
  isSelf,
  isSpeaking,
  isMuted,
  cameraOff,
  onToggleMic,
  onToggleCamera,
}) {
  const videoRef = useRef(null);
  const [expanded, setExpanded] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const retryTimerRef = useRef(null);
  const size = expanded ? BUBBLE_SIZE_EXPANDED : BUBBLE_SIZE_DEFAULT;

  // Attach/detach stream to video element
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    // Clear any pending retry
    clearTimeout(retryTimerRef.current);

    if (stream) {
      // Only reassign if srcObject actually changed
      if (el.srcObject !== stream) {
        el.srcObject = stream;
      }

      const attemptPlay = () => {
        if (!el.srcObject) return;
        el.play().catch((err) => {
          // Autoplay blocked — retry after user interaction
          if (err.name === 'NotAllowedError') {
            console.warn('[CameraBubble] Autoplay blocked, will retry on interaction');
            const retryOnClick = () => {
              el.play().catch(() => {});
              document.removeEventListener('click', retryOnClick);
            };
            document.addEventListener('click', retryOnClick, { once: true });
          }
        });
      };

      attemptPlay();

      // Check if video tracks exist and are live
      const checkTracks = () => {
        const vt = stream.getVideoTracks();
        const ready = vt.length > 0 && vt[0].readyState === 'live' && vt[0].enabled;
        setVideoReady(ready);
      };

      // Initial check + slight delay for remote streams that take a moment
      checkTracks();
      retryTimerRef.current = setTimeout(checkTracks, 500);

      const onPlaying = () => setVideoReady(true);
      const onEnded = () => setVideoReady(false);
      const onTrackEnded = () => setVideoReady(false);

      el.addEventListener('playing', onPlaying);
      el.addEventListener('ended', onEnded);
      stream.addEventListener('addtrack', checkTracks);
      stream.addEventListener('removetrack', checkTracks);

      // Listen for track 'ended' event (camera revoked)
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.addEventListener('ended', onTrackEnded);
      }

      return () => {
        clearTimeout(retryTimerRef.current);
        el.removeEventListener('playing', onPlaying);
        el.removeEventListener('ended', onEnded);
        stream.removeEventListener('addtrack', checkTracks);
        stream.removeEventListener('removetrack', checkTracks);
        if (videoTrack) {
          videoTrack.removeEventListener('ended', onTrackEnded);
        }
        setVideoReady(false);
      };
    } else {
      el.srcObject = null;
      setVideoReady(false);
    }
  }, [stream]);

  // Re-check video readiness when camera toggles
  useEffect(() => {
    if (!stream) return;
    const vt = stream.getVideoTracks();
    if (vt.length > 0) {
      setVideoReady(vt[0].readyState === 'live' && vt[0].enabled && !cameraOff);
    }
  }, [cameraOff, stream]);

  const showVideo = stream && !cameraOff && videoReady;

  return (
    <motion.div
      className={`camera-bubble ${isSpeaking ? 'speaking' : ''}`}
      drag
      dragMomentum={false}
      dragElastic={0.1}
      animate={{ width: size, height: size }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      onClick={(e) => {
        e.stopPropagation();
        setExpanded(!expanded);
      }}
      style={{
        background: !showVideo ? 'var(--surface)' : 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        width: size,
        height: size,
      }}
      whileHover={{ scale: 1.05 }}
    >
      {/* Always render video so srcObject can be set early */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isSelf}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: isSelf ? 'scaleX(-1)' : 'none',
          borderRadius: '50%',
          display: showVideo ? 'block' : 'none',
        }}
      />

      {/* Avatar fallback */}
      {!showVideo && (
        <div style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: expanded ? '3rem' : '1.5rem',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
          color: 'white',
          fontWeight: 700,
          fontFamily: "'Outfit', sans-serif",
        }}>
          {name?.[0]?.toUpperCase() || '?'}
        </div>
      )}

      {/* Name Label */}
      <span className="bubble-name">{isSelf ? 'You' : name}</span>

      {/* Controls (only for self) */}
      {isSelf && (
        <div className="bubble-controls" onClick={(e) => e.stopPropagation()}>
          <button
            className={`bubble-btn ${isMuted ? 'muted' : ''}`}
            onClick={(e) => { e.stopPropagation(); onToggleMic?.(); }}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? '🔇' : '🎤'}
          </button>
          <button
            className={`bubble-btn ${cameraOff ? 'muted' : ''}`}
            onClick={(e) => { e.stopPropagation(); onToggleCamera?.(); }}
            title={cameraOff ? 'Camera On' : 'Camera Off'}
          >
            {cameraOff ? '📷' : '📹'}
          </button>
        </div>
      )}
    </motion.div>
  );
}
