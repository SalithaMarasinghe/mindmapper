import { useState, useEffect } from 'react';
import { useJarvisStore } from '../../store/jarvisStore';
import { JarvisOrb } from './JarvisOrb';
import { VoiceDeckHeader } from './VoiceDeckHeader';
import { Waveform } from './Waveform';
import { StatusText } from './StatusText';
import { TranscriptBox } from './TranscriptBox';
import { MicButton } from './MicButton';
import { QuickRefinementChips } from './QuickRefinementChips';
import { ContextBar } from './ContextBar';
import { Copy, X, FileText, Check } from 'lucide-react';

export function VoiceDeck() {
  const {
    isRecording,
    isTranscribing,
    isSpeaking,
    orbState,
    audioLevel,
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

  useEffect(() => {
    if (lastCopiedAt) {
      setCopiedRecently(true);
      const timer = setTimeout(() => setCopiedRecently(false), 2500);
      return () => clearTimeout(timer);
    }
  }, [lastCopiedAt]);

  const handleOrbClick = () => {
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

        <div className="flex flex-col items-center gap-3 py-2">
          <button
            onClick={handleOrbClick}
            className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-accent"
            title={isSpeaking ? 'Interrupt' : 'Toggle recording'}
          >
            <JarvisOrb size={58} state={orbState} audioLevel={audioLevel} glow={false} />
          </button>

          <Waveform
            isActive={isRecording}
            isThinking={isSubmitting || isTranscribing}
            analyserNode={null}
            audioLevel={audioLevel}
          />
          
          <StatusText text={statusMessage} />
        </div>

        <TranscriptBox transcript={transcript} />

        <MicButton
          isRecording={isRecording}
          isDisabled={isSubmitting || isTranscribing}
          isSpeaking={isSpeaking}
          onToggle={toggleRecording}
          onStopSpeaking={stopSpeaking}
        />

        <QuickRefinementChips onRefinement={(text) => submitCommand(text)} />

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

        <ContextBar />
      </div>
    </aside>
  );
}
