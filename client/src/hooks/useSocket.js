/**
 * useSocket.js — Socket.io connection and room management hook
 * Fixed: uses state instead of ref for socket so components re-render when socket is ready.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { SERVER_URL } from '../utils/constants';

export function useSocket() {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [roomCode, setRoomCode] = useState(null);
  const [role, setRole] = useState(null); // 'host' | 'guest'
  const [roomData, setRoomData] = useState(null);
  const [error, setError] = useState(null);
  const socketRef = useRef(null);

  useEffect(() => {
    const s = io(SERVER_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      extraHeaders: {
        'ngrok-skip-browser-warning': 'true',
      },
    });

    s.on('connect', () => {
      setConnected(true);
      setSocket(s); // Update state so children get the connected socket
    });
    s.on('disconnect', () => setConnected(false));
    s.on('connect_error', () => setConnected(false));

    s.on('user-joined', ({ name, room }) => {
      setRoomData(room);
    });

    s.on('user-left', ({ name }) => {
      setRoomData(prev => prev ? { ...prev, guest: null } : prev);
    });

    s.on('room-destroyed', () => {
      setRoomCode(null);
      setRole(null);
      setRoomData(null);
      setError('Host left. Room closed.');
    });

    socketRef.current = s;
    setSocket(s);

    return () => s.disconnect();
  }, []);

  const createRoom = useCallback((name) => {
    return new Promise((resolve, reject) => {
      socketRef.current?.emit('create-room', name, (res) => {
        if (res.success) {
          setRoomCode(res.roomCode);
          setRole('host');
          setRoomData(res.room);
          setError(null);
          resolve(res);
        } else {
          setError(res.error);
          reject(res.error);
        }
      });
    });
  }, []);

  const joinRoom = useCallback((code, name) => {
    return new Promise((resolve, reject) => {
      socketRef.current?.emit('join-room', code, name, (res) => {
        if (res.success) {
          setRoomCode(res.roomCode);
          setRole('guest');
          setRoomData(res.room);
          setError(null);
          resolve(res);
        } else {
          setError(res.error);
          reject(res.error);
        }
      });
    });
  }, []);

  return {
    socket,
    connected,
    roomCode,
    role,
    roomData,
    error,
    createRoom,
    joinRoom,
    setError,
  };
}
