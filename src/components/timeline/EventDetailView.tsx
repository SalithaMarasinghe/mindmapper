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
const LABEL_CLS = 'text-xs font-semibold text-slate-400 uppercase tracking-wider';

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
    if (event.status === 'done') { statusLabel = 'Done'; statusClass = 'bg-green-900/60 text-green-300 border-green-700'; }
    else if (event.status === 'blocked') { statusLabel = 'Blocked'; statusClass = 'bg-red-900/60 text-red-300 border-red-700'; }
    else { statusLabel = 'In Progress'; statusClass = 'bg-[#141414]/60 text-slate-300 border-slate-600'; }
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-[#000000]/80 backdrop-blur-sm" onClick={onClose} />

      {/* Modal Container */}
      <div className="relative w-full max-w-3xl bg-[#0a0a0a] rounded-2xl shadow-2xl border border-[#1a1a1a] flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-[#1a1a1a] bg-[#000000]/30">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              {/* Type Badge */}
              {event.type === 'work' ? (
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-teal-900/60 border border-teal-700 text-teal-300 text-xs font-bold uppercase tracking-wider">
                  <Briefcase className="w-3.5 h-3.5" /> Work
                </span>
              ) : (
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-violet-900/60 border border-violet-700 text-violet-300 text-xs font-bold uppercase tracking-wider">
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
                <span className="px-2.5 py-1 rounded-md bg-[#0a0a0a] border border-slate-700 text-slate-300 text-xs font-bold uppercase tracking-wider">
                  Optional
                </span>
              )}

              {/* Project Tag */}
              {event.projectTag && (
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold text-slate-400 border border-slate-700/50 bg-[#0a0a0a]/50">
                  #{event.projectTag}
                </span>
              )}
            </div>

            <h2 className="text-2xl font-bold text-slate-100 mt-1">{event.title}</h2>
            
            <p className="text-sm font-medium text-slate-400">
              {event.date}
              {event.startTime && ` • ${formatTime(event.startTime)}`}
              {event.endTime && ` – ${formatTime(event.endTime)}`}
            </p>
          </div>
          
          <div className="flex items-center gap-1">
            {onEdit && (
              <button
                onClick={onEdit}
                className="p-1.5 text-slate-400 hover:text-teal-400 hover:bg-teal-900/30 rounded-lg transition-colors flex-shrink-0"
                aria-label="Edit event"
              >
                <Edit2 className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-[#141414] rounded-lg transition-colors flex-shrink-0"
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
            <div className="flex flex-col gap-2 p-3 rounded-lg bg-teal-950/20 border border-teal-900/30">
              {prevEvent && (
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <Link2 className="w-4 h-4 text-teal-500" />
                  <span className="text-slate-400">Continued from:</span>
                  <span className="font-semibold">{prevEvent.title}</span>
                  <span className="text-xs text-slate-500 ml-1">({prevEvent.date})</span>
                </div>
              )}
              {nextEvent && (
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <Link2 className="w-4 h-4 text-teal-500" />
                  <span className="text-slate-400">Continued in:</span>
                  <span className="font-semibold">{nextEvent.title}</span>
                  <span className="text-xs text-slate-500 ml-1">({nextEvent.date})</span>
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
                  <div className="p-3.5 rounded-lg bg-[#000000]/50 border border-[#1a1a1a]">
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
                          className="inline-flex items-center gap-1.5 text-sm text-teal-400 hover:text-teal-300 hover:underline"
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
                <div className="p-3.5 rounded-xl bg-gradient-to-r from-teal-950/60 to-emerald-950/60 border border-teal-600/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-teal-500/20 text-teal-400">
                      <Video className="w-5 h-5 animate-pulse" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-100 uppercase tracking-wide">Video Conference Ready</h4>
                      <p className="text-xs text-slate-400">Click to directly enter the meeting room.</p>
                    </div>
                  </div>
                  <a
                    href={event.links.find((l) => l.url.includes('meet.google') || l.url.includes('zoom.us') || l.url.includes('teams.microsoft'))?.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-white font-semibold text-xs rounded-lg shadow-md transition-all shrink-0"
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
                  <div className="p-3.5 rounded-lg bg-violet-950/20 border border-violet-900/30">
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
                          <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                        ) : (
                          <Circle className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
                        )}
                        <span className={`text-sm ${task.done ? 'text-slate-400 line-through' : 'text-slate-200'}`}>
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
                          className="inline-flex items-center gap-1.5 text-sm text-teal-400 hover:text-teal-300 hover:underline"
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
        <div className="px-6 py-4 border-t border-[#1a1a1a] bg-[#000000]/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 text-sm font-semibold text-white bg-[#141414] hover:bg-[#1e1e1e] rounded-lg transition shadow-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
