import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Loader2, Plus, Trash2, Link2, ChevronDown,
  Briefcase, Users,
} from 'lucide-react';
import { useTimelineStore } from '../../store/timelineStore';
import type { TimelineEventFull, EventLink, TaskItem, WorkStatus, EventType } from '../../types';
import type { NewEventDraft } from './WeekCalendar';
import { MarkdownEditor } from '../common/MarkdownEditor';

// ─── Shared input/label class tokens ─────────────────────────────────────────

const INPUT_CLS =
  'w-full rounded-lg border border-[#1a1a1a] bg-[#000000] px-3 py-2 text-sm text-slate-200 ' +
  'placeholder:text-slate-500 focus:border-teal-500 focus:outline-none focus:ring-2 ' +
  'focus:ring-teal-500/30 transition-shadow';

const LABEL_CLS = 'block text-sm font-semibold text-slate-300 mb-1.5';

const SECTION_CLS = 'flex flex-col gap-1.5';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EventModalProps {
  /** When creating: pass a draft with pre-filled date/times from the calendar drag */
  draft?: NewEventDraft;
  /** When editing: pass the full existing event */
  existingEvent?: TimelineEventFull;
  onClose: () => void;
}

// ─── Small sub-components ─────────────────────────────────────────────────────

function FieldLabel({ children, optional }: { children: React.ReactNode; optional?: boolean }) {
  return (
    <label className={LABEL_CLS}>
      {children}
      {optional && <span className="text-slate-500 font-normal ml-1">– Optional</span>}
    </label>
  );
}

// Links list editor (shared by both work + meeting forms)
function LinksEditor({ links, onChange }: { links: EventLink[]; onChange: (l: EventLink[]) => void }) {
  const add = () => onChange([...links, { label: '', url: '' }]);
  const remove = (i: number) => onChange(links.filter((_, idx) => idx !== i));
  const update = (i: number, field: keyof EventLink, val: string) => {
    const next = links.map((l, idx) => idx === i ? { ...l, [field]: val } : l);
    onChange(next);
  };

  return (
    <div className={SECTION_CLS}>
      <FieldLabel optional>Links</FieldLabel>
      <div className="flex flex-col gap-2">
        {links.map((link, i) => (
          <div key={i} className="flex gap-2 items-center">
            <input
              className={`${INPUT_CLS} flex-1`}
              placeholder="Label"
              value={link.label}
              onChange={e => update(i, 'label', e.target.value)}
            />
            <input
              className={`${INPUT_CLS} flex-[2]`}
              placeholder="https://..."
              type="url"
              value={link.url}
              onChange={e => update(i, 'url', e.target.value)}
            />
            <button
              type="button"
              onClick={() => remove(i)}
              aria-label="Remove link"
              className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-900/10 rounded-lg transition flex-shrink-0"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={add}
          className="flex items-center gap-1.5 text-xs font-semibold text-teal-400 hover:text-teal-300 transition w-fit"
        >
          <Plus className="w-3.5 h-3.5" /> Add link
        </button>
      </div>
    </div>
  );
}

// Tasks list editor (meeting form only)
function TasksEditor({ tasks, onChange }: { tasks: TaskItem[]; onChange: (t: TaskItem[]) => void }) {
  const add = () => onChange([...tasks, { text: '', done: false }]);
  const remove = (i: number) => onChange(tasks.filter((_, idx) => idx !== i));
  const update = (i: number, field: keyof TaskItem, val: string | boolean) => {
    const next = tasks.map((t, idx) => idx === i ? { ...t, [field]: val } : t);
    onChange(next);
  };

  return (
    <div className={SECTION_CLS}>
      <FieldLabel optional>Tasks Assigned</FieldLabel>
      <div className="flex flex-col gap-2">
        {tasks.map((task, i) => (
          <div key={i} className="flex gap-2 items-center">
            <input
              type="checkbox"
              checked={task.done}
              onChange={e => update(i, 'done', e.target.checked)}
              className="w-4 h-4 rounded border-[#1a1a1a] accent-teal-500 flex-shrink-0 cursor-pointer"
              aria-label="Task done"
            />
            <input
              className={`${INPUT_CLS} flex-1`}
              placeholder="Task description..."
              value={task.text}
              onChange={e => update(i, 'text', e.target.value)}
            />
            <button
              type="button"
              onClick={() => remove(i)}
              aria-label="Remove task"
              className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-900/10 rounded-lg transition flex-shrink-0"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={add}
          className="flex items-center gap-1.5 text-xs font-semibold text-teal-400 hover:text-teal-300 transition w-fit"
        >
          <Plus className="w-3.5 h-3.5" /> Add task
        </button>
      </div>
    </div>
  );
}

// ─── EventModal ───────────────────────────────────────────────────────────────

export function EventModal({ draft, existingEvent, onClose }: EventModalProps) {
  const isEditing = Boolean(existingEvent);

  const {
    createWorkEvent,
    createMeetingEvent,
    updateEvent,
    eventsByDate,
    projects,
    fetchProjects,
    createProject,
  } = useTimelineStore();

  // ── Shared fields ───────────────────────────────────────────────────────
  const [eventType, setEventType] = useState<EventType>(existingEvent?.type ?? 'work');
  const [title, setTitle]         = useState(existingEvent?.title ?? '');
  const [date, setDate]           = useState(existingEvent?.date ?? draft?.date ?? '');
  const [startTime, setStartTime] = useState(existingEvent?.startTime ?? draft?.startTime ?? '');
  const [endTime, setEndTime]     = useState(existingEvent?.endTime ?? draft?.endTime ?? '');
  const [projectTag, setProjectTag] = useState(existingEvent?.projectTag ?? '');
  const [projectId, setProjectId] = useState<string | null>(existingEvent?.projectId ?? null);
  const [isCreatingNewProject, setIsCreatingNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [previousEventId, setPreviousEventId] = useState(existingEvent?.previousEventId ?? null as string | null);
  const [chainSearch, setChainSearch] = useState('');
  const [chainOpen, setChainOpen]     = useState(false);

  useEffect(() => {
    void fetchProjects();
  }, [fetchProjects]);

  useEffect(() => {
    if (projects.length > 0 && !projectId && projectTag) {
      const match = projects.find((p) => p.name.toLowerCase() === projectTag.toLowerCase());
      if (match) setProjectId(match.id);
    }
  }, [projects, projectId, projectTag]);

  // ── Work-specific fields ────────────────────────────────────────────────
  const initWorkDesc   = existingEvent?.type === 'work' ? existingEvent.description         : '';
  const initWorkNotes  = existingEvent?.type === 'work' ? existingEvent.implementationNotes : '';
  const initWorkStatus = existingEvent?.type === 'work' ? existingEvent.status              : 'in_progress' as WorkStatus;
  const initWorkLinks  = existingEvent?.type === 'work' ? existingEvent.links               : [] as EventLink[];

  const [description, setDescription]           = useState(initWorkDesc);
  const [implementationNotes, setImplNotes]     = useState(initWorkNotes);
  const [status, setStatus]                     = useState<WorkStatus>(initWorkStatus);
  const [workLinks, setWorkLinks]               = useState<EventLink[]>(initWorkLinks);

  // ── Meeting-specific fields ─────────────────────────────────────────────
  const initMeetOpt      = existingEvent?.type === 'meeting' ? existingEvent.isOptional         : false;
  const initMeetSummary  = existingEvent?.type === 'meeting' ? existingEvent.discussionSummary  : '';
  const initMeetTasks    = existingEvent?.type === 'meeting' ? existingEvent.tasksAssigned       : [] as TaskItem[];
  const initMeetDecision = existingEvent?.type === 'meeting' ? existingEvent.decisions           : '';
  const initMeetLinks    = existingEvent?.type === 'meeting' ? existingEvent.links               : [] as EventLink[];

  const [isOptional, setIsOptional]           = useState(initMeetOpt);
  const [discussionSummary, setDiscussion]    = useState(initMeetSummary);
  const [tasksAssigned, setTasks]             = useState<TaskItem[]>(initMeetTasks);
  const [decisions, setDecisions]             = useState(initMeetDecision);
  const [meetingLinks, setMeetingLinks]       = useState<EventLink[]>(initMeetLinks);

  const [isSubmitting, setIsSubmitting]       = useState(false);
  const [error, setError]                     = useState<string | null>(null);

  // ── "Continue from" recent events list ─────────────────────────────────
  const allEvents = useMemo(
    () => Object.values(eventsByDate).flat().filter(e => !existingEvent || e.id !== existingEvent.id),
    [eventsByDate, existingEvent],
  );

  const filteredChainEvents = useMemo(() => {
    const q = chainSearch.toLowerCase();
    return allEvents
      .filter(e => e.title.toLowerCase().includes(q) || e.date.includes(q))
      .slice(0, 8);
  }, [allEvents, chainSearch]);

  const selectedPrevEvent = useMemo(
    () => previousEventId ? allEvents.find(e => e.id === previousEventId) : null,
    [allEvents, previousEventId],
  );

  // ── Submit ──────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !date) return;

    setIsSubmitting(true);
    setError(null);

    try {
      let finalProjectId = projectId;
      let finalProjectTag = projectTag.trim() || null;

      if (isCreatingNewProject && newProjectName.trim()) {
        const created = await createProject(newProjectName.trim());
        if (created) {
          finalProjectId = created.id;
          finalProjectTag = created.name;
        }
      } else if (projectId) {
        const proj = projects.find((p) => p.id === projectId);
        if (proj) finalProjectTag = proj.name;
      }

      if (isEditing && existingEvent) {
        const eventUpdates = {
          title:      title.trim(),
          date,
          startTime:  startTime || null,
          endTime:    endTime   || null,
          projectId:  finalProjectId,
          projectTag: finalProjectTag,
        };

        const detailUpdates = eventType === 'work'
          ? { description, implementationNotes, status, links: workLinks }
          : { isOptional, discussionSummary, tasksAssigned, decisions, links: meetingLinks };

        await updateEvent(existingEvent.id, eventUpdates, detailUpdates);

      } else if (eventType === 'work') {
        await createWorkEvent({
          title:               title.trim(),
          date,
          startTime:           startTime || null,
          endTime:             endTime   || null,
          projectId:           finalProjectId,
          projectTag:          finalProjectTag,
          description,
          implementationNotes,
          status,
          links:               workLinks,
        });
      } else {
        await createMeetingEvent({
          title:             title.trim(),
          date,
          startTime:         startTime || null,
          endTime:           endTime   || null,
          projectId:         finalProjectId,
          projectTag:        finalProjectTag,
          isOptional,
          discussionSummary,
          tasksAssigned,
          decisions,
          links:             meetingLinks,
        });
      }

      onClose();
    } catch {
      setError('Failed to save event. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────
  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={isEditing ? 'Edit event' : 'New event'}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-[#0a0a0a] rounded-2xl shadow-2xl border border-[#1a1a1a] w-full max-w-4xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="px-6 py-4 border-b border-[#1a1a1a] flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-100">
            {isEditing ? 'Edit Event' : 'New Event'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 hover:bg-[#141414] rounded-full text-slate-400 hover:text-slate-200 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* ── Scrollable body ──────────────────────────────────────────── */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[82vh] flex flex-col gap-6">

          {/* Type toggle — only shown when creating */}
          {!isEditing && (
            <div className="flex bg-[#000000] p-1 rounded-lg border border-[#1a1a1a] self-start">
              <button
                type="button"
                onClick={() => setEventType('work')}
                className={`flex items-center gap-2 px-4 py-1.5 text-sm font-semibold rounded-md transition-all ${
                  eventType === 'work'
                    ? 'bg-[#0a0a0a] text-teal-400 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Briefcase className="w-3.5 h-3.5" /> Work
              </button>
              <button
                type="button"
                onClick={() => setEventType('meeting')}
                className={`flex items-center gap-2 px-4 py-1.5 text-sm font-semibold rounded-md transition-all ${
                  eventType === 'meeting'
                    ? 'bg-[#0a0a0a] text-violet-400 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Users className="w-3.5 h-3.5" /> Meeting
              </button>
            </div>
          )}

          {/* ── Shared fields ────────────────────────────────────────── */}

          {/* Title */}
          <div className={SECTION_CLS}>
            <FieldLabel>Title <span className="text-red-400">*</span></FieldLabel>
            <input
              autoFocus
              required
              type="text"
              className={INPUT_CLS}
              placeholder={eventType === 'work' ? 'e.g., Implemented auth middleware' : 'e.g., Sprint planning'}
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
          </div>

          {/* Date + times */}
          <div className="grid grid-cols-3 gap-3">
            <div className={SECTION_CLS}>
              <FieldLabel>Date <span className="text-red-400">*</span></FieldLabel>
              <input
                required
                type="date"
                className={INPUT_CLS}
                value={date}
                onChange={e => setDate(e.target.value)}
              />
            </div>
            <div className={SECTION_CLS}>
              <FieldLabel optional>Start</FieldLabel>
              <input
                type="time"
                className={INPUT_CLS}
                value={startTime}
                onChange={e => setStartTime(e.target.value)}
              />
            </div>
            <div className={SECTION_CLS}>
              <FieldLabel optional>End</FieldLabel>
              <input
                type="time"
                className={INPUT_CLS}
                value={endTime}
                onChange={e => setEndTime(e.target.value)}
              />
            </div>
          </div>

          {/* Project Initiative */}
          <div className={SECTION_CLS}>
            <div className="flex items-center justify-between mb-1">
              <FieldLabel optional>Project Initiative</FieldLabel>
              <button
                type="button"
                onClick={() => {
                  setIsCreatingNewProject(!isCreatingNewProject);
                  if (!isCreatingNewProject) {
                    setProjectId(null);
                  }
                }}
                className="text-[11px] text-teal-400 hover:text-teal-300 font-semibold transition"
              >
                {isCreatingNewProject ? '← Select Existing' : '+ New Project'}
              </button>
            </div>

            {isCreatingNewProject ? (
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  className={INPUT_CLS}
                  placeholder="Enter new project name (e.g., Mobile App Redesign)..."
                  value={newProjectName}
                  onChange={e => setNewProjectName(e.target.value)}
                  autoFocus
                />
              </div>
            ) : (
              <div className="relative">
                <select
                  className={`${INPUT_CLS} appearance-none pr-8 cursor-pointer`}
                  value={projectId || (projects.find(p => p.name.toLowerCase() === projectTag.toLowerCase())?.id ?? '')}
                  onChange={e => {
                    const selId = e.target.value;
                    if (selId === '__new__') {
                      setIsCreatingNewProject(true);
                      setProjectId(null);
                    } else if (selId) {
                      setProjectId(selId);
                      const p = projects.find(proj => proj.id === selId);
                      if (p) setProjectTag(p.name);
                    } else {
                      setProjectId(null);
                      setProjectTag('');
                    }
                  }}
                >
                  <option value="">No Project Assigned (Standalone)</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.status === 'completed' ? '(Completed)' : '(Active)'}
                    </option>
                  ))}
                  <option value="__new__">+ Create New Project…</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
              </div>
            )}
          </div>

          {/* ── Divider ──────────────────────────────────────────────── */}
          <div className="border-t border-[#1a1a1a]" />

          {/* ── Work form ────────────────────────────────────────────── */}
          {eventType === 'work' && (
            <>
              {/* Description */}
              <div className={SECTION_CLS}>
                <FieldLabel>What did you work on?</FieldLabel>
                <MarkdownEditor
                  value={description}
                  onChange={setDescription}
                  placeholder="Describe what you worked on... (Markdown supported: # headings, **bold**, - lists, `code`)"
                  minHeight="170px"
                />
              </div>

              {/* Implementation notes */}
              <div className={SECTION_CLS}>
                <FieldLabel optional>Implementation Notes</FieldLabel>
                <MarkdownEditor
                  value={implementationNotes}
                  onChange={setImplNotes}
                  placeholder="Technical details, decisions made, architecture, code snippets, gotchas... (Markdown supported)"
                  minHeight="170px"
                />
              </div>

              {/* Status */}
              <div className={SECTION_CLS}>
                <FieldLabel>Status</FieldLabel>
                <div className="relative">
                  <select
                    value={status}
                    onChange={e => setStatus(e.target.value as WorkStatus)}
                    className={`${INPUT_CLS} appearance-none pr-8 cursor-pointer`}
                  >
                    <option value="in_progress">In Progress</option>
                    <option value="done">Done</option>
                    <option value="blocked">Blocked</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                </div>
              </div>

              {/* Links */}
              <LinksEditor links={workLinks} onChange={setWorkLinks} />
            </>
          )}

          {/* ── Meeting form ──────────────────────────────────────────── */}
          {eventType === 'meeting' && (
            <>
              {/* Is optional */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  role="switch"
                  aria-checked={isOptional}
                  onClick={() => setIsOptional(v => !v)}
                  className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${
                    isOptional ? 'bg-teal-600' : 'bg-[#141414]'
                  }`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-[#e2e8f0] shadow transition-transform ${
                    isOptional ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
                <span className="text-sm font-semibold text-slate-300">Attendance was optional for me</span>
              </div>

              {/* Discussion summary */}
              <div className={SECTION_CLS}>
                <FieldLabel optional>Discussion Summary</FieldLabel>
                <MarkdownEditor
                  value={discussionSummary}
                  onChange={setDiscussion}
                  placeholder="What was discussed, key topics, feedback... (Markdown supported: # headings, - lists, - [ ] tasks)"
                  minHeight="170px"
                />
              </div>

              {/* Tasks assigned */}
              <TasksEditor tasks={tasksAssigned} onChange={setTasks} />

              {/* Decisions */}
              <div className={SECTION_CLS}>
                <FieldLabel optional>Decisions Made</FieldLabel>
                <MarkdownEditor
                  value={decisions}
                  onChange={setDecisions}
                  placeholder="Key decisions reached, consensus, next steps... (Markdown supported)"
                  minHeight="150px"
                />
              </div>

              {/* Links */}
              <LinksEditor links={meetingLinks} onChange={setMeetingLinks} />
            </>
          )}

          {/* ── Divider ──────────────────────────────────────────────── */}
          <div className="border-t border-[#1a1a1a]" />

          {/* ── Continue from (chain linker) ──────────────────────────── */}
          <div className={SECTION_CLS}>
            <FieldLabel optional>
              <span className="flex items-center gap-1.5">
                <Link2 className="w-3.5 h-3.5 text-slate-500" />
                Continue from previous event
              </span>
            </FieldLabel>

            {selectedPrevEvent ? (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-teal-900/30 border border-teal-800">
                <span className="text-xs text-teal-300 flex-1 truncate font-medium">
                  ↩ {selectedPrevEvent.date} — {selectedPrevEvent.title}
                </span>
                <button
                  type="button"
                  onClick={() => { setPreviousEventId(null); setChainSearch(''); }}
                  aria-label="Clear previous event link"
                  className="text-slate-500 hover:text-red-400 transition flex-shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  type="text"
                  className={INPUT_CLS}
                  placeholder="Search recent events to chain from..."
                  value={chainSearch}
                  onChange={e => { setChainSearch(e.target.value); setChainOpen(true); }}
                  onFocus={() => setChainOpen(true)}
                  onBlur={() => setTimeout(() => setChainOpen(false), 150)}
                />
                {chainOpen && filteredChainEvents.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg shadow-xl overflow-hidden">
                    {filteredChainEvents.map(ev => (
                      <button
                        key={ev.id}
                        type="button"
                        onMouseDown={() => { setPreviousEventId(ev.id); setChainSearch(''); setChainOpen(false); }}
                        className="w-full text-left px-3 py-2.5 hover:bg-[#141414] transition flex items-center gap-3"
                      >
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${ev.type === 'work' ? 'bg-teal-400' : 'bg-violet-400'}`} />
                        <span className="text-xs text-slate-500 flex-shrink-0">{ev.date}</span>
                        <span className="text-sm text-slate-200 truncate">{ev.title}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-red-400 bg-red-900/10 border border-red-800/50 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

        </form>

        {/* ── Footer ──────────────────────────────────────────────────── */}
        <div className="px-6 py-4 border-t border-[#1a1a1a] bg-[#000000]/50 flex justify-end gap-3 rounded-b-2xl">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-slate-300 bg-[#141414]/50 hover:bg-[#141414] rounded-lg transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            form=""
            onClick={handleSubmit}
            disabled={!title.trim() || !date || isSubmitting}
            className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg disabled:bg-teal-800/50 disabled:text-teal-400 transition shadow-sm disabled:cursor-not-allowed"
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {isEditing ? 'Save Changes' : 'Create Event'}
          </button>
        </div>

      </div>
    </div>,
    document.body,
  );
}
