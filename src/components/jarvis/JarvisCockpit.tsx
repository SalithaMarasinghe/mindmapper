import { useState, useRef, useEffect } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Sparkles,
  Copy,
  Check,
  RotateCcw,
  Send,
  FileText,
  Trash2,
  Loader2,
  ClipboardPaste,
  MessageSquare,
  Globe,
  ExternalLink,
  Headphones,
} from 'lucide-react';
import { useJarvisStore } from '../../store/jarvisStore';
import { useAssistantStore } from '../../store/assistantStore';
import { JarvisOrb } from './JarvisOrb';
import { JarvisProposalRenderer } from './JarvisProposalRenderer';
import { toast } from 'react-hot-toast';

export function JarvisCockpit() {
  const {
    isRecording,
    isTranscribing,
    isHandsFree,
    isWakeWordLoading,
    orbState,
    pastedText,
    statusMessage,
    activeProposal,
    activePromptDocument,
    isMuted,
    isSubmitting,
    isSpeaking,
    stopSpeaking,
    lastCopiedAt,
    isWebSearchEnabled,
    setPastedText,
    copyPromptToClipboard,
    clearPrompt,
    toggleMute,
    toggleRecording,
    toggleHandsFree,
    toggleWebSearch,
    submitCommand,
    approveProposal,
    rejectProposal,
  } = useJarvisStore();

  const { messages, isSending, startNewConversation } = useAssistantStore();

  const [inputVal, setInputVal] = useState('');
  const [copiedRecently, setCopiedRecently] = useState(false);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);


  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, isSending, isSubmitting, activeProposal]);

  // Visual pulse on copy
  useEffect(() => {
    if (lastCopiedAt) {
      setCopiedRecently(true);
      const timer = setTimeout(() => setCopiedRecently(false), 2500);
      return () => clearTimeout(timer);
    }
  }, [lastCopiedAt]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSubmitting || isTranscribing || isRecording) return;
    stopSpeaking();
    const textToSubmit = inputVal.trim();
    if (!textToSubmit && !pastedText.trim()) return;
    setInputVal('');
    void submitCommand(textToSubmit);
  };

  const handleCopyPromptText = async (text: string, msgId?: string) => {
    const ok = await copyPromptToClipboard(text);
    if (ok) {
      if (msgId) {
        setCopiedMsgId(msgId);
        setTimeout(() => setCopiedMsgId(null), 2500);
      }
    }
  };

  const handleRefinePill = (refinementText: string) => {
    setInputVal(refinementText);
    void submitCommand(refinementText);
  };

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setPastedText(pastedText ? `${pastedText}\n${text}` : text);
        toast.success('Pasted into prompt context!');
      }
    } catch {
      toast('Paste directly into the data box below');
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#000000] text-slate-200 overflow-hidden relative">
      {/* ── Ambient Glow Background ── */}
      <div className="absolute top-0 left-1/3 w-[800px] h-[350px] bg-gradient-to-b from-cyan-500/10 via-indigo-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />

      {/* ── Main Cockpit Workspace (Left: Voice Deck | Right: Expansive Chat & Actions) ── */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden z-10">
        
        {/* ── LEFT COLUMN: Voice & Control Deck (Fixed/Dedicated Width) ── */}
        <div className="w-full lg:w-[380px] xl:w-[420px] shrink-0 border-r border-[#111111] bg-[#000000]/70 flex flex-col overflow-y-auto p-5 space-y-5">
          {/* Deck Top Bar */}
          <div className="flex items-center justify-between pb-1 border-b border-[#111111]/60">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isRecording ? 'bg-red-400' : 'bg-cyan-400'} opacity-75`} />
                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isRecording ? 'bg-red-500' : 'bg-cyan-500'}`} />
              </span>
              <span className="text-xs font-bold tracking-wider text-slate-200 uppercase font-mono">
                JARVIS VOICE DECK
              </span>
            </div>

            <button
              onClick={toggleMute}
              className={`p-1.5 rounded-lg border text-xs transition ${
                isMuted
                  ? 'bg-rose-950/40 border-rose-800/60 text-rose-400'
                  : 'bg-[#080808] border-slate-800 text-slate-400 hover:text-cyan-400'
              }`}
              title={isMuted ? 'Unmute Jarvis Voice' : 'Mute Jarvis Voice'}
            >
              {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            </button>
          </div>
          {/* Orb Hero Section */}
          <div className="flex flex-col items-center justify-center pt-2">
            <div
              className="relative group cursor-pointer"
              onClick={() => {
                if (isSpeaking) {
                  stopSpeaking();
                } else {
                  toggleRecording();
                }
              }}
            >
              <JarvisOrb size={160} state={orbState} />
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="px-2.5 py-1 rounded-full bg-black/80 text-[11px] font-mono text-cyan-300 border border-cyan-500/40 shadow-lg">
                  {isSpeaking ? 'Click to Interrupt' : isRecording ? 'Click to Stop' : 'Click to Speak'}
                </span>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${isSpeaking ? 'bg-amber-400 animate-pulse' : isRecording ? 'bg-red-400 animate-ping' : 'bg-cyan-400 animate-pulse'}`} />
              <p className="text-xs font-semibold text-cyan-300 tracking-wide font-mono text-center">
                {isSpeaking ? 'Speaking... (Click to interrupt)' : statusMessage}
              </p>
            </div>

            {/* Dedicated Interrupt Narration Pill */}
            {isSpeaking && (
              <button
                type="button"
                onClick={stopSpeaking}
                className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[11px] font-mono transition shadow-sm animate-pulse"
              >
                <VolumeX className="w-3.5 h-3.5" />
                <span>Interrupt Narration</span>
              </button>
            )}

            {/* Big Push-To-Talk Button */}
            <div className="mt-4 w-full flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (isSpeaking) {
                    stopSpeaking();
                  }
                  toggleRecording();
                }}
                disabled={isSubmitting || isTranscribing}
                className={`flex-1 flex items-center justify-center gap-2.5 py-3 rounded-2xl text-xs font-bold tracking-wider transition-all shadow-lg active:scale-95 ${
                  isRecording
                    ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-900/50 animate-pulse'
                    : isSpeaking
                    ? 'bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 text-white shadow-amber-950/60'
                    : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-cyan-950/60 hover:shadow-cyan-500/30'
                }`}
              >
                {isRecording ? <MicOff className="w-4 h-4" /> : isSpeaking ? <VolumeX className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                <span>
                  {isRecording
                    ? 'STOP & PROCESS'
                    : isSpeaking
                    ? 'INTERRUPT & SPEAK (MIC)'
                    : 'SPEAK TO JARVIS (MIC)'}
                </span>
              </button>
            </div>

            {/* Hands-Free Wake-Word Toggle Card */}
            <div
              className={`mt-3 w-full p-3 rounded-2xl border transition-all flex items-center justify-between ${
                isHandsFree
                  ? 'bg-cyan-950/30 border-cyan-500/50 shadow-lg shadow-cyan-950/40 ring-1 ring-cyan-500/20'
                  : 'bg-[#080808] border-[#1a1a1a] hover:border-slate-800'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`p-2 rounded-xl shrink-0 ${
                    isHandsFree ? 'bg-cyan-500/20 text-cyan-300' : 'bg-slate-900 text-slate-400'
                  }`}
                >
                  {isWakeWordLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                  ) : (
                    <Headphones className={`w-4 h-4 ${isHandsFree ? 'text-cyan-400 animate-pulse' : ''}`} />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-200 font-mono truncate">
                      Hands-Free ("Hey Jarvis")
                    </span>
                    {isHandsFree && (
                      <span className="px-1.5 py-0.2 rounded-full text-[9px] font-mono font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 animate-pulse shrink-0">
                        LIVE
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                    {isWakeWordLoading
                      ? 'Loading WebAssembly model...'
                      : isHandsFree
                      ? '100% on-device · Say "Hey Jarvis" anytime'
                      : 'Listen ambiently without touching mouse'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => void toggleHandsFree()}
                disabled={isWakeWordLoading}
                className={`ml-2 px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all shadow-sm cursor-pointer shrink-0 ${
                  isHandsFree
                    ? 'bg-cyan-500 text-black hover:bg-cyan-400'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                }`}
              >
                {isWakeWordLoading ? '...' : isHandsFree ? 'ON' : 'OFF'}
              </button>
            </div>
          </div>

          {/* Active Prompt Snapshot / Quick Copy Card */}
          {activePromptDocument && (
            <div className="p-3.5 rounded-2xl bg-[#080808] border border-cyan-800/50 shadow-md space-y-2">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-cyan-300 font-mono">
                  <FileText className="w-3.5 h-3.5 text-cyan-400" />
                  Latest Engineered Prompt
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleCopyPromptText(activePromptDocument)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-950 hover:bg-cyan-900 border border-cyan-700/50 text-[11px] font-semibold text-cyan-300 transition"
                  >
                    {copiedRecently ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-cyan-400" />}
                    <span>{copiedRecently ? 'Copied!' : 'Copy'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={clearPrompt}
                    className="p-1 rounded-lg hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 transition"
                    title="Dismiss prompt banner"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="text-[11px] text-slate-400 font-mono line-clamp-3 bg-[#000000] p-2 rounded-xl border border-slate-800/80">
                {activePromptDocument}
              </div>

              {copiedRecently && (
                <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-mono">
                  <Check className="w-3 h-3" />
                  <span>Auto-copied to clipboard — ready to paste in Cursor / Claude</span>
                </div>
              )}
            </div>
          )}

          {/* Quick Refine Pills */}
          <div className="space-y-2">
            <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1 font-mono">
              <RotateCcw className="w-3 h-3 text-cyan-400" />
              Quick Refinements:
            </span>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => handleRefinePill('Make the prompt more concise and direct')}
                className="px-2.5 py-1 rounded-full bg-[#080808] hover:bg-cyan-950 text-slate-300 hover:text-cyan-300 border border-slate-700/60 text-[11px] transition"
              >
                + More concise
              </button>
              <button
                type="button"
                onClick={() => handleRefinePill('Add strict TypeScript rules and clean interfaces')}
                className="px-2.5 py-1 rounded-full bg-[#080808] hover:bg-cyan-950 text-slate-300 hover:text-cyan-300 border border-slate-700/60 text-[11px] transition"
              >
                + Strict TypeScript
              </button>
              <button
                type="button"
                onClick={() => handleRefinePill('Enforce Tailwind CSS v4 design rules')}
                className="px-2.5 py-1 rounded-full bg-[#080808] hover:bg-cyan-950 text-slate-300 hover:text-cyan-300 border border-slate-700/60 text-[11px] transition"
              >
                + Tailwind v4
              </button>
              <button
                type="button"
                onClick={() => handleRefinePill('Include unit tests and edge cases in the prompt')}
                className="px-2.5 py-1 rounded-full bg-[#080808] hover:bg-cyan-950 text-slate-300 hover:text-cyan-300 border border-slate-700/60 text-[11px] transition"
              >
                + Include tests
              </button>
            </div>
          </div>

          {/* Paste Context Box */}
          <div className="rounded-2xl bg-[#000000] border border-[#161616] p-3.5 space-y-2">
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-300">
              <span className="flex items-center gap-1.5 text-slate-400">
                <ClipboardPaste className="w-3.5 h-3.5 text-teal-400" />
                Paste Raw Code / Logs
              </span>
              <div className="flex items-center gap-2">
                {pastedText && (
                  <button
                    type="button"
                    onClick={() => setPastedText('')}
                    className="text-[10px] text-slate-500 hover:text-rose-400 flex items-center gap-1 transition"
                  >
                    Clear
                  </button>
                )}
                <button
                  type="button"
                  onClick={handlePasteClipboard}
                  className="px-2 py-0.5 rounded bg-[#0a0a0a] hover:bg-[#141414] text-teal-300 text-[10px] font-medium transition cursor-pointer"
                >
                  Paste Clipboard
                </button>
              </div>
            </div>

            <textarea
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder="Paste terminal output, git diff, or documentation here to include as context..."
              rows={3}
              className="w-full bg-[#0a0a0a] border border-slate-700/60 rounded-xl p-2.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-teal-500 font-mono resize-none transition leading-relaxed"
            />
          </div>
        </div>

        {/* ── RIGHT COLUMN: Full-Height Chat, Proposals & Interaction Stream ── */}
        <div className="flex-1 flex flex-col min-h-0 bg-[#000000] overflow-hidden">
          {/* Chat Stream Header */}
          <div className="flex items-center justify-between px-6 py-3 border-b border-[#111111] bg-[#000000] shrink-0">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-bold tracking-wide text-slate-200 uppercase font-mono">
                Conversation & Action Stream
              </span>
              <span className="text-[11px] text-slate-500 font-mono">
                ({messages.length} messages)
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleWebSearch}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition cursor-pointer border ${
                  isWebSearchEnabled
                    ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/60 shadow-[0_0_12px_rgba(16,185,129,0.25)]'
                    : 'bg-[#080808] text-slate-400 border-slate-700/80 hover:text-slate-200'
                }`}
                title={isWebSearchEnabled ? 'Live Web Search enabled (Tavily/DDG)' : 'Enable Live Web Search (Tavily/DDG)'}
              >
                <Globe className={`w-3.5 h-3.5 ${isWebSearchEnabled ? 'text-emerald-400 animate-pulse' : 'text-slate-400'}`} />
                <span>Live Search: {isWebSearchEnabled ? 'ON' : 'OFF'}</span>
              </button>

              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={startNewConversation}
                  className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200 px-2.5 py-1 rounded-lg bg-[#080808] border border-slate-700/80 transition"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>New Session</span>
                </button>
              )}
            </div>
          </div>

          {/* Chat Messages List (Full Width & Full Height) */}
          <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-6 space-y-4 min-h-0">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-500">
                <Sparkles className="w-12 h-12 text-cyan-500/30 mb-3 animate-pulse" />
                <p className="text-base font-bold text-slate-300">Jarvis AI Command Center Ready</p>
                <p className="text-xs text-slate-500 mt-1 max-w-md">
                  Speak into the mic or type on the right. Ask to engineer a prompt, explain complex architectures like RAG, or manage your task timers.
                </p>

                <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg w-full text-left">
                  <div
                    onClick={() => handleRefinePill('Context engineer a prompt to build a real-time collaborative mindmap in React 19 and Tailwind')}
                    className="p-3.5 rounded-2xl bg-[#080808] border border-slate-800/80 hover:border-cyan-500/40 cursor-pointer transition text-xs text-slate-400 hover:text-slate-200"
                  >
                    ✨ <span className="font-semibold text-slate-300">Real-time mindmap prompt</span>
                  </div>
                  <div
                    onClick={() => handleRefinePill('Explain what RAG is, how vector search works with pgvector, and best practices')}
                    className="p-3.5 rounded-2xl bg-[#080808] border border-slate-800/80 hover:border-indigo-500/40 cursor-pointer transition text-xs text-slate-400 hover:text-slate-200"
                  >
                    🧠 <span className="font-semibold text-slate-300">Explain RAG architecture</span>
                  </div>
                </div>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`rounded-2xl px-5 py-3.5 text-xs leading-relaxed shadow-lg ${
                      msg.role === 'user'
                        ? 'max-w-[80%] bg-cyan-950/80 text-cyan-100 border border-cyan-700/60'
                        : 'w-full max-w-4xl bg-[#080808] text-slate-200 border border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2 text-[10px] font-mono text-slate-400">
                      <span className="font-semibold">{msg.role === 'user' ? 'You' : 'Jarvis AI'}</span>
                      <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>

                    <div className="whitespace-pre-wrap font-sans text-xs leading-relaxed">
                      {msg.content}
                    </div>

                    {/* Verified Live Web Search Sources */}
                    {msg.searchSources && msg.searchSources.length > 0 && (
                      <div className="mt-3 pt-2.5 border-t border-[#111111]/80">
                        <div className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-400 uppercase tracking-wider mb-2">
                          <Globe className="w-3 h-3 text-emerald-400" />
                          <span>Verified Web Sources ({msg.searchSources.length})</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {msg.searchSources.map((source, idx) => (
                            <a
                              key={idx}
                              href={source.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#000000] hover:bg-[#0a0a0a] border border-slate-800 hover:border-emerald-500/40 text-[11px] text-slate-300 hover:text-emerald-300 transition group"
                            >
                              <span className="truncate max-w-[220px] font-medium">{source.title}</span>
                              <ExternalLink className="w-3 h-3 text-slate-500 group-hover:text-emerald-400 shrink-0" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Dedicated Context-Engineered Prompt Block */}
                    {msg.engineeredPrompt && (
                      <div className="mt-4 pt-3 border-t border-[#111111] space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-cyan-300 font-mono">
                            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                            Context-Engineered Prompt
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyPromptText(msg.engineeredPrompt!, msg.id)}
                            className="flex items-center gap-1 px-3 py-1 rounded-lg bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-700/50 text-xs font-semibold text-cyan-300 transition"
                          >
                            {copiedMsgId === msg.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5 text-cyan-400" />
                            )}
                            <span>{copiedMsgId === msg.id ? 'Copied!' : 'Copy to Clipboard'}</span>
                          </button>
                        </div>

                        <div className="p-4 rounded-xl bg-[#000000] border border-[#111111] font-mono text-xs text-slate-200 whitespace-pre-wrap select-text selection:bg-cyan-500/30 leading-relaxed max-h-[400px] overflow-y-auto">
                          {msg.engineeredPrompt}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}

            {/* Active Action Proposal Card (Full Width) */}
            {activeProposal && (
              <div className="w-full max-w-4xl p-4 bg-[#080808] border border-cyan-500/50 rounded-2xl shadow-2xl">
                <JarvisProposalRenderer
                  proposal={activeProposal}
                  onApprove={approveProposal}
                  onReject={rejectProposal}
                />
              </div>
            )}

            {(isSending || isSubmitting) && (
              <div className="flex items-center gap-2 text-xs text-cyan-400 font-mono px-4 py-2.5 rounded-xl bg-cyan-950/40 border border-cyan-900/60 w-fit">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Jarvis is thinking & compiling...</span>
              </div>
            )}
          </div>

          {/* Chat Input Bar (Full Width at Bottom of Right Column) */}
          <form onSubmit={handleSubmit} className="p-4 border-t border-[#111111] bg-[#000000] shrink-0">
            <div className="flex items-center gap-2.5 max-w-5xl mx-auto">
              <input
                type="text"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                placeholder="Ask Jarvis to engineer a prompt, explain architecture (e.g. RAG), or manage tasks..."
                disabled={isSubmitting || isTranscribing}
                className="flex-1 bg-[#080808] text-slate-200 text-xs px-4 py-3 rounded-2xl border border-slate-700/80 focus:outline-none focus:border-cyan-500 placeholder:text-slate-500 font-sans shadow-inner"
              />
              <button
                type="submit"
                disabled={(!inputVal.trim() && !pastedText.trim()) || isSubmitting}
                className="p-3 rounded-2xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 disabled:hover:bg-cyan-600 text-white transition shadow-md"
                title="Send Command (Enter)"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center justify-between max-w-5xl mx-auto mt-2 px-1 text-[11px] text-slate-500">
              <span>Press <kbd className="px-1 py-0.5 rounded bg-[#0a0a0a] text-[10px] text-slate-300 font-mono">Enter</kbd> to send · Click mic on left to speak</span>
              <span>All generated prompts auto-copy to clipboard</span>
            </div>
          </form>
        </div>

      </div>
    </div>
  );
}
