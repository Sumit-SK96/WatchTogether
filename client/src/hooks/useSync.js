/**
 * useSync.js — Playback synchronization hook
 * Handles bidirectional sync of play/pause/seek/speed between two users.
 *
 * DESIGN:
 * - Only user-initiated actions emit sync events (never native video events)
 * - Remote actions set a suppression window (200ms) instead of a counter
 * - No buffering sync (it caused cascading pauses for the guest)
 * - Heartbeat every 5s corrects drift > 2 seconds
 */
import { useEffect, useRef, useCallback } from 'react';
import { SYNC_TOLERANCE } from '../utils/constants';

export function useSync(socket, roomCode, videoRef, userName) {
  // Suppression window: suppress local emits for 200ms after a remote action
  const suppressUntilRef = useRef(0);

  const shouldSuppress = useCallback(() => {
    return Date.now() < suppressUntilRef.current;
  }, []);

  const suppressFor = useCallback((ms = 300) => {
    suppressUntilRef.current = Date.now() + ms;
  }, []);

  // ─── Emit sync events (local user actions → remote) ────

  const emitPlay = useCallback((currentTime) => {
    if (shouldSuppress()) return;
    socket?.emit('sync-play', { roomCode, currentTime, userName });
  }, [socket, roomCode, userName, shouldSuppress]);

  const emitPause = useCallback((currentTime) => {
    if (shouldSuppress()) return;
    socket?.emit('sync-pause', { roomCode, currentTime, userName });
  }, [socket, roomCode, userName, shouldSuppress]);

  const emitSeek = useCallback((currentTime) => {
    if (shouldSuppress()) return;
    socket?.emit('sync-seek', { roomCode, currentTime, userName });
  }, [socket, roomCode, userName, shouldSuppress]);

  const emitSpeed = useCallback((speed) => {
    if (shouldSuppress()) return;
    socket?.emit('sync-speed', { roomCode, speed, userName });
  }, [socket, roomCode, userName, shouldSuppress]);

  // Buffering: only inform partner, DON'T pause them
  const emitBuffering = useCallback((isBuffering) => {
    socket?.emit('buffering', { roomCode, isBuffering, userName });
  }, [socket, roomCode, userName]);

  // ─── Listen for remote sync events ────────

  useEffect(() => {
    if (!socket || !roomCode) return;

    const handleRemotePlay = ({ currentTime, userName: remoteName }) => {
      const video = videoRef.current;
      if (!video) return;

      // Suppress local emits for the actions we're about to take
      suppressFor(500);

      if (Math.abs(video.currentTime - currentTime) > SYNC_TOLERANCE) {
        video.currentTime = currentTime;
      }
      video.play().catch(() => {});

      window.dispatchEvent(new CustomEvent('sync-toast', {
        detail: { message: `${remoteName} pressed play` }
      }));
    };

    const handleRemotePause = ({ currentTime, userName: remoteName }) => {
      const video = videoRef.current;
      if (!video) return;

      suppressFor(500);

      video.pause();
      if (Math.abs(video.currentTime - currentTime) > SYNC_TOLERANCE) {
        video.currentTime = currentTime;
      }

      window.dispatchEvent(new CustomEvent('sync-toast', {
        detail: { message: `${remoteName} paused` }
      }));
    };

    const handleRemoteSeek = ({ currentTime, userName: remoteName }) => {
      const video = videoRef.current;
      if (!video) return;

      suppressFor(500);
      video.currentTime = currentTime;

      window.dispatchEvent(new CustomEvent('sync-toast', {
        detail: { message: `${remoteName} seeked` }
      }));
    };

    const handleRemoteSpeed = ({ speed, userName: remoteName }) => {
      const video = videoRef.current;
      if (!video) return;

      suppressFor(500);
      video.playbackRate = speed;

      window.dispatchEvent(new CustomEvent('sync-toast', {
        detail: { message: `${remoteName} changed speed to ${speed}x` }
      }));
      window.dispatchEvent(new CustomEvent('speed-changed', { detail: { speed } }));
    };

    // Buffering: just show a toast, don't pause
    const handleRemoteBuffering = ({ isBuffering, userName: remoteName }) => {
      if (isBuffering) {
        window.dispatchEvent(new CustomEvent('sync-toast', {
          detail: { message: `${remoteName} is buffering...` }
        }));
      }
    };

    socket.on('remote-play', handleRemotePlay);
    socket.on('remote-pause', handleRemotePause);
    socket.on('remote-seek', handleRemoteSeek);
    socket.on('remote-speed', handleRemoteSpeed);
    socket.on('remote-buffering', handleRemoteBuffering);

    return () => {
      socket.off('remote-play', handleRemotePlay);
      socket.off('remote-pause', handleRemotePause);
      socket.off('remote-seek', handleRemoteSeek);
      socket.off('remote-speed', handleRemoteSpeed);
      socket.off('remote-buffering', handleRemoteBuffering);
    };
  }, [socket, roomCode, videoRef, suppressFor]);

  // ─── Periodic heartbeat sync ──────────────
  useEffect(() => {
    if (!socket || !roomCode) return;

    const heartbeat = setInterval(() => {
      const video = videoRef.current;
      if (!video || video.paused) return;
      socket.emit('sync-heartbeat', {
        roomCode,
        currentTime: video.currentTime,
        playing: !video.paused,
        userName,
      });
    }, 5000);

    const handleHeartbeat = ({ currentTime }) => {
      const video = videoRef.current;
      if (!video) return;
      const drift = Math.abs(video.currentTime - currentTime);
      if (drift > 2) {
        console.log(`[Sync] Heartbeat correction: drift=${drift.toFixed(1)}s`);
        suppressFor(500);
        video.currentTime = currentTime;
      }
    };

    socket.on('remote-heartbeat', handleHeartbeat);

    return () => {
      clearInterval(heartbeat);
      socket.off('remote-heartbeat', handleHeartbeat);
    };
  }, [socket, roomCode, videoRef, userName, suppressFor]);

  return { emitPlay, emitPause, emitSeek, emitSpeed, emitBuffering };
}
