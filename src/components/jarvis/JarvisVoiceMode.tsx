import { useEffect, useMemo } from 'react';
import { Mic, MicOff, X } from 'lucide-react';
import { useJarvisStore } from '../../store/jarvisStore';
import { JarvisOrb } from './JarvisOrb';

export function JarvisVoiceMode() {
  const {
    voiceModeOpen,
    micMuted,
    orbState,
    audioLevel,
    transcript,
    lastSpokenText,
    isSubmitting,
    isTranscribing,
    isSpeaking,
    closeVoiceMode,
    toggleMicMute,
    stopSpeaking,
    toggleRecording,
  } = useJarvisStore();

  // Close on Escape key
  useEffect(() => {
    if (!voiceModeOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeVoiceMode();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [voiceModeOpen, closeVoiceMode]);

  // Derived quiet status label
  const statusLabel = useMemo(() => {
    if (micMuted) return 'Mic muted';
    if (orbState === 'listening') return 'Listening';
    if (orbState === 'thinking' || isSubmitting || isTranscribing) return 'Thinking';
    if (orbState === 'speaking' || isSpeaking) return 'Speaking';
    return 'Listening';
  }, [micMuted, orbState, isSubmitting, isTranscribing, isSpeaking]);

  // Derived live caption in larger text
  const captionText = useMemo(() => {
    if (micMuted) {
      return 'Microphone is muted. Tap the mic button to speak.';
    }
    if (orbState === 'listening') {
      return transcript || 'Listening to you...';
    }
    if (orbState === 'thinking' || isSubmitting || isTranscribing) {
      return transcript || 'Thinking...';
    }
    if (orbState === 'speaking' || isSpeaking) {
      return lastSpokenText || 'Speaking...';
    }
    return transcript || 'How can I assist you?';
  }, [micMuted, orbState, isSubmitting, isTranscribing, isSpeaking, transcript, lastSpokenText]);

  // Tap orb interaction
  const handleOrbClick = () => {
    if (isSpeaking) {
      stopSpeaking();
    } else {
      void toggleRecording();
    }
  };

  if (!voiceModeOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Jarvis Voice Mode"
      className="fixed inset-0 z-50 bg-[#0B0B0C] flex flex-col justify-between p-6 select-none animate-in fade-in duration-200"
    >
      {/* ── Top Bar with Title and Close (X) Button ─────────────────── */}
      <header className="pt-[max(env(safe-area-inset-top,0px),8px)] w-full flex items-center justify-between max-w-lg mx-auto">
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-widest font-semibold text-text-muted/60">
            Jarvis Voice
          </span>
          {micMuted && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 font-medium">
              Muted
            </span>
          )}
        </div>

        <button
          onClick={closeVoiceMode}
          aria-label="Close voice mode"
          title="Close voice mode (Esc)"
          className="p-2.5 rounded-full text-text-muted hover:text-text hover:bg-surface-2 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </header>

      {/* ── Center Stage: Large Orb + Status + Live Caption ──────────── */}
      <main className="my-auto flex flex-col items-center justify-center text-center max-w-lg mx-auto w-full px-4 space-y-7">
        {/* Large Centered Orb (Max ~190-200px) */}
        <div className="relative py-2">
          <JarvisOrb
            size={190}
            state={micMuted ? 'idle' : orbState}
            audioLevel={micMuted ? 0 : audioLevel}
            onClick={handleOrbClick}
            className="cursor-pointer"
          />
        </div>

        {/* Quiet Status Label */}
        <div className="text-xs uppercase tracking-[0.2em] font-medium text-text-muted transition-colors duration-200">
          {statusLabel}
        </div>

        {/* Live Caption in Larger Text */}
        <div className="min-h-[80px] flex items-center justify-center w-full px-2">
          <p
            className={`text-lg sm:text-xl font-normal leading-relaxed max-w-md transition-opacity duration-200 ${
              micMuted
                ? 'text-text-muted'
                : orbState === 'listening' && !transcript
                ? 'text-text-muted/60 animate-pulse'
                : 'text-text/90'
            }`}
          >
            {captionText}
          </p>
        </div>
      </main>

      {/* ── Bottom Controls: Mute & Close Buttons ────────────────────── */}
      <footer className="pb-[max(env(safe-area-inset-bottom,0px),24px)] flex items-center justify-center gap-6 max-w-lg mx-auto w-full">
        {/* Mute-Mic Button */}
        <button
          onClick={toggleMicMute}
          aria-label={micMuted ? 'Unmute microphone' : 'Mute microphone'}
          title={micMuted ? 'Unmute microphone' : 'Mute microphone'}
          className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all active:scale-95 cursor-pointer ${
            micMuted
              ? 'bg-rose-500/15 text-rose-400 border border-rose-500/40 hover:bg-rose-500/25'
              : 'bg-surface-2 text-text border border-border/70 hover:border-text-muted hover:bg-surface'
          }`}
        >
          {micMuted ? <MicOff className="w-6 h-6 text-rose-400" /> : <Mic className="w-6 h-6" />}
        </button>

        {/* Close (X) Button */}
        <button
          onClick={closeVoiceMode}
          aria-label="Close voice mode"
          title="Exit voice mode (Esc)"
          className="w-14 h-14 rounded-full bg-surface-2 border border-border/70 text-text-muted hover:text-text hover:bg-surface flex items-center justify-center shadow-lg transition-all active:scale-95 cursor-pointer"
        >
          <X className="w-6 h-6" />
        </button>
      </footer>
    </div>
  );
}
