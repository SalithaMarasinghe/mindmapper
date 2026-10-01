import { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, ExternalLink, Link2, Briefcase, Users, CheckCircle2, Circle, Edit2, Video } from 'lucide-react';
import { useTimelineStore } from '../../store/timelineStore';
import type { TimelineEventFull } from '../../types';
import { MarkdownViewer } from '../common/MarkdownViewer';

export interface EventDetailViewProps {
  event: TimelineEventFull;
  onClose: () => void;
  onEdit?: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(t: string | null): string {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

const SECTION_CLS = 'flex flex-col gap-1.5';
const LABEL_CLS = 'text-xs font-semibold text-text-secondary uppercase tracking-wider';

// ─── Component ────────────────────────────────────────────────────────────────

export function EventDetailView({ event, onClose, onEdit }: EventDetailViewProps) {
  const { getChain } = useTimelineStore();

  const chainEvents = useMemo(() => {
    if (!event.chainId) return [];
    return getChain(event.chainId);
  }, [event.chainId, getChain]);

  const { prevEvent, nextEvent } = useMemo(() => {
    if (chainEvents.length < 2) return { prevEvent: null, nextEvent: null };
    const currentIndex = chainEvents.findIndex(e => e.id === event.id);
    if (currentIndex === -1) return { prevEvent: null, nextEvent: null };
    return {
      prevEvent: currentIndex > 0 ? chainEvents[currentIndex - 1] : null,
      nextEvent: currentIndex < chainEvents.length - 1 ? chainEvents[currentIndex + 1] : null,
    };
  }, [chainEvents, event.id]);

  let statusLabel = '';
  let statusClass = '';
  if (event.type === 'work') {
    if (event.status === 'done') { statusLabel = 'Done'; statusClass = 'bg-surface text-text-secondary border-border'; }
    else if (event.status === 'blocked') { statusLabel = 'Blocked'; statusClass = 'bg-surface text-text-secondary border-border'; }
    else { statusLabel = 'In Progress'; statusClass = 'bg-bg/60 text-text border-border'; }
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-bg/80 backdrop-blur-sm" onClick={onClose} />

      {/* Modal Container */}
      <div className="relative w-full max-w-3xl bg-bg rounded-2xl shadow-2xl border border-border flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-border bg-bg/30">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              {/* Type Badge */}
              {event.type === 'work' ? (
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-surface border border-border text-accent text-xs font-bold uppercase tracking-wider">
                  <Briefcase className="w-3.5 h-3.5" /> Work
                </span>
              ) : (
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-surface border border-border text-text-secondary text-xs font-bold uppercase tracking-wider">
                  <Users className="w-3.5 h-3.5" /> Meeting
                </span>
              )}

              {/* Status Badge (Work) or Optional (Meeting) */}
              {event.type === 'work' && (
                <span className={`px-2.5 py-1 rounded-md border text-xs font-bold uppercase tracking-wider ${statusClass}`}>
                  {statusLabel}
                </span>
              )}
              {event.type === 'meeting' && event.isOptional && (
                <span className="px-2.5 py-1 rounded-md bg-bg border border-border text-text text-xs font-bold uppercase tracking-wider">
                  Optional
                </span>
              )}

              {/* Project Tag */}
              {event.projectTag && (
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold text-text-secondary border border-border/50 bg-bg/50">
                  #{event.projectTag}
                </span>
              )}
            </div>

            <h2 className="text-2xl font-bold text-text mt-1">{event.title}</h2>
            
            <p className="text-sm font-medium text-text-secondary">
              {event.date}
              {event.startTime && ` • ${formatTime(event.startTime)}`}
              {event.endTime && ` – ${formatTime(event.endTime)}`}
            </p>
          </div>
          
          <div className="flex items-center gap-1">
            {onEdit && (
              <button
                onClick={onEdit}
                className="p-1.5 text-text-secondary hover:text-accent hover:bg-surface rounded-lg transition-colors flex-shrink-0"
                aria-label="Edit event"
              >
                <Edit2 className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-text-secondary hover:text-text hover:bg-bg rounded-lg transition-colors flex-shrink-0"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-8">

          {/* Chain Info */}
          {(prevEvent || nextEvent) && (
            <div className="flex flex-col gap-2 p-3 rounded-lg bg-surface border border-border">
              {prevEvent && (
                <div className="flex items-center gap-2 text-sm text-text">
                  <Link2 className="w-4 h-4 text-accent" />
                  <span className="text-text-secondary">Continued from:</span>
                  <span className="font-semibold">{prevEvent.title}</span>
                  <span className="text-xs text-text-muted ml-1">({prevEvent.date})</span>
                </div>
              )}
              {nextEvent && (
                <div className="flex items-center gap-2 text-sm text-text">
                  <Link2 className="w-4 h-4 text-accent" />
                  <span className="text-text-secondary">Continued in:</span>
                  <span className="font-semibold">{nextEvent.title}</span>
                  <span className="text-xs text-text-muted ml-1">({nextEvent.date})</span>
                </div>
              )}
            </div>
          )}

          {/* ── WORK EVENT FIELDS ── */}
          {event.type === 'work' && (
            <>
              {event.description && (
                <div className={SECTION_CLS}>
                  <h3 className={LABEL_CLS}>Description</h3>
                  <MarkdownViewer content={event.description} />
                </div>
              )}

              {event.implementationNotes && (
                <div className={SECTION_CLS}>
                  <h3 className={LABEL_CLS}>Implementation Notes</h3>
                  <div className="p-3.5 rounded-lg bg-bg/50 border border-border">
                    <MarkdownViewer content={event.implementationNotes} />
                  </div>
                </div>
              )}

              {event.links.length > 0 && (
                <div className={SECTION_CLS}>
                  <h3 className={LABEL_CLS}>Links</h3>
                  <ul className="flex flex-col gap-2">
                    {event.links.map((link, i) => (
                      <li key={i}>
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-sm text-accent hover:text-accent hover:underline"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          {link.label || link.url}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}

          {/* ── MEETING EVENT FIELDS ── */}
          {event.type === 'meeting' && (
            <>
              {event.links.some((l) => l.url.includes('meet.google') || l.url.includes('zoom.us') || l.url.includes('teams.microsoft')) && (
                <div className="p-3.5 rounded-xl bg-gradient-to-r from-teal-950/60 to-emerald-950/60 border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-accent text-accent">
                      <Video className="w-5 h-5 animate-pulse" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-text uppercase tracking-wide">Video Conference Ready</h4>
                      <p className="text-xs text-text-secondary">Click to directly enter the meeting room.</p>
                    </div>
                  </div>
                  <a
                    href={event.links.find((l) => l.url.includes('meet.google') || l.url.includes('zoom.us') || l.url.includes('teams.microsoft'))?.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-text font-semibold text-xs rounded-lg shadow-md transition-all shrink-0"
                  >
                    <Video className="w-4 h-4" />
                    <span>Join Meeting Directly</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}
              {event.discussionSummary && (
                <div className={SECTION_CLS}>
                  <h3 className={LABEL_CLS}>Discussion Summary</h3>
                  <MarkdownViewer content={event.discussionSummary} />
                </div>
              )}

              {event.decisions && (
                <div className={SECTION_CLS}>
                  <h3 className={LABEL_CLS}>Decisions Made</h3>
                  <div className="p-3.5 rounded-lg bg-surface border border-border">
                    <MarkdownViewer content={event.decisions} />
                  </div>
                </div>
              )}

              {event.tasksAssigned.length > 0 && (
                <div className={SECTION_CLS}>
                  <h3 className={LABEL_CLS}>Tasks Assigned</h3>
                  <ul className="flex flex-col gap-2">
                    {event.tasksAssigned.map((task, i) => (
                      <li key={i} className="flex items-start gap-2.5">
                        {task.done ? (
                          <CheckCircle2 className="w-4 h-4 text-text flex-shrink-0 mt-0.5" />
                        ) : (
                          <Circle className="w-4 h-4 text-text-muted flex-shrink-0 mt-0.5" />
                        )}
                        <span className={`text-sm ${task.done ? 'text-text-secondary line-through' : 'text-text'}`}>
                          {task.text}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {event.links.length > 0 && (
                <div className={SECTION_CLS}>
                  <h3 className={LABEL_CLS}>Links</h3>
                  <ul className="flex flex-col gap-2">
                    {event.links.map((link, i) => (
                      <li key={i}>
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-sm text-accent hover:text-accent hover:underline"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          {link.label || link.url}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}

        </div>
        
        {/* Footer */}
        <div className="px-6 py-4 border-t border-border bg-bg/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 text-sm font-semibold text-text bg-bg hover:bg-bg rounded-lg transition shadow-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
