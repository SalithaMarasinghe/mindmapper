import { useEffect, useRef, useState, useMemo } from 'react';
import {
  type RGB,
  lerpRGB,
  toRgbaString,
  getOrbColorsFromDom,
  DEFAULT_ORB_COLORS,
  mapFrequencyDataToSymmetricBars,
  getIdleBarTargets,
  getThinkingBarTargets,
  getSpeakingSyntheticBarTargets,
} from './orbUtils';

export type JarvisOrbState = 'idle' | 'listening' | 'thinking' | 'speaking';

export interface JarvisOrbProps {
  state?: JarvisOrbState | 'success';
  level?: number;
  size?: number;
  analyser?: AnalyserNode | null;
  onClick?: () => void;
  className?: string;

  // Legacy prop support for compatibility
  audioLevel?: number;
  glow?: boolean;
}

const BAR_COUNT = 40;
const ATTACK = 0.5;
const RELEASE = 0.12;

export function JarvisOrb({
  state = 'idle',
  level,
  size = 120,
  analyser = null,
  onClick,
  className = '',
  audioLevel,
}: JarvisOrbProps) {
  // Normalize legacy 'success' to 'idle'
  const normalizedState: JarvisOrbState =
    state === 'success' || !['idle', 'listening', 'thinking', 'speaking'].includes(state)
      ? 'idle'
      : (state as JarvisOrbState);

  // Normalize effective audio level (0 to 1)
  const effectiveLevel = typeof level === 'number' ? level : typeof audioLevel === 'number' ? audioLevel : 0;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Persistent animation references (zero React re-renders per frame)
  const animFrameRef = useRef<number | null>(null);
  const isVisibleRef = useRef<boolean>(true);
  const lastTimeRef = useRef<number>(performance.now());

  // Mutable state mirrors for animation loop
  const stateRef = useRef<JarvisOrbState>(normalizedState);
  stateRef.current = normalizedState;

  const levelRef = useRef<number>(effectiveLevel);
  levelRef.current = effectiveLevel;

  const analyserRef = useRef<AnalyserNode | null>(analyser);
  analyserRef.current = analyser;

  // Frequency data buffer
  const freqDataRef = useRef<Uint8Array<ArrayBuffer> | null>(null);

  // Smooth bar amplitudes (0.0 to 1.0)
  const currentBarsRef = useRef<Float32Array>(new Float32Array(BAR_COUNT).fill(0.25));

  // Current interpolated RGB color
  const currentColorRef = useRef<RGB>(DEFAULT_ORB_COLORS.idle);

  // Current halo opacity (0 to 1)
  const haloOpacityRef = useRef<number>(normalizedState === 'listening' ? 1 : 0);

  // Current center dot scale
  const dotScaleRef = useRef<number>(1);

  // Check prefers-reduced-motion
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // Aria label text node
  const stateLabel = useMemo(() => {
    switch (normalizedState) {
      case 'listening':
        return 'Listening';
      case 'thinking':
        return 'Thinking';
      case 'speaking':
        return 'Speaking';
      case 'idle':
      default:
        return 'Idle';
    }
  }, [normalizedState]);

  // Main canvas rendering & requestAnimationFrame loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high DPI crisp rendering
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    const scale = size / 120;
    const cx = size / 2;
    const cy = size / 2;
    const rBase = 30 * scale;
    const minLen = 4 * scale;
    const maxLen = 20 * scale;
    const barWidth = 2 * scale;
    const dotRadius = 5 * scale;
    const hairlineRingWidth = 0.5 * scale;
    const haloRadius = rBase + 12 * scale;
    const haloWidth = 8 * scale;

    // If reduced motion is requested, render a static crisp ring and exit
    if (prefersReducedMotion) {
      const palette = getOrbColorsFromDom(canvas);
      const staticColor =
        normalizedState === 'listening'
          ? palette.active
          : normalizedState === 'thinking'
          ? palette.muted
          : normalizedState === 'speaking'
          ? palette.speaking
          : palette.idle;

      ctx.clearRect(0, 0, size, size);

      // Hairline ring
      ctx.beginPath();
      ctx.arc(cx, cy, rBase, 0, Math.PI * 2);
      ctx.lineWidth = hairlineRingWidth;
      ctx.strokeStyle = toRgbaString(staticColor, 0.4);
      ctx.stroke();

      // Static low bars (~30% amplitude)
      const staticBarLen = minLen + 0.3 * (maxLen - minLen);
      ctx.lineCap = 'round';
      ctx.lineWidth = barWidth;
      ctx.strokeStyle = toRgbaString(staticColor, 1);

      for (let i = 0; i < BAR_COUNT; i++) {
        const theta = (i / BAR_COUNT) * Math.PI * 2 - Math.PI / 2;
        const cos = Math.cos(theta);
        const sin = Math.sin(theta);
        const innerX = cx + rBase * cos;
        const innerY = cy + rBase * sin;
        const outerX = cx + (rBase + staticBarLen) * cos;
        const outerY = cy + (rBase + staticBarLen) * sin;

        ctx.beginPath();
        ctx.moveTo(innerX, innerY);
        ctx.lineTo(outerX, outerY);
        ctx.stroke();
      }

      // Center dot
      ctx.beginPath();
      ctx.arc(cx, cy, dotRadius, 0, Math.PI * 2);
      ctx.fillStyle = toRgbaString(staticColor, 1);
      ctx.fill();

      return;
    }

    // Set up Page Visibility & IntersectionObserver pausing
    const handleVisibilityChange = () => {
      isVisibleRef.current = !document.hidden;
      if (isVisibleRef.current && animFrameRef.current === null) {
        lastTimeRef.current = performance.now();
        animFrameRef.current = requestAnimationFrame(render);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const observer = new IntersectionObserver(([entry]) => {
      isVisibleRef.current = entry.isIntersecting && !document.hidden;
      if (isVisibleRef.current && animFrameRef.current === null) {
        lastTimeRef.current = performance.now();
        animFrameRef.current = requestAnimationFrame(render);
      }
    });
    observer.observe(canvas);

    // Render loop
    const render = (time: number) => {
      if (!isVisibleRef.current) {
        animFrameRef.current = null;
        return;
      }

      const dt = Math.min(100, time - lastTimeRef.current);
      lastTimeRef.current = time;

      // 1. Resolve colors from CSS variables
      const palette = getOrbColorsFromDom(canvas);
      const currentState = stateRef.current;
      const currentLevel = levelRef.current;
      const activeAnalyser = analyserRef.current;

      const targetColor: RGB =
        currentState === 'listening'
          ? palette.active
          : currentState === 'thinking'
          ? palette.muted
          : currentState === 'speaking'
          ? palette.speaking
          : palette.idle;

      // Color lerp (~300ms transition time)
      const colorLerpFactor = 1 - Math.exp(-dt / 85);
      currentColorRef.current = lerpRGB(currentColorRef.current, targetColor, colorLerpFactor);
      const color = currentColorRef.current;
      const colorStr = toRgbaString(color, 1);

      // Halo opacity lerp (~300ms)
      const targetHalo = currentState === 'listening' ? 1 : 0;
      haloOpacityRef.current += (targetHalo - haloOpacityRef.current) * colorLerpFactor;

      // 2. Compute target bar heights based on state
      let targetHeights: number[];

      if (currentState === 'listening') {
        if (activeAnalyser) {
          if (!freqDataRef.current || freqDataRef.current.length !== activeAnalyser.frequencyBinCount) {
            freqDataRef.current = new Uint8Array(new ArrayBuffer(activeAnalyser.frequencyBinCount));
          }
          activeAnalyser.getByteFrequencyData(freqDataRef.current);
          targetHeights = mapFrequencyDataToSymmetricBars(freqDataRef.current, BAR_COUNT);
        } else if (currentLevel > 0) {
          // Synthetic audio-driven fallback when level is passed without raw AnalyserNode
          const baseTargets = getSpeakingSyntheticBarTargets(time, BAR_COUNT);
          targetHeights = baseTargets.map((b) => Math.min(1, b * (0.4 + currentLevel * 0.9)));
        } else {
          // Subtle listening ready pulse
          targetHeights = getIdleBarTargets(time, BAR_COUNT).map((v) => v * 1.15);
        }

        // Center dot pulses with overall volume
        const targetDotScale = 1.0 + Math.min(0.45, currentLevel * 0.35);
        dotScaleRef.current += (targetDotScale - dotScaleRef.current) * 0.2;
      } else if (currentState === 'thinking') {
        targetHeights = getThinkingBarTargets(time, BAR_COUNT);
        dotScaleRef.current += (1.0 - dotScaleRef.current) * 0.1;
      } else if (currentState === 'speaking') {
        if (activeAnalyser) {
          if (!freqDataRef.current || freqDataRef.current.length !== activeAnalyser.frequencyBinCount) {
            freqDataRef.current = new Uint8Array(new ArrayBuffer(activeAnalyser.frequencyBinCount));
          }
          activeAnalyser.getByteFrequencyData(freqDataRef.current);
          targetHeights = mapFrequencyDataToSymmetricBars(freqDataRef.current, BAR_COUNT);
        } else {
          targetHeights = getSpeakingSyntheticBarTargets(time, BAR_COUNT);
        }
        const targetDotScale = 1.0 + Math.min(0.35, (currentLevel || 0.4) * 0.28);
        dotScaleRef.current += (targetDotScale - dotScaleRef.current) * 0.15;
      } else {
        // Idle breathing wave
        targetHeights = getIdleBarTargets(time, BAR_COUNT);
        // Center dot breathes slowly between 1.0 and 1.06
        const breathPhase = (time % 4000) / 4000;
        const breathScale = 1.0 + 0.06 * (Math.sin(breathPhase * Math.PI * 2) * 0.5 + 0.5);
        dotScaleRef.current += (breathScale - dotScaleRef.current) * 0.08;
      }

      // 3. Smooth per-bar amplitudes (attack 0.5, release 0.12)
      const bars = currentBarsRef.current;
      for (let i = 0; i < BAR_COUNT; i++) {
        const target = targetHeights[i] ?? 0.25;
        const current = bars[i];
        const smoothingFactor = target > current ? ATTACK : RELEASE;
        bars[i] = current + (target - current) * smoothingFactor;
      }

      // 4. Draw to Canvas
      ctx.clearRect(0, 0, size, size);

      // Listening soft halo ring (8px wide at 8% opacity)
      if (haloOpacityRef.current > 0.005) {
        ctx.beginPath();
        ctx.arc(cx, cy, haloRadius, 0, Math.PI * 2);
        ctx.lineWidth = haloWidth;
        ctx.strokeStyle = toRgbaString(color, 0.08 * haloOpacityRef.current);
        ctx.stroke();
      }

      // Baseline hairline ring (0.5px, 40% opacity)
      ctx.beginPath();
      ctx.arc(cx, cy, rBase, 0, Math.PI * 2);
      ctx.lineWidth = hairlineRingWidth;
      ctx.strokeStyle = toRgbaString(color, 0.4);
      ctx.stroke();

      // 40 radial bars
      ctx.lineCap = 'round';
      ctx.lineWidth = barWidth;
      ctx.strokeStyle = colorStr;

      for (let i = 0; i < BAR_COUNT; i++) {
        const barAmp = bars[i];
        const barLen = minLen + barAmp * (maxLen - minLen);

        // 9 degrees apart (360 / 40)
        const theta = (i / BAR_COUNT) * Math.PI * 2 - Math.PI / 2;
        const cos = Math.cos(theta);
        const sin = Math.sin(theta);

        const innerX = cx + rBase * cos;
        const innerY = cy + rBase * sin;
        const outerX = cx + (rBase + barLen) * cos;
        const outerY = cy + (rBase + barLen) * sin;

        ctx.beginPath();
        ctx.moveTo(innerX, innerY);
        ctx.lineTo(outerX, outerY);
        ctx.stroke();
      }

      // Center dot (10px scaled, pulses dynamically)
      ctx.beginPath();
      ctx.arc(cx, cy, dotRadius * dotScaleRef.current, 0, Math.PI * 2);
      ctx.fillStyle = colorStr;
      ctx.fill();

      animFrameRef.current = requestAnimationFrame(render);
    };

    lastTimeRef.current = performance.now();
    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      observer.disconnect();
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
    };
  }, [size, prefersReducedMotion, normalizedState]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (onClick && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label={`Jarvis Voice Orb: ${stateLabel}`}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      className={`relative inline-flex items-center justify-center rounded-full select-none ${
        onClick
          ? 'cursor-pointer focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none'
          : ''
      } ${className}`}
      style={{ width: size, height: size }}
    >
      <canvas
        ref={canvasRef}
        style={{ width: size, height: size }}
        className="block pointer-events-none"
      />
      {/* Visually hidden screen reader status */}
      <span className="sr-only" aria-live="polite">
        {stateLabel}
      </span>
    </div>
  );
}
