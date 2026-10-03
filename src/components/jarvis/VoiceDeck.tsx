import { useState, useEffect } from 'react';
import { useJarvisStore } from '../../store/jarvisStore';
import { JarvisOrb, type JarvisOrbState } from './JarvisOrb';
import { VoiceDeckHeader } from './VoiceDeckHeader';
import { StatusText } from './StatusText';
import { TranscriptBox } from './TranscriptBox';
import { MicButton } from './MicButton';
import { QuickRefinementChips } from './QuickRefinementChips';
import { ContextBar } from './ContextBar';
import { jarvisVoice } from '../../services/jarvisVoice';
import { Copy, X, FileText, Check, Headphones } from 'lucide-react';

export function VoiceDeck() {
  const {
    isRecording,
    isTranscribing,
    isSpeaking,
    isHandsFree,
    transcript,
    statusMessage,
    isSubmitting,
    activePromptDocument,
    stopSpeaking,
    toggleRecording,
    copyPromptToClipboard,
    clearPrompt,
    submitCommand,
    lastCopiedAt,
  } = useJarvisStore();

  const [copiedRecently, setCopiedRecently] = useState(false);

  // Derive orb state from one source of truth (store voice state)
  const derivedOrbState: JarvisOrbState = isSpeaking
    ? 'speaking'
    : isRecording
    ? 'listening'
    : isSubmitting || isTranscribing
    ? 'thinking'
    : 'idle';

  const micAnalyser = jarvisVoice.getAnalyser();

  useEffect(() => {
    if (lastCopiedAt) {
      setCopiedRecently(true);
      const timer = setTimeout(() => setCopiedRecently(false), 2500);
      return () => clearTimeout(timer);
    }
  }, [lastCopiedAt]);

  const handleOrbToggle = () => {
    if (isSpeaking) {
      stopSpeaking();
      void toggleRecording();
    } else {
      void toggleRecording();
    }
  };

  const handleCopyPromptText = async (text: string) => {
    await copyPromptToClipboard(text);
  };

  return (
    <aside className="w-full md:w-[260px] shrink-0 bg-panel border-r border-border flex flex-col overflow-y-auto">
      <div className="p-4 space-y-4">
        <VoiceDeckHeader />

        {/* Centered Radial Waveform Orb */}
        <div className="flex flex-col items-center justify-center pt-1 pb-2">
          <JarvisOrb
            size={120}
            state={derivedOrbState}
            analyser={micAnalyser}
            onClick={handleOrbToggle}
          />
          <div className="mt-2.5 w-full">
            <StatusText text={statusMessage} />
          </div>
        </div>

        {/* Live transcript directly under the orb */}
        <TranscriptBox transcript={transcript} />

        {/* Mic control button */}
        <MicButton
          isRecording={isRecording}
          isDisabled={isSubmitting || isTranscribing}
          isSpeaking={isSpeaking}
          onToggle={toggleRecording}
          onStopSpeaking={stopSpeaking}
        />

        {/* Hands-Free ambient status hint */}
        {isHandsFree && !isRecording && (
          <div className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-accent/10 border border-accent/30 text-accent text-[11px] font-mono animate-pulse">
            <Headphones className="w-3.5 h-3.5 shrink-0" />
            <span>Say "Hey Jarvis" to speak</span>
          </div>
        )}

        {/* Quick Refinement Chips */}
        <QuickRefinementChips onRefinement={(text) => submitCommand(text)} />

        {/* Active Context-Engineered Prompt Card (if present) */}
        {activePromptDocument && (
          <div className="bg-surface rounded-[8px] border border-border p-3 mt-2 space-y-2 relative group transition-all duration-300">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-accent font-mono">
                <FileText className="w-3.5 h-3.5" />
                Prompt
              </span>

              <div className="flex items-center gap-1.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={() => handleCopyPromptText(activePromptDocument)}
                  className="flex items-center gap-1 px-2 py-1 rounded bg-bg border border-border text-[10px] font-medium text-text-secondary hover:text-text transition-colors"
                >
                  {copiedRecently ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedRecently ? 'Copied' : 'Copy'}</span>
                </button>

                <button
                  type="button"
                  onClick={clearPrompt}
                  className="p-1 rounded hover:bg-surface-2 text-text-muted hover:text-text transition-colors"
                  title="Dismiss prompt"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="text-[11px] text-text-secondary font-mono line-clamp-3 bg-bg p-2 rounded border border-border overflow-hidden">
              {activePromptDocument}
            </div>
          </div>
        )}

        {/* Context Bar */}
        <ContextBar />
      </div>
    </aside>
  );
}
