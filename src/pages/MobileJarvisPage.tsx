import { useRef, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Globe,
  Plus,
  Sparkles,
  Headphones,
  Loader2,
  PanelLeft,
} from 'lucide-react';
import { useJarvisStore } from '../store/jarvisStore';
import { useAssistantStore } from '../store/assistantStore';
import { JarvisSidebar } from '../components/jarvis/JarvisSidebar';
import { JarvisOrb } from '../components/jarvis/JarvisOrb';
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
    openVoiceMode,
  } = useJarvisStore();

  const {
    messages,
    isSending,
    startNewConversation,
    fetchConversations,
  } = useAssistantStore();

  const [inputVal, setInputVal] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    // Mobile viewports (< 768px) must ALWAYS start with the sidebar closed
    // so the drawer never blocks the screen on app launch.
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      return false;
    }
    const saved = localStorage.getItem('jarvis_sidebar_open');
    if (saved !== null) return saved === 'true';
    return typeof window !== 'undefined' ? window.innerWidth >= 1024 : false;
  });

  const handleToggleSidebar = () => {
    setSidebarOpen((prev) => {
      const next = !prev;
      // Only persist sidebar open preference on desktop viewports
      if (typeof window !== 'undefined' && window.innerWidth >= 768) {
        localStorage.setItem('jarvis_sidebar_open', String(next));
      }
      return next;
    });
  };

  // Ensure any stale sidebar open preference on mobile devices is purged
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      localStorage.removeItem('jarvis_sidebar_open');
    }
  }, []);

  // Support ?voice=1 or ?voice=true URL param if user launches directly into Voice Mode
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const search = window.location.search;
      if (search.includes('voice=true') || search.includes('voice=1')) {
        openVoiceMode();
      }
    }
  }, [openVoiceMode]);
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
    <div className="h-full h-[100dvh] w-full flex bg-bg text-text overflow-hidden select-none">
      
      {/* ── Desktop In-Flow Sliding Side Panel (Pushes Chat Aside) ── */}
      <aside
        className={`hidden md:flex flex-col h-full bg-surface/50 border-r border-border/40 shrink-0 transition-all duration-300 ease-in-out overflow-hidden z-20 ${
          sidebarOpen ? 'w-64 lg:w-72 opacity-100' : 'w-0 opacity-0 pointer-events-none border-none'
        }`}
      >
        <JarvisSidebar onClose={() => setSidebarOpen(false)} isMobile={false} />
      </aside>

      {/* ── Mobile Sliding Drawer Overlay ── */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="relative w-[280px] max-w-[85vw] h-full bg-surface border-r border-border flex flex-col shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            <JarvisSidebar onClose={() => setSidebarOpen(false)} isMobile={true} />
          </aside>
        </div>
      )}

      {/* ── Main Chat Area (Compacts & Pushes Aside) ── */}
      <div className="flex-1 min-w-0 flex flex-col h-full h-[100dvh] overflow-hidden relative">

        {/* ── Slim Minimal Header ────────────────────────────────────────── */}
        <header className="pt-[max(env(safe-area-inset-top,0px),12px)] pb-2 px-3 sm:px-4 border-b border-border/20 bg-bg/85 backdrop-blur-md shrink-0 flex items-center justify-between z-30">
          {/* Left: Sidebar Toggle + Jarvis Wordmark (sm+) + Active Project Selector (always visible on mobile) */}
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 max-w-[calc(50%-22px)] shrink">
            <button
              type="button"
              onClick={handleToggleSidebar}
              aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
              title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
              className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-surface-2 transition-colors cursor-pointer shrink-0"
            >
              <PanelLeft className="w-4 h-4" />
            </button>

            <Link
              to="/dashboard"
              onClick={() => sessionStorage.setItem('prefer_desktop', 'true')}
              className="font-semibold text-text text-sm tracking-tight shrink-0 hover:opacity-80 transition-opacity hidden sm:inline"
              title="Switch to Desktop View"
            >
              Jarvis
            </Link>
            <span className="text-text-muted/30 text-xs select-none hidden sm:inline">/</span>
            <div className="min-w-0 truncate">
              <ActiveProjectSelector compact variant="pill" />
            </div>
          </div>

          {/* Center: Small Orb (38px) */}
          <div className="flex items-center justify-center shrink-0 mx-1">
            <JarvisOrb
              size={38}
              state={orbState}
              audioLevel={audioLevel}
              onClick={toggleVoiceMode}
            />
          </div>

          {/* Right: Instant 1-Click Toggles & New Chat */}
          <div className="flex items-center justify-end gap-1 min-w-0 shrink-0">
            {/* 1-Click Hands-Free Wake-Word Toggle */}
            <button
              type="button"
              onClick={() => void toggleHandsFree()}
              disabled={isWakeWordLoading}
              title={isHandsFree ? "Hands-Free Active ('Hey Jarvis') - Tap to turn off" : "Enable Hands-Free ('Hey Jarvis')"}
              className={`p-1.5 sm:px-2 rounded-lg transition-colors cursor-pointer flex items-center gap-1 text-xs border ${
                isHandsFree
                  ? 'bg-accent/15 text-accent font-medium border-accent/40 shadow-xs'
                  : 'text-text-muted hover:text-text hover:bg-surface-2 border-transparent'
              }`}
            >
              {isWakeWordLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" />
              ) : (
                <Headphones className={`w-3.5 h-3.5 ${isHandsFree ? 'text-accent' : ''}`} />
              )}
              <span className="hidden md:inline text-[10px] font-mono uppercase">
                {isHandsFree ? 'HF:ON' : 'HF'}
              </span>
            </button>

            {/* 1-Click Auto Web Search Toggle */}
            <button
              type="button"
              onClick={toggleWebSearch}
              title={isWebSearchEnabled ? "Auto Web Search Active (searches automatically when needed) - Tap to disable" : "Auto Web Search Disabled - Tap to enable"}
              className={`p-1.5 sm:px-2 rounded-lg transition-colors cursor-pointer flex items-center gap-1 text-xs border ${
                isWebSearchEnabled
                  ? 'bg-accent/15 text-accent font-medium border-accent/40 shadow-xs'
                  : 'text-text-muted hover:text-text hover:bg-surface-2 border-transparent'
              }`}
            >
              <Globe className={`w-3.5 h-3.5 ${isWebSearchEnabled ? 'text-accent' : ''}`} />
              <span className="hidden md:inline text-[10px] font-mono uppercase">
                {isWebSearchEnabled ? 'AUTO:ON' : 'OFF'}
              </span>
            </button>

            {/* New Session Button */}
            <button
              type="button"
              onClick={() => startNewConversation()}
              title="New clean session"
              className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-surface-2 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </header>

      {/* ── Interim Speech Transcript Banner ──────────────────────────── */}
      {transcript && isRecording && (
        <div className="bg-surface border-b border-border px-4 py-2 shrink-0 animate-in fade-in">
          <TranscriptBox transcript={transcript} />
        </div>
      )}

      {/* ── Main Scroll Area: Hero Orb OR Message Feed ────────────────── */}
      <div ref={chatScrollRef} className="flex-1 overflow-y-auto min-h-0 px-4 md:px-6 py-4">
        <div className="max-w-[720px] mx-auto w-full space-y-6 pb-28">
        {messages.length === 0 ? (
          // ── Minimal Mobile Landing (Zero Messages) ──────────────────
          <div className="flex-1 flex flex-col items-center justify-center text-center px-4 py-6 max-w-md mx-auto my-auto min-h-[42vh]">
            <h2 className="text-xl sm:text-2xl font-semibold text-text tracking-tight mb-1.5">
              What can I do for you today?
            </h2>
            <p className="text-xs text-text-muted mb-6 max-w-xs leading-relaxed">
              Tap the orb for Voice Mode, type below, or try a quick prompt.
            </p>

            {/* Quick Suggestion Chips (2x2 grid) */}
            <div className="w-full space-y-2 text-left">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {quickPrompts.map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => submitCommand(q.prompt)}
                    className="p-2.5 sm:p-3 rounded-[12px] bg-surface/80 hover:bg-surface-2 border border-border/60 hover:border-border text-left text-xs transition-all cursor-pointer group shadow-xs active:scale-[0.98]"
                  >
                    <div className="font-medium text-text group-hover:text-accent transition-colors flex items-center justify-between">
                      <span>{q.title}</span>
                      <Sparkles className="w-3 h-3 text-text-muted/40 group-hover:text-accent transition-colors" />
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
      </div>

      {/* ── Full-Screen Voice Mode Overlay ── */}
      <JarvisVoiceMode />
    </div>
  );
}
