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
import { JarvisVoiceMode } from './JarvisVoiceMode';

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
    startNewConversation,
    fetchConversations
  } = useAssistantStore();

  const [inputVal, setInputVal] = useState('');
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Fetch initial conversations on mount
  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

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

  const handleAttachFile = async (file: File) => {
    try {
      if (file.type.startsWith('image/')) {
        setInputVal((prev) => (prev ? `${prev} [Attached Image: ${file.name}]` : `[Attached Image: ${file.name}]`));
      } else {
        const text = await file.text();
        setInputVal((prev) => (prev ? `${prev}\n\n[Attached: ${file.name}]\n${text}` : `[Attached: ${file.name}]\n${text}`));
      }
    } catch (err) {
      console.warn('File attach error:', err);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-bg relative">
      <StreamHeader
        messageCount={messages.length}
        isWebSearchEnabled={isWebSearchEnabled}
        onToggleWebSearch={toggleWebSearch}
        onNewSession={startNewConversation}
      />

      <div ref={chatScrollRef} className="flex-1 overflow-y-auto px-4 md:px-6 py-6 min-h-0">
        <div className="max-w-[720px] mx-auto w-full space-y-6 pb-28">
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
                  const msgProposals = msg.proposals || [];
                  const executedProposals = msgProposals.filter(
                    (p) => p.status === 'auto_executed' || p.status === 'approved' || p.status === 'undone'
                  );
                  const hasActivePending = Boolean(
                    activeProposal && msgProposals.some((p) => p.id === activeProposal.id)
                  );

                  return (
                    <div key={msg.id} className="space-y-4">
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

                      {/* Pending proposal card waiting for user review & approval */}
                      {hasActivePending && activeProposal && (
                        <div className="w-full bg-surface rounded-[12px] border border-border/60 p-4 mt-2 shadow-sm">
                          <JarvisProposalRenderer
                            proposal={activeProposal}
                            onApprove={approveProposal}
                            onReject={rejectProposal}
                          />
                        </div>
                      )}

                      {/* Executed / approved / undone actions */}
                      {executedProposals.map((proposal) => (
                        <InstantActionRow
                          key={proposal.id}
                          proposal={proposal}
                          messageId={msg.id}
                        />
                      ))}
                    </div>
                  );
                }

                return null;
              })}

              {/* Fallback for orphan active proposal not attached to any message */}
              {activeProposal &&
                !messages.some((m) => m.proposals?.some((p) => p.id === activeProposal.id)) && (
                  <div className="w-full bg-surface rounded-[12px] border border-border/60 p-4 mt-4 shadow-sm">
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
      </div>

      <Composer
        value={inputVal}
        onChange={setInputVal}
        onSubmit={handleSubmit}
        onMicClick={handleMicClick}
        isDisabled={isSystemBusy || isTranscribing}
        isRecording={isRecording}
        isSpeaking={isSpeaking}
        placeholder="Ask Jarvis..."
        onAttach={handleAttachFile}
      />

      {/* ── Full-Screen Voice Mode Overlay ── */}
      <JarvisVoiceMode />
    </div>
  );
}
