import { useEffect, useRef } from 'react';
import { jarvisVoice } from '../../services/jarvisVoice';

interface WaveformProps {
  barCount?: number;
  isActive: boolean;
  isThinking: boolean;
  analyserNode: AnalyserNode | null;
  audioLevel?: number;
}

export function Waveform({
  barCount = 28,
  isActive,
  isThinking,
  analyserNode,
  audioLevel = 0,
}: WaveformProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<number | null>(null);

  useEffect(() => {
    const bars = containerRef.current?.children;
    if (!bars) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const renderFrame = () => {
      const now = Date.now();
      // Try to get analyser from the service instance directly if not passed via props (as per instructions)
      const actualAnalyser = analyserNode || (jarvisVoice as any).analyser;

      for (let i = 0; i < barCount; i++) {
        const bar = bars[i] as HTMLElement;
        if (!bar) continue;

        if (prefersReducedMotion) {
          bar.style.height = '50%';
          continue;
        }

        if (isActive) {
          let heightPercent = 10;
          if (actualAnalyser) {
            const dataArray = new Uint8Array(actualAnalyser.frequencyBinCount);
            actualAnalyser.getByteFrequencyData(dataArray);
            const val = dataArray[i * Math.floor(dataArray.length / barCount)] || 0;
            heightPercent = Math.max(10, (val / 255) * 100);
          } else {
            const val = Math.sin(i * 0.5 + now * 0.003) * audioLevel * 100;
            heightPercent = Math.max(10, Math.abs(val));
          }
          bar.style.height = `${heightPercent}%`;
        } else if (isThinking) {
          const wave = Math.sin(i * 0.4 + now * 0.005) * 50 + 50;
          bar.style.height = `${Math.max(10, wave)}%`;
        }
      }

      if (isActive || isThinking) {
        requestRef.current = requestAnimationFrame(renderFrame);
      }
    };

    if (isActive || isThinking) {
      requestRef.current = requestAnimationFrame(renderFrame);
    } else {
      // For idle, we reset height so CSS animation can take over
      for (let i = 0; i < barCount; i++) {
        const bar = bars[i] as HTMLElement;
        if (bar && !prefersReducedMotion) {
          bar.style.height = '100%';
        }
      }
    }

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [isActive, isThinking, analyserNode, barCount, audioLevel]);

  return (
    <>
      <style>{`
        @keyframes waveform-idle {
          0%, 100% { transform: scaleY(0.2); }
          50% { transform: scaleY(1); }
        }
      `}</style>
      <div className="h-8 flex items-end justify-center gap-[2px]" ref={containerRef}>
        {Array.from({ length: barCount }).map((_, i) => {
          const isIdle = !isActive && !isThinking;
          return (
            <div
              key={i}
              className={`w-[2px] rounded-full transition-all duration-100 origin-bottom ${
                isActive
                  ? 'bg-accent'
                  : isThinking
                  ? 'bg-text-secondary'
                  : 'bg-text-muted'
              }`}
              style={{
                animation: isIdle ? 'waveform-idle 2s ease-in-out infinite' : 'none',
                animationDelay: isIdle ? `${i * 0.05}s` : undefined,
                height: isIdle ? '100%' : undefined,
              }}
            />
          );
        })}
      </div>
    </>
  );
}
