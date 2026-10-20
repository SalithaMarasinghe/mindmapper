import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Calendar,
  Clock,
  Briefcase,
  Users,
  Copy,
  Download,
  FileText,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Search,
  ArrowUpDown,
  ExternalLink,
  Edit2,
  X,
  Eye,
  RefreshCw,
  FolderGit2,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useTimelineStore } from '../../store/timelineStore';
import { useAuthStore } from '../../store/authStore';
import type { TimelineEventFull } from '../../types';
import { EventDetailView } from '../timeline/EventDetailView';
import { EventModal } from '../timeline/EventModal';
import { MarkdownViewer } from '../common/MarkdownViewer';
import { supabase } from '../../lib/supabase';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(t: string | null): string {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

function calculateDuration(start: string | null, end: string | null): string {
  if (!start || !end) return '';
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;
  const diffMin = endMin - startMin;
  if (diffMin <= 0) return '';
  const hours = Math.floor(diffMin / 60);
  const mins = diffMin % 60;
  if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h`;
  return `${mins}m`;
}

function formatDateDisplay(dateStr: string): string {
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

type DatePreset = 'this_month' | 'last_30d' | 'last_90d' | 'all' | 'custom';
type TypeFilter = 'all' | 'work' | 'meeting';
type SortOrder = 'asc' | 'desc';

export function WorkSummaryView() {
  const { projects, activeProjectId, fetchProjects, fetchRange } = useTimelineStore();
  const user = useAuthStore((s) => s.user);

  // ── Date Filters ────────────────────────────────────────────────────────────
  const [datePreset, setDatePreset] = useState<DatePreset>('this_month');

  const defaultDates = useMemo(() => {
    const today = new Date();
    const endStr = today.toISOString().slice(0, 10);
    // 1st of current month
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const startStr = firstDay.toISOString().slice(0, 10);
    return { startStr, endStr };
  }, []);

  const [startDate, setStartDate] = useState(defaultDates.startStr);
  const [endDate, setEndDate] = useState(defaultDates.endStr);

  const applyDatePreset = (preset: DatePreset) => {
    setDatePreset(preset);
    const today = new Date();
    const endStr = today.toISOString().slice(0, 10);

    if (preset === 'this_month') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      setStartDate(firstDay.toISOString().slice(0, 10));
      setEndDate(endStr);
    } else if (preset === 'last_30d') {
      const start = new Date(today);
      start.setDate(start.getDate() - 30);
      setStartDate(start.toISOString().slice(0, 10));
      setEndDate(endStr);
    } else if (preset === 'last_90d') {
      const start = new Date(today);
      start.setDate(start.getDate() - 90);
      setStartDate(start.toISOString().slice(0, 10));
      setEndDate(endStr);
    } else if (preset === 'all') {
      setStartDate('2024-01-01');
      setEndDate(endStr);
    }
  };

  // ── Project & Other Filters ─────────────────────────────────────────────────
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc'); // Default chronological ascending
  const [searchQuery, setSearchQuery] = useState('');

  // ── Data State ──────────────────────────────────────────────────────────────
  const [events, setEvents] = useState<TimelineEventFull[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // ── Modals & Drawers ────────────────────────────────────────────────────────
  const [expandedEventIds, setExpandedEventIds] = useState<Set<string>>(new Set());
  const [modalEvent, setModalEvent] = useState<TimelineEventFull | null>(null);
  const [editingEvent, setEditingEvent] = useState<TimelineEventFull | null>(null);
  const [isPreviewExportOpen, setIsPreviewExportOpen] = useState(false);

  // ── AI Synthesis State ──────────────────────────────────────────────────────
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [synthesisOutput, setSynthesisOutput] = useState<string | null>(null);
  const [isSynthesisModalOpen, setIsSynthesisModalOpen] = useState(false);

  // Load Projects on mount
  useEffect(() => {
    if (projects.length === 0) {
      void fetchProjects();
    }
  }, [projects.length, fetchProjects]);

  // Sync default selected project to activeProjectId once available
  useEffect(() => {
    if (activeProjectId && selectedProjectId === 'all') {
      setSelectedProjectId(activeProjectId);
    }
  }, [activeProjectId]);

  // Load Events whenever date range changes
  const loadEvents = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchRange(startDate, endDate);
      setEvents(data);
    } catch (err) {
      console.error('Failed to load events for Work Summary:', err);
      toast.error('Failed to load timeline events.');
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate, fetchRange]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  // ── Filtered & Sorted Events ────────────────────────────────────────────────
  const activeProject = useMemo(() => {
    if (selectedProjectId === 'all') return null;
    return projects.find((p) => p.id === selectedProjectId) || null;
  }, [projects, selectedProjectId]);

  const filteredEvents = useMemo(() => {
    let result = [...events];

    // Filter by Project
    if (selectedProjectId !== 'all' && activeProject) {
      const targetName = activeProject.name.toLowerCase().trim();
      result = result.filter((ev) => {
        if (ev.projectId && ev.projectId === selectedProjectId) return true;
        if (ev.projectTag && ev.projectTag.toLowerCase().trim() === targetName) return true;
        return false;
      });
    }

    // Filter by Type
    if (typeFilter !== 'all') {
      result = result.filter((ev) => ev.type === typeFilter);
    }

    // Filter by Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((ev) => {
        const titleMatch = ev.title.toLowerCase().includes(q);
        const xyzMatch = ev.summaryXyz?.toLowerCase().includes(q);
        const projectMatch = ev.projectTag?.toLowerCase().includes(q);
        const descMatch =
          ev.type === 'work'
            ? ev.description?.toLowerCase().includes(q)
            : ev.discussionSummary?.toLowerCase().includes(q);
        return titleMatch || xyzMatch || projectMatch || descMatch;
      });
    }

    // Sort Chronologically
    result.sort((a, b) => {
      const dateCmp = a.date.localeCompare(b.date);
      if (dateCmp !== 0) return sortOrder === 'asc' ? dateCmp : -dateCmp;
      const timeA = a.startTime || '00:00';
      const timeB = b.startTime || '00:00';
      return sortOrder === 'asc' ? timeA.localeCompare(timeB) : timeB.localeCompare(timeA);
    });

    return result;
  }, [events, selectedProjectId, activeProject, typeFilter, searchQuery, sortOrder]);

  // Metrics
  const metrics = useMemo(() => {
    const total = filteredEvents.length;
    const workCount = filteredEvents.filter((e) => e.type === 'work').length;
    const meetingCount = filteredEvents.filter((e) => e.type === 'meeting').length;

    let totalMinutes = 0;
    filteredEvents.forEach((e) => {
      if (e.startTime && e.endTime) {
        const [sh, sm] = e.startTime.split(':').map(Number);
        const [eh, em] = e.endTime.split(':').map(Number);
        const diff = eh * 60 + em - (sh * 60 + sm);
        if (diff > 0) totalMinutes += diff;
      }
    });

    const hours = (totalMinutes / 60).toFixed(1);
    return { total, workCount, meetingCount, hours };
  }, [filteredEvents]);

  // Toggle inline description expansion
  const toggleExpand = (id: string) => {
    setExpandedEventIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => {
    setExpandedEventIds(new Set(filteredEvents.map((e) => e.id)));
  };

  const collapseAll = () => {
    setExpandedEventIds(new Set());
  };

  // ── Combined Markdown Compilation ───────────────────────────────────────────
  const compiledMarkdown = useMemo(() => {
    const projName = activeProject ? activeProject.name : 'All Projects & Storylines';
    const authorName = user?.user_metadata?.full_name || 'Salitha Marasinghe';

    const lines: string[] = [];
    lines.push(`# 🎯 Google XYZ Work & Executive Summary Ledger`);
    lines.push(`**Project:** ${projName}  `);
    lines.push(`**Author:** ${authorName}  `);
    lines.push(`**Period:** ${startDate} to ${endDate}  `);
    lines.push(
      `**Total Activity:** ${metrics.total} Milestones (${metrics.workCount} Work Sessions, ${metrics.meetingCount} Executive Alignments, ~${metrics.hours}h logged)  `
    );
    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push('## Chronological Google XYZ Milestones');
    lines.push(
      '> All milestones below follow the Google XYZ formula: **Accomplished [X], as measured by [Y], by doing [Z]**.\n'
    );

    if (filteredEvents.length === 0) {
      lines.push('*No records logged for this project and period.*');
    } else {
      filteredEvents.forEach((ev, i) => {
        const timeStr =
          ev.startTime && ev.endTime ? `${formatTime(ev.startTime)} – ${formatTime(ev.endTime)}` : '';
        const dur = calculateDuration(ev.startTime, ev.endTime);
        const typeLabel = ev.type === 'work' ? '🛠️ Work Journal' : '🤝 Executive Meeting';
        const cleanXyz = (ev.summaryXyz || '(No Google XYZ summary recorded)').trim();

        lines.push(`### ${i + 1}. ${ev.title}`);
        lines.push(`- **Date:** ${formatDateDisplay(ev.date)}${timeStr ? ` • ${timeStr}` : ''}${dur ? ` (${dur})` : ''}`);
        lines.push(`- **Type:** ${typeLabel}`);
        if (ev.projectTag) {
          lines.push(`- **Project:** \`${ev.projectTag}\``);
        }
        lines.push('');
        lines.push(`> **Google XYZ Summary:**  `);
        lines.push(`> ${cleanXyz.replace(/\n/g, '\n> ')}`);
        lines.push('');
      });
    }

    return lines.join('\n');
  }, [activeProject, user, startDate, endDate, metrics, filteredEvents]);

  // Export handlers
  const handleCopyAll = () => {
    navigator.clipboard.writeText(compiledMarkdown);
    toast.success('Chained Google XYZ summaries copied to clipboard!');
  };

  const handleDownloadMarkdown = () => {
    const projSlug = activeProject ? activeProject.name.toLowerCase().replace(/[^a-z0-9]+/g, '_') : 'all_projects';
    const filename = `work_summary_${projSlug}_${startDate}_to_${endDate}.md`;
    const blob = new Blob([compiledMarkdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Downloaded ${filename}!`);
  };

  // AI Master Monthly XYZ Synthesis
  const handleSynthesizeMasterXYZ = async () => {
    if (filteredEvents.length === 0) {
      toast.error('No events available to synthesize.');
      return;
    }

    setIsSynthesizing(true);
    setSynthesisOutput(null);
    setIsSynthesisModalOpen(true);

    const projName = activeProject ? activeProject.name : 'Engineering Portfolio';
    const prompt = `You are a Principal Engineering Director and elite Technical Executive Evaluator.
Review the following chronologically chained Google XYZ milestones for Salitha Marasinghe on project "${projName}" between ${startDate} and ${endDate}.

### GOAL:
Synthesize ALL the chronological achievements into a SINGLE unified, promotion-ready, high-impact master summary strictly following the Google XYZ formula:
"Accomplished [X], as measured by [Y], by doing [Z]."

### STRICT RULES:
1. Output MUST strictly follow the Google XYZ formula: "Accomplished [X], as measured by [Y], by doing [Z]".
2. 2 to 4 sentences maximum.
3. Promotion-ready, defensible numbers, technical architecture depth, concrete deliverables, and business impact.
4. No generic fluff or routine task descriptions.
5. Provide the master summary first, followed by a concise 3-bullet breakdown of the top pillars achieved.

### CHRONOLOGICAL MILESTONES:
${compiledMarkdown.slice(0, 15000)}`;

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
            message: prompt,
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
        throw new Error(`Synthesis API error: ${response.statusText}`);
      }

      const resJson = await response.json();
      setSynthesisOutput(resJson.replyText || 'No synthesis generated.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Synthesis failed';
      toast.error(msg);
      console.error(err);
    } finally {
      setIsSynthesizing(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-bg overflow-hidden">
      {/* ── Top Header & Filter Controls ────────────────────────────────────────── */}
      <div className="bg-panel border-b border-border px-4 sm:px-6 py-4 shrink-0 flex flex-col gap-3.5 shadow-xs">
        {/* Row 1: Title, Project Selector, Quick Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-accent-dim text-accent border border-border">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-text tracking-tight">Work Summary</h1>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-accent-dim text-accent border border-accent/20">
                  Google XYZ Ledger
                </span>
              </div>
              <p className="text-xs text-text-muted">
                Project-driven chronological timeline of promotion-ready Google XYZ milestones.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSynthesizeMasterXYZ}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface hover:bg-surface-2 border border-border text-accent text-xs font-semibold transition shadow-xs hover:border-accent/40"
              title="Synthesize into single Monthly Google XYZ summary via AI"
            >
              <Sparkles className="w-3.5 h-3.5 text-accent" />
              <span>Synthesize Master XYZ</span>
            </button>

            <button
              type="button"
              onClick={() => setIsPreviewExportOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface hover:bg-surface-2 border border-border text-text text-xs font-semibold transition shadow-xs"
              title="Preview combined Google XYZ digest"
            >
              <Eye className="w-3.5 h-3.5 text-text-muted" />
              <span>Preview Ledger</span>
            </button>

            <button
              type="button"
              onClick={handleCopyAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface hover:bg-surface-2 border border-border text-text text-xs font-semibold transition shadow-xs"
              title="Copy all chained Google XYZ summaries to clipboard"
            >
              <Copy className="w-3.5 h-3.5 text-text-muted" />
              <span>Copy All</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadMarkdown}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-accent text-bg hover:opacity-90 text-xs font-bold transition shadow-xs"
              title="Download Markdown (.md) ledger"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export .md</span>
            </button>
          </div>
        </div>

        {/* Row 2: Filter Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-border/50 text-xs">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Project Selector */}
            <div className="flex items-center gap-1.5 bg-surface border border-border rounded-lg px-2.5 py-1.5 shadow-2xs">
              <FolderGit2 className="w-3.5 h-3.5 text-text-muted shrink-0" />
              <label htmlFor="project-select" className="text-text-muted font-medium shrink-0">
                Project:
              </label>
              <select
                id="project-select"
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="bg-transparent text-text font-semibold focus:outline-none cursor-pointer pr-1"
              >
                <option value="all" className="bg-panel text-text">
                  All Projects & Storylines
                </option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id} className="bg-panel text-text">
                    {p.name} {p.status ? `(${p.status})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Preset Selector */}
            <div className="flex items-center gap-1 bg-surface border border-border rounded-lg p-1 shadow-2xs">
              <button
                type="button"
                onClick={() => applyDatePreset('this_month')}
                className={`px-2.5 py-1 rounded-md font-medium transition ${
                  datePreset === 'this_month' ? 'bg-surface-2 text-text font-semibold shadow-2xs' : 'text-text-muted hover:text-text'
                }`}
              >
                This Month
              </button>
              <button
                type="button"
                onClick={() => applyDatePreset('last_30d')}
                className={`px-2.5 py-1 rounded-md font-medium transition ${
                  datePreset === 'last_30d' ? 'bg-surface-2 text-text font-semibold shadow-2xs' : 'text-text-muted hover:text-text'
                }`}
              >
                Last 30d
              </button>
              <button
                type="button"
                onClick={() => applyDatePreset('last_90d')}
                className={`px-2.5 py-1 rounded-md font-medium transition ${
                  datePreset === 'last_90d' ? 'bg-surface-2 text-text font-semibold shadow-2xs' : 'text-text-muted hover:text-text'
                }`}
              >
                Last 90d
              </button>
              <button
                type="button"
                onClick={() => applyDatePreset('all')}
                className={`px-2.5 py-1 rounded-md font-medium transition ${
                  datePreset === 'all' ? 'bg-surface-2 text-text font-semibold shadow-2xs' : 'text-text-muted hover:text-text'
                }`}
              >
                All Time
              </button>
            </div>

            {/* Custom Date Pickers */}
            <div className="flex items-center gap-1.5 bg-surface border border-border rounded-lg px-2 py-1 shadow-2xs">
              <Calendar className="w-3.5 h-3.5 text-text-muted shrink-0" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setDatePreset('custom');
                }}
                className="bg-transparent text-text font-medium focus:outline-none text-[11px] cursor-pointer"
              />
              <span className="text-text-muted text-[11px]">→</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setDatePreset('custom');
                }}
                className="bg-transparent text-text font-medium focus:outline-none text-[11px] cursor-pointer"
              />
            </div>

            {/* Type Filter */}
            <div className="flex items-center gap-1 bg-surface border border-border rounded-lg p-1 shadow-2xs">
              <button
                type="button"
                onClick={() => setTypeFilter('all')}
                className={`px-2 py-1 rounded-md transition ${
                  typeFilter === 'all' ? 'bg-surface-2 text-text font-semibold shadow-2xs' : 'text-text-muted hover:text-text'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter('work')}
                className={`px-2 py-1 rounded-md transition flex items-center gap-1 ${
                  typeFilter === 'work' ? 'bg-surface-2 text-text font-semibold shadow-2xs' : 'text-text-muted hover:text-text'
                }`}
              >
                <span>🛠️</span> Work
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter('meeting')}
                className={`px-2 py-1 rounded-md transition flex items-center gap-1 ${
                  typeFilter === 'meeting' ? 'bg-surface-2 text-text font-semibold shadow-2xs' : 'text-text-muted hover:text-text'
                }`}
              >
                <span>🤝</span> Meetings
              </button>
            </div>
          </div>

          {/* Right Controls: Sort Order & Expand/Collapse */}
          <div className="flex items-center gap-2">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-text-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search milestones..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-surface border border-border rounded-lg pl-8 pr-2.5 py-1 text-xs text-text placeholder:text-text-muted focus:outline-none focus:border-border-strong w-36 sm:w-44"
              />
            </div>

            {/* Sort Order Toggle */}
            <button
              type="button"
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="flex items-center gap-1 px-2.5 py-1 bg-surface border border-border rounded-lg text-text-secondary hover:text-text hover:bg-surface-2 transition"
              title={sortOrder === 'asc' ? 'Oldest first (Chronological)' : 'Newest first (Reverse)'}
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
              <span>{sortOrder === 'asc' ? 'Chronological' : 'Newest First'}</span>
            </button>

            {/* Expand / Collapse All */}
            <button
              type="button"
              onClick={expandedEventIds.size > 0 ? collapseAll : expandAll}
              className="px-2.5 py-1 bg-surface border border-border rounded-lg text-text-secondary hover:text-text hover:bg-surface-2 transition text-[11px]"
            >
              {expandedEventIds.size > 0 ? 'Collapse Details' : 'Expand All Details'}
            </button>

            {/* Reload button */}
            <button
              type="button"
              onClick={() => void loadEvents()}
              disabled={isLoading}
              className="p-1.5 bg-surface border border-border rounded-lg text-text-secondary hover:text-text hover:bg-surface-2 transition disabled:opacity-50"
              title="Refresh timeline data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Summary Metrics Bar ─────────────────────────────────────────────────── */}
      <div className="bg-panel/40 border-b border-border/60 px-4 sm:px-6 py-2.5 shrink-0 flex flex-wrap items-center justify-between text-xs text-text-secondary">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-text font-bold text-sm">{metrics.total}</span>
            <span className="text-text-muted">Milestones</span>
          </div>
          <span className="text-border">•</span>
          <div className="flex items-center gap-1.5">
            <span className="text-text font-bold text-sm">{metrics.workCount}</span>
            <span className="text-text-muted">Work Journals</span>
          </div>
          <span className="text-border">•</span>
          <div className="flex items-center gap-1.5">
            <span className="text-text font-bold text-sm">{metrics.meetingCount}</span>
            <span className="text-text-muted">Meetings</span>
          </div>
          <span className="text-border">•</span>
          <div className="flex items-center gap-1.5">
            <span className="text-text font-bold text-sm">{metrics.hours}h</span>
            <span className="text-text-muted">Total Focus</span>
          </div>
        </div>

        <div className="text-text-muted text-[11px] flex items-center gap-1.5">
          <span>Target:</span>
          <span className="text-text font-semibold">{activeProject ? activeProject.name : 'All Projects'}</span>
          <span>({startDate} to {endDate})</span>
        </div>
      </div>

      {/* ── Main Timeline Feed ──────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6">
        <div className="max-w-4xl mx-auto">
          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-text-muted">
              <RefreshCw className="w-6 h-6 animate-spin text-accent" />
              <p className="text-sm">Loading project chronological timeline...</p>
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-center border border-dashed border-border rounded-2xl bg-panel/30 p-8">
              <FileText className="w-10 h-10 text-text-muted opacity-40" />
              <h3 className="text-base font-semibold text-text">No records found</h3>
              <p className="text-xs text-text-muted max-w-md">
                There are no work or meeting journals logged for{' '}
                <span className="text-accent">{activeProject ? activeProject.name : 'this filter'}</span> within the
                selected work period ({startDate} to {endDate}).
              </p>
            </div>
          ) : (
            <div className="relative pl-6 sm:pl-8 border-l-2 border-border/80 space-y-8">
              {filteredEvents.map((event, index) => {
                const isWork = event.type === 'work';
                const isExpanded = expandedEventIds.has(event.id);
                const duration = calculateDuration(event.startTime, event.endTime);
                const timeString =
                  event.startTime && event.endTime
                    ? `${formatTime(event.startTime)} – ${formatTime(event.endTime)}`
                    : event.startTime
                    ? formatTime(event.startTime)
                    : '';

                return (
                  <div key={event.id} className="relative group">
                    {/* Timeline Node Indicator on the rail */}
                    <div
                      className={`absolute -left-[31px] sm:-left-[39px] top-1.5 w-7 h-7 rounded-full border-2 bg-panel flex items-center justify-center transition-transform group-hover:scale-110 shadow-sm ${
                        isWork
                          ? 'border-emerald-500/80 text-emerald-400'
                          : 'border-purple-500/80 text-purple-400'
                      }`}
                      title={`${isWork ? 'Work Journal' : 'Executive Meeting'} #${index + 1}`}
                    >
                      {isWork ? <Briefcase className="w-3.5 h-3.5" /> : <Users className="w-3.5 h-3.5" />}
                    </div>

                    {/* Timeline Card */}
                    <div className="bg-panel border border-border rounded-xl p-5 hover:border-border-strong transition-all shadow-sm flex flex-col gap-3.5">
                      {/* Card Header: Date, Time, Type, Status */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-text-muted px-2 py-0.5 rounded bg-surface border border-border">
                            #{index + 1}
                          </span>
                          <div className="flex items-center gap-1.5 text-xs text-text font-semibold">
                            <Calendar className="w-3.5 h-3.5 text-text-muted" />
                            <span>{formatDateDisplay(event.date)}</span>
                          </div>
                          {timeString && (
                            <div className="flex items-center gap-1 text-xs text-text-secondary bg-surface px-2 py-0.5 rounded border border-border/60">
                              <Clock className="w-3 h-3 text-text-muted" />
                              <span>{timeString}</span>
                              {duration && <span className="text-text-muted font-normal">({duration})</span>}
                            </div>
                          )}
                        </div>

                        {/* Badges: Project, Type, Status */}
                        <div className="flex items-center gap-1.5">
                          {event.projectTag && (
                            <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-surface-2 text-text-secondary border border-border">
                              #{event.projectTag}
                            </span>
                          )}
                          <span
                            className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${
                              isWork
                                ? 'bg-emerald-950/30 text-emerald-400 border-emerald-800/40'
                                : 'bg-purple-950/30 text-purple-400 border-purple-800/40'
                            }`}
                          >
                            {isWork ? '🛠️ Work' : '🤝 Meeting'}
                          </span>
                          {isWork && event.status && (
                            <span
                              className={`text-[11px] font-medium px-2 py-0.5 rounded border ${
                                event.status === 'done'
                                  ? 'bg-surface text-text-secondary border-border'
                                  : 'bg-surface/80 text-text-muted border-border/50'
                              }`}
                            >
                              {event.status === 'done' ? 'Done' : 'In Progress'}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Event Title */}
                      <div>
                        <h2 className="text-base sm:text-lg font-bold text-text tracking-tight">{event.title}</h2>
                      </div>

                      {/* ── GOOGLE XYZ SUMMARY CALLOUT (Highlighted Feature) ── */}
                      <div className="bg-surface rounded-xl p-4 border border-border relative overflow-hidden group/xyz">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-accent px-2 py-0.5 rounded-full bg-accent-dim border border-accent/20 flex items-center gap-1">
                              <span>🎯</span> Google XYZ Summary
                            </span>
                            <span className="text-[11px] text-text-muted italic hidden sm:inline">
                              Accomplished [X], as measured by [Y], by doing [Z]
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              if (event.summaryXyz) {
                                navigator.clipboard.writeText(event.summaryXyz);
                                toast.success('Google XYZ Summary copied!');
                              }
                            }}
                            className="p-1 rounded text-text-muted hover:text-text hover:bg-surface-2 transition"
                            title="Copy this Google XYZ summary"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Summary Content */}
                        <p className="text-sm text-text leading-relaxed font-normal whitespace-pre-wrap">
                          {event.summaryXyz || (
                            <span className="text-text-muted italic">No Google XYZ summary provided.</span>
                          )}
                        </p>
                      </div>

                      {/* ── Action Bar: Dedicated Description & Modal References ── */}
                      <div className="flex items-center justify-between pt-1 text-xs">
                        <div className="flex items-center gap-2">
                          {/* Toggle Inline Description */}
                          <button
                            type="button"
                            onClick={() => toggleExpand(event.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface hover:bg-surface-2 text-text-secondary hover:text-text border border-border transition"
                          >
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            <span>{isExpanded ? 'Hide Dedicated Description' : 'View Dedicated Description'}</span>
                          </button>

                          {/* Full Modal Viewer */}
                          <button
                            type="button"
                            onClick={() => setModalEvent(event)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface hover:bg-surface-2 text-text-secondary hover:text-text border border-border transition"
                            title="Open full document in modal"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>Document Modal</span>
                          </button>
                        </div>

                        {/* Edit Button */}
                        <button
                          type="button"
                          onClick={() => setEditingEvent(event)}
                          className="flex items-center gap-1 px-2.5 py-1 text-text-muted hover:text-text hover:bg-surface rounded transition"
                          title="Edit this journal entry"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>
                      </div>

                      {/* ── INLINE DEDICATED DESCRIPTION (Accordion Drawer) ── */}
                      {isExpanded && (
                        <div className="mt-2 pt-4 border-t border-border/60 flex flex-col gap-3 animate-in fade-in duration-200">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-text-secondary uppercase tracking-wider flex items-center gap-1.5">
                              <FileText className="w-3.5 h-3.5" />
                              Dedicated Technical Description
                            </span>
                            <span className="text-[11px] text-text-muted">
                              Full executive report saved in database
                            </span>
                          </div>

                          <div className="bg-bg/60 border border-border/80 rounded-xl p-4 text-sm max-h-[500px] overflow-y-auto">
                            {isWork ? (
                              <div className="flex flex-col gap-4">
                                <MarkdownViewer
                                  content={event.description}
                                  emptyPlaceholder="No detailed technical description recorded."
                                />
                                {event.implementationNotes && (
                                  <div className="pt-3 border-t border-border/50">
                                    <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">
                                      Implementation Notes & Logs
                                    </h4>
                                    <p className="text-xs font-mono text-text-secondary whitespace-pre-wrap bg-surface p-2.5 rounded-lg border border-border/50">
                                      {event.implementationNotes}
                                    </p>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="flex flex-col gap-4">
                                <MarkdownViewer
                                  content={event.discussionSummary}
                                  emptyPlaceholder="No discussion summary recorded."
                                />
                                {event.decisions && (
                                  <div className="pt-3 border-t border-border/50">
                                    <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">
                                      Decisions Finalized
                                    </h4>
                                    <p className="text-xs text-text-secondary whitespace-pre-wrap bg-surface p-2.5 rounded-lg border border-border/50">
                                      {event.decisions}
                                    </p>
                                  </div>
                                )}
                                {event.tasksAssigned && event.tasksAssigned.length > 0 && (
                                  <div className="pt-3 border-t border-border/50">
                                    <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">
                                      Action Items ({event.tasksAssigned.length})
                                    </h4>
                                    <ul className="list-disc list-inside text-xs text-text-secondary space-y-1">
                                      {event.tasksAssigned.map((task, tidx) => (
                                        <li key={tidx}>
                                          {typeof task === 'string' ? task : task.text}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── MODAL: EventDetailView (Full-Screen Dedicated Document) ────────────── */}
      {modalEvent && (
        <EventDetailView
          event={modalEvent}
          onClose={() => setModalEvent(null)}
          onEdit={() => {
            const ev = modalEvent;
            setModalEvent(null);
            setEditingEvent(ev);
          }}
        />
      )}

      {/* ── MODAL: EventModal (Edit Existing Event) ────────────────────────────── */}
      {editingEvent && (
        <EventModal
          existingEvent={editingEvent}
          onClose={() => {
            setEditingEvent(null);
            void loadEvents();
          }}
        />
      )}

      {/* ── MODAL: Export Preview ──────────────────────────────────────────────── */}
      {isPreviewExportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-panel border border-border rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-text">Preview Chained Google XYZ Ledger</h3>
                <p className="text-xs text-text-muted">
                  Chronological combination of Google XYZ milestones for {activeProject ? activeProject.name : 'All Projects'}.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsPreviewExportOpen(false)}
                className="p-1 rounded-lg text-text-muted hover:text-text hover:bg-surface transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 font-mono text-xs bg-bg/50">
              <pre className="whitespace-pre-wrap text-text-secondary leading-relaxed">
                {compiledMarkdown}
              </pre>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 border-t border-border bg-panel flex items-center justify-between">
              <span className="text-xs text-text-muted">
                {metrics.total} milestones ready for export
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyAll}
                  className="px-3.5 py-1.5 rounded-lg bg-surface hover:bg-surface-2 border border-border text-text text-xs font-semibold transition"
                >
                  Copy to Clipboard
                </button>
                <button
                  type="button"
                  onClick={handleDownloadMarkdown}
                  className="px-3.5 py-1.5 rounded-lg bg-accent text-bg hover:opacity-90 text-xs font-bold transition flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download .md</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: AI Master Monthly XYZ Synthesis ────────────────────────────── */}
      {isSynthesisModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-panel border border-border rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-accent-dim text-accent">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-text">AI Master Monthly XYZ Synthesis</h3>
                  <p className="text-xs text-text-muted">
                    Consolidated 1-paragraph Google XYZ formula summary for your resume & monthly reviews.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSynthesisModalOpen(false)}
                className="p-1 rounded-lg text-text-muted hover:text-text hover:bg-surface transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {isSynthesizing ? (
                <div className="py-16 flex flex-col items-center justify-center gap-3 text-text-muted">
                  <RefreshCw className="w-6 h-6 animate-spin text-accent" />
                  <p className="text-sm font-medium text-text">
                    Synthesizing {metrics.total} chronological milestones into Google XYZ master formula...
                  </p>
                  <p className="text-xs text-text-muted max-w-xs text-center">
                    Extracting Accomplished [X], Measured by [Y], by doing [Z] across all sessions.
                  </p>
                </div>
              ) : synthesisOutput ? (
                <div className="space-y-4">
                  <div className="bg-surface rounded-xl p-4 border border-border">
                    <MarkdownViewer content={synthesisOutput} />
                  </div>
                </div>
              ) : (
                <div className="py-10 text-center text-text-muted text-xs">
                  No synthesis output available.
                </div>
              )}
            </div>

            <div className="px-6 py-3.5 border-t border-border bg-panel flex items-center justify-between">
              <button
                type="button"
                onClick={handleSynthesizeMasterXYZ}
                disabled={isSynthesizing}
                className="text-xs text-text-muted hover:text-text underline disabled:opacity-50"
              >
                Re-generate
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (synthesisOutput) {
                      navigator.clipboard.writeText(synthesisOutput);
                      toast.success('Master XYZ synthesis copied to clipboard!');
                    }
                  }}
                  disabled={!synthesisOutput}
                  className="px-4 py-1.5 rounded-lg bg-accent text-bg hover:opacity-90 text-xs font-bold transition disabled:opacity-50"
                >
                  Copy Master XYZ
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
