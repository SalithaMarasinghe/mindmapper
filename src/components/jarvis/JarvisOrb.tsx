import React, { useMemo } from 'react';

export type JarvisOrbState = 'idle' | 'listening' | 'thinking' | 'speaking';

export interface JarvisOrbProps {
  state?: JarvisOrbState | 'success';
  size?: number;
  onClick?: () => void;
  className?: string;
  glow?: boolean;
  // Audio reactivity & compatibility props
  level?: number;
  audioLevel?: number;
  analyser?: AnalyserNode | null;
}

export function JarvisOrb({
  state = 'idle',
  size = 42,
  onClick,
  className = '',
  glow = true,
  level,
  audioLevel,
}: JarvisOrbProps) {
  // Normalize legacy 'success' to 'idle'
  const normalizedState: JarvisOrbState =
    state === 'success' || !['idle', 'listening', 'thinking', 'speaking'].includes(state)
      ? 'idle'
      : (state as JarvisOrbState);

  const effectiveLevel =
    typeof level === 'number'
      ? level
      : typeof audioLevel === 'number'
      ? audioLevel
      : 0;

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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (onClick && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onClick();
    }
  };

  // State-specific animation class
  const animClass = useMemo(() => {
    switch (normalizedState) {
      case 'listening':
        return 'orb-anim-listening';
      case 'thinking':
        return 'orb-anim-thinking';
      case 'speaking':
        return 'orb-anim-speaking';
      case 'idle':
      default:
        return 'orb-anim-idle';
    }
  }, [normalizedState]);

  // Subtle audio reactivity scale when audioLevel is present
  const audioScale =
    effectiveLevel > 0.05
      ? `scale(${1 + Math.min(0.22, effectiveLevel * 0.28)})`
      : undefined;

  return (
    <div
      role={onClick ? 'button' : 'img'}
      tabIndex={onClick ? 0 : undefined}
      aria-label={`Jarvis Voice Orb: ${stateLabel}`}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      style={{ width: size, height: size }}
      className={`relative inline-flex items-center justify-center select-none ${
        onClick
          ? 'cursor-pointer focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none focus-visible:ring-offset-2 focus-visible:ring-offset-bg transition-transform active:scale-95'
          : ''
      } ${className}`}
    >
      {/* ── Outer Pulsing Halo Ring (Listening State) ───────────────── */}
      {normalizedState === 'listening' && (
        <div
          className="orb-anim-halo absolute inset-[-12%] rounded-full border border-[var(--orb-color,#ededed)]/30 pointer-events-none"
          style={{ animation: 'orb-halo-ring 1.8s cubic-bezier(0.16, 1, 0.3, 1) infinite' }}
        />
      )}

      {/* ── Soft Ambient Glow ────────────────────────────────────────── */}
      {glow && (
        <div
          className="absolute inset-[-15%] rounded-full pointer-events-none transition-opacity duration-300"
          style={{
            background: 'radial-gradient(circle, var(--orb-color, #ededed) 0%, rgba(237, 237, 237, 0.35) 40%, transparent 70%)',
            filter: `blur(${Math.max(4, size * 0.2)}px)`,
            opacity:
              normalizedState === 'listening'
                ? 0.75
                : normalizedState === 'speaking'
                ? 0.65
                : normalizedState === 'thinking'
                ? 0.55
                : 0.38,
          }}
        />
      )}

      {/* ── Main Radial Gradient Sphere ──────────────────────────────── */}
      <div
        className={`relative w-full h-full rounded-full overflow-hidden shadow-lg ${animClass}`}
        style={{
          transform: audioScale,
          transition: 'transform 100ms ease-out',
          background: `radial-gradient(circle at 35% 30%, #FFFFFF 0%, var(--orb-color, #EDEDED) 28%, color-mix(in srgb, var(--orb-color, #EDEDED) 65%, #18181B) 60%, #09090B 100%)`,
        }}
      >
        {/* Slow drift / swirl inner gradient layer */}
        <div
          className="absolute inset-0 rounded-full pointer-events-none opacity-60 mix-blend-overlay"
          style={{
            background: `radial-gradient(circle at 65% 65%, color-mix(in srgb, var(--orb-color, #EDEDED) 40%, transparent) 0%, transparent 65%)`,
            animation:
              normalizedState === 'thinking'
                ? 'orb-drift-slow 2.4s linear infinite'
                : 'orb-drift-slow 10s ease-in-out infinite',
          }}
        />

        {/* Specular glass highlight (upper-left refraction) */}
        <div
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            background:
              'radial-gradient(circle at 30% 24%, rgba(255, 255, 255, 0.75) 0%, rgba(255, 255, 255, 0.15) 32%, transparent 60%)',
          }}
        />

        {/* Rim shadow for spherical 3D depth */}
        <div
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            boxShadow: 'inset 0 -2px 6px rgba(0, 0, 0, 0.65), inset 0 1px 2px rgba(255, 255, 255, 0.5)',
          }}
        />
      </div>

      {/* Screen-reader live region */}
      <span className="sr-only" aria-live="polite">
        {stateLabel}
      </span>
    </div>
  );
}
