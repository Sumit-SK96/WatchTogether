/**
 * helpers.js — Utility functions
 */

/** Format seconds into HH:MM:SS or MM:SS */
export function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Extract video title from filename */
export function getVideoTitle(filename) {
  if (!filename) return 'Untitled Video';
  return filename.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
}

/** Generate a random ID */
export function randomId() {
  return Math.random().toString(36).substr(2, 9);
}

/** Clamp a value between min and max */
export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
