/**
 * useAudioDetection.js — Detect when a user is speaking
 * Uses Web Audio API AnalyserNode to monitor audio levels.
 */
import { useEffect, useRef, useState } from 'react';

export function useAudioDetection(stream) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);

  useEffect(() => {
    if (!stream) return;

    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack) return;

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.4;
    source.connect(analyser);
    analyserRef.current = analyser;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    let speakingTimeout = null;

    const detect = () => {
      analyser.getByteFrequencyData(dataArray);
      const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;

      if (avg > 15) {
        setIsSpeaking(true);
        clearTimeout(speakingTimeout);
        speakingTimeout = setTimeout(() => setIsSpeaking(false), 500);
      }

      animFrameRef.current = requestAnimationFrame(detect);
    };

    detect();

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      clearTimeout(speakingTimeout);
      audioCtx.close();
    };
  }, [stream]);

  return isSpeaking;
}
