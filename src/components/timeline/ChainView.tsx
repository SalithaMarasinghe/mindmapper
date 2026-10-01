import { createPortal } from 'react-dom';
import { X, Link2, Briefcase, Users, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import { useTimelineStore } from '../../store/timelineStore';
import type { TimelineEventFull } from '../../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Format "HH:MM" → "9:00 AM" */
function formatTime(t: string | null): string {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

/** Format "YYYY-MM-DD" → "Thu, Sep 18" */
function formatDate(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00`);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

// ─── Work step card ───────────────────────────────────────────────────────────

function WorkStep({
  event,
  index,
  isLast,
  onEdit,
}: {
  event: TimelineEventFull & { type: 'work' };
  index: number;
  isLast: boolean;
  onEdit: () => void;
}) {
  const statusIcon =
    event.status === 'done'    ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400" /> :
    event.status === 'blocked' ? <AlertTriangle className="w-3.5 h-3.5 text-red-400" />  :
                                  <Clock className="w-3.5 h-3.5 text-slate-400" />;

  const statusLabel =
    event.status === 'done'    ? 'Done' :
    event.status === 'blocked' ? 'Blocked' :
                                  'In Progress';

  const statusColor =
    event.status === 'done'    ? 'text-green-400' :
    event.status === 'blocked' ? 'text-red-400'   :
                                  'text-slate-400';

  return (
    <div className="flex gap-4">
      {/* ── Spine ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col items-center flex-shrink-0" style={{ width: 32 }}>
        {/* Node circle */}
        <div className="w-8 h-8 rounded-full bg-teal-900/70 border-2 border-teal-600 flex items-center justify-center flex-shrink-0 z-10">
          <span className="text-xs font-bold text-teal-300">{index + 1}</span>
        </div>
        {/* Connecting line */}
        {!isLast && <div className="w-px flex-1 bg-gradient-to-b from-teal-700/60 to-[#141414]/30 mt-1" style={{ minHeight: 24 }} />}
      </div>

      {/* ── Card ──────────────────────────────────────────────────────── */}
      <div className="flex-1 pb-6">
        <button
          onClick={onEdit}
          className="w-full text-left rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] hover:border-teal-700/60 hover:bg-[#0a0a0a]/80 transition-all duration-150 overflow-hidden group"
        >
          {/* Header strip */}
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[#1a1a1a] bg-teal-950/20">
            <Briefcase className="w-3.5 h-3.5 text-teal-400 flex-shrink-0" />
            <span className="text-xs font-bold text-teal-300 uppercase tracking-wider">Work</span>
            <span className="ml-auto flex items-center gap-1.5 text-xs font-semibold">
              {statusIcon}
              <span className={statusColor}>{statusLabel}</span>
            </span>
          </div>

          <div className="px-4 py-3">
            {/* Date + time */}
            <div className="flex items-baseline gap-2 mb-1.5">
              <span className="text-xs font-semibold text-slate-500">{formatDate(event.date)}</span>
              {event.startTime && (
                <span className="text-xs text-slate-600">
                  {formatTime(event.startTime)}{event.endTime ? ` – ${formatTime(event.endTime)}` : ''}
                </span>
              )}
              {event.projectTag && (
                <span className="ml-auto text-[10px] font-semibold bg-[#141414] text-slate-400 px-2 py-0.5 rounded-full">
                  {event.projectTag}
                </span>
              )}
            </div>

            {/* Title */}
            <h4 className="text-sm font-semibold text-slate-100 mb-2 group-hover:text-teal-200 transition-colors">
              {event.title}
            </h4>

            {/* Description */}
            {event.description && (
              <p className="text-xs text-slate-400 leading-relaxed line-clamp-3">
                {event.description}
              </p>
            )}

            {/* Implementation notes preview */}
            {event.implementationNotes && (
              <p className="mt-2 text-xs text-slate-500 italic leading-relaxed line-clamp-2 border-l-2 border-[#1a1a1a] pl-2">
                {event.implementationNotes}
              </p>
            )}

            {/* Links */}
            {event.links.length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {event.links.map((l, i) => (
                  <a
                    key={i}
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="text-[10px] font-semibold text-teal-400 hover:text-teal-300 bg-teal-900/20 border border-teal-800/40 rounded-full px-2 py-0.5 transition"
                  >
                    ↗ {l.label || l.url}
                  </a>
                ))}
              </div>
            )}
          </div>
        </button>
      </div>
    </div>
  );
}

// ─── Meeting step card ────────────────────────────────────────────────────────

function MeetingStep({
  event,
  index,
  isLast,
  onEdit,
}: {
  event: TimelineEventFull & { type: 'meeting' };
  index: number;
  isLast: boolean;
  onEdit: () => void;
}) {
  const doneTasks  = event.tasksAssigned.filter(t => t.done).length;
  const totalTasks = event.tasksAssigned.length;

  return (
    <div className="flex gap-4">
      {/* ── Spine ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col items-center flex-shrink-0" style={{ width: 32 }}>
        <div className="w-8 h-8 rounded-full bg-violet-900/70 border-2 border-violet-600 flex items-center justify-center flex-shrink-0 z-10">
          <span className="text-xs font-bold text-violet-300">{index + 1}</span>
        </div>
        {!isLast && <div className="w-px flex-1 bg-gradient-to-b from-violet-700/60 to-[#141414]/30 mt-1" style={{ minHeight: 24 }} />}
      </div>

      {/* ── Card ──────────────────────────────────────────────────────── */}
      <div className="flex-1 pb-6">
        <button
          onClick={onEdit}
          className="w-full text-left rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] hover:border-violet-700/60 transition-all duration-150 overflow-hidden group"
        >
          {/* Header strip */}
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[#1a1a1a] bg-violet-950/20">
            <Users className="w-3.5 h-3.5 text-violet-400 flex-shrink-0" />
            <span className="text-xs font-bold text-violet-300 uppercase tracking-wider">Meeting</span>
            {event.isOptional && (
              <span className="text-[10px] font-semibold text-slate-500 bg-[#141414] rounded-full px-2 py-0.5">optional</span>
            )}
            {totalTasks > 0 && (
              <span className="ml-auto text-xs text-slate-500">
                Tasks: <span className={doneTasks === totalTasks ? 'text-green-400' : 'text-slate-400'}>{doneTasks}/{totalTasks}</span>
              </span>
            )}
          </div>

          <div className="px-4 py-3">
            <div className="flex items-baseline gap-2 mb-1.5">
              <span className="text-xs font-semibold text-slate-500">{formatDate(event.date)}</span>
              {event.startTime && (
                <span className="text-xs text-slate-600">
                  {formatTime(event.startTime)}{event.endTime ? ` – ${formatTime(event.endTime)}` : ''}
                </span>
              )}
              {event.projectTag && (
                <span className="ml-auto text-[10px] font-semibold bg-[#141414] text-slate-400 px-2 py-0.5 rounded-full">
                  {event.projectTag}
                </span>
              )}
            </div>

            <h4 className="text-sm font-semibold text-slate-100 mb-2 group-hover:text-violet-200 transition-colors">
              {event.title}
            </h4>

            {event.discussionSummary && (
              <p className="text-xs text-slate-400 leading-relaxed line-clamp-3">
                {event.discussionSummary}
              </p>
            )}

            {event.decisions && (
              <p className="mt-2 text-xs text-slate-500 italic leading-relaxed line-clamp-2 border-l-2 border-[#1a1a1a] pl-2">
                ↳ {event.decisions}
              </p>
            )}

            {/* Task list preview */}
            {event.tasksAssigned.length > 0 && (
              <ul className="mt-2.5 flex flex-col gap-1">
                {event.tasksAssigned.slice(0, 3).map((t, i) => (
                  <li key={i} className="flex items-center gap-1.5 text-xs text-slate-400">
                    <span className={`w-3 h-3 rounded-sm border flex items-center justify-center flex-shrink-0 ${
                      t.done ? 'border-green-600 bg-green-900/40' : 'border-[#1a1a1a]'
                    }`}>
                      {t.done && <span className="text-green-400 text-[8px] font-bold">✓</span>}
                    </span>
                    <span className={t.done ? 'line-through text-slate-600' : ''}>{t.text}</span>
                  </li>
                ))}
                {event.tasksAssigned.length > 3 && (
                  <li className="text-[10px] text-slate-600 pl-4.5">
                    +{event.tasksAssigned.length - 3} more tasks
                  </li>
                )}
              </ul>
            )}

            {event.links.length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {event.links.map((l, i) => (
                  <a
                    key={i}
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="text-[10px] font-semibold text-violet-400 hover:text-violet-300 bg-violet-900/20 border border-violet-800/40 rounded-full px-2 py-0.5 transition"
                  >
                    ↗ {l.label || l.url}
                  </a>
                ))}
              </div>
            )}
          </div>
        </button>
      </div>
    </div>
  );
}

// ─── ChainView ────────────────────────────────────────────────────────────────

export interface ChainViewProps {
  chainId: string;
  onClose: () => void;
  onEditEvent: (event: TimelineEventFull) => void;
}

export function ChainView({ chainId, onClose, onEditEvent }: ChainViewProps) {
  const { getChain } = useTimelineStore();
  const chain = getChain(chainId);

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-end sm:justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Chain view"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Panel — slides in from the right on mobile, centred modal on desktop */}
      <div className="
        bg-[#000000] border-l sm:border border-[#1a1a1a]
        w-full sm:w-[540px] h-[90vh] sm:h-auto sm:max-h-[80vh]
        rounded-t-2xl sm:rounded-2xl shadow-2xl
        flex flex-col overflow-hidden
        animate-in fade-in slide-in-from-right-8 sm:slide-in-from-bottom-4 duration-200
      ">

        {/* ── Header ───────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-[#1a1a1a] flex-shrink-0 bg-[#0a0a0a]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-teal-900/60 border border-teal-700 flex items-center justify-center">
              <Link2 className="w-3.5 h-3.5 text-teal-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100">Chain Thread</h2>
              <p className="text-[10px] text-slate-500">{chain.length} linked event{chain.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close chain view"
            className="ml-auto p-1.5 hover:bg-[#141414] rounded-full text-slate-400 hover:text-slate-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Body ─────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 pt-6 pb-2">
          {chain.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Link2 className="w-10 h-10 text-slate-700 mb-3" />
              <p className="text-sm font-semibold text-slate-500">No events found in this chain.</p>
              <p className="text-xs text-slate-600 mt-1">They may not have been loaded yet — navigate to their week first.</p>
            </div>
          ) : (
            <div>
              {chain.map((event, index) => {
                const isLast = index === chain.length - 1;
                if (event.type === 'work') {
                  return (
                    <WorkStep
                      key={event.id}
                      event={event as TimelineEventFull & { type: 'work' }}
                      index={index}
                      isLast={isLast}
                      onEdit={() => { onEditEvent(event); onClose(); }}
                    />
                  );
                }
                return (
                  <MeetingStep
                    key={event.id}
                    event={event as TimelineEventFull & { type: 'meeting' }}
                    index={index}
                    isLast={isLast}
                    onEdit={() => { onEditEvent(event); onClose(); }}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* ── Footer note ──────────────────────────────────────────────── */}
        <div className="px-6 py-3 border-t border-[#1a1a1a] flex-shrink-0">
          <p className="text-[10px] text-slate-600">
            Click any step to open it for editing. Chain ID: <span className="font-mono text-slate-700">{chainId.slice(0, 8)}…</span>
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
}
