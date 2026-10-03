import { useRef, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Globe,
  Plus,
  Monitor,
  Sparkles,
  Settings,
  LogOut,
  Headphones,
  Loader2,
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
import { Composer } from '../components/jarvis/Composer';
import { JarvisVoiceMode } from '../components/jarvis/JarvisVoiceMode';

export function MobileJarvisPage() {
  const {
    activeProposal,
    isWebSearchEnabled,
    isSubmitting,
    isSpeaking,
    isRecording,
    isTranscribing,
    isHandsFree,
    isWakeWordLoading,
    transcript,
    orbState,
    audioLevel,
    statusMessage,
    stopSpeaking,
    toggleRecording,
    toggleHandsFree,
    toggleWebSearch,
    approveProposal,
    rejectProposal,
    submitCommand,
    copyPromptToClipboard,
    lastCopiedAt,
    toggleVoiceMode,
  } = useJarvisStore();

  const {
    messages,
    isSending,
    startNewConversation,
    fetchConversations,
  } = useAssistantStore();

  const { user, signOut } = useAuthStore();

  const [inputVal, setInputVal] = useState('');
  const [profileOpen, setProfileOpen] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Fetch initial conversations on mount
  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);


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
  };

  const handleMicClick = () => {
    if (isSpeaking) {
      stopSpeaking();
    }
    toggleRecording();
  };

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
    <div className="h-full w-full flex flex-col bg-bg text-text overflow-hidden select-none">
      
      {/* ── Slim Minimal Header ────────────────────────────────────────── */}
      <header className="pt-[max(env(safe-area-inset-top,0px),8px)] pb-2 px-4 border-b border-border/20 bg-bg/85 backdrop-blur-md shrink-0 flex items-center justify-between z-30">
        {/* Left: Jarvis Wordmark + Minimal Project Selector */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Link
            to="/dashboard"
            onClick={() => sessionStorage.setItem('prefer_desktop', 'true')}
            className="font-semibold text-text text-sm tracking-tight shrink-0 hover:opacity-80 transition-opacity"
            title="Switch to Desktop View"
          >
            Jarvis
          </Link>
          <span className="text-text-muted/30 text-xs select-none">/</span>
          <ActiveProjectSelector compact variant="minimal" />
        </div>

        {/* Center: Small Orb (42px) */}
        <div className="flex items-center justify-center shrink-0">
          <JarvisOrb
            size={42}
            state={orbState}
            audioLevel={audioLevel}
            onClick={toggleVoiceMode}
          />
        </div>

        {/* Right: Single Settings Icon Button & Relocated Controls */}
        <div className="relative flex items-center justify-end flex-1 min-w-0">
          <button
            onClick={() => setProfileOpen(!profileOpen)}
            aria-label="Settings and actions"
            className={`p-2 rounded-full transition-colors cursor-pointer ${
              profileOpen
                ? 'bg-surface-2 text-text'
                : 'text-text-muted hover:text-text hover:bg-surface-2'
            }`}
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* Settings Popover Dropdown */}
          {profileOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
              <div className="absolute right-0 top-full mt-2 w-64 bg-surface border border-border/80 rounded-[12px] shadow-2xl p-2 z-50 text-xs animate-in fade-in zoom-in-95 duration-150">
                {/* User email & Hands-free indicator */}
                <div className="px-3 py-2 border-b border-border/40 text-text-muted truncate flex items-center justify-between">
                  <span className="truncate">{user?.email || 'Logged In'}</span>
                  {isHandsFree && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-accent bg-accent/10 px-1.5 py-0.5 rounded-full font-medium">
                      <Headphones className="w-2.5 h-2.5" /> Hands-Free
                    </span>
                  )}
                </div>

                {/* Relocated actions */}
                <div className="py-1.5 space-y-1">
                  {/* Hands-Free Wake-Word Toggle */}
                  <button
                    onClick={() => void toggleHandsFree()}
                    disabled={isWakeWordLoading}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-[8px] hover:bg-surface-2 transition-colors cursor-pointer text-text-secondary hover:text-text"
                  >
                    <div className="flex items-center gap-2">
                      {isWakeWordLoading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" />
                      ) : (
                        <Headphones className={`w-3.5 h-3.5 ${isHandsFree ? 'text-accent' : 'text-text-muted'}`} />
                      )}
                      <span>Hands-Free ('Hey Jarvis')</span>
                    </div>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isHandsFree ? 'bg-accent/20 text-accent font-medium' : 'text-text-muted'}`}>
                      {isWakeWordLoading ? '...' : isHandsFree ? 'ON' : 'OFF'}
                    </span>
                  </button>

                  {/* Web Search Toggle */}
                  <button
                    onClick={toggleWebSearch}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-[8px] hover:bg-surface-2 transition-colors cursor-pointer text-text-secondary hover:text-text"
                  >
                    <div className="flex items-center gap-2">
                      <Globe className={`w-3.5 h-3.5 ${isWebSearchEnabled ? 'text-accent' : 'text-text-muted'}`} />
                      <span>Live Web Search</span>
                    </div>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isWebSearchEnabled ? 'bg-accent/20 text-accent font-medium' : 'text-text-muted'}`}>
                      {isWebSearchEnabled ? 'ON' : 'OFF'}
                    </span>
                  </button>

                  {/* New Conversation Session */}
                  <button
                    onClick={() => {
                      setProfileOpen(false);
                      startNewConversation();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-[8px] hover:bg-surface-2 transition-colors cursor-pointer text-text-secondary hover:text-text"
                  >
                    <Plus className="w-3.5 h-3.5 text-text-muted" />
                    <span>New Session</span>
                  </button>

                  {/* Switch to Desktop Dashboard */}
                  <Link
                    to="/dashboard"
                    onClick={() => {
                      setProfileOpen(false);
                      sessionStorage.setItem('prefer_desktop', 'true');
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-[8px] hover:bg-surface-2 transition-colors cursor-pointer text-text-secondary hover:text-text"
                  >
                    <Monitor className="w-3.5 h-3.5 text-text-muted" />
                    <span>Desktop Dashboard</span>
                  </Link>

                  {/* Settings Page */}
                  <Link
                    to="/settings"
                    onClick={() => setProfileOpen(false)}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-[8px] hover:bg-surface-2 transition-colors cursor-pointer text-text-secondary hover:text-text"
                  >
                    <Settings className="w-3.5 h-3.5 text-text-muted" />
                    <span>Settings</span>
                  </Link>

                  {/* Sign Out */}
                  <div className="pt-1 border-t border-border/40">
                    <button
                      onClick={() => {
                        setProfileOpen(false);
                        signOut();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-[8px] hover:bg-rose-500/10 text-text-muted hover:text-rose-400 transition-colors cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign out</span>
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </header>

      {/* ── Interim Speech Transcript Banner ──────────────────────────── */}
      {transcript && isRecording && (
        <div className="bg-surface border-b border-border px-4 py-2 shrink-0 animate-in fade-in">
          <TranscriptBox transcript={transcript} />
        </div>
      )}

      {/* ── Main Scroll Area: Hero Orb OR Message Feed ────────────────── */}
      <div ref={chatScrollRef} className="flex-1 overflow-y-auto min-h-0 px-4 md:px-6 py-6">
        <div className="max-w-[720px] mx-auto w-full space-y-6 pb-28">
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
                <span className={`text-sm font-medium ${isRecording ? 'text-accent animate-pulse' : isHandsFree ? 'text-accent' : 'text-text'}`}>
                  {isRecording
                    ? 'Listening to voice...'
                    : isSpeaking
                    ? 'Jarvis speaking (tap to mute)'
                    : isHandsFree
                    ? '🎧 Hands-Free Active · Say "Hey Jarvis"'
                    : statusMessage || 'Tap orb or mic to speak'}
                </span>
                <p className="text-xs text-text-muted mt-1">
                  {isHandsFree
                    ? '100% on-device private listening in WebAssembly'
                    : 'Log WhatsApp calls, review action items, or ask questions'}
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

                    {/* Pending Action Review Proposal Card (1-Tap Thumb Approvals) */}
                    {hasActivePending && activeProposal && (
                      <div className="bg-surface rounded-[14px] border border-accent/40 p-4 shadow-xl animate-in zoom-in-95 duration-200">
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
                <div className="bg-surface rounded-[14px] border border-accent/40 p-4 shadow-xl">
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
      </div>

      {/* ── Floating Bottom Pill Input Dock & Quick Dictation Mic ─────── */}
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
