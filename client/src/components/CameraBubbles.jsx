/**
 * CameraBubbles.jsx — Container for both camera bubbles (self + remote)
 * Always shows local bubble. Shows remote bubble when remote stream is available
 * or when a remote user is connected (with a placeholder).
 */
import React from 'react';
import CameraBubble from './CameraBubble';
import { useAudioDetection } from '../hooks/useAudioDetection';

export default function CameraBubbles({
  localStream,
  remoteStream,
  userName,
  remoteName,
  cameraOn,
  micOn,
  onToggleCamera,
  onToggleMic,
}) {
  const localSpeaking = useAudioDetection(localStream);
  const remoteSpeaking = useAudioDetection(remoteStream);

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      pointerEvents: 'none',
      zIndex: 30,
    }}>
      {/* Self bubble — always visible once we have local stream */}
      <div style={{ pointerEvents: 'all', position: 'absolute', bottom: '24px', right: '24px' }}>
        <CameraBubble
          stream={localStream}
          name={userName}
          isSelf={true}
          isSpeaking={localSpeaking}
          isMuted={!micOn}
          cameraOff={!cameraOn}
          onToggleMic={onToggleMic}
          onToggleCamera={onToggleCamera}
        />
      </div>

      {/* Remote bubble — show when remote user exists (with or without stream) */}
      {remoteName && remoteName !== 'Waiting...' && (
        <div style={{ pointerEvents: 'all', position: 'absolute', bottom: '120px', right: '24px' }}>
          <CameraBubble
            stream={remoteStream}
            name={remoteName}
            isSelf={false}
            isSpeaking={remoteSpeaking}
            isMuted={false}
            cameraOff={!remoteStream}
          />
        </div>
      )}
    </div>
  );
}
