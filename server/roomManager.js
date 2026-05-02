/**
 * roomManager.js — In-memory room state management
 * Handles room creation, joining, leaving, and playback state tracking.
 * No database needed — rooms exist only while the server is running.
 */

const rooms = new Map();

/**
 * Generate a random 6-character alphanumeric room code
 */
function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed ambiguous chars (0,O,1,I)
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  // Ensure uniqueness
  if (rooms.has(code)) return generateRoomCode();
  return code;
}

/**
 * Create a new room
 * @param {string} hostId - Socket ID of the host
 * @param {string} hostName - Display name of the host
 * @returns {object} Room data
 */
function createRoom(hostId, hostName) {
  const code = generateRoomCode();
  const room = {
    code,
    host: { id: hostId, name: hostName, ready: false },
    guest: null,
    playbackState: {
      playing: false,
      currentTime: 0,
      speed: 1,
      lastUpdate: Date.now(),
    },
    messages: [],
    createdAt: Date.now(),
  };
  rooms.set(code, room);
  return room;
}

/**
 * Join an existing room as a guest
 * @param {string} code - Room code
 * @param {string} guestId - Socket ID of the guest
 * @param {string} guestName - Display name of the guest
 * @returns {object|null} Room data or null if room is full/doesn't exist
 */
function joinRoom(code, guestId, guestName) {
  const room = rooms.get(code);
  if (!room) return { error: 'Room not found' };
  if (room.guest && room.guest.id !== guestId) return { error: 'Room is full' };

  room.guest = { id: guestId, name: guestName, ready: false };
  return room;
}

/**
 * Get a room by code
 */
function getRoom(code) {
  return rooms.get(code) || null;
}

/**
 * Get room by a user's socket ID
 */
function getRoomByUserId(userId) {
  for (const [code, room] of rooms) {
    if (room.host.id === userId || (room.guest && room.guest.id === userId)) {
      return room;
    }
  }
  return null;
}

/**
 * Update playback state for a room
 */
function updatePlaybackState(code, state) {
  const room = rooms.get(code);
  if (!room) return null;
  room.playbackState = {
    ...room.playbackState,
    ...state,
    lastUpdate: Date.now(),
  };
  return room.playbackState;
}

/**
 * Remove a user from their room
 * If host leaves, the room is destroyed. If guest leaves, slot is freed.
 * @returns {{ room: object|null, destroyed: boolean, userRole: string }}
 */
function removeUser(userId) {
  for (const [code, room] of rooms) {
    if (room.host.id === userId) {
      rooms.delete(code);
      return { room, destroyed: true, userRole: 'host' };
    }
    if (room.guest && room.guest.id === userId) {
      const guestName = room.guest.name;
      room.guest = null;
      return { room, destroyed: false, userRole: 'guest', guestName };
    }
  }
  return { room: null, destroyed: false, userRole: null };
}

/**
 * Add a chat message to room history
 */
function addMessage(code, message) {
  const room = rooms.get(code);
  if (!room) return;
  room.messages.push({
    ...message,
    timestamp: Date.now(),
  });
  // Keep only last 100 messages
  if (room.messages.length > 100) {
    room.messages = room.messages.slice(-100);
  }
}

/**
 * Check if a user is the host of a room
 */
function isHost(code, userId) {
  const room = rooms.get(code);
  return room ? room.host.id === userId : false;
}

module.exports = {
  createRoom,
  joinRoom,
  getRoom,
  getRoomByUserId,
  updatePlaybackState,
  removeUser,
  addMessage,
  isHost,
  generateRoomCode,
};
