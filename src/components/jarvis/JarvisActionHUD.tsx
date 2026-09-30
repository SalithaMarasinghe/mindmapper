import { useEffect, useRef, useState } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  X,
  Send,
  ClipboardPaste,
  Sparkles,
  Play,
  RotateCcw,
  Loader2,
} from 'lucide-react';
import { useJarvisStore } from '../../store/jarvisStore';
import { useTaskStore } from '../../store/taskStore';
import { JarvisOrb } from './JarvisOrb';
import { JarvisProposalRenderer } from './JarvisProposalRenderer';

export function JarvisActionHUD() {
  const {
    isOpen,
    isRecording,
    isTranscribing,
    orbState,
    audioLevel,
    transcript,
    pastedText,
    statusMessage,
    activeProposal,
    isMuted,
    isSubmitting,
    openHUD,
    closeHUD,
    setTranscript,
    setPastedText,
    toggleMute,
    toggleRecording,
    submitCommand,
    approveProposal,
    rejectProposal,
  } = useJarvisStore();

  const { tasks } = useTaskStore();
  const runningTask = tasks.find((t) => t.status === 'in_progress' && !t.isPaused);

  const [inputVal, setInputVal] = useState('');
  const dropzoneRef = useRef<HTMLTextAreaElement | null>(null);

  // Global hotkey: Alt+J to summon / dismiss Jarvis
  // NOTE: Works only when the Chrome tab/window has OS focus.
  // There is no way to intercept keyboard events from a background browser window in a web app.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.code === 'KeyJ') {
        e.preventDefault();
        if (isOpen) {
          closeHUD();
        } else {
          openHUD(true);
        }
      } else if (e.code === 'Escape' && isOpen) {
        e.preventDefault();
        closeHUD();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, openHUD, closeHUD]);

  // Sync transcript into input whenever a new transcription lands
  useEffect(() => {
    if (transcript) setInputVal(transcript);
  }, [transcript]);

  // Clear input when HUD freshly opens
  useEffect(() => {
    if (isOpen) setInputVal('');
  }, [isOpen]);

  const handleSubmit = () => {
    if (isSubmitting || isTranscribing || isRecording) return;
    void submitCommand(inputVal);
  };

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setPastedText(pastedText ? `${pastedText}\n${text}` : text);
    } catch {
      dropzoneRef.current?.focus();
    }
  };

  const micBusy = isSubmitting || isTranscribing;

  return (
    <>
      {/* ── Standby Floating Orb Dock ─────────────────────────────────────── */}
      {!isOpen && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3">
          {runningTask && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#121824]/90 border border-teal-500/30 text-teal-300 text-xs shadow-lg backdrop-blur-md animate-pulse">
              <Play className="w-3 h-3 fill-teal-400 text-teal-400" />
              <span className="font-semibold truncate max-w-[140px]">{runningTask.title}</span>
            </div>
          )}

          <div className="relative group">
            <button
              type="button"
              onClick={() => openHUD(true)}
              className="relative p-1 rounded-full bg-[#0d121d] border border-cyan-500/40 hover:border-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.25)] hover:shadow-[0_0_30px_rgba(6,182,212,0.45)] transition-all duration-300 transform active:scale-90"
              title="Summon Jarvis (Alt + J)"
            >
              <JarvisOrb size={46} state={orbState} audioLevel={audioLevel} />
            </button>

            <div className="absolute right-0 bottom-full mb-2 hidden group-hover:flex flex-col items-end pointer-events-none">
              <div className="px-2.5 py-1 rounded-lg bg-[#141b29] border border-slate-700 text-slate-200 text-[11px] font-medium whitespace-nowrap shadow-xl">
                <span>Summon Jarvis (</span>
                <kbd className="px-1 py-0.5 rounded bg-slate-800 text-[10px] text-teal-300">Alt+J</kbd>
                <span>)</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── HUD Modal Overlay ─────────────────────────────────────────────── */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl bg-[#0c101a]/95 border border-cyan-500/30 rounded-3xl shadow-[0_0_50px_rgba(6,182,212,0.2)] overflow-hidden flex flex-col max-h-[90vh]">
            {/* Ambient Aura */}
            <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-48 bg-gradient-to-b from-cyan-500/15 via-teal-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />

            {/* Top Toolbar */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/80 relative z-10">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wider uppercase bg-cyan-950/60 text-cyan-300 border border-cyan-700/50">
                  <Sparkles className="w-3 h-3 text-cyan-400" />
                  JARVIS AI DECK
                </span>
                <span className="text-xs text-slate-400 hidden sm:inline">Voice & Action Command HUD</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleMute}
                  className={`p-2 rounded-xl border text-xs transition ${
                    isMuted
                      ? 'bg-rose-950/40 border-rose-800/60 text-rose-400'
                      : 'bg-[#151c2b] border-slate-700 text-slate-300 hover:text-cyan-400'
                  }`}
                  title={isMuted ? 'Unmute Jarvis Voice' : 'Mute Jarvis Voice'}
                >
                  {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>

                <button
                  type="button"
                  onClick={closeHUD}
                  className="p-2 rounded-xl bg-[#151c2b] hover:bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-200 transition"
                  title="Close HUD (Esc)"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1 relative z-10">
              {/* Orb + Status */}
              <div className="flex flex-col items-center justify-center pt-2">
                <JarvisOrb size={130} state={orbState} audioLevel={audioLevel} />
                <p className="mt-2 text-xs font-semibold text-cyan-300 tracking-wide flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${isRecording ? 'bg-red-400 animate-ping' : 'bg-cyan-400 animate-pulse'}`} />
                  {statusMessage}
                </p>
              </div>

              {/* ── Push-to-Talk Section ──────────────────────────────────── */}
              <div className="relative">
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 mb-1 px-1">
                  <span className="flex items-center gap-1.5">
                    {isTranscribing ? (
                      <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
                    ) : (
                      <Mic className={`w-3.5 h-3.5 ${isRecording ? 'text-red-400 animate-pulse' : 'text-slate-500'}`} />
                    )}
                    {isTranscribing ? 'Transcribing with Whisper...' : isRecording ? 'Recording — speak now' : 'Voice Command'}
                  </span>

                  {/* Big push-to-talk button */}
                  <button
                    type="button"
                    disabled={micBusy}
                    onClick={() => void toggleRecording()}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold transition-all active:scale-95 ${
                      isRecording
                        ? 'bg-red-600 hover:bg-red-500 text-white shadow-[0_0_12px_rgba(220,38,38,0.5)] animate-pulse'
                        : micBusy
                        ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                        : 'bg-cyan-700 hover:bg-cyan-600 text-white shadow-[0_0_8px_rgba(6,182,212,0.3)]'
                    }`}
                    title={isRecording ? 'Stop recording and transcribe' : 'Start recording'}
                  >
                    {isTranscribing ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : isRecording ? (
                      <MicOff className="w-3 h-3" />
                    ) : (
                      <Mic className="w-3 h-3" />
                    )}
                    {isTranscribing ? 'Transcribing...' : isRecording ? 'Stop' : 'Record'}
                  </button>
                </div>

                {/* Text input — editable after transcription, or type manually */}
                <div className="relative flex items-center">
                  <input
                    type="text"
                    value={inputVal}
                    onChange={(e) => {
                      setInputVal(e.target.value);
                      setTranscript(e.target.value);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSubmit();
                      }
                    }}
                    placeholder={
                      isRecording
                        ? 'Speak now — recording in progress...'
                        : isTranscribing
                        ? 'Transcribing your voice...'
                        : 'Record voice above, or type here directly... (Enter to send)'
                    }
                    disabled={isRecording || isTranscribing}
                    className="w-full bg-[#131926] border border-cyan-500/30 focus:border-cyan-400 rounded-2xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 transition pr-12 disabled:opacity-50"
                  />

                  <button
                    type="button"
                    disabled={isSubmitting || isRecording || isTranscribing || (!inputVal.trim() && !pastedText.trim())}
                    onClick={handleSubmit}
                    className="absolute right-2 p-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-30 text-white transition active:scale-95 cursor-pointer"
                    title="Send command (Enter)"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>

                {/* Transcription hint */}
                {!isRecording && !isTranscribing && !transcript && (
                  <p className="text-[10px] text-slate-500 mt-1 px-1">
                    Click <strong className="text-cyan-400">Record</strong>, speak your command, click <strong className="text-cyan-400">Stop</strong> — Whisper will transcribe it.
                  </p>
                )}
              </div>

              {/* ── Paste Dropzone ─────────────────────────────────────────── */}
              <div className="rounded-2xl bg-[#0f1420] border border-[#232d42] p-3.5 space-y-2">
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-300">
                  <span className="flex items-center gap-1.5 text-slate-400">
                    <ClipboardPaste className="w-3.5 h-3.5 text-teal-400" />
                    Paste Dropzone (Git Commits, Terminal Output, Meeting Transcripts)
                  </span>
                  <div className="flex items-center gap-2">
                    {pastedText && (
                      <button
                        type="button"
                        onClick={() => setPastedText('')}
                        className="text-[10px] text-slate-500 hover:text-rose-400 flex items-center gap-1 transition"
                      >
                        <RotateCcw className="w-2.5 h-2.5" />
                        Clear
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handlePasteClipboard}
                      className="px-2 py-0.5 rounded bg-[#1e2738] hover:bg-[#28354c] text-teal-300 text-[10px] font-medium transition cursor-pointer"
                    >
                      Paste from Clipboard
                    </button>
                  </div>
                </div>

                <textarea
                  ref={dropzoneRef}
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  placeholder="Paste raw terminal logs, git diffs, or meeting transcripts here alongside your voice command..."
                  rows={pastedText ? 4 : 2}
                  className="w-full bg-[#161d2d] border border-slate-700/60 rounded-xl p-3 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-teal-500 font-mono resize-none transition leading-relaxed"
                />

                {pastedText && (
                  <div className="text-right text-[10px] text-slate-500">
                    {pastedText.length} characters ready for compilation
                  </div>
                )}
              </div>

              {/* ── Proposal Stage ─────────────────────────────────────────── */}
              {activeProposal && (
                <div className="pt-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                      Proposed Changes Ready for Approval
                    </span>
                    <span className="text-[11px] text-slate-400">Review below before committing</span>
                  </div>

                  <JarvisProposalRenderer
                    proposal={activeProposal}
                    onApprove={() => void approveProposal()}
                    onReject={rejectProposal}
                    isSubmitting={isSubmitting}
                  />
                </div>
              )}
            </div>

            {/* Footer Bar */}
            <div className="px-6 py-3 bg-[#0a0d16] border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400 relative z-10">
              <span className="text-[11px] text-slate-500">
                Summon: <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-300">Alt + J</kbd>
                <span className="ml-2 text-slate-600">· Transcription via Groq Whisper</span>
              </span>

              {activeProposal && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={rejectProposal}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-slate-200 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => void approveProposal()}
                    className="px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-teal-600 hover:bg-teal-500 shadow-lg active:scale-95 transition"
                  >
                    {isSubmitting ? 'Writing...' : 'Approve & Write Changes'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
