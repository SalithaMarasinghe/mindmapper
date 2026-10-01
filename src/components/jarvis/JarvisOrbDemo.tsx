import { useState } from 'react';
import { JarvisOrb, type JarvisOrbState } from './JarvisOrb';
import { useMicLevel } from '../../hooks/useMicLevel';
import { Mic, Sparkles, Volume2, Moon } from 'lucide-react';

export function JarvisOrbDemo() {
  const [orbState, setOrbState] = useState<JarvisOrbState>('idle');
  const [simulatedLevel, setSimulatedLevel] = useState<number>(0.35);
  const [useRealMic, setUseRealMic] = useState<boolean>(false);
  const [orbSize, setOrbSize] = useState<number>(120);

  // Real microphone audio hook
  const { analyser, level: realMicLevel, isBlocked } = useMicLevel({
    enabled: useRealMic && orbState === 'listening',
  });

  const effectiveLevel = useRealMic && orbState === 'listening' ? realMicLevel : simulatedLevel;

  return (
    <div className="w-full max-w-xl mx-auto p-6 bg-panel border border-border rounded-[16px] text-text shadow-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div>
          <h2 className="text-base font-semibold text-text tracking-tight flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-accent" />
            Radial Waveform Orb Harness
          </h2>
          <p className="text-xs text-text-muted mt-0.5">
            Test and preview states, live microphone analysis, and transitions.
          </p>
        </div>
        <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-surface border border-border text-accent">
          {orbState.toUpperCase()}
        </span>
      </div>

      {/* Orb Stage */}
      <div className="relative flex flex-col items-center justify-center py-10 bg-bg rounded-[12px] border border-border overflow-hidden">
        <JarvisOrb
          state={orbState}
          level={effectiveLevel}
          size={orbSize}
          analyser={useRealMic ? analyser : null}
          onClick={() => {
            setOrbState((prev) => (prev === 'listening' ? 'idle' : 'listening'));
          }}
        />

        <div className="mt-4 text-center">
          <p className="text-xs font-mono text-text-secondary">
            State: <span className="text-accent">{orbState}</span> · Level:{' '}
            <span className="text-accent">{(effectiveLevel * 100).toFixed(0)}%</span>
          </p>
          {isBlocked && orbState === 'listening' && (
            <p className="text-[11px] text-amber-400 mt-1">⚠️ Mic blocked: using synthetic simulation</p>
          )}
        </div>
      </div>

      {/* Controls: State Selector */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-text-secondary">Orb State</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <button
            type="button"
            onClick={() => setOrbState('idle')}
            className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-[8px] text-xs font-medium border transition-colors ${
              orbState === 'idle'
                ? 'bg-surface-2 text-text border-accent/40 shadow-sm'
                : 'bg-surface text-text-muted border-border hover:text-text hover:bg-surface-2'
            }`}
          >
            <Moon className="w-3.5 h-3.5" />
            Idle
          </button>

          <button
            type="button"
            onClick={() => setOrbState('listening')}
            className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-[8px] text-xs font-medium border transition-colors ${
              orbState === 'listening'
                ? 'bg-surface-2 text-accent border-accent shadow-sm'
                : 'bg-surface text-text-muted border-border hover:text-text hover:bg-surface-2'
            }`}
          >
            <Mic className="w-3.5 h-3.5" />
            Listening
          </button>

          <button
            type="button"
            onClick={() => setOrbState('thinking')}
            className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-[8px] text-xs font-medium border transition-colors ${
              orbState === 'thinking'
                ? 'bg-surface-2 text-text-secondary border-text-secondary shadow-sm'
                : 'bg-surface text-text-muted border-border hover:text-text hover:bg-surface-2'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Thinking
          </button>

          <button
            type="button"
            onClick={() => setOrbState('speaking')}
            className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-[8px] text-xs font-medium border transition-colors ${
              orbState === 'speaking'
                ? 'bg-surface-2 text-teal-300 border-teal-400/40 shadow-sm'
                : 'bg-surface text-text-muted border-border hover:text-text hover:bg-surface-2'
            }`}
          >
            <Volume2 className="w-3.5 h-3.5" />
            Speaking
          </button>
        </div>
      </div>

      {/* Level Slider & Mic Switch */}
      <div className="space-y-4 pt-1 border-t border-border">
        <div className="flex items-center justify-between text-xs">
          <label htmlFor="simulated-level" className="font-medium text-text-secondary">
            Simulated Amplitude Level: {Math.round(simulatedLevel * 100)}%
          </label>
          <span className="text-[11px] font-mono text-text-muted">0.00 – 1.00</span>
        </div>
        <input
          id="simulated-level"
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={simulatedLevel}
          disabled={useRealMic && orbState === 'listening'}
          onChange={(e) => setSimulatedLevel(parseFloat(e.target.value))}
          className="w-full accent-accent h-1.5 bg-surface-2 rounded-lg cursor-pointer disabled:opacity-40"
        />

        {/* Real Mic & Size Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <label className="flex items-center gap-2 cursor-pointer text-xs text-text-secondary">
            <input
              type="checkbox"
              checked={useRealMic}
              onChange={(e) => setUseRealMic(e.target.checked)}
              className="rounded border-border accent-accent"
            />
            <span>Enable Real Microphone during Listening</span>
          </label>

          <div className="flex items-center gap-1.5 text-xs text-text-muted">
            <span>Size:</span>
            {[80, 120, 160].map((sz) => (
              <button
                key={sz}
                type="button"
                onClick={() => setOrbSize(sz)}
                className={`px-2 py-0.5 rounded-[6px] border text-[11px] font-mono ${
                  orbSize === sz
                    ? 'bg-surface-2 text-accent border-accent/40'
                    : 'bg-surface text-text-muted border-border'
                }`}
              >
                {sz}px
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
