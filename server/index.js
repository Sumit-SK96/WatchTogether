/**
 * WatchTogether Server
 * Express + Socket.io server handling:
 * - Room management (create/join/leave)
 * - Playback sync (play/pause/seek/speed + heartbeat)
 * - WebRTC signaling (offer/answer/ICE candidates)
 * - Chat & emoji reactions
 * 
 * FIXED:
 * - Added sync-heartbeat for periodic drift correction
 * - Better WebRTC signal forwarding with logging
 * - Improved disconnect handling
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const roomManager = require('./roomManager');

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3001;

// Socket.io with CORS
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || '*',
    methods: ['GET', 'POST'],
  },
  transports: ['websocket', 'polling'],
  maxHttpBufferSize: 1e6,
  pingTimeout: 30000,
  pingInterval: 10000,
});

app.use(cors());
app.use(express.json());

// Serve the built frontend (production mode)
const path = require('path');
const clientDist = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});


// ═══════════════════════════════════════════════
// Socket.io Connection Handler
// ═══════════════════════════════════════════════

io.on('connection', (socket) => {
  console.log(`🔌 Connected: ${socket.id}`);

  // ─── Room Events ───────────────────────────

  /**
   * Create a new room
   * @param {string} name - Display name of the host
   */
  socket.on('create-room', (name, callback) => {
    const room = roomManager.createRoom(socket.id, name);
    socket.join(room.code);
    console.log(`🏠 Room ${room.code} created by ${name} (${socket.id})`);
    callback({
      success: true,
      roomCode: room.code,
      role: 'host',
      room: sanitizeRoom(room),
    });
  });

  /**
   * Join an existing room
   * @param {string} code - Room code
   * @param {string} name - Display name of the guest
   */
  socket.on('join-room', (code, name, callback) => {
    const upperCode = code.toUpperCase();
    const result = roomManager.joinRoom(upperCode, socket.id, name);

    if (result.error) {
      callback({ success: false, error: result.error });
      return;
    }

    socket.join(upperCode);
    console.log(`👋 ${name} joined room ${upperCode}`);

    // Notify host that guest joined
    socket.to(upperCode).emit('user-joined', {
      name,
      id: socket.id,
      room: sanitizeRoom(result),
    });

    // Send current playback state to late joiner for auto-sync
    const room = roomManager.getRoom(upperCode);
    callback({
      success: true,
      roomCode: upperCode,
      role: 'guest',
      room: sanitizeRoom(room),
      syncState: room.playbackState,
    });
  });

  // ─── Playback Sync Events ─────────────────

  /**
   * Sync play event
   */
  socket.on('sync-play', ({ roomCode, currentTime, userName }) => {
    roomManager.updatePlaybackState(roomCode, {
      playing: true,
      currentTime,
    });
    socket.to(roomCode).emit('remote-play', {
      currentTime,
      userName,
      timestamp: Date.now(),
    });
  });

  /**
   * Sync pause event
   */
  socket.on('sync-pause', ({ roomCode, currentTime, userName }) => {
    roomManager.updatePlaybackState(roomCode, {
      playing: false,
      currentTime,
    });
    socket.to(roomCode).emit('remote-pause', {
      currentTime,
      userName,
      timestamp: Date.now(),
    });
  });

  /**
   * Sync seek event
   */
  socket.on('sync-seek', ({ roomCode, currentTime, userName }) => {
    roomManager.updatePlaybackState(roomCode, { currentTime });
    socket.to(roomCode).emit('remote-seek', {
      currentTime,
      userName,
      timestamp: Date.now(),
    });
  });

  /**
   * Sync playback speed change
   */
  socket.on('sync-speed', ({ roomCode, speed, userName }) => {
    roomManager.updatePlaybackState(roomCode, { speed });
    socket.to(roomCode).emit('remote-speed', {
      speed,
      userName,
      timestamp: Date.now(),
    });
  });

  /**
   * Sync heartbeat — periodic drift correction
   */
  socket.on('sync-heartbeat', ({ roomCode, currentTime, playing, userName }) => {
    roomManager.updatePlaybackState(roomCode, { currentTime, playing });
    socket.to(roomCode).emit('remote-heartbeat', {
      currentTime,
      playing,
      userName,
      timestamp: Date.now(),
    });
  });

  /**
   * Buffering state sync — pause partner when one user is buffering
   */
  socket.on('buffering', ({ roomCode, isBuffering, userName }) => {
    socket.to(roomCode).emit('remote-buffering', {
      isBuffering,
      userName,
      timestamp: Date.now(),
    });
  });

  /**
   * Request current sync state (for reconnection)
   */
  socket.on('request-sync', ({ roomCode }, callback) => {
    const room = roomManager.getRoom(roomCode);
    if (room) {
      callback({ success: true, syncState: room.playbackState });
    } else {
      callback({ success: false, error: 'Room not found' });
    }
  });

  // ─── WebRTC Signaling ─────────────────────

  /**
   * Forward WebRTC signal to peer in the room
   */
  socket.on('webrtc-signal', ({ roomCode, signal }) => {
    console.log(`📡 WebRTC signal from ${socket.id} in ${roomCode}: ${signal.type || 'candidate'}`);
    socket.to(roomCode).emit('webrtc-signal', {
      signal,
      from: socket.id,
    });
  });

  // ─── Chat & Reactions ─────────────────────

  /**
   * Chat message
   */
  socket.on('chat-message', ({ roomCode, message, userName }) => {
    const msg = { text: message, sender: userName, senderId: socket.id };
    roomManager.addMessage(roomCode, msg);
    // Broadcast to everyone in room (including sender for confirmation)
    io.to(roomCode).emit('chat-message', {
      ...msg,
      timestamp: Date.now(),
    });
  });

  /**
   * Emoji reaction
   */
  socket.on('reaction', ({ roomCode, emoji, userName }) => {
    // Send to everyone in the room including sender
    io.to(roomCode).emit('reaction', {
      emoji,
      userName,
      id: `${Date.now()}-${Math.random()}`,
    });
  });

  /**
   * Funny Sound
   */
  socket.on('funny-sound', ({ roomCode, soundType, userName }) => {
    // Broadcast to others in the room
    socket.to(roomCode).emit('funny-sound', {
      soundType,
      userName,
      timestamp: Date.now(),
    });
  });

  /**
   * Mood Change
   */
  socket.on('mood-change', ({ roomCode, mood, userName }) => {
    // Broadcast to everyone in the room
    io.to(roomCode).emit('mood-change', {
      mood,
      userName,
      timestamp: Date.now(),
    });
  });

  // ─── Disconnect ────────────────────────────

  socket.on('disconnect', () => {
    console.log(`❌ Disconnected: ${socket.id}`);
    const { room, destroyed, userRole, guestName } = roomManager.removeUser(socket.id);

    if (room && !destroyed) {
      // Guest left — notify host
      io.to(room.code).emit('user-left', {
        name: guestName || 'User',
        role: userRole,
      });
    } else if (room && destroyed) {
      // Host left — notify guest and destroy room
      io.to(room.code).emit('room-destroyed', {
        message: 'Host has left. Room closed.',
      });
    }
  });
});

/**
 * Sanitize room data for client consumption (remove socket IDs for security)
 */
function sanitizeRoom(room) {
  return {
    code: room.code,
    host: { name: room.host.name, ready: room.host.ready },
    guest: room.guest ? { name: room.guest.name, ready: room.guest.ready } : null,
    playbackState: room.playbackState,
  };
}

// SPA fallback — serve index.html for all non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

// ═══════════════════════════════════════════════
// Start Server
// ═══════════════════════════════════════════════


server.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════╗
  ║   🎬 WatchTogether Server Running   ║
  ║   Port: ${PORT}                        ║
  ║   http://localhost:${PORT}              ║
  ║   Ready for connections...           ║
  ╚══════════════════════════════════════╝
  `);
});
