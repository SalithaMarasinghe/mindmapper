import { useEffect, useRef } from 'react';

export type OrbVisualState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'success';

interface JarvisOrbProps {
  state?: OrbVisualState;
  size?: number; // diameter in pixels
  audioLevel?: number; // 0.0 to 1.0 (from mic or synthesizer)
  onClick?: () => void;
  className?: string;
  glow?: boolean;
}

export function JarvisOrb({
  state = 'idle',
  size = 140,
  audioLevel = 0,
  onClick,
  className = '',
  glow = true,
}: JarvisOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const stateRef = useRef(state);
  const audioLevelRef = useRef(audioLevel);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    audioLevelRef.current = audioLevel;
  }, [audioLevel]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    const center = size / 2;
    let angle1 = 0;
    let angle2 = 0;
    let angle3 = 0;
    let pulseAngle = 0;

    // Particle nodes in the holographic sphere
    const particleCount = 28;
    const particles = Array.from({ length: particleCount }, (_, i) => ({
      theta: Math.random() * Math.PI * 2,
      phi: Math.acos(Math.random() * 2 - 1),
      speed: 0.01 + (i % 5) * 0.003,
      size: 1 + Math.random() * 1.5,
    }));

    const render = () => {
      ctx.clearRect(0, 0, size, size);

      const currentState = stateRef.current;
      const liveAudio = audioLevelRef.current;

      // Dynamic speeds depending on state
      const speedMultiplier =
        currentState === 'thinking' ? 3.5 : currentState === 'listening' ? 1.6 : currentState === 'speaking' ? 2.0 : 1.0;

      angle1 += 0.018 * speedMultiplier;
      angle2 -= 0.014 * speedMultiplier;
      angle3 += 0.011 * speedMultiplier;
      pulseAngle += 0.04 * speedMultiplier;

      // Core colors
      let primaryColor = '0, 245, 255'; // Cyan
      let secondaryColor = '14, 165, 233'; // Sky Blue
      let accentColor = '99, 102, 241'; // Indigo

      if (currentState === 'success') {
        primaryColor = '16, 185, 129'; // Emerald
        secondaryColor = '52, 211, 153';
        accentColor = '5, 150, 105';
      } else if (currentState === 'thinking') {
        primaryColor = '168, 85, 247'; // Purple
        secondaryColor = '99, 102, 241';
        accentColor = '192, 132, 252';
      }

      // 1. Central Core Glow (Breathing + Audio Reactive)
      const baseRadius = size * 0.18;
      const audioExpansion = liveAudio * (size * 0.15);
      const breath = Math.sin(pulseAngle) * (size * 0.03);
      const coreRadius = Math.max(6, baseRadius + breath + audioExpansion);

      const grad = ctx.createRadialGradient(center, center, 0, center, center, coreRadius * 2);
      grad.addColorStop(0, `rgba(${primaryColor}, 0.9)`);
      grad.addColorStop(0.3, `rgba(${secondaryColor}, 0.5)`);
      grad.addColorStop(0.7, `rgba(${accentColor}, 0.15)`);
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(center, center, coreRadius * 2, 0, Math.PI * 2);
      ctx.fill();

      // 2. High-Density Inner Nucleus
      ctx.fillStyle = `rgba(255, 255, 255, 0.95)`;
      ctx.beginPath();
      ctx.arc(center, center, coreRadius * 0.45, 0, Math.PI * 2);
      ctx.fill();

      // 3. Gyroscopic Orbital Ring 1 (Horizontal with slight tilt)
      const ring1Radius = size * 0.36 + audioExpansion * 0.5;
      ctx.save();
      ctx.translate(center, center);
      ctx.rotate(angle1);
      ctx.scale(1, 0.42);

      ctx.strokeStyle = `rgba(${primaryColor}, 0.75)`;
      ctx.lineWidth = 1.6;
      ctx.setLineDash([8, 6, 2, 6]);
      ctx.beginPath();
      ctx.arc(0, 0, ring1Radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // 4. Gyroscopic Orbital Ring 2 (Tilted +45 deg)
      const ring2Radius = size * 0.4 + audioExpansion * 0.6;
      ctx.save();
      ctx.translate(center, center);
      ctx.rotate(Math.PI / 4 + angle2);
      ctx.scale(1, 0.38);

      ctx.strokeStyle = `rgba(${secondaryColor}, 0.7)`;
      ctx.lineWidth = 1.4;
      ctx.setLineDash([12, 4, 4, 4]);
      ctx.beginPath();
      ctx.arc(0, 0, ring2Radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // 5. Gyroscopic Orbital Ring 3 (Tilted -45 deg)
      const ring3Radius = size * 0.44 + audioExpansion * 0.7;
      ctx.save();
      ctx.translate(center, center);
      ctx.rotate(-Math.PI / 4 + angle3);
      ctx.scale(1, 0.45);

      ctx.strokeStyle = `rgba(${accentColor}, 0.65)`;
      ctx.lineWidth = 1.2;
      ctx.setLineDash([16, 6]);
      ctx.beginPath();
      ctx.arc(0, 0, ring3Radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // 6. 3D Particle Cloud
      const sphereRadius = size * 0.32 + audioExpansion * 0.4;
      for (const p of particles) {
        p.theta += p.speed * speedMultiplier;
        const x = center + sphereRadius * Math.sin(p.phi) * Math.cos(p.theta);
        const y = center + sphereRadius * Math.cos(p.phi);
        const z = sphereRadius * Math.sin(p.phi) * Math.sin(p.theta);

        // Alpha based on depth z (-sphereRadius to +sphereRadius)
        const depthAlpha = Math.max(0.15, (z + sphereRadius) / (2 * sphereRadius));
        ctx.fillStyle = `rgba(${primaryColor}, ${depthAlpha * 0.85})`;
        ctx.beginPath();
        ctx.arc(x, y, p.size * (0.8 + depthAlpha * 0.5), 0, Math.PI * 2);
        ctx.fill();
      }

      // 7. Outer Acoustic Waveform Shockwave (when speaking or listening)
      if (currentState === 'listening' || currentState === 'speaking') {
        const waveRadius = (ring3Radius + 8) + (Math.sin(pulseAngle * 1.5) * 6);
        ctx.strokeStyle = `rgba(${primaryColor}, ${0.2 + liveAudio * 0.5})`;
        ctx.lineWidth = 1.0;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(center, center, waveRadius, 0, Math.PI * 2);
        ctx.stroke();
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [size]);

  return (
    <div
      onClick={onClick}
      className={`relative flex items-center justify-center select-none ${
        onClick ? 'cursor-pointer hover:scale-105 active:scale-95 transition-transform' : ''
      } ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Outer ambient blur aura */}
      {glow && (
        <div
          className={`absolute inset-0 rounded-full blur-xl pointer-events-none transition-all duration-500 ${
            state === 'success'
              ? 'bg-emerald-500/20'
              : state === 'thinking'
              ? 'bg-purple-500/20'
              : state === 'listening'
              ? 'bg-cyan-400/30'
              : 'bg-teal-500/15'
          }`}
        />
      )}
      <canvas
        ref={canvasRef}
        style={{ width: size, height: size }}
        className="relative z-10 block"
      />
    </div>
  );
}
