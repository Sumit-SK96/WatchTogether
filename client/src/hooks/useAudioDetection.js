/**
 * useAudioDetection.js — Detect when a user is speaking
 * Uses Web Audio API AnalyserNode to monitor audio levels.
 *
 * FIXES (v2):
 *  - Throttled detection loop (every 100ms instead of every frame) to reduce CPU
 *  - Proper cleanup of AudioContext
 *  - Guards against suspended AudioContext (autoplay policy)
 *  - Only runs when mic track is enabled
 */
import { useEffect, useRef, useState } from 'react';

const SPEAKING_THRESHOLD = 15;
const SILENCE_TIMEOUT = 500;
const DETECTION_INTERVAL = 100; // ms between checks (instead of rAF)

export function useAudioDetection(stream) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const cleanupRef = useRef(null);

  useEffect(() => {
    if (!stream) {
      setIsSpeaking(false);
      return;
    }

    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack || !audioTrack.enabled) {
      setIsSpeaking(false);
      return;
    }

    let cancelled = false;
    let audioCtx = null;
    let intervalId = null;
    let speakingTimeout = null;

    const setup = async () => {
      try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();

        // Resume context if suspended (browser autoplay policy)
        if (audioCtx.state === 'suspended') {
          await audioCtx.resume();
        }

        if (cancelled) {
          audioCtx.close();
          return;
        }

        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256; // Smaller FFT for better perf
        analyser.smoothingTimeConstant = 0.3;
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        // Use setInterval instead of rAF — less CPU, still responsive
        intervalId = setInterval(() => {
          if (cancelled || audioCtx.state === 'closed') {
            clearInterval(intervalId);
            return;
          }

          // Don't process if track was disabled (muted)
          if (!audioTrack.enabled || audioTrack.readyState === 'ended') {
            setIsSpeaking(false);
            return;
          }

          analyser.getByteFrequencyData(dataArray);

          // Only check first 32 bins (voice frequencies: ~85Hz-4kHz)
          let sum = 0;
          const voiceBins = Math.min(32, dataArray.length);
          for (let i = 0; i < voiceBins; i++) {
            sum += dataArray[i];
          }
          const avg = sum / voiceBins;

          if (avg > SPEAKING_THRESHOLD) {
            setIsSpeaking(true);
            clearTimeout(speakingTimeout);
            speakingTimeout = setTimeout(() => {
              if (!cancelled) setIsSpeaking(false);
            }, SILENCE_TIMEOUT);
          }
        }, DETECTION_INTERVAL);
      } catch (err) {
        console.warn('[AudioDetection] Setup error:', err.message);
      }
    };

    setup();

    return () => {
      cancelled = true;
      clearInterval(intervalId);
      clearTimeout(speakingTimeout);
      if (audioCtx && audioCtx.state !== 'closed') {
        audioCtx.close().catch(() => {});
      }
      setIsSpeaking(false);
    };
  }, [stream]);

  return isSpeaking;
}
