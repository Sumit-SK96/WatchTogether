/**
 * VideoPlayer.jsx — Custom HTML5 video player
 * Supports local file playback, keyboard shortcuts, and sync integration.
 * 
 * FIXED:
 * - Removed double-fire of play/pause: native video events only update UI state,
 *   sync emission is handled exclusively by user actions (click/keyboard)
 * - Added 'video-loaded' event dispatch for late joiner sync
 * - Better click handling to prevent sync loops
 */
import React, { useRef, useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import VideoControls from './VideoControls';
import { getVideoTitle } from '../utils/helpers';
import { CONTROLS_TIMEOUT } from '../utils/constants';

const VideoPlayer = forwardRef(function VideoPlayer({
  videoFile,
  mood = 'default',
  onPlay,
  onPause,
  onSeek,
  onSpeedChange,
  onBuffering,
}, ref) {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [speed, setSpeed] = useState(1);
  const [videoSrc, setVideoSrc] = useState(null);
  const [cursorHidden, setCursorHidden] = useState(false);
  const cursorTimerRef = useRef(null);
  const animFrameRef = useRef(null);

  // Expose video ref to parent
  useImperativeHandle(ref, () => videoRef.current);

  // Create object URL for local file
  useEffect(() => {
    if (videoFile) {
      const url = URL.createObjectURL(videoFile);
      setVideoSrc(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [videoFile]);

  // requestAnimationFrame for smooth time updates
  useEffect(() => {
    const update = () => {
      if (videoRef.current) {
        setCurrentTime(videoRef.current.currentTime);
      }
      animFrameRef.current = requestAnimationFrame(update);
    };
    animFrameRef.current = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, []);

  // Cursor auto-hide
  const resetCursorTimer = useCallback(() => {
    setCursorHidden(false);
    clearTimeout(cursorTimerRef.current);
    cursorTimerRef.current = setTimeout(() => {
      if (playing) setCursorHidden(true);
    }, CONTROLS_TIMEOUT);
  }, [playing]);

  // Refs for stable keyboard handler references
  const handlersRef = useRef({});

  // This is the ONLY function that should emit play/pause sync events
  // It's called by user clicks and keyboard shortcuts only
  const handlePlayPause = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
      // setPlaying handled by native onPlay
      onPlay?.(video.currentTime);
    } else {
      video.pause();
      // setPlaying handled by native onPause
      onPause?.(video.currentTime);
    }
  }, [onPlay, onPause]);

  const handleSeek = useCallback((time) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = time;
    setCurrentTime(time);
    onSeek?.(time);
  }, [onSeek]);

  const handleVolumeChange = useCallback((v) => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = v;
    setVolume(v);
  }, []);

  const handleSpeedChange = useCallback((s) => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = s;
    setSpeed(s);
    onSpeedChange?.(s);
  }, [onSpeedChange]);

  const handleFullscreen = useCallback(() => {
    const el = containerRef.current;
    const video = videoRef.current;
    if (!el && !video) return;

    if (document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement) {
      if (document.exitFullscreen) document.exitFullscreen();
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
      else if (document.mozCancelFullScreen) document.mozCancelFullScreen();
    } else {
      const target = el || video;
      if (target.requestFullscreen) {
        target.requestFullscreen().catch(err => {
          console.warn('Fullscreen request failed:', err);
          window.dispatchEvent(new CustomEvent('sync-toast', {
            detail: { message: 'Fullscreen not supported by your browser.', type: 'warning' }
          }));
        });
      }
      else if (target.webkitRequestFullscreen) target.webkitRequestFullscreen();
      else if (target.mozRequestFullScreen) target.mozRequestFullScreen();
      else if (video && video.webkitEnterFullscreen) video.webkitEnterFullscreen(); // iOS Safari
      else {
        window.dispatchEvent(new CustomEvent('sync-toast', {
          detail: { message: 'Fullscreen not supported by your browser.', type: 'warning' }
        }));
      }
    }
  }, []);

  // Keep refs updated for stable keyboard handler
  handlersRef.current = { handlePlayPause, handleSeek, handleVolumeChange, handleFullscreen };

  // Keyboard shortcuts — uses refs to always have latest handler versions
  useEffect(() => {
    const handleKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      const video = videoRef.current;
      if (!video) return;
      const h = handlersRef.current;

      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault();
          h.handlePlayPause();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          h.handleSeek(Math.max(0, video.currentTime - 10));
          break;
        case 'ArrowRight':
          e.preventDefault();
          h.handleSeek(Math.min(video.duration, video.currentTime + 10));
          break;
        case 'ArrowUp':
          e.preventDefault();
          h.handleVolumeChange(Math.min(1, video.volume + 0.1));
          break;
        case 'ArrowDown':
          e.preventDefault();
          h.handleVolumeChange(Math.max(0, video.volume - 0.1));
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          h.handleFullscreen();
          break;
        case 'm':
        case 'M':
          e.preventDefault();
          video.muted = !video.muted;
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []); // Empty deps — uses refs, always stable


  // Listen for remote speed changes to update UI
  useEffect(() => {
    const handler = (e) => setSpeed(e.detail.speed);
    window.addEventListener('speed-changed', handler);
    return () => window.removeEventListener('speed-changed', handler);
  }, []);

  // Buffering detection
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const handleWaiting = () => onBuffering?.(true);
    const handleCanPlay = () => onBuffering?.(false);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('canplay', handleCanPlay);
    return () => {
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('canplay', handleCanPlay);
    };
  }, [onBuffering, videoSrc]);

  if (!videoSrc) return null;

  return (
    <div
      ref={containerRef}
      className={`video-container ${cursorHidden ? 'cursor-hidden' : ''}`}
      onMouseMove={resetCursorTimer}
      onClick={(e) => {
        // Only toggle play on video area clicks, not on controls
        if (e.target.tagName === 'VIDEO') {
          e.preventDefault();
          handlePlayPause();
        }
      }}
      onDoubleClick={(e) => {
        if (e.target.tagName === 'VIDEO') handleFullscreen();
      }}
    >
      <video
        ref={videoRef}
        src={videoSrc}
        style={{
          width: '100%',
          height: '100%',
          filter: mood === 'comedy' ? 'brightness(1.05)' :
                  mood === 'romance' ? 'sepia(0.08) saturate(1.1)' :
                  mood === 'action' ? 'contrast(1.05) saturate(1.15)' :
                  mood === 'thriller' ? 'saturate(0.85) contrast(1.1)' : 'none',
          transition: 'filter 0.8s ease',
          outline: 'none',
        }}
        onLoadedMetadata={() => {
          setDuration(videoRef.current?.duration || 0);
          // Dispatch event for late joiner auto-sync
          window.dispatchEvent(new CustomEvent('video-loaded'));
        }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        playsInline
      />

      {mood !== 'default' && (
        <div 
          className={`vignette-${mood}`}
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            zIndex: 5,
            transition: 'opacity 0.8s ease',
            opacity: 1
          }}
        />
      )}

      <VideoControls
        videoRef={videoRef}
        currentTime={currentTime}
        duration={duration}
        playing={playing}
        volume={volume}
        speed={speed}
        videoTitle={getVideoTitle(videoFile?.name)}
        onPlayPause={handlePlayPause}
        onSeek={handleSeek}
        onVolumeChange={handleVolumeChange}
        onSpeedChange={handleSpeedChange}
        onFullscreen={handleFullscreen}
      />
    </div>
  );
});

export default VideoPlayer;
