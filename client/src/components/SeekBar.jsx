/**
 * SeekBar.jsx — Custom seek bar with gradient fill, buffered indicator, and hover tooltip
 * Uses requestAnimationFrame for smooth updates.
 */
import React, { useState, useRef, useCallback } from 'react';
import { formatTime } from '../utils/helpers';

export default function SeekBar({ videoRef, currentTime, duration, onSeek }) {
  const [hoverTime, setHoverTime] = useState(null);
  const [hoverX, setHoverX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const barRef = useRef(null);

  const progress = duration ? (currentTime / duration) * 100 : 0;

  // Get buffered percentage
  const getBuffered = () => {
    const video = videoRef?.current;
    if (!video || !video.buffered.length) return 0;
    return (video.buffered.end(video.buffered.length - 1) / duration) * 100;
  };

  const handleMouseMove = useCallback((e) => {
    const rect = barRef.current?.getBoundingClientRect();
    if (!rect || !duration) return;
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const time = (x / rect.width) * duration;
    setHoverTime(time);
    setHoverX(x);
  }, [duration]);

  const handleClick = useCallback((e) => {
    const rect = barRef.current?.getBoundingClientRect();
    if (!rect || !duration) return;
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const time = (x / rect.width) * duration;
    onSeek(time);
  }, [duration, onSeek]);

  const handleMouseDown = useCallback((e) => {
    setIsDragging(true);
    handleClick(e);

    const handleDrag = (ev) => {
      const rect = barRef.current?.getBoundingClientRect();
      if (!rect || !duration) return;
      const x = Math.max(0, Math.min(ev.clientX - rect.left, rect.width));
      const time = (x / rect.width) * duration;
      onSeek(time);
      setHoverTime(time);
      setHoverX(x);
    };

    const handleUp = () => {
      setIsDragging(false);
      window.removeEventListener('mousemove', handleDrag);
      window.removeEventListener('mouseup', handleUp);
    };

    window.addEventListener('mousemove', handleDrag);
    window.addEventListener('mouseup', handleUp);
  }, [duration, onSeek, handleClick]);

  return (
    <div
      ref={barRef}
      className="seek-bar-container"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setHoverTime(null)}
      onMouseDown={handleMouseDown}
    >
      <div className="seek-bar-track">
        <div className="seek-bar-buffered" style={{ width: `${getBuffered()}%` }} />
        <div className="seek-bar-fill" style={{ width: `${progress}%` }} />
      </div>
      <div
        className="seek-bar-thumb"
        style={{ left: `${progress}%` }}
      />
      {hoverTime !== null && (
        <div className="seek-bar-tooltip" style={{ left: `${hoverX}px` }}>
          {formatTime(hoverTime)}
        </div>
      )}
    </div>
  );
}
