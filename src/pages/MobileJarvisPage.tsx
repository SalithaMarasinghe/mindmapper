import { useRef, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Globe,
  Plus,
  Monitor,
  Mic,
  MicOff,
  Send,
  VolumeX,
  Sparkles,
  Settings,
  LogOut
} from 'lucide-react';
import { useJarvisStore } from '../store/jarvisStore';
import { useAssistantStore } from '../store/assistantStore';
import { useAuthStore } from '../store/authStore';
import { JarvisOrb } from '../components/jarvis/JarvisOrb';
import { Waveform } from '../components/jarvis/Waveform';
import { TranscriptBox } from '../components/jarvis/TranscriptBox';
import { UserMessage } from '../components/jarvis/UserMessage';
import { JarvisAnswer } from '../components/jarvis/JarvisAnswer';
import { InstantActionRow } from '../components/jarvis/InstantActionRow';
import { SystemStatusRow } from '../components/jarvis/SystemStatusRow';
import { JarvisProposalRenderer } from '../components/jarvis/JarvisProposalRenderer';
import { ActiveProjectSelector } from '../components/layout/ActiveProjectSelector';

export function MobileJarvisPage() {
  const {
    activeProposal,
    isWebSearchEnabled,
    isSubmitting,
    isSpeaking,
    isRecording,
    isTranscribing,
    transcript,
    orbState,
    audioLevel,
    statusMessage,
    stopSpeaking,
    toggleRecording,
    toggleWebSearch,
    approveProposal,
    rejectProposal,
    submitCommand,
    copyPromptToClipboard,
    lastCopiedAt,
  } = useJarvisStore();

  const {
    messages,
    isSending,
    startNewConversation,
    fetchConversations,
  } = useAssistantStore();

  const { profile, user, signOut } = useAuthStore();

  const [inputVal, setInputVal] = useState('');
  const [profileOpen, setProfileOpen] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Fetch initial conversations on mount
  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Sync speech transcript into inputVal
  useEffect(() => {
    if (transcript) {
      setInputVal((prev) => (prev ? `${prev} ${transcript}` : transcript));
    }
  }, [transcript]);

  // Auto-scroll to bottom of conversation
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
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
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
  const initial = profile?.displayName?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? 'U';

  const quickPrompts = [
    {
      title: 'WhatsApp Meeting',
      prompt: 'I just had a 15-minute call via WhatsApp with my supervisor regarding RAG implementation. We agreed to investigate the codebase and add 2 tasks for tomorrow: analyze chunking pipeline and benchmark retrieval latency.',
    },
    {
      title: 'Vector Search Q&A',
      prompt: 'Explain the architectural differences between HNSW graphs and IVF indexes in vector retrieval.',
    },
    {
      title: 'Weather Check',
      prompt: "What is the weather forecast for today in my area?",
    },
    {
      title: 'Review Action Items',
      prompt: 'Summarize my high priority tasks on the board today.',
    },
  ];

  return (
    <div className="fixed inset-0 w-full flex flex-col bg-bg text-text overflow-hidden select-none">
      
      {/* ── Top Mobile Bar ────────────────────────────────────────────── */}
      <header className="pt-[max(env(safe-area-inset-top,0px),12px)] pb-2.5 px-3 border-b border-border bg-panel shrink-0 flex items-center justify-between z-30">
        <div className="flex items-center gap-2">
          <Link
            to="/dashboard"
            onClick={() => sessionStorage.setItem('prefer_desktop', 'true')}
            className="flex items-center gap-1.5 font-bold text-accent text-base tracking-tight shrink-0"
            title="Switch to Desktop View"
          >
            <span>🧠</span> Jarvis
          </Link>

          {/* Active Focus Project Selector (Compact Pill) */}
          <div className="ml-1">
            <ActiveProjectSelector compact />
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Web Search Toggle Pill */}
          <button
            onClick={toggleWebSearch}
            aria-label="Toggle web search"
            className={`px-2 py-1 rounded-full text-[11px] border transition-colors flex items-center gap-1 ${
              isWebSearchEnabled
                ? 'bg-surface-2 text-accent border-accent/40 font-medium'
                : 'bg-surface text-text-muted border-border hover:text-text-secondary'
            }`}
            title="Toggle Live Web Search"
          >
            <Globe className="w-3 h-3" />
            <span className="hidden xs:inline">Search</span>
          </button>

          {/* New Session Button */}
          {messages.length > 0 && (
            <button
              onClick={startNewConversation}
              className="p-1.5 rounded-[8px] text-text-muted hover:text-text hover:bg-surface transition-colors"
              title="New Conversation Session"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}

          {/* Desktop Dashboard Switch Link */}
          <Link
            to="/dashboard"
            onClick={() => sessionStorage.setItem('prefer_desktop', 'true')}
            className="p-1.5 rounded-[8px] text-text-muted hover:text-text hover:bg-surface transition-colors"
            title="Desktop Dashboard"
          >
            <Monitor className="w-4 h-4" />
          </Link>

          {/* Avatar Profile Dropdown */}
          <div className="relative">
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className="flex items-center p-0.5 rounded-full hover:bg-surface transition-colors"
            >
              <div className="h-6 w-6 rounded-full bg-accent text-bg font-semibold text-xs flex items-center justify-center">
                {initial}
              </div>
            </button>

            {profileOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
                <div className="absolute right-0 mt-2 w-44 bg-panel rounded-[10px] shadow-2xl border border-border py-1.5 z-50 text-xs">
                  <div className="px-3 py-1.5 border-b border-border/50 text-text-muted truncate">
                    {user?.email}
                  </div>
                  <Link
                    to="/settings"
                    onClick={() => setProfileOpen(false)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-text-secondary hover:bg-surface hover:text-text transition-colors"
                  >
                    <Settings className="h-3.5 w-3.5 text-text-muted" /> Settings
                  </Link>
                  <button
                    onClick={() => {
                      setProfileOpen(false);
                      signOut();
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-text-secondary hover:bg-surface hover:text-text transition-colors"
                  >
                    <LogOut className="h-3.5 w-3.5 text-text-muted" /> Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── Active Compact Voice Banner (When Messages Exist) ─────────── */}
      {messages.length > 0 && (
        <div className="border-b border-border bg-panel/60 px-3 py-2 shrink-0 flex items-center justify-between gap-3">
          <div
            onClick={handleMicClick}
            className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0"
          >
            <div className="shrink-0 relative">
              <JarvisOrb size={44} state={orbState} audioLevel={audioLevel} glow={false} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-text truncate flex items-center gap-1.5">
                {isRecording ? (
                  <span className="text-accent animate-pulse">● Listening to you...</span>
                ) : isSpeaking ? (
                  <span className="text-accent flex items-center gap-1">
                    <VolumeX className="w-3 h-3" /> Speaking (tap to mute)
                  </span>
                ) : isSystemBusy ? (
                  <span className="text-text-secondary">Jarvis is thinking...</span>
                ) : (
                  <span className="text-text-secondary">Jarvis Active · Tap orb to speak</span>
                )}
              </div>
              <div className="h-4 flex items-center mt-0.5">
                <Waveform
                  barCount={20}
                  isActive={isRecording}
                  isThinking={isSystemBusy || isTranscribing}
                  analyserNode={null}
                  audioLevel={audioLevel}
                />
              </div>
            </div>
          </div>

          <button
            onClick={handleMicClick}
            className={`p-2 rounded-full shrink-0 transition-all ${
              isRecording
                ? 'bg-accent text-bg scale-105'
                : isSpeaking
                ? 'bg-surface-2 text-text border border-border'
                : 'bg-surface text-text-muted hover:text-text'
            }`}
            aria-label="Voice input"
          >
            {isRecording ? <MicOff className="w-4 h-4" /> : isSpeaking ? <VolumeX className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
        </div>
      )}

      {/* ── Interim Speech Transcript Banner ──────────────────────────── */}
      {transcript && isRecording && (
        <div className="bg-surface border-b border-border px-4 py-2 shrink-0 animate-in fade-in">
          <TranscriptBox transcript={transcript} />
        </div>
      )}

      {/* ── Main Scroll Area: Hero Orb OR Message Feed ────────────────── */}
      <div ref={chatScrollRef} className="flex-1 overflow-y-auto min-h-0 p-3.5 space-y-4">
        {messages.length === 0 ? (
          // ── Hero Orb Landing (Zero Messages) ────────────────────────
          <div className="h-full flex flex-col items-center justify-center text-center px-4 py-6 max-w-md mx-auto">
            <div
              onClick={handleMicClick}
              className="cursor-pointer group flex flex-col items-center my-auto"
            >
              <div className="relative p-2 rounded-full group-active:scale-95 transition-transform duration-200">
                <JarvisOrb size={96} state={orbState} audioLevel={audioLevel} glow={false} />
              </div>

              <div className="mt-4 h-6 flex items-center justify-center">
                <Waveform
                  barCount={28}
                  isActive={isRecording}
                  isThinking={isSystemBusy || isTranscribing}
                  analyserNode={null}
                  audioLevel={audioLevel}
                />
              </div>

              <div className="mt-3">
                <span className={`text-sm font-medium ${isRecording ? 'text-accent animate-pulse' : 'text-text'}`}>
                  {isRecording ? 'Listening to voice...' : isSpeaking ? 'Jarvis speaking (tap to mute)' : statusMessage || 'Tap orb or mic to speak'}
                </span>
                <p className="text-xs text-text-muted mt-1">
                  Log WhatsApp calls, review action items, or ask questions
                </p>
              </div>
            </div>

            {/* Quick Suggestion Chips */}
            <div className="w-full mt-6 space-y-2 text-left">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted flex items-center gap-1 px-1">
                <Sparkles className="w-3 h-3 text-accent" /> Quick Prompts
              </span>
              <div className="grid grid-cols-1 gap-2">
                {quickPrompts.map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => submitCommand(q.prompt)}
                    className="p-2.5 rounded-[10px] bg-surface hover:bg-surface-2 border border-border text-left text-xs transition-colors cursor-pointer group"
                  >
                    <div className="font-medium text-text group-hover:text-accent transition-colors">
                      {q.title}
                    </div>
                    <div className="text-[11px] text-text-muted truncate mt-0.5">
                      {q.prompt}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          // ── Conversation & Action Cards Stream ──────────────────────
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
                  <div key={msg.id} className="space-y-3">
                    {msg.content && (
                      <div className="bg-panel/40 rounded-[12px] p-3 border border-border/40">
                        <JarvisAnswer
                          content={msg.content}
                          timestamp={formatTime(msg.createdAt)}
                          searchSources={msg.searchSources}
                          engineeredPrompt={msg.engineeredPrompt}
                          onCopyPrompt={copyPromptToClipboard}
                          isCopied={lastCopiedAt ? Date.now() - lastCopiedAt < 2000 : false}
                        />
                      </div>
                    )}

                    {/* Pending Action Review Proposal Card (1-Tap Thumb Approvals) */}
                    {hasActivePending && activeProposal && (
                      <div className="bg-surface rounded-[14px] border-2 border-accent/40 p-4 shadow-xl animate-in zoom-in-95 duration-200">
                        <JarvisProposalRenderer
                          proposal={activeProposal}
                          onApprove={approveProposal}
                          onReject={rejectProposal}
                        />
                      </div>
                    )}

                    {/* Executed / approved actions */}
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

            {/* Fallback for orphan active proposal */}
            {activeProposal &&
              !messages.some((m) => m.proposals?.some((p) => p.id === activeProposal.id)) && (
                <div className="bg-surface rounded-[14px] border-2 border-accent/40 p-4 shadow-xl">
                  <JarvisProposalRenderer
                    proposal={activeProposal}
                    onApprove={approveProposal}
                    onReject={rejectProposal}
                  />
                </div>
              )}

            {isSystemBusy && <SystemStatusRow text="Jarvis is thinking…" />}
          </>
        )}
      </div>

      {/* ── Fixed Bottom Composer Dock (Touch & Thumb Optimized) ─────── */}
      <footer className="bg-panel border-t border-border px-3 pt-2 pb-[max(env(safe-area-inset-bottom,0px),8px)] shrink-0 z-30">
        <div className="bg-surface rounded-[20px] border border-border flex items-end px-2.5 py-1.5 gap-2 focus-within:border-accent/50 transition-colors">
          
          {/* Large Mic Toggle Button */}
          <button
            onClick={handleMicClick}
            disabled={isSystemBusy || isTranscribing}
            className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 transition-all ${
              isRecording
                ? 'bg-accent text-bg animate-pulse scale-105 shadow-md'
                : isSpeaking
                ? 'bg-surface-2 text-text border border-border'
                : 'text-text-muted hover:text-text hover:bg-surface-2'
            }`}
            aria-label={isRecording ? 'Stop recording' : 'Start voice input'}
          >
            {isRecording ? <MicOff className="w-4 h-4" /> : isSpeaking ? <VolumeX className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          {/* Textarea: 16px font size to prevent iOS Safari auto-zoom! */}
          <textarea
            ref={textareaRef}
            rows={1}
            value={inputVal}
            onChange={(e) => {
              setInputVal(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = `${Math.min(e.target.scrollHeight, 110)}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder={isRecording ? 'Listening to voice...' : 'Speak or type to Jarvis...'}
            className="flex-1 bg-transparent text-[16px] text-text placeholder:text-text-muted resize-none focus:outline-none min-h-[24px] max-h-[110px] leading-relaxed py-1"
          />

          {/* Send Button */}
          <button
            onClick={handleSubmit}
            disabled={!inputVal.trim() || isSystemBusy}
            className="h-9 w-9 rounded-full bg-white text-[#0B0B0C] flex items-center justify-center shrink-0 disabled:opacity-20 hover:bg-white/90 active:scale-95 transition-all cursor-pointer"
            aria-label="Send message"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </footer>
    </div>
  );
}
