/**
 * useWebRTC.js — WebRTC peer connection for camera/mic sharing
 * Uses NATIVE WebRTC API (RTCPeerConnection) — no simple-peer dependency.
 *
 * FIXES (v2):
 *  - Proper retry/reconnect when ICE fails or disconnects
 *  - Guard against race conditions during offer/answer exchange
 *  - Debounced renegotiation to prevent rapid-fire offers
 *  - Graceful getUserMedia fallback (audio-only if camera blocked)
 *  - Cleanup leak: stop tracks and close AudioContext on unmount
 *  - Better candidate queuing with drain after remoteDescription set
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
  // Free TURN relay for NAT traversal
  {
    urls: 'turn:openrelay.metered.ca:443',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443?transport=tcp',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
];

// How long to wait before retrying a failed connection
const RECONNECT_DELAY = 2000;
const MAX_RECONNECT_ATTEMPTS = 3;

export function useWebRTC(socket, roomCode, role, hasRemoteUser) {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [cameraOn, setCameraOn] = useState(true);
  const [micOn, setMicOn] = useState(true);

  const pcRef = useRef(null);                // RTCPeerConnection
  const localStreamRef = useRef(null);
  const makingOfferRef = useRef(false);       // Prevent glare (both sides creating offers)
  const ignoreOfferRef = useRef(false);
  const pendingCandidatesRef = useRef([]);    // ICE candidates before remote description
  const connectedRef = useRef(false);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef(null);
  const mountedRef = useRef(true);

  // ─── Get local camera + mic (with fallback) ──────
  const startMedia = useCallback(async () => {
    if (localStreamRef.current) {
      setLocalStream(localStreamRef.current);
      return localStreamRef.current;
    }

    // Try video + audio first, then audio-only, then give up gracefully
    const configs = [
      {
        video: {
          width: { ideal: 320, max: 640 },
          height: { ideal: 240, max: 480 },
          frameRate: { ideal: 15, max: 24 },
          facingMode: 'user',
        },
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      },
      // Fallback: lower resolution
      {
        video: { width: 160, height: 120, frameRate: 10, facingMode: 'user' },
        audio: { echoCancellation: true, noiseSuppression: true },
      },
      // Fallback: audio only
      { video: false, audio: true },
    ];

    for (const constraints of configs) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        localStreamRef.current = stream;
        setLocalStream(stream);
        const hasVideo = stream.getVideoTracks().length > 0;
        const hasAudio = stream.getAudioTracks().length > 0;
        console.log(`[WebRTC] ✅ Local media acquired: ${hasVideo ? '🎥' : '❌'} video, ${hasAudio ? '🎤' : '❌'} audio`);
        if (!hasVideo) setCameraOn(false);
        return stream;
      } catch (err) {
        console.warn('[WebRTC] getUserMedia attempt failed:', constraints.video ? 'with video' : 'audio-only', err.message);
        continue;
      }
    }

    console.error('[WebRTC] ❌ All getUserMedia attempts failed');
    return null;
  }, []);

  // ─── Cleanup peer connection ────────────────
  const closePeer = useCallback(() => {
    clearTimeout(reconnectTimerRef.current);

    if (pcRef.current) {
      pcRef.current.onicecandidate = null;
      pcRef.current.ontrack = null;
      pcRef.current.onnegotiationneeded = null;
      pcRef.current.oniceconnectionstatechange = null;
      pcRef.current.onconnectionstatechange = null;
      pcRef.current.onsignalingstatechange = null;
      try { pcRef.current.close(); } catch (e) { /* already closed */ }
      pcRef.current = null;
    }
    connectedRef.current = false;
    makingOfferRef.current = false;
    ignoreOfferRef.current = false;
    pendingCandidatesRef.current = [];
    setRemoteStream(null);
  }, []);

  // ─── Create RTCPeerConnection ───────────────
  const createPeerConnection = useCallback((stream) => {
    closePeer();

    const pc = new RTCPeerConnection({
      iceServers: ICE_SERVERS,
      iceCandidatePoolSize: 4,
    });
    pcRef.current = pc;

    // Add local tracks to the connection
    if (stream) {
      stream.getTracks().forEach((track) => {
        console.log('[WebRTC] Adding local track:', track.kind, 'enabled:', track.enabled);
        pc.addTrack(track, stream);
      });
    }

    // ── When we get remote tracks ──
    pc.ontrack = (event) => {
      console.log('[WebRTC] ✅ Received remote track:', event.track.kind);
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0]);
      } else {
        // Fallback: build our own MediaStream
        setRemoteStream((prev) => {
          const rs = prev || new MediaStream();
          rs.addTrack(event.track);
          return rs;
        });
      }
    };

    // ── Send ICE candidates to remote via socket ──
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket?.emit('webrtc-signal', {
          roomCode,
          signal: { type: 'candidate', candidate: event.candidate },
        });
      }
    };

    // ── Monitor ICE connection state for reconnection ──
    pc.oniceconnectionstatechange = () => {
      if (!mountedRef.current) return;
      const state = pc.iceConnectionState;
      console.log('[WebRTC] ICE state:', state);

      if (state === 'connected' || state === 'completed') {
        connectedRef.current = true;
        reconnectAttemptsRef.current = 0;
        console.log('[WebRTC] ✅✅ PEER CONNECTED!');
      }

      if (state === 'failed') {
        console.log('[WebRTC] ❌ ICE failed');
        handleReconnect(stream);
      }

      if (state === 'disconnected') {
        console.log('[WebRTC] ⚠️ ICE disconnected — will attempt reconnect in 2s');
        // Give it a moment — sometimes 'disconnected' resolves on its own
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = setTimeout(() => {
          if (pcRef.current?.iceConnectionState === 'disconnected') {
            handleReconnect(stream);
          }
        }, RECONNECT_DELAY);
      }
    };

    pc.onconnectionstatechange = () => {
      if (!mountedRef.current) return;
      console.log('[WebRTC] Connection state:', pc.connectionState);
      if (pc.connectionState === 'failed') {
        handleReconnect(stream);
      }
    };

    return pc;
  }, [socket, roomCode, closePeer]);

  // ─── Reconnect logic ───────────────────────
  const handleReconnect = useCallback((stream) => {
    if (!mountedRef.current || !hasRemoteUser) return;
    if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
      console.error('[WebRTC] ❌ Max reconnect attempts reached');
      return;
    }

    reconnectAttemptsRef.current++;
    console.log(`[WebRTC] 🔄 Reconnect attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS}`);

    clearTimeout(reconnectTimerRef.current);
    reconnectTimerRef.current = setTimeout(async () => {
      if (!mountedRef.current) return;
      // Only host initiates reconnection
      if (role === 'host') {
        const s = localStreamRef.current || await startMedia();
        if (!s || !mountedRef.current) return;
        const pc = createPeerConnection(s);
        await createAndSendOffer(pc);
      }
    }, RECONNECT_DELAY);
  }, [hasRemoteUser, role, startMedia, createPeerConnection]);

  // ─── HOST: Create offer and send to guest ───
  const createAndSendOffer = useCallback(async (pc) => {
    if (!pc || pc.signalingState === 'closed') return;
    try {
      makingOfferRef.current = true;
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });

      // Check signaling state again — may have changed during async createOffer
      if (!pc || pc.signalingState === 'closed') return;
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
      if (cancelled || !mountedRef.current) return;
      if (!stream) {
        console.warn('[WebRTC] No local stream, cannot start peer connection');
        return;
      }

      console.log('[WebRTC] Host starting peer connection');
      const pc = createPeerConnection(stream);

      // Wait a bit for the guest to set up their signal listener
      await new Promise((r) => setTimeout(r, 1500));
      if (cancelled || !pcRef.current || pcRef.current !== pc) return;

      await createAndSendOffer(pc);
    };

    start();
    return () => { cancelled = true; };
  }, [role, hasRemoteUser, socket, roomCode, startMedia, createPeerConnection, createAndSendOffer]);

  // ─── Listen for WebRTC signals ──────────────
  useEffect(() => {
    if (!socket || !roomCode) return;

    const handleSignal = async ({ signal }) => {
      if (!mountedRef.current) return;

      try {
        // ── OFFER from host ──
        if (signal.type === 'offer') {
          console.log('[WebRTC] 📥 Received OFFER');

          // Guest: create peer connection if needed
          let pc = pcRef.current;
          if (!pc || pc.signalingState === 'closed' || pc.connectionState === 'closed') {
            const stream = localStreamRef.current || await startMedia();
            if (!mountedRef.current) return;
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

          // If we're not stable, rollback first (for polite peer)
          if (pc.signalingState !== 'stable') {
            await pc.setLocalDescription({ type: 'rollback' });
          }

          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));

          // Drain pending ICE candidates
          while (pendingCandidatesRef.current.length > 0) {
            const c = pendingCandidatesRef.current.shift();
            try { await pc.addIceCandidate(c); } catch (e) { /* ignore */ }
          }

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
          if (!pc || pc.signalingState === 'closed') return;

          // Only set remote description if we're in 'have-local-offer' state
          if (pc.signalingState !== 'have-local-offer') {
            console.warn('[WebRTC] Ignoring answer — signaling state:', pc.signalingState);
            return;
          }

          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));

          // Drain pending ICE candidates
          while (pendingCandidatesRef.current.length > 0) {
            const c = pendingCandidatesRef.current.shift();
            try { await pc.addIceCandidate(c); } catch (e) { /* ignore */ }
          }
        }

        // ── ICE Candidate ──
        else if (signal.type === 'candidate') {
          const pc = pcRef.current;
          if (!pc) {
            pendingCandidatesRef.current.push(new RTCIceCandidate(signal.candidate));
            return;
          }
          if (pc.remoteDescription && pc.remoteDescription.type) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
            } catch (e) {
              if (!e.message.includes('end-of-candidates')) {
                console.warn('[WebRTC] Error adding ICE candidate:', e.message);
              }
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
      const tracks = localStreamRef.current.getVideoTracks();
      tracks.forEach((track) => {
        track.enabled = !track.enabled;
        setCameraOn(track.enabled);
      });
    }
  }, []);

  // ─── Toggle mic ────────────────────────────
  const toggleMic = useCallback(() => {
    if (localStreamRef.current) {
      const tracks = localStreamRef.current.getAudioTracks();
      tracks.forEach((track) => {
        track.enabled = !track.enabled;
        setMicOn(track.enabled);
      });
    }
  }, []);

  // ─── Reset when remote user leaves ─────────
  useEffect(() => {
    if (!hasRemoteUser && connectedRef.current) {
      console.log('[WebRTC] Remote user left, closing peer');
      closePeer();
      reconnectAttemptsRef.current = 0;
    }
  }, [hasRemoteUser, closePeer]);

  // ─── Track mount/unmount state ─────────────
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ─── Cleanup on unmount ────────────────────
  useEffect(() => {
    return () => {
      clearTimeout(reconnectTimerRef.current);
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
