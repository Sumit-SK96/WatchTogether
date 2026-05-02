/**
 * App.jsx — Root application component
 * Manages top-level state: socket connection, room state, and view routing.
 */
import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import LandingPage from './components/LandingPage';
import WatchRoom from './components/WatchRoom';
import LoadingScreen from './components/LoadingScreen';
import { useSocket } from './hooks/useSocket';

export default function App() {
  const {
    socket, connected,
    roomCode, role, roomData,
    error, createRoom, joinRoom, setError,
  } = useSocket();

  const [userName, setUserName] = useState('');
  const [showLoading, setShowLoading] = useState(true);

  // Show loading screen briefly on mount
  useEffect(() => {
    const timer = setTimeout(() => setShowLoading(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  // Check URL for room code (shareable link)
  useEffect(() => {
    if (!connected) return;
    const params = new URLSearchParams(window.location.search);
    const roomFromUrl = params.get('room');
    if (roomFromUrl) {
      // Will be handled when user enters name and clicks join
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [connected]);

  const handleCreateRoom = async (name) => {
    setUserName(name);
    await createRoom(name);
  };

  const handleJoinRoom = async (code, name) => {
    setUserName(name);
    await joinRoom(code, name);
  };

  // Loading screen
  if (showLoading || !connected) {
    return <LoadingScreen />;
  }

  return (
    <AnimatePresence mode="wait">
      {!roomCode ? (
        <motion.div
          key="landing"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
        >
          <LandingPage
            onCreateRoom={handleCreateRoom}
            onJoinRoom={handleJoinRoom}
            error={error}
          />
        </motion.div>
      ) : (
        <motion.div
          key="room"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
          style={{ width: '100%', height: '100%' }}
        >
          <WatchRoom
            socket={socket}
            roomCode={roomCode}
            role={role}
            roomData={roomData}
            userName={userName}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
