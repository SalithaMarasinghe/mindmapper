import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  FileText,
  Download,
  Copy,
  Calendar,
  Sparkles,
  GitBranch,
  X,
  Tag,
  Clock,
  Briefcase,
  Users,
  ExternalLink,
  ArrowUpDown,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useTimelineStore } from '../../store/timelineStore';
import type { TimelineEventFull } from '../../types';
import { compileLedger, type CompiledLedger } from '../../services/ledgerCompiler';
import { compileLedgerToMarkdown } from '../../utils/markdownCompiler';
import { MarkdownViewer } from '../common/MarkdownViewer';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';

export interface CareerLedgerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type DatePreset = '7d' | '30d' | '90d' | '180d' | 'all' | 'custom';
type TabType = 'storylines' | 'chronological' | 'markdown' | 'synthesis';
type SynthesisType = 'resume' | 'promotion' | 'linkedin';

export function CareerLedgerModal({ isOpen, onClose }: CareerLedgerModalProps) {
  const { fetchRange, fetchProjects, projects } = useTimelineStore();
  const user = useAuthStore((state) => state.user);

  // ── Date Range State ────────────────────────────────────────────────────────
  const [preset, setPreset] = useState<DatePreset>('180d');

  const defaultDates = useMemo(() => {
    const today = new Date();
    const endStr = today.toISOString().slice(0, 10);
    const sixMonthsAgo = new Date(today);
    sixMonthsAgo.setDate(sixMonthsAgo.getDate() - 180);
    const startStr = sixMonthsAgo.toISOString().slice(0, 10);
    return { startStr, endStr };
  }, []);

  const [startDate, setStartDate] = useState(defaultDates.startStr);
  const [endDate, setEndDate] = useState(defaultDates.endStr);

  const applyPreset = (p: DatePreset) => {
    setPreset(p);
    const today = new Date();
    const endStr = today.toISOString().slice(0, 10);
    let start = new Date(today);

    if (p === '7d') {
      start.setDate(start.getDate() - 7);
    } else if (p === '30d') {
      start.setDate(start.getDate() - 30);
    } else if (p === '90d') {
      start.setDate(start.getDate() - 90);
    } else if (p === '180d') {
      start.setDate(start.getDate() - 180);
    } else if (p === 'all') {
      start = new Date('2024-01-01');
    } else {
      return; // custom
    }

    setStartDate(start.toISOString().slice(0, 10));
    setEndDate(endStr);
  };

  // ── Raw & Compiled Data ─────────────────────────────────────────────────────
  const [events, setEvents] = useState<TimelineEventFull[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<TabType>('storylines');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    if (!isOpen) return;
    let isCancelled = false;

    const load = async () => {
      setIsLoading(true);
      try {
        const [data] = await Promise.all([
          fetchRange(startDate, endDate),
          fetchProjects(),
        ]);
        if (!isCancelled) {
          setEvents(data);
        }
      } catch (err) {
        console.error('Failed to load ledger events:', err);
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    };

    void load();
    return () => {
      isCancelled = true;
    };
  }, [isOpen, startDate, endDate, fetchRange, fetchProjects]);

  const compiledLedger: CompiledLedger = useMemo(() => {
    const tagFilter = selectedTag === 'all' ? null : selectedTag;
    return compileLedger(events, startDate, endDate, tagFilter, sortOrder, projects);
  }, [events, startDate, endDate, selectedTag, sortOrder, projects]);

  const markdownContent = useMemo(() => {
    return compileLedgerToMarkdown(compiledLedger, {
      engineerName: user?.user_metadata?.full_name || 'Salitha Marasinghe',
      engineerRole: 'Trainee Associate Software Engineer',
    });
  }, [compiledLedger, user]);

  // ── AI Career Synthesis State ───────────────────────────────────────────────
  const [synthesisMode, setSynthesisMode] = useState<SynthesisType>('resume');
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [synthesisOutput, setSynthesisOutput] = useState<string | null>(null);

  const runSynthesis = async (type: SynthesisType) => {
    setSynthesisMode(type);
    setIsSynthesizing(true);
    setSynthesisOutput(null);

    let goalPrompt = '';
    if (type === 'resume') {
      goalPrompt = `You are an elite Silicon Valley technical recruiter and resume writer.
Review the following verified Continuous Workload & Career Ledger for Salitha Marasinghe (Trainee Associate Software Engineer).
Extract 5 to 7 high-impact, promotion-grade bullet points following the Google XYZ formula: "Accomplished [X] as measured by [Y], by doing [Z]".
Highlight initiative ownership, technical judgment, latency/cost/scale wins, and trade-offs.
Do not invent facts. Return formatted Markdown with a brief introductory sentence and clear bullet points.`;
    } else if (type === 'promotion') {
      goalPrompt = `You are a Principal Engineering Director conducting a semi-annual promotion audit.
Review the following Continuous Workload & Career Ledger for Salitha Marasinghe.
Write a comprehensive, professional Promotion & Performance Review Dossier evaluating Salitha across four core engineering pillars:
1. Technical Execution & Architecture
2. Problem Solving & Technical Judgment
3. Velocity, Consistency & Delivery Momentum
4. Cross-Functional Alignment & Ownership
Cite specific chained initiatives and outcomes from the ledger.`;
    } else {
      goalPrompt = `You are a developer relations expert and technical author.
Review the following Continuous Workload & Career Ledger for Salitha Marasinghe.
Generate 2 engaging, professional LinkedIn accomplishment posts celebrating key engineering achievements, lessons learned, and architectural decisions made over this period.`;
    }

    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant-chat`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: `${goalPrompt}\n\n### COMPILED WORK LEDGER:\n\n${markdownContent.slice(0, 15000)}`,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            currentTimeISO: new Date().toISOString(),
            context: {
              today: new Date().toISOString().slice(0, 10),
              currentTimeLocal: new Date().toLocaleTimeString(),
              todaysTasks: [],
              todaysEvents: [],
              pastUnfinishedTasks: [],
            },
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`AI synthesis error: ${response.statusText}`);
      }

      const resJson = await response.json();
      setSynthesisOutput(resJson.replyText || 'No output generated.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Synthesis failed';
      toast.error(msg);
      console.error(err);
    } finally {
      setIsSynthesizing(false);
    }
  };

  // ── Download & Copy Handlers ────────────────────────────────────────────────
  const handleDownload = () => {
    const blob = new Blob([markdownContent], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `salitha_career_ledger_${startDate}_to_${endDate}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Downloaded Career Ledger Markdown (.md)! 🎉');
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(markdownContent);
    toast.success('Career Ledger copied to clipboard!');
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-[#080808] rounded-2xl shadow-2xl border border-[#161616] w-full max-w-6xl h-[92vh] flex flex-col overflow-hidden text-slate-200">
        {/* ── Modal Header ──────────────────────────────────────────────────── */}
        <div className="px-6 py-4 border-b border-[#161616] bg-[#0a0a0a] flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-100">
                  Continuous Workload & Career Ledger
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950/70 text-amber-300 border border-amber-800/60 uppercase tracking-wider">
                  Promotion Ready
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Compile months of chained engineering sessions into a verified Google XYZ portfolio.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#141414] hover:bg-[#141414] border border-[#1a1a1a] text-xs font-semibold text-slate-200 transition"
              title="Copy Markdown to Clipboard"
            >
              <Copy className="w-3.5 h-3.5 text-teal-400" />
              <span className="hidden sm:inline">Copy .md</span>
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-slate-900 text-xs font-bold transition shadow-sm"
              title="Download Markdown Document"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download .md</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 hover:bg-[#141414] rounded-full text-slate-400 hover:text-slate-200 transition ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── Filters & Controls Bar ────────────────────────────────────────── */}
        <div className="px-6 py-3 border-b border-[#111111] bg-[#080808] flex flex-wrap items-center justify-between gap-3 text-xs flex-shrink-0">
          {/* Presets */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mr-1">
              Range:
            </span>
            {(['7d', '30d', '90d', '180d', 'all'] as DatePreset[]).map((p) => {
              const label =
                p === '7d' ? '7D' : p === '30d' ? '1M' : p === '90d' ? '3M' : p === '180d' ? '6 Months' : 'All';
              const active = preset === p;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => applyPreset(p)}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition ${
                    active
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'bg-[#0a0a0a] text-slate-300 hover:bg-[#141414]'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Date Inputs */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 font-mono text-[11px] bg-[#080808] px-2.5 py-1 rounded border border-[#161616]">
              <Calendar className="w-3 h-3 text-slate-500" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPreset('custom');
                }}
                className="bg-transparent text-slate-200 outline-none w-24 text-[11px]"
              />
              <span className="text-slate-600">→</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPreset('custom');
                }}
                className="bg-transparent text-slate-200 outline-none w-24 text-[11px]"
              />
            </div>

            {/* Project Tag Dropdown */}
            {compiledLedger.projectTags.length > 0 && (
              <div className="flex items-center gap-1">
                <Tag className="w-3 h-3 text-slate-500" />
                <select
                  value={selectedTag}
                  onChange={(e) => setSelectedTag(e.target.value)}
                  className="bg-[#080808] text-slate-200 border border-[#161616] rounded px-2 py-1 text-xs outline-none cursor-pointer"
                >
                  <option value="all">All Projects ({compiledLedger.projectTags.length})</option>
                  {compiledLedger.projectTags.map((t) => (
                    <option key={t} value={t}>
                      #{t}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* ── View Navigation Tabs ─────────────────────────────────────────── */}
        <div className="px-6 border-b border-[#111111] bg-[#080808] flex items-center justify-between gap-4 flex-shrink-0">
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => setActiveTab('storylines')}
              className={`py-3 text-xs sm:text-sm font-semibold flex items-center gap-2 border-b-2 transition ${
                activeTab === 'storylines'
                  ? 'border-amber-400 text-amber-300'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <GitBranch className="w-4 h-4" />
              <span>Chained Storylines ({compiledLedger.storylines.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('chronological')}
              className={`py-3 text-xs sm:text-sm font-semibold flex items-center gap-2 border-b-2 transition ${
                activeTab === 'chronological'
                  ? 'border-teal-400 text-teal-300'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>Chronological Log ({compiledLedger.weeks.length} Weeks)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('markdown')}
              className={`py-3 text-xs sm:text-sm font-semibold flex items-center gap-2 border-b-2 transition ${
                activeTab === 'markdown'
                  ? 'border-purple-400 text-purple-300'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Markdown Document</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('synthesis');
                if (!synthesisOutput) runSynthesis('resume');
              }}
              className={`py-3 text-xs sm:text-sm font-semibold flex items-center gap-2 border-b-2 transition ${
                activeTab === 'synthesis'
                  ? 'border-rose-400 text-rose-300'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sparkles className="w-4 h-4 text-rose-400" />
              <span>AI Career Synthesis</span>
            </button>
          </div>

          {/* Quick Metrics */}
          <div className="hidden md:flex items-center gap-3 text-xs font-mono text-slate-400">
            <span className="flex items-center gap-1">
              <Briefcase className="w-3.5 h-3.5 text-teal-400" />
              {compiledLedger.workEventsCount} Work Sessions
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-purple-400" />
              {compiledLedger.meetingEventsCount} Meetings
            </span>
          </div>
        </div>

        {/* ── Main Content Area ────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-6 bg-[#000000]">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-64 gap-2 text-slate-400 text-xs">
              <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
              <span>Compiling Career Ledger across {startDate} to {endDate}…</span>
            </div>
          ) : compiledLedger.totalEvents === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 gap-2 text-slate-500 text-xs text-center">
              <FileText className="w-10 h-10 text-slate-600 mb-1" />
              <p className="font-semibold text-slate-400">No events found in this date range.</p>
              <p>Adjust your date range or log meetings and work sessions to populate your ledger.</p>
            </div>
          ) : (
            <>
              {/* TAB 1: STORYLINES (CHAINS) */}
              {activeTab === 'storylines' && (
                <div className="flex flex-col gap-5 max-w-4xl mx-auto">
                  <div className="p-3 bg-amber-950/20 border border-amber-800/40 rounded-xl text-xs text-amber-200 flex items-center justify-between">
                    <span>
                      Showing <strong>{compiledLedger.storylines.length}</strong> multi-session initiative threads. Each thread traces strategic problem formulation directly to shipped results.
                    </span>
                    <span className="text-[11px] font-mono text-amber-400 font-bold shrink-0 ml-2">
                      {compiledLedger.storylines.length} Initiatives
                    </span>
                  </div>

                  {compiledLedger.storylines.map((storyline, idx) => (
                    <div
                      key={storyline.chainId}
                      className="p-5 bg-[#080808] rounded-xl border border-[#161616] flex flex-col gap-4 shadow-sm"
                    >
                      {/* Storyline Header */}
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950/70 text-amber-300 border border-amber-800/60 uppercase">
                              Storyline #{idx + 1}
                            </span>
                            {storyline.projectStatus && (
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                  storyline.projectStatus === 'completed'
                                    ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/60'
                                    : 'bg-blue-950/80 text-blue-300 border border-blue-800/60'
                                }`}
                              >
                                {storyline.projectStatus}
                              </span>
                            )}
                            {storyline.projectTag && (
                              <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-[#0a0a0a] text-slate-300 border border-[#1a1a1a]">
                                <Tag className="w-3 h-3 text-teal-400" />
                                {storyline.projectTag}
                              </span>
                            )}
                          </div>
                          <h3 className="font-bold text-base text-slate-100">{storyline.title}</h3>
                          <div className="flex items-center gap-2 text-xs text-slate-400 font-mono flex-wrap">
                            {storyline.projectCreatedAt && (
                              <>
                                <span className="text-amber-300/90 font-medium">
                                  Inception: {new Date(storyline.projectCreatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                </span>
                                <span>•</span>
                              </>
                            )}
                            <span>
                              Window: {storyline.startDate} – {storyline.endDate} ({storyline.events.length} sessions: {storyline.meetings.length} meetings, {storyline.workSessions.length} work logs)
                            </span>
                          </div>
                        </div>
                        <span className="text-[10px] font-mono text-slate-500 bg-[#000000] px-2 py-1 rounded border border-[#111111]">
                          Chain: {storyline.chainId.slice(0, 8)}…
                        </span>
                      </div>

                      {/* Interleaved Causal Progression Spine */}
                      <div className="relative pl-6 sm:pl-8 flex flex-col gap-4 before:absolute before:left-3 sm:before:left-3.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-gradient-to-b before:from-purple-500/50 before:via-teal-500/50 before:to-amber-500/50 my-1">
                        {storyline.events.map((ev, stepIdx) => {
                          const isMeeting = ev.type === 'meeting';
                          return (
                            <div key={ev.id} className="relative group">
                              {/* Spine Node Icon */}
                              <div
                                className={`absolute -left-[23px] sm:-left-[25px] top-3.5 w-7 h-7 rounded-full flex items-center justify-center border-2 shadow-sm ${
                                  isMeeting
                                    ? 'bg-[#0a0a0a] border-purple-500 text-purple-300'
                                    : 'bg-[#0a0a0a] border-teal-500 text-teal-300'
                                }`}
                              >
                                {isMeeting ? (
                                  <Users className="w-3.5 h-3.5" />
                                ) : (
                                  <Briefcase className="w-3.5 h-3.5" />
                                )}
                              </div>

                              {/* Step Card */}
                              <div
                                className={`p-4 rounded-xl border text-xs flex flex-col gap-3 transition ${
                                  isMeeting
                                    ? 'bg-[#080808]/90 border-purple-900/40 hover:border-purple-800/60'
                                    : 'bg-[#000000]/90 border-teal-900/40 hover:border-teal-800/60'
                                }`}
                              >
                                {/* Step Header */}
                                <div className="flex items-start justify-between gap-3 flex-wrap">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span
                                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                        isMeeting
                                          ? 'bg-purple-950 text-purple-300 border border-purple-800/70'
                                          : 'bg-teal-950 text-teal-300 border border-teal-800/70'
                                      }`}
                                    >
                                      Step {stepIdx + 1} • {isMeeting ? 'Alignment & Strategy' : 'Engineering Execution'}
                                    </span>
                                    <h4 className="font-bold text-sm text-slate-100">{ev.title}</h4>
                                  </div>
                                  <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400">
                                    <Clock className="w-3 h-3 text-slate-500" />
                                    <span>
                                      {ev.date} {ev.startTime ? `(${ev.startTime} – ${ev.endTime})` : ''}
                                    </span>
                                  </div>
                                </div>

                                {/* Meeting Details */}
                                {isMeeting && (
                                  <div className="flex flex-col gap-2.5">
                                    {ev.discussionSummary && (
                                      <div className="pl-3 border-l-2 border-purple-800/50">
                                        <MarkdownViewer content={ev.discussionSummary} className="text-xs" />
                                      </div>
                                    )}

                                    {ev.decisions && !ev.discussionSummary?.includes('Agreed Decisions') && (
                                      <div className="p-3 bg-purple-950/40 rounded-lg border border-purple-800/50 text-[11px] text-purple-200">
                                        <div className="flex items-center gap-1.5 text-purple-300 font-bold uppercase tracking-wider text-[10px] mb-1">
                                          <span>⚖️ Agreed Decisions & Direction</span>
                                        </div>
                                        <p className="whitespace-pre-wrap leading-relaxed">{ev.decisions}</p>
                                      </div>
                                    )}

                                    {ev.tasksAssigned && ev.tasksAssigned.length > 0 && !ev.discussionSummary?.includes('Action Items') && (
                                      <div className="p-2.5 bg-[#000000] rounded-lg border border-purple-950 flex flex-col gap-1.5 text-[11px]">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                          Action Items / To-Dos ({ev.tasksAssigned.filter((t) => t.done).length}/{ev.tasksAssigned.length} done):
                                        </span>
                                        <div className="space-y-1">
                                          {ev.tasksAssigned.map((task, tIdx) => (
                                            <div key={tIdx} className="flex items-center gap-2 text-slate-300">
                                              <span
                                                className={`w-3.5 h-3.5 rounded flex items-center justify-center text-[10px] ${
                                                  task.done
                                                    ? 'bg-teal-900/60 text-teal-400 border border-teal-700/60 font-bold'
                                                    : 'border border-slate-600 text-transparent'
                                                }`}
                                              >
                                                {task.done ? '✓' : ''}
                                              </span>
                                              <span className={task.done ? 'line-through text-slate-500' : 'text-slate-200'}>
                                                {task.text}
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    {ev.links && ev.links.length > 0 && (
                                      <div className="flex items-center gap-2 flex-wrap pt-1">
                                        {ev.links.map((link, lIdx) => (
                                          <a
                                            key={lIdx}
                                            href={link.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-purple-950/60 hover:bg-purple-900/60 border border-purple-800/60 text-purple-300 text-[11px] font-medium transition"
                                          >
                                            <ExternalLink className="w-3 h-3" />
                                            <span>{link.label || link.url}</span>
                                          </a>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Work Session Details */}
                                {!isMeeting && (
                                  <div className="flex flex-col gap-2.5">
                                    {ev.description && (
                                      <div className="pl-3 border-l-2 border-teal-800/50">
                                        <MarkdownViewer content={ev.description} className="text-xs" />
                                      </div>
                                    )}

                                    {ev.implementationNotes && (
                                      <div className="p-3 bg-[#000000] rounded-lg border border-teal-950 text-[11px] font-mono text-slate-300 overflow-x-auto">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-teal-400 block mb-1">
                                          Technical Execution & Notes:
                                        </span>
                                        <pre className="whitespace-pre-wrap">{ev.implementationNotes}</pre>
                                      </div>
                                    )}

                                    {ev.links && ev.links.length > 0 && (
                                      <div className="flex items-center gap-2 flex-wrap pt-1">
                                        {ev.links.map((link, lIdx) => (
                                          <a
                                            key={lIdx}
                                            href={link.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-teal-950/60 hover:bg-teal-900/60 border border-teal-800/60 text-teal-300 text-[11px] font-medium transition"
                                          >
                                            <ExternalLink className="w-3 h-3" />
                                            <span>{link.label || link.url}</span>
                                          </a>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}

                  {/* Standalone Accomplishments */}
                  {compiledLedger.standaloneEvents.length > 0 && (
                    <div className="p-4 bg-[#080808] rounded-xl border border-[#161616] flex flex-col gap-3">
                      <h4 className="font-bold text-sm text-slate-200">
                        Standalone Accomplishments ({compiledLedger.standaloneEvents.length})
                      </h4>
                      <p className="text-xs text-slate-400">
                        Independent tasks and sessions executed outside of a multi-step chain.
                      </p>
                      <div className="space-y-2 mt-1">
                        {compiledLedger.standaloneEvents.slice(0, 10).map((ev) => (
                          <div
                            key={ev.id}
                            className="p-2.5 bg-[#000000] rounded-lg border border-[#161616] text-xs flex items-center justify-between"
                          >
                            <span className="font-medium text-slate-300">
                              [{ev.type.toUpperCase()}] {ev.title}
                            </span>
                            <span className="font-mono text-slate-400 text-[11px]">{ev.date}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: CHRONOLOGICAL LOG */}
              {activeTab === 'chronological' && (
                <div className="flex flex-col gap-5 max-w-4xl mx-auto">
                  {/* Subheader & Sort Control */}
                  <div className="flex items-center justify-between p-3.5 bg-[#080808] rounded-xl border border-[#161616] text-xs">
                    <div className="flex items-center gap-2 text-slate-300">
                      <Calendar className="w-4 h-4 text-teal-400" />
                      <span>
                        Showing <strong>{compiledLedger.weeks.length} weeks</strong> ({compiledLedger.totalEvents} events: {compiledLedger.workEventsCount} work sessions, {compiledLedger.meetingEventsCount} meetings)
                      </span>
                    </div>
                    <button
                      onClick={() => setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0a0a0a] hover:bg-[#141414] text-teal-300 font-semibold border border-[#1a1a1a] transition shadow-sm text-xs"
                      title="Toggle chronological vs reverse-chronological order"
                    >
                      <ArrowUpDown className="w-3.5 h-3.5 text-teal-400" />
                      <span>Order: {sortOrder === 'asc' ? 'Oldest First (Chronological)' : 'Newest First'}</span>
                    </button>
                  </div>

                  {compiledLedger.weeks.map((week) => (
                    <div
                      key={week.weekKey}
                      className="p-4 bg-[#080808] rounded-xl border border-[#161616] flex flex-col gap-4 shadow-sm"
                    >
                      <div className="flex items-center justify-between pb-2 border-b border-[#161616]">
                        <h3 className="font-bold text-sm text-teal-300 flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-teal-400" />
                          {week.weekLabel}
                        </h3>
                        <span className="text-xs font-mono text-slate-400">
                          {week.totalEvents} events logged
                        </span>
                      </div>

                      <div className="space-y-4">
                        {week.days.map((day) => (
                          <div key={day.date} className="flex flex-col gap-2">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                              {day.dayOfWeek}, {day.date}
                            </span>

                            <div className="space-y-2.5 pl-2 border-l border-[#161616]">
                              {day.events.map((ev) => (
                                <div
                                  key={ev.id}
                                  className="p-3.5 bg-[#000000] rounded-lg border border-[#111111] text-xs flex flex-col gap-2"
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span
                                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                                          ev.type === 'meeting'
                                            ? 'bg-purple-950/70 text-purple-300 border border-purple-800/60'
                                            : 'bg-teal-950/70 text-teal-300 border border-teal-800/60'
                                        }`}
                                      >
                                        {ev.type}
                                      </span>
                                      <span className="font-semibold text-slate-200">
                                        {ev.title}
                                      </span>
                                      {ev.projectTag && (
                                        <span className="text-[10px] font-mono text-slate-400 bg-[#0a0a0a] px-1.5 py-0.5 rounded border border-[#161616]">
                                          #{ev.projectTag}
                                        </span>
                                      )}
                                    </div>
                                    <span className="text-[11px] font-mono text-slate-400">
                                      {ev.startTime || '??'} – {ev.endTime || '??'}
                                    </span>
                                  </div>

                                  {ev.chainId && (
                                    <div className="flex items-center gap-1 text-[11px] text-amber-300">
                                      <GitBranch className="w-3 h-3 text-amber-400" />
                                      <span>Chained thread ({ev.chainId.slice(0, 8)}…)</span>
                                    </div>
                                  )}

                                  {/* Work Event Details */}
                                  {ev.type === 'work' && ev.description && (
                                    <div className="mt-1 pl-3 border-l-2 border-teal-800/60">
                                      <MarkdownViewer content={ev.description} className="text-xs" />
                                    </div>
                                  )}

                                  {/* Meeting Event Details */}
                                  {ev.type === 'meeting' && (
                                    <div className="mt-1 pl-3 border-l-2 border-purple-800/60 flex flex-col gap-2">
                                      {ev.discussionSummary && (
                                        <MarkdownViewer content={ev.discussionSummary} className="text-xs" />
                                      )}
                                      {ev.decisions && (
                                        <div className="p-2.5 bg-purple-950/40 rounded-lg border border-purple-800/40 text-[11px] text-purple-200">
                                          <strong className="text-purple-300 block mb-0.5 font-bold uppercase tracking-wider text-[10px]">
                                            Agreed Decisions:
                                          </strong>
                                          <p className="whitespace-pre-wrap">{ev.decisions}</p>
                                        </div>
                                      )}
                                      {ev.tasksAssigned && ev.tasksAssigned.length > 0 && (
                                        <div className="flex flex-col gap-1 text-[11px] bg-[#080808] p-2 rounded-lg border border-[#111111]">
                                          <strong className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">
                                            Action Items ({ev.tasksAssigned.filter((t) => t.done).length}/{ev.tasksAssigned.length} completed):
                                          </strong>
                                          {ev.tasksAssigned.map((task, idx) => (
                                            <div key={idx} className="flex items-center gap-1.5 text-slate-300">
                                              <span className={task.done ? 'line-through text-slate-500' : 'text-slate-200 font-medium'}>
                                                {task.done ? '✓' : '○'} {task.text}
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* TAB 3: RAW MARKDOWN DOCUMENT */}
              {activeTab === 'markdown' && (
                <div className="flex flex-col gap-3 max-w-4xl mx-auto">
                  <div className="flex items-center justify-between p-3 bg-[#0a0a0a] rounded-xl border border-[#161616] text-xs">
                    <span className="text-slate-300">
                      Standardized Markdown compiled using Google XYZ format. Ready to export, download, or feed to external models.
                    </span>
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="flex items-center gap-1 px-3 py-1 bg-teal-600 hover:bg-teal-500 text-slate-950 rounded font-bold text-xs transition"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      Copy All Markdown
                    </button>
                  </div>

                  <div className="p-6 bg-[#000000] rounded-xl border border-[#111111] text-xs font-mono leading-relaxed overflow-x-auto select-text whitespace-pre-wrap text-slate-300">
                    {markdownContent}
                  </div>
                </div>
              )}

              {/* TAB 4: AI CAREER SYNTHESIS */}
              {activeTab === 'synthesis' && (
                <div className="flex flex-col gap-4 max-w-4xl mx-auto">
                  {/* Synthesis Recipe Selector */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={() => runSynthesis('resume')}
                      className={`p-3.5 rounded-xl border text-left transition flex flex-col gap-1 ${
                        synthesisMode === 'resume'
                          ? 'bg-rose-950/40 border-rose-700/60 text-rose-200'
                          : 'bg-[#080808] border-[#161616] text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span className="font-bold text-xs text-rose-300 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-rose-400" />
                        Resume Bullets (Google XYZ)
                      </span>
                      <p className="text-[11px] text-slate-400">
                        Extracts 5–7 high-impact resume bullets ready for LinkedIn and CVs.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => runSynthesis('promotion')}
                      className={`p-3.5 rounded-xl border text-left transition flex flex-col gap-1 ${
                        synthesisMode === 'promotion'
                          ? 'bg-amber-950/40 border-amber-700/60 text-amber-200'
                          : 'bg-[#080808] border-[#161616] text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span className="font-bold text-xs text-amber-300 flex items-center gap-1.5">
                        <AwardIcon className="w-3.5 h-3.5 text-amber-400" />
                        Promotion Dossier
                      </span>
                      <p className="text-[11px] text-slate-400">
                        Evaluates leadership, technical complexity, velocity, and delivery.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => runSynthesis('linkedin')}
                      className={`p-3.5 rounded-xl border text-left transition flex flex-col gap-1 ${
                        synthesisMode === 'linkedin'
                          ? 'bg-blue-950/40 border-blue-700/60 text-blue-200'
                          : 'bg-[#080808] border-[#161616] text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span className="font-bold text-xs text-blue-300 flex items-center gap-1.5">
                        <ExternalLink className="w-3.5 h-3.5 text-blue-400" />
                        LinkedIn Highlights
                      </span>
                      <p className="text-[11px] text-slate-400">
                        Writes compelling accomplishment stories for public profile visibility.
                      </p>
                    </button>
                  </div>

                  {/* AI Generation Output */}
                  <div className="p-5 bg-[#080808] rounded-xl border border-[#161616] flex flex-col gap-3 min-h-[300px]">
                    <div className="flex items-center justify-between pb-2 border-b border-[#161616]">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-rose-400" />
                        {synthesisMode === 'resume'
                          ? 'Synthesized Resume Bullets'
                          : synthesisMode === 'promotion'
                          ? 'Performance & Promotion Dossier'
                          : 'LinkedIn Accomplishment Posts'}
                      </span>
                      {synthesisOutput && (
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(synthesisOutput);
                            toast.success('Copied AI synthesis to clipboard!');
                          }}
                          className="flex items-center gap-1 text-xs text-teal-300 hover:text-teal-200 font-semibold"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          Copy Result
                        </button>
                      )}
                    </div>

                    {isSynthesizing ? (
                      <div className="flex flex-col items-center justify-center flex-1 gap-2 text-slate-400 text-xs py-12">
                        <div className="w-7 h-7 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
                        <span>Synthesizing career assets with OpenRouter...</span>
                      </div>
                    ) : synthesisOutput ? (
                      <div className="text-xs leading-relaxed text-slate-200">
                        <MarkdownViewer content={synthesisOutput} className="text-xs" />
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center flex-1 text-slate-500 text-xs py-12">
                        Select a recipe above to generate your career assets.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

function AwardIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="8" r="6" />
      <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
    </svg>
  );
}
