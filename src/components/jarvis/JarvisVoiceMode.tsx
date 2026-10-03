import { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Mic, MicOff, X } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useJarvisStore } from '../../store/jarvisStore';
import { JarvisOrb } from './JarvisOrb';
import { JarvisProposalRenderer } from './JarvisProposalRenderer';

export function JarvisVoiceMode() {
  const {
    voiceModeOpen,
    micMuted,
    orbState,
    transcript,
    isSubmitting,
    isTranscribing,
    isSpeaking,
    activeProposal,
    approveProposal,
    rejectProposal,
    closeVoiceMode,
    toggleMicMute,
    stopSpeaking,
    toggleRecording,
  } = useJarvisStore(
    useShallow((s) => ({
      voiceModeOpen: s.voiceModeOpen,
      micMuted: s.micMuted,
      orbState: s.orbState,
      transcript: s.transcript,
      isSubmitting: s.isSubmitting,
      isTranscribing: s.isTranscribing,
      isSpeaking: s.isSpeaking,
      activeProposal: s.activeProposal,
      approveProposal: s.approveProposal,
      rejectProposal: s.rejectProposal,
      closeVoiceMode: s.closeVoiceMode,
      toggleMicMute: s.toggleMicMute,
      stopSpeaking: s.stopSpeaking,
      toggleRecording: s.toggleRecording,
    }))
  );

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
    if (orbState === 'speaking' || isSpeaking) return 'Speaking · Tap to interrupt';
    return 'Ready · Tap to speak';
  }, [micMuted, orbState, isSubmitting, isTranscribing, isSpeaking]);

  // Derived live caption in larger text (Clean & voice-only: never mixes in long assistant paragraphs)
  const captionText = useMemo(() => {
    if (micMuted) {
      return 'Microphone is muted. Tap the mic button to speak.';
    }
    if (orbState === 'listening') {
      return transcript || 'Listening to you...';
    }
    if (orbState === 'thinking' || isSubmitting || isTranscribing) {
      return 'Thinking...';
    }
    if (orbState === 'speaking' || isSpeaking) {
      return 'Jarvis is answering...';
    }
    return transcript || 'Tap the orb to speak';
  }, [micMuted, orbState, isSubmitting, isTranscribing, isSpeaking, transcript]);

  // Tap orb interaction (Interrupts speech and starts listening immediately)
  const handleOrbClick = () => {
    if (isSpeaking) {
      stopSpeaking();
      void toggleRecording();
    } else {
      void toggleRecording();
    }
  };

  if (!voiceModeOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Jarvis Voice Mode"
      className="fixed inset-0 z-[9999] bg-[#0B0B0C] flex flex-col justify-between p-4 sm:p-6 pointer-events-auto touch-manipulation animate-in fade-in duration-150"
    >
      {/* ── Top Bar with Title, Review Badge and Close (X) Button ────── */}
      <header className="pt-[max(env(safe-area-inset-top,0px),8px)] w-full flex items-center justify-between max-w-lg mx-auto shrink-0 relative z-20">
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-widest font-semibold text-text-muted/60">
            Jarvis Voice
          </span>
          {micMuted && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 font-medium">
              Muted
            </span>
          )}
          {activeProposal && (
            <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-accent/15 text-accent border border-accent/30 font-medium animate-pulse">
              Action Review
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={closeVoiceMode}
          aria-label="Close voice mode"
          title="Close voice mode (Esc)"
          className="p-3 min-w-[48px] min-h-[48px] flex items-center justify-center rounded-full text-text-muted hover:text-text hover:bg-surface-2 transition-colors cursor-pointer touch-manipulation active:scale-95"
        >
          <X className="w-5 h-5" />
        </button>
      </header>

      {/* ── Center Stage: Dynamic Orb + Proposal Card / Live Caption ─── */}
      <main
        className={`flex flex-col items-center text-center max-w-lg mx-auto w-full px-2 transition-all duration-300 ease-out relative z-10 ${
          activeProposal ? 'flex-1 min-h-0 my-1 justify-start' : 'my-auto py-2 space-y-7 justify-center'
        }`}
      >
        {/* Dynamic Orb: 68px at the top when a proposal card is active, 190px when standalone */}
        <div className="relative py-1 shrink-0 transition-all duration-300 ease-out">
          <JarvisOrb
            size={activeProposal ? 68 : 190}
            state={micMuted ? 'idle' : orbState}
            onClick={handleOrbClick}
            className="cursor-pointer transition-transform duration-300 touch-manipulation"
          />
        </div>

        {/* Quiet Status Label */}
        <div className="text-xs uppercase tracking-[0.2em] font-medium text-text-muted shrink-0 transition-colors duration-200">
          {activeProposal ? 'Review Action Before Execution' : statusLabel}
        </div>

        {/* Active Proposal Card (Interactive Multimodal Voice Canvas) */}
        {activeProposal ? (
          <div className="w-full flex-1 min-h-0 overflow-y-auto px-1 py-1 my-1 text-left animate-in fade-in duration-150 relative z-20">
            <JarvisProposalRenderer
              proposal={activeProposal}
              onApprove={approveProposal}
              onReject={rejectProposal}
              isSubmitting={isSubmitting}
            />
          </div>
        ) : (
          /* Live Caption in Larger Text */
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
        )}
      </main>

      {/* ── Bottom Controls: Mute & Close Buttons ────────────────────── */}
      <footer
        className={`pb-[max(env(safe-area-inset-bottom,0px),20px)] flex items-center justify-center gap-6 max-w-lg mx-auto w-full shrink-0 relative z-20 ${
          activeProposal ? 'pt-1' : ''
        }`}
      >
        {/* Mute-Mic Button */}
        <button
          type="button"
          onClick={toggleMicMute}
          aria-label={micMuted ? 'Unmute microphone' : 'Mute microphone'}
          title={micMuted ? 'Unmute microphone' : 'Mute microphone'}
          className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all active:scale-95 cursor-pointer touch-manipulation ${
            micMuted
              ? 'bg-rose-500/15 text-rose-400 border border-rose-500/40 hover:bg-rose-500/25'
              : 'bg-surface-2 text-text border border-border/70 hover:border-text-muted hover:bg-surface'
          }`}
        >
          {micMuted ? <MicOff className="w-6 h-6 text-rose-400" /> : <Mic className="w-6 h-6" />}
        </button>

        {/* Close (X) Button */}
        <button
          type="button"
          onClick={closeVoiceMode}
          aria-label="Close voice mode"
          title="Exit voice mode (Esc)"
          className="w-14 h-14 rounded-full bg-surface-2 border border-border/70 text-text-muted hover:text-text hover:bg-surface flex items-center justify-center shadow-lg transition-all active:scale-95 cursor-pointer touch-manipulation"
        >
          <X className="w-6 h-6" />
        </button>
      </footer>
    </div>,
    document.body
  );
}
