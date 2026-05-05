/**
 * VideoControls.jsx — Custom video player controls overlay
 * Includes play/pause, volume, speed, fullscreen, PiP, and time display.
 */
import React, { useState, useEffect, useCallback } from 'react';
import SeekBar from './SeekBar';
import { formatTime } from '../utils/helpers';
import { PLAYBACK_SPEEDS, CONTROLS_TIMEOUT } from '../utils/constants';

export default function VideoControls({
  videoRef,
  currentTime,
  duration,
  playing,
  volume,
  speed,
  videoTitle,
  onPlayPause,
  onSeek,
  onVolumeChange,
  onSpeedChange,
  onFullscreen,
}) {
  const [visible, setVisible] = useState(true);
  const [showSpeed, setShowSpeed] = useState(false);
  const [muted, setMuted] = useState(false);
  const hideTimerRef = React.useRef(null);

  // Auto-hide controls
  const showControls = useCallback(() => {
    setVisible(true);
    clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      if (playing) setVisible(false);
    }, CONTROLS_TIMEOUT);
  }, [playing]);

  useEffect(() => {
    showControls();
    return () => clearTimeout(hideTimerRef.current);
  }, [playing, showControls]);

  // Listen for remote speed changes
  useEffect(() => {
    const handler = (e) => {
      // Speed UI update handled by parent
    };
    window.addEventListener('speed-changed', handler);
    return () => window.removeEventListener('speed-changed', handler);
  }, []);

  const handleMuteToggle = () => {
    const video = videoRef.current;
    if (!video) return;
    if (muted) {
      video.muted = false;
      setMuted(false);
      onVolumeChange(video.volume);
    } else {
      video.muted = true;
      setMuted(true);
    }
  };

  const handlePiP = async () => {
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (videoRef.current?.requestPictureInPicture) {
        await videoRef.current.requestPictureInPicture();
      } else {
        throw new Error('Not supported');
      }
    } catch (err) {
      console.warn('PiP not supported:', err);
      window.dispatchEvent(new CustomEvent('sync-toast', {
        detail: { message: 'Picture-in-Picture is not supported in your browser.', type: 'warning' }
      }));
    }
  };

  return (
    <div
      className={`video-controls ${visible ? 'visible' : ''}`}
      onMouseMove={showControls}
      onMouseEnter={showControls}
    >
      <style>{`
        .control-btn {
          position: relative;
        }
        .control-btn::after {
          content: attr(data-tooltip);
          position: absolute;
          bottom: calc(100% + 8px);
          left: 50%;
          transform: translateX(-50%) scale(0.95);
          background: rgba(13,13,26,0.85);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255,255,255,0.06);
          padding: 4px 8px;
          border-radius: 8px;
          font-size: 11px;
          color: white;
          opacity: 0;
          pointer-events: none;
          transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
          white-space: nowrap;
          z-index: 100;
        }
        .control-btn:hover::after {
          opacity: 1;
          transform: translateX(-50%) scale(1);
          transition-delay: 400ms;
        }
        .speed-btn {
          position: relative;
        }
        .speed-btn::after {
          content: attr(data-tooltip);
          position: absolute;
          bottom: calc(100% + 8px);
          left: 50%;
          transform: translateX(-50%) scale(0.95);
          background: rgba(13,13,26,0.85);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255,255,255,0.06);
          padding: 4px 8px;
          border-radius: 8px;
          font-size: 11px;
          color: white;
          opacity: 0;
          pointer-events: none;
          transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
          white-space: nowrap;
          z-index: 100;
        }
        .speed-btn:hover::after {
          opacity: 1;
          transform: translateX(-50%) scale(1);
          transition-delay: 400ms;
        }
      `}</style>

      {/* Video Title */}
      {videoTitle && (
        <div style={{
          position: 'absolute',
          top: '16px',
          left: '20px',
          right: '20px',
          fontSize: '0.9rem',
          fontWeight: 500,
          color: 'rgba(255,255,255,0.8)',
          textShadow: '0 1px 4px rgba(0,0,0,0.6)',
          pointerEvents: 'none',
          opacity: visible ? 1 : 0,
          transition: 'opacity 0.3s ease',
        }}>
          {videoTitle}
        </div>
      )}

      {/* Seek Bar */}
      <SeekBar
        videoRef={videoRef}
        currentTime={currentTime}
        duration={duration}
        onSeek={onSeek}
      />

      {/* Controls Row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: '4px',
      }}>
        {/* Left Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {/* Play/Pause */}
          <button className="control-btn" onClick={onPlayPause} id="play-pause-btn" data-tooltip="Play / Pause (Space)">
            {playing ? '⏸' : '▶️'}
          </button>

          {/* Volume */}
          <button className="control-btn" onClick={handleMuteToggle} data-tooltip="Mute (M)">
            {muted || volume === 0 ? '🔇' : volume < 0.5 ? '🔉' : '🔊'}
          </button>
          <input
            type="range"
            className="volume-slider"
            min="0"
            max="1"
            step="0.01"
            value={muted ? 0 : volume}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              onVolumeChange(v);
              if (v > 0) setMuted(false);
            }}
          />

          {/* Time Display */}
          <span style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '0.8rem',
            color: 'rgba(255,255,255,0.7)',
            marginLeft: '8px',
            userSelect: 'none',
          }}>
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>

        {/* Right Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {/* Speed Selector */}
          <div className="speed-selector">
            <button
              className="speed-btn"
              onClick={() => setShowSpeed(!showSpeed)}
              data-tooltip="Playback Speed"
            >
              {speed}x
            </button>
            {showSpeed && (
              <div className="speed-dropdown">
                {PLAYBACK_SPEEDS.map(s => (
                  <button
                    key={s}
                    className={`speed-option ${speed === s ? 'active' : ''}`}
                    onClick={() => { onSpeedChange(s); setShowSpeed(false); }}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* PiP */}
          <button className="control-btn" onClick={handlePiP} data-tooltip="Picture-in-Picture">
            📐
          </button>

          {/* Fullscreen */}
          <button className="control-btn" onClick={onFullscreen} id="fullscreen-btn" data-tooltip="Fullscreen (F)">
            ⛶
          </button>
        </div>
      </div>
    </div>
  );
}
