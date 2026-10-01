import { useState, useEffect, useRef } from 'react';

export interface UseMicLevelOptions {
  enabled?: boolean;
  fftSize?: number;
  smoothingTimeConstant?: number;
}

export interface UseMicLevelResult {
  analyser: AnalyserNode | null;
  level: number;
  isBlocked: boolean;
  error: Error | null;
}

/**
 * useMicLevel hook
 * Requests microphone stream only when enabled (e.g. state === 'listening'),
 * creates an AudioContext + AnalyserNode (fftSize 128, smoothingTimeConstant 0.8),
 * and exposes the AnalyserNode along with a smoothed normalized audio level (0-1).
 * Safely closes tracks and AudioContext on unmount or when disabled.
 */
export function useMicLevel({
  enabled = false,
  fftSize = 128,
  smoothingTimeConstant = 0.8,
}: UseMicLevelOptions = {}): UseMicLevelResult {
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [level, setLevel] = useState<number>(0);
  const [isBlocked, setIsBlocked] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const rafIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) {
      // Teardown when disabled
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (sourceRef.current) {
        sourceRef.current.disconnect();
        sourceRef.current = null;
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        void audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
      setAnalyser(null);
      setLevel(0);
      setIsBlocked(false);
      setError(null);
      return;
    }

    if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setIsBlocked(true);
      setError(new Error('Audio API not supported'));
      return;
    }

    let isSubscribed = true;

    async function initAudio() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: false,
        });

        if (!isSubscribed) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;

        const AudioContextClass =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new AudioContextClass();
        audioContextRef.current = ctx;

        if (ctx.state === 'suspended') {
          await ctx.resume().catch(() => {});
        }

        const node = ctx.createAnalyser();
        node.fftSize = fftSize;
        node.smoothingTimeConstant = smoothingTimeConstant;

        const source = ctx.createMediaStreamSource(stream);
        source.connect(node);
        sourceRef.current = source;

        setAnalyser(node);
        setIsBlocked(false);
        setError(null);

        // Analysis loop
        const dataArray = new Uint8Array(node.frequencyBinCount);

        const tick = () => {
          if (!isSubscribed) return;

          node.getByteFrequencyData(dataArray);

          // Focus on primary speech spectrum (bins 1 to 12 approx 80Hz - 3500Hz)
          const binCount = Math.min(dataArray.length, 16);
          let sum = 0;
          let count = 0;
          for (let i = 1; i < binCount; i++) {
            sum += dataArray[i];
            count++;
          }

          const rawLevel = count > 0 ? sum / (count * 255) : 0;
          // Apply non-linear curve to boost human perception of speech dynamics
          const scaledLevel = Math.min(1, Math.pow(rawLevel * 1.5, 0.85));

          setLevel(scaledLevel);
          rafIdRef.current = requestAnimationFrame(tick);
        };

        rafIdRef.current = requestAnimationFrame(tick);
      } catch (err) {
        if (!isSubscribed) return;
        const e = err instanceof Error ? err : new Error(String(err));
        console.warn('[useMicLevel] Microphone access denied or error:', e.message);
        setIsBlocked(true);
        setError(e);
      }
    }

    void initAudio();

    return () => {
      isSubscribed = false;
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (sourceRef.current) {
        sourceRef.current.disconnect();
        sourceRef.current = null;
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        void audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
    };
  }, [enabled, fftSize, smoothingTimeConstant]);

  return { analyser, level, isBlocked, error };
}
