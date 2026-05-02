/**
 * constants.js — App-wide constants and configuration
 */
export const SERVER_URL = import.meta.env.VITE_SERVER_URL || (import.meta.env.DEV ? 'http://localhost:3001' : window.location.origin);
export const PLAYBACK_SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4];
export const SUPPORTED_FORMATS = ['.mp4', '.webm', '.mov', '.mkv', '.avi', '.ogg', '.m4v'];
export const REACTION_EMOJIS = ['😂', '❤️', '🔥', '👏', '😱', '🎉', '👀', '💀'];
export const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];
export const CONTROLS_TIMEOUT = 3000;
export const SYNC_TOLERANCE = 0.5;
export const TOAST_TIMEOUT = 3000;
export const BUBBLE_SIZE_DEFAULT = 80;
export const BUBBLE_SIZE_EXPANDED = 240;
export const BUBBLE_SIZE_TABLET = 60;
export const BUBBLE_SIZE_MOBILE = 50;
