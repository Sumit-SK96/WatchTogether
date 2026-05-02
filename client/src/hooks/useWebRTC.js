/**
 * useWebRTC.js — WebRTC peer connection for camera/mic sharing
 * Uses NATIVE WebRTC API (RTCPeerConnection) — no simple-peer dependency.
 * This eliminates all Vite/Node.js polyfill issues.
 *
 * Flow:
 *   HOST creates offer → sends via socket → GUEST answers
 *   Both exchange ICE candidates via socket
 */
import { useEffect, useRef, useState, useCallback } from 'react';

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  // Free TURN servers for NAT traversal
  {
    urls: 'turn:relay1.expressturn.com:443',
    username: 'efGMGBCZXIUCYBIALJ',
    credential: 'jNpOkFoq5jS8NKPP',
  },
];

export function useWebRTC(socket, roomCode, role, hasRemoteUser) {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [cameraOn, setCameraOn] = useState(true);
  const [micOn, setMicOn] = useState(true);

  const pcRef = useRef(null);                // RTCPeerConnection
  const localStreamRef = useRef(null);
  const makingOfferRef = useRef(false);       // Prevent glare (both sides creating offers)
  const ignoreOfferRef = useRef(false);
  const isNegotiatingRef = useRef(false);
  const pendingCandidatesRef = useRef([]);    // ICE candidates before remote description
  const connectedRef = useRef(false);

  // ─── Get local camera + mic ─────────────────
  const startMedia = useCallback(async () => {
    if (localStreamRef.current) {
      setLocalStream(localStreamRef.current);
      return localStreamRef.current;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 320 }, height: { ideal: 320 }, facingMode: 'user' },
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      localStreamRef.current = stream;
      setLocalStream(stream);
      console.log('[WebRTC] ✅ Local media acquired:',
        stream.getVideoTracks().length, 'video,',
        stream.getAudioTracks().length, 'audio');
      return stream;
    } catch (err) {
      console.error('[WebRTC] ❌ getUserMedia failed:', err.message);
      return null;
    }
  }, []);

  // ─── Cleanup peer connection ────────────────
  const closePeer = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.onicecandidate = null;
      pcRef.current.ontrack = null;
      pcRef.current.onnegotiationneeded = null;
      pcRef.current.oniceconnectionstatechange = null;
      pcRef.current.close();
      pcRef.current = null;
    }
    connectedRef.current = false;
    makingOfferRef.current = false;
    ignoreOfferRef.current = false;
    isNegotiatingRef.current = false;
    pendingCandidatesRef.current = [];
    setRemoteStream(null);
  }, []);

  // ─── Create RTCPeerConnection ───────────────
  const createPeerConnection = useCallback((stream) => {
    closePeer();

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;

    // Add local tracks to the connection
    if (stream) {
      stream.getTracks().forEach((track) => {
        console.log('[WebRTC] Adding local track:', track.kind);
        pc.addTrack(track, stream);
      });
    }

    // ── When we get remote tracks ──
    pc.ontrack = (event) => {
      console.log('[WebRTC] ✅ Received remote track:', event.track.kind);
      // event.streams[0] contains all tracks from the remote peer
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0]);
      } else {
        // Fallback: create our own stream
        const rs = new MediaStream();
        rs.addTrack(event.track);
        setRemoteStream(rs);
      }
    };

    // ── Send ICE candidates to remote via socket ──
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('[WebRTC] Sending ICE candidate');
        socket?.emit('webrtc-signal', {
          roomCode,
          signal: { type: 'candidate', candidate: event.candidate },
        });
      }
    };

    // ── Monitor connection state ──
    pc.oniceconnectionstatechange = () => {
      console.log('[WebRTC] ICE state:', pc.iceConnectionState);
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        connectedRef.current = true;
        console.log('[WebRTC] ✅✅ PEER CONNECTED!');
      }
      if (pc.iceConnectionState === 'failed') {
        console.log('[WebRTC] ❌ ICE failed, restarting...');
        pc.restartIce();
      }
      if (pc.iceConnectionState === 'disconnected') {
        console.log('[WebRTC] ⚠️ ICE disconnected');
      }
    };

    pc.onconnectionstatechange = () => {
      console.log('[WebRTC] Connection state:', pc.connectionState);
    };

    return pc;
  }, [socket, roomCode, closePeer]);

  // ─── HOST: Create offer and send to guest ───
  const createAndSendOffer = useCallback(async (pc) => {
    try {
      makingOfferRef.current = true;
      const offer = await pc.createOffer();
      if (pc.signalingState !== 'stable') {
        console.log('[WebRTC] Signaling not stable, aborting offer');
        return;
      }
      await pc.setLocalDescription(offer);
      console.log('[WebRTC] 📤 Sending OFFER');
      socket?.emit('webrtc-signal', {
        roomCode,
        signal: { type: 'offer', sdp: pc.localDescription },
      });
    } catch (err) {
      console.error('[WebRTC] Error creating offer:', err);
    } finally {
      makingOfferRef.current = false;
    }
  }, [socket, roomCode]);

  // ─── HOST: Start connection when guest joins ──
  useEffect(() => {
    if (role !== 'host' || !hasRemoteUser || !socket || !roomCode) return;
    if (connectedRef.current) return;

    let cancelled = false;

    const start = async () => {
      const stream = localStreamRef.current || await startMedia();
      if (cancelled) return;

      console.log('[WebRTC] Host starting peer connection');
      const pc = createPeerConnection(stream);
      // Small delay to let guest set up their signal listener
      await new Promise((r) => setTimeout(r, 1000));
      if (cancelled || !pcRef.current) return;
      await createAndSendOffer(pc);
    };

    start();
    return () => { cancelled = true; };
  }, [role, hasRemoteUser, socket, roomCode, startMedia, createPeerConnection, createAndSendOffer]);

  // ─── Listen for WebRTC signals ──────────────
  useEffect(() => {
    if (!socket || !roomCode) return;

    const handleSignal = async ({ signal }) => {
      try {
        // ── OFFER from host ──
        if (signal.type === 'offer') {
          console.log('[WebRTC] 📥 Received OFFER');

          // Guest: create peer connection if needed
          let pc = pcRef.current;
          if (!pc || pc.connectionState === 'closed') {
            const stream = localStreamRef.current || await startMedia();
            pc = createPeerConnection(stream);
          }

          // "Perfect negotiation" pattern: handle offer collision
          const offerCollision = makingOfferRef.current || pc.signalingState !== 'stable';
          const isPolite = role === 'guest'; // Guest is always polite
          ignoreOfferRef.current = !isPolite && offerCollision;

          if (ignoreOfferRef.current) {
            console.log('[WebRTC] Ignoring colliding offer');
            return;
          }

          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));

          // Drain pending ICE candidates
          for (const c of pendingCandidatesRef.current) {
            try { await pc.addIceCandidate(c); } catch (e) { /* ignore */ }
          }
          pendingCandidatesRef.current = [];

          // Create and send answer
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          console.log('[WebRTC] 📤 Sending ANSWER');
          socket.emit('webrtc-signal', {
            roomCode,
            signal: { type: 'answer', sdp: pc.localDescription },
          });
        }

        // ── ANSWER from guest ──
        else if (signal.type === 'answer') {
          console.log('[WebRTC] 📥 Received ANSWER');
          const pc = pcRef.current;
          if (!pc) return;
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));

          // Drain pending ICE candidates
          for (const c of pendingCandidatesRef.current) {
            try { await pc.addIceCandidate(c); } catch (e) { /* ignore */ }
          }
          pendingCandidatesRef.current = [];
        }

        // ── ICE Candidate ──
        else if (signal.type === 'candidate') {
          console.log('[WebRTC] 📥 Received ICE candidate');
          const pc = pcRef.current;
          if (!pc) {
            pendingCandidatesRef.current.push(new RTCIceCandidate(signal.candidate));
            return;
          }
          if (pc.remoteDescription && pc.remoteDescription.type) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
            } catch (e) {
              console.warn('[WebRTC] Error adding ICE candidate:', e.message);
            }
          } else {
            // Queue until remote description is set
            pendingCandidatesRef.current.push(new RTCIceCandidate(signal.candidate));
          }
        }
      } catch (err) {
        console.error('[WebRTC] Signal handling error:', err);
      }
    };

    socket.on('webrtc-signal', handleSignal);
    return () => socket.off('webrtc-signal', handleSignal);
  }, [socket, roomCode, role, startMedia, createPeerConnection]);

  // ─── Toggle camera ─────────────────────────
  const toggleCamera = useCallback(() => {
    if (localStreamRef.current) {
      const track = localStreamRef.current.getVideoTracks()[0];
      if (track) {
        track.enabled = !track.enabled;
        setCameraOn(track.enabled);
      }
    }
  }, []);

  // ─── Toggle mic ────────────────────────────
  const toggleMic = useCallback(() => {
    if (localStreamRef.current) {
      const track = localStreamRef.current.getAudioTracks()[0];
      if (track) {
        track.enabled = !track.enabled;
        setMicOn(track.enabled);
      }
    }
  }, []);

  // ─── Reset when remote user leaves ─────────
  useEffect(() => {
    if (!hasRemoteUser && connectedRef.current) {
      console.log('[WebRTC] Remote user left, closing peer');
      closePeer();
    }
  }, [hasRemoteUser, closePeer]);

  // ─── Cleanup on unmount ────────────────────
  useEffect(() => {
    return () => {
      closePeer();
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
      }
    };
  }, [closePeer]);

  return {
    localStream,
    remoteStream,
    cameraOn,
    micOn,
    toggleCamera,
    toggleMic,
    startMedia,
  };
}
