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
    event.status === 'done'    ? <CheckCircle2 className="w-3.5 h-3.5 text-text-secondary" /> :
    event.status === 'blocked' ? <AlertTriangle className="w-3.5 h-3.5 text-text-secondary" />  :
                                  <Clock className="w-3.5 h-3.5 text-text-secondary" />;

  const statusLabel =
    event.status === 'done'    ? 'Done' :
    event.status === 'blocked' ? 'Blocked' :
                                  'In Progress';

  const statusColor =
    event.status === 'done'    ? 'text-text-secondary' :
    event.status === 'blocked' ? 'text-text-secondary'   :
                                  'text-text-secondary';

  return (
    <div className="flex gap-4">
      {/* ── Spine ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col items-center flex-shrink-0" style={{ width: 32 }}>
        {/* Node circle */}
        <div className="w-8 h-8 rounded-full bg-surface border-2 border-border flex items-center justify-center flex-shrink-0 z-10">
          <span className="text-xs font-bold text-accent">{index + 1}</span>
        </div>
        {/* Connecting line */}
        {!isLast && <div className="w-px flex-1 bg-gradient-to-b from-teal-700/60 to-transparent mt-1" style={{ minHeight: 24 }} />}
      </div>

      {/* ── Card ──────────────────────────────────────────────────────── */}
      <div className="flex-1 pb-6">
        <button
          onClick={onEdit}
          className="w-full text-left rounded-xl border border-border bg-bg hover:border-border hover:bg-bg/80 transition-all duration-150 overflow-hidden group"
        >
          {/* Header strip */}
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-surface">
            <Briefcase className="w-3.5 h-3.5 text-accent flex-shrink-0" />
            <span className="text-xs font-bold text-accent uppercase tracking-wider">Work</span>
            <span className="ml-auto flex items-center gap-1.5 text-xs font-semibold">
              {statusIcon}
              <span className={statusColor}>{statusLabel}</span>
            </span>
          </div>

          <div className="px-4 py-3">
            {/* Date + time */}
            <div className="flex items-baseline gap-2 mb-1.5">
              <span className="text-xs font-semibold text-text-muted">{formatDate(event.date)}</span>
              {event.startTime && (
                <span className="text-xs text-text-muted">
                  {formatTime(event.startTime)}{event.endTime ? ` – ${formatTime(event.endTime)}` : ''}
                </span>
              )}
              {event.projectTag && (
                <span className="ml-auto text-[10px] font-semibold bg-bg text-text-secondary px-2 py-0.5 rounded-full">
                  {event.projectTag}
                </span>
              )}
            </div>

            {/* Title */}
            <h4 className="text-sm font-semibold text-text mb-2 group-hover:text-accent transition-colors">
              {event.title}
            </h4>

            {/* Description */}
            {event.description && (
              <p className="text-xs text-text-secondary leading-relaxed line-clamp-3">
                {event.description}
              </p>
            )}

            {/* Implementation notes preview */}
            {event.implementationNotes && (
              <p className="mt-2 text-xs text-text-muted italic leading-relaxed line-clamp-2 border-l-2 border-border pl-2">
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
                    className="text-[10px] font-semibold text-accent hover:text-accent bg-surface border border-border rounded-full px-2 py-0.5 transition"
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
        <div className="w-8 h-8 rounded-full bg-surface border-2 border-border flex items-center justify-center flex-shrink-0 z-10">
          <span className="text-xs font-bold text-text-secondary">{index + 1}</span>
        </div>
        {!isLast && <div className="w-px flex-1 bg-gradient-to-b from-violet-700/60 to-transparent mt-1" style={{ minHeight: 24 }} />}
      </div>

      {/* ── Card ──────────────────────────────────────────────────────── */}
      <div className="flex-1 pb-6">
        <button
          onClick={onEdit}
          className="w-full text-left rounded-xl border border-border bg-bg hover:border-border transition-all duration-150 overflow-hidden group"
        >
          {/* Header strip */}
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-surface">
            <Users className="w-3.5 h-3.5 text-text-secondary flex-shrink-0" />
            <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">Meeting</span>
            {event.isOptional && (
              <span className="text-[10px] font-semibold text-text-muted bg-bg rounded-full px-2 py-0.5">optional</span>
            )}
            {totalTasks > 0 && (
              <span className="ml-auto text-xs text-text-muted">
                Tasks: <span className={doneTasks === totalTasks ? 'text-text-secondary' : 'text-text-secondary'}>{doneTasks}/{totalTasks}</span>
              </span>
            )}
          </div>

          <div className="px-4 py-3">
            <div className="flex items-baseline gap-2 mb-1.5">
              <span className="text-xs font-semibold text-text-muted">{formatDate(event.date)}</span>
              {event.startTime && (
                <span className="text-xs text-text-muted">
                  {formatTime(event.startTime)}{event.endTime ? ` – ${formatTime(event.endTime)}` : ''}
                </span>
              )}
              {event.projectTag && (
                <span className="ml-auto text-[10px] font-semibold bg-bg text-text-secondary px-2 py-0.5 rounded-full">
                  {event.projectTag}
                </span>
              )}
            </div>

            <h4 className="text-sm font-semibold text-text mb-2 group-hover:text-text transition-colors">
              {event.title}
            </h4>

            {event.discussionSummary && (
              <p className="text-xs text-text-secondary leading-relaxed line-clamp-3">
                {event.discussionSummary}
              </p>
            )}

            {event.decisions && (
              <p className="mt-2 text-xs text-text-muted italic leading-relaxed line-clamp-2 border-l-2 border-border pl-2">
                ↳ {event.decisions}
              </p>
            )}

            {/* Task list preview */}
            {event.tasksAssigned.length > 0 && (
              <ul className="mt-2.5 flex flex-col gap-1">
                {event.tasksAssigned.slice(0, 3).map((t, i) => (
                  <li key={i} className="flex items-center gap-1.5 text-xs text-text-secondary">
                    <span className={`w-3 h-3 rounded-sm border flex items-center justify-center flex-shrink-0 ${
                      t.done ? 'border-border bg-surface' : 'border-border'
                    }`}>
                      {t.done && <span className="text-text-secondary text-[8px] font-bold">✓</span>}
                    </span>
                    <span className={t.done ? 'line-through text-text-muted' : ''}>{t.text}</span>
                  </li>
                ))}
                {event.tasksAssigned.length > 3 && (
                  <li className="text-[10px] text-text-muted pl-4.5">
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
                    className="text-[10px] font-semibold text-text-secondary hover:text-text-secondary bg-surface border border-border rounded-full px-2 py-0.5 transition"
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
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-end sm:justify-center p-0 sm:p-4 bg-bg/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Chain view"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Panel — slides in from the right on mobile, centred modal on desktop */}
      <div className="
        bg-bg border-l sm:border border-border
        w-full sm:w-[540px] h-[90vh] sm:h-auto sm:max-h-[80vh]
        rounded-t-2xl sm:rounded-2xl shadow-2xl
        flex flex-col overflow-hidden
        animate-in fade-in slide-in-from-right-8 sm:slide-in-from-bottom-4 duration-200
      ">

        {/* ── Header ───────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-border flex-shrink-0 bg-bg">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-surface border border-border flex items-center justify-center">
              <Link2 className="w-3.5 h-3.5 text-accent" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-text">Chain Thread</h2>
              <p className="text-[10px] text-text-muted">{chain.length} linked event{chain.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close chain view"
            className="ml-auto p-1.5 hover:bg-bg rounded-full text-text-secondary hover:text-text transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Body ─────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 pt-6 pb-2">
          {chain.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Link2 className="w-10 h-10 text-text-muted mb-3" />
              <p className="text-sm font-semibold text-text-muted">No events found in this chain.</p>
              <p className="text-xs text-text-muted mt-1">They may not have been loaded yet — navigate to their week first.</p>
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
        <div className="px-6 py-3 border-t border-border flex-shrink-0">
          <p className="text-[10px] text-text-muted">
            Click any step to open it for editing. Chain ID: <span className="font-mono text-text-muted">{chainId.slice(0, 8)}…</span>
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
}
