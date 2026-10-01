import { useRef, useEffect, useState } from 'react';
import { useJarvisStore } from '../../store/jarvisStore';
import { useAssistantStore } from '../../store/assistantStore';
import { StreamHeader } from './StreamHeader';
import { UserMessage } from './UserMessage';
import { JarvisAnswer } from './JarvisAnswer';
import { InstantActionRow } from './InstantActionRow';
import { SystemStatusRow } from './SystemStatusRow';
import { EmptySuggestions } from './EmptySuggestions';
import { Composer } from './Composer';
import { JarvisProposalRenderer } from './JarvisProposalRenderer';

export function ConversationStream() {
  const {
    activeProposal,
    isWebSearchEnabled,
    isSubmitting,
    isSpeaking,
    isRecording,
    isTranscribing,
    transcript,
    stopSpeaking,
    toggleRecording,
    toggleWebSearch,
    approveProposal,
    rejectProposal,
    submitCommand,
    copyPromptToClipboard,
    lastCopiedAt
  } = useJarvisStore();

  const {
    messages,
    isSending,
    startNewConversation
  } = useAssistantStore();

  const [inputVal, setInputVal] = useState('');
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Sync transcript into inputVal
  useEffect(() => {
    if (transcript) {
      setInputVal((prev) => (prev ? `${prev} ${transcript}` : transcript));
    }
  }, [transcript]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, isSending, isSubmitting, activeProposal]);

  const handleSubmit = () => {
    if (!inputVal.trim()) return;
    if (isSpeaking) {
      stopSpeaking();
    }
    submitCommand(inputVal.trim());
    setInputVal('');
  };

  const handleMicClick = () => {
    if (isSpeaking) {
      stopSpeaking();
    }
    toggleRecording();
  };

  const formatTime = (dateStr?: string | Date) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const checkHasContext = (content: string) => {
    return content.includes('Pasted Content') || content.includes('Logs');
  };

  const isSystemBusy = isSending || isSubmitting;

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-bg">
      <StreamHeader
        messageCount={messages.length}
        isWebSearchEnabled={isWebSearchEnabled}
        onToggleWebSearch={toggleWebSearch}
        onNewSession={startNewConversation}
      />

      <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-5 space-y-4 min-h-0">
        {messages.length === 0 ? (
          <EmptySuggestions onSuggestionClick={(text) => submitCommand(text)} />
        ) : (
          <>
            {messages.map((msg) => {
              if (msg.role === 'user') {
                return (
                  <UserMessage
                    key={msg.id}
                    content={msg.content}
                    timestamp={formatTime(msg.createdAt)}
                    hasContext={checkHasContext(msg.content)}
                  />
                );
              }

              if (msg.role === 'assistant') {
                const autoExecutedProposals = msg.proposals?.filter(
                  (p) => p.status === 'auto_executed' || p.status === 'undone'
                ) || [];

                return (
                  <div key={msg.id} className="space-y-3">
                    {autoExecutedProposals.map((proposal) => (
                      <InstantActionRow
                        key={proposal.id}
                        proposal={proposal}
                        messageId={msg.id}
                      />
                    ))}
                    {msg.content && (
                      <JarvisAnswer
                        content={msg.content}
                        timestamp={formatTime(msg.createdAt)}
                        searchSources={msg.searchSources}
                        engineeredPrompt={msg.engineeredPrompt}
                        onCopyPrompt={copyPromptToClipboard}
                        isCopied={lastCopiedAt ? Date.now() - lastCopiedAt < 2000 : false}
                      />
                    )}
                  </div>
                );
              }

              return null;
            })}

            {activeProposal && (
              <div className="max-w-4xl bg-surface rounded-[12px] border border-border p-4 mt-4">
                <JarvisProposalRenderer
                  proposal={activeProposal}
                  onApprove={approveProposal}
                  onReject={rejectProposal}
                />
              </div>
            )}

            {isSystemBusy && (
              <SystemStatusRow text="Jarvis is thinking…" />
            )}
          </>
        )}
      </div>

      <Composer
        value={inputVal}
        onChange={setInputVal}
        onSubmit={handleSubmit}
        onMicClick={handleMicClick}
        isDisabled={isSystemBusy || isTranscribing}
        isRecording={isRecording}
      />
    </div>
  );
}
