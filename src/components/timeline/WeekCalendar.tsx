import { useRef, useState, useCallback, useEffect } from 'react';
import { Link2, Edit2, Trash2, GitBranch } from 'lucide-react';
import { useTimelineStore } from '../../store/timelineStore';
import type { TimelineEventFull } from '../../types';

// ─── Constants ────────────────────────────────────────────────────────────────

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/** px height of a single hour row */
const HOUR_PX = 64;

/** px width of the left time gutter */
const GUTTER_PX = 60;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** "HH:MM" → fractional hours from midnight */
function timeToHours(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h + m / 60;
}

/** fractional hours → "HH:MM" (snaps to nearest 15 min) */
function hoursToTime(h: number): string {
  const snapped = Math.round(h * 4) / 4;
  const hh = Math.floor(snapped);
  const mm = Math.round((snapped - hh) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

/** Format "HH:MM" → "9:00 AM" */
function formatTime(t: string | null): string {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

/** ISO date string YYYY-MM-DD from a Date using local timezone */
function toDateStr(d: Date): string {
  const yyyy = d.getFullYear();
  const mm   = String(d.getMonth() + 1).padStart(2, '0');
  const dd   = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function buildWeekDates(weekStart: Date): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return toDateStr(d);
  });
}

function formatDayHeader(dateStr: string): { weekday: string; day: string; isToday: boolean } {
  const d = new Date(`${dateStr}T12:00:00`);
  const today = toDateStr(new Date());
  return { weekday: DAYS[d.getDay()], day: String(d.getDate()), isToday: dateStr === today };
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface DragSelection {
  dateStr: string;
  startHour: number;
  endHour: number;
}

export interface NewEventDraft {
  date: string;
  startTime: string;
  endTime: string;
}

export interface WeekCalendarProps {
  weekStart: Date;
  eventsByDate: Record<string, TimelineEventFull[]>;
  startHour?: number;
  endHour?: number;
  onNewEvent: (draft: NewEventDraft) => void;
  onEventClick: (event: TimelineEventFull) => void;
  /** Called when user picks "View full chain" from the context menu */
  onViewChain?: (chainId: string) => void;
}

// ─── Event context menu ───────────────────────────────────────────────────────

interface ContextMenuState {
  x: number;
  y: number;
  event: TimelineEventFull;
}

function EventContextMenu({
  menu,
  onEdit,
  onViewChain,
  onDelete,
  onClose,
}: {
  menu: ContextMenuState;
  onEdit: () => void;
  onViewChain?: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    // Delay by one tick so the triggering right-click doesn't immediately close it
    const t = setTimeout(() => document.addEventListener('mousedown', handler), 10);
    return () => { clearTimeout(t); document.removeEventListener('mousedown', handler); };
  }, [onClose]);

  const ITEM = 'flex w-full items-center gap-2.5 px-3 py-1.5 text-sm font-semibold transition';

  return (
    <div
      ref={ref}
      style={{ top: menu.y, left: menu.x, position: 'fixed' }}
      className="z-[200] w-52 bg-bg rounded-xl shadow-xl shadow-black/50 border border-border py-1.5 animate-in fade-in zoom-in-95 duration-100"
    >
      <div className="px-3 py-2 border-b border-border mb-1">
        <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider truncate">
          {menu.event.title}
        </p>
      </div>

      <button onClick={() => { onEdit(); onClose(); }} className={`${ITEM} text-text hover:bg-surface hover:text-accent`}>
        <Edit2 className="h-4 w-4" /> Edit event
      </button>

      {menu.event.chainId && onViewChain && (
        <button onClick={() => { onViewChain(); onClose(); }} className={`${ITEM} text-text hover:bg-surface hover:text-accent`}>
          <GitBranch className="h-4 w-4" /> View full chain
        </button>
      )}

      <div className="border-t border-border my-1" />

      <button onClick={() => { onDelete(); onClose(); }} className={`${ITEM} text-text-secondary hover:bg-surface`}>
        <Trash2 className="h-4 w-4" /> Delete event
      </button>
    </div>
  );
}

// ─── Event block colors ───────────────────────────────────────────────────────

function getEventColors(type: 'work' | 'meeting') {
  if (type === 'work') {
    return { bg: 'bg-surface', border: 'border-border border-l-[3px] border-l-slate-400', text: 'text-text', dot: 'bg-slate-400' };
  }
  return { bg: 'bg-surface', border: 'border-border border-l-[3px] border-l-indigo-400', text: 'text-text', dot: 'bg-indigo-400' };
}

// ─── EventBlock ───────────────────────────────────────────────────────────────

interface EventBlockProps {
  event: TimelineEventFull;
  startHour: number;
  isChained: boolean;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

function EventBlock({ event, startHour, isChained, onClick, onContextMenu }: EventBlockProps) {
  const colors   = getEventColors(event.type);
  const evStart  = event.startTime ? timeToHours(event.startTime) : startHour;
  const evEnd    = event.endTime   ? timeToHours(event.endTime)   : evStart + 1;
  const duration = Math.max(evEnd - evStart, 0.25);
  const topPx    = (evStart - startHour) * HOUR_PX;
  const heightPx = duration * HOUR_PX;

  let statusLabel = '';
  let statusClass = '';
  if (event.type === 'work') {
    if (event.status === 'done')        { statusLabel = '✓ Done';        statusClass = 'bg-surface text-text-secondary'; }
    else if (event.status === 'blocked')     { statusLabel = '⚠ Blocked';     statusClass = 'bg-surface text-text-secondary'; }
    else                                     { statusLabel = '• In Progress'; statusClass = 'bg-bg/60 text-text-secondary'; }
  }

  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      onMouseDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onContextMenu(e); }}
      title={event.title}
      style={{ top: topPx, height: Math.max(heightPx, 24), left: 2, right: 2 }}
      className={`
        absolute z-10 rounded-md border px-1.5 py-1 text-left
        flex flex-col justify-start overflow-hidden
        transition-all duration-100 hover:z-20 hover:brightness-110 active:scale-[0.98]
        ${colors.bg} ${colors.border} ${colors.text}
      `}
    >
      <div className="flex items-center gap-1 min-w-0">
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${colors.dot}`} />
        <span className="text-xs font-semibold truncate flex-1 leading-tight">{event.title}</span>
        {isChained && <Link2 className="w-3 h-3 flex-shrink-0 opacity-70" aria-label="Chained event" />}
      </div>

      {heightPx >= 36 && event.startTime && (
        <span className="text-[10px] opacity-70 leading-tight mt-0.5">
          {formatTime(event.startTime)}{event.endTime ? ` – ${formatTime(event.endTime)}` : ''}
        </span>
      )}

      {heightPx >= 52 && event.type === 'work' && statusLabel && (
        <span className={`mt-auto self-start text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${statusClass}`}>
          {statusLabel}
        </span>
      )}
    </button>
  );
}

// ─── WeekCalendar ─────────────────────────────────────────────────────────────

export function WeekCalendar({
  weekStart,
  eventsByDate,
  startHour = 6,
  endHour = 22,
  onNewEvent,
  onEventClick,
  onViewChain,
}: WeekCalendarProps) {
  const { deleteEvent } = useTimelineStore();
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  const totalHours    = endHour - startHour;
  const totalHeightPx = totalHours * HOUR_PX;
  const weekDates     = buildWeekDates(weekStart);
  const hourLabels    = Array.from({ length: totalHours + 1 }, (_, i) => startHour + i);

  // ── Drag state ────────────────────────────────────────────────────────
  const [drag, setDrag] = useState<DragSelection | null>(null);
  const isDragging      = useRef(false);
  const dragDateRef     = useRef<string | null>(null);
  const dragAnchor      = useRef<number>(0);

  const yToHour = useCallback((relY: number): number => {
    const raw     = startHour + relY / HOUR_PX;
    const clamped = Math.min(Math.max(raw, startHour), endHour);
    return Math.round(clamped * 4) / 4;
  }, [startHour, endHour]);

  const handleColumnMouseDown = useCallback((
    e: React.MouseEvent<HTMLDivElement>,
    dateStr: string,
  ) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const relY = e.clientY - e.currentTarget.getBoundingClientRect().top;
    const hour = yToHour(relY);
    isDragging.current  = true;
    dragDateRef.current = dateStr;
    dragAnchor.current  = hour;
    setDrag({ dateStr, startHour: hour, endHour: hour });
  }, [yToHour]);

  const handleColumnMouseMove = useCallback((
    e: React.MouseEvent<HTMLDivElement>,
    dateStr: string,
  ) => {
    if (!isDragging.current || dragDateRef.current !== dateStr) return;
    const relY   = e.clientY - e.currentTarget.getBoundingClientRect().top;
    const hour   = yToHour(relY);
    const anchor = dragAnchor.current;
    setDrag({ dateStr, startHour: Math.min(anchor, hour), endHour: Math.max(anchor, hour) });
  }, [yToHour]);

  useEffect(() => {
    const onMouseUp = () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      setDrag(prev => {
        if (prev && prev.endHour - prev.startHour >= 0.25) {
          onNewEvent({
            date:      prev.dateStr,
            startTime: hoursToTime(prev.startHour),
            endTime:   hoursToTime(prev.endHour),
          });
        }
        return null;
      });
      dragDateRef.current = null;
    };
    window.addEventListener('mouseup', onMouseUp);
    return () => window.removeEventListener('mouseup', onMouseUp);
  }, [onNewEvent]);

  // ── Chain detection ───────────────────────────────────────────────────
  const chainIdCounts = new Map<string, number>();
  for (const events of Object.values(eventsByDate)) {
    for (const ev of events) {
      if (ev.chainId) chainIdCounts.set(ev.chainId, (chainIdCounts.get(ev.chainId) ?? 0) + 1);
    }
  }

  // ── Current time ──────────────────────────────────────────────────────
  const now        = new Date();
  const nowHour    = now.getHours() + now.getMinutes() / 60;
  const todayStr   = toDateStr(now);
  const nowInRange = nowHour >= startHour && nowHour <= endHour;
  const nowTopPx   = (nowHour - startHour) * HOUR_PX;

  function hourLabel(h: number): string {
    if (h === 0)  return '12 AM';
    if (h < 12)   return `${h} AM`;
    if (h === 12) return '12 PM';
    return `${h - 12} PM`;
  }

  return (
    <>
      <div className="flex flex-col select-none bg-bg overflow-hidden h-full">

        {/* Day headers */}
        <div className="flex border-b border-border bg-bg flex-shrink-0">
          <div style={{ width: GUTTER_PX, minWidth: GUTTER_PX }} className="border-r border-border" />
          {weekDates.map((dateStr) => {
            const { weekday, day, isToday } = formatDayHeader(dateStr);
            return (
              <div key={dateStr} className="flex-1 flex flex-col items-center py-2 border-l border-border min-w-0">
                <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">{weekday}</span>
                <span className={`
                  mt-1 w-7 h-7 flex items-center justify-center rounded-full text-sm font-bold transition-colors
                  ${isToday ? 'bg-accent text-bg' : 'text-text'}
                `}>
                  {day}
                </span>
              </div>
            );
          })}
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 h-full" style={{ maxHeight: '100%' }}>
          <div className="flex relative" style={{ height: totalHeightPx }}>

            {/* Time gutter */}
            <div className="relative flex-shrink-0 border-r border-border" style={{ width: GUTTER_PX, minWidth: GUTTER_PX }}>
              {hourLabels.map((h) => (
                <div
                  key={h}
                  className="absolute right-2.5 flex items-end justify-end"
                  style={{ top: (h - startHour) * HOUR_PX - 9, height: 18 }}
                >
                  {h < endHour && (
                    <span className="text-xs text-text whitespace-nowrap font-medium leading-none">
                      {hourLabel(h)}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Day columns */}
            {weekDates.map((dateStr) => {
              const dayEvents = eventsByDate[dateStr] ?? [];
              const isToday   = dateStr === todayStr;
              const isDragCol = drag?.dateStr === dateStr;

              return (
                <div
                  key={dateStr}
                  role="gridcell"
                  aria-label={dateStr}
                  className={`relative flex-1 border-l border-border cursor-crosshair min-w-0 ${isToday ? 'bg-surface' : ''}`}
                  onMouseDown={(e) => handleColumnMouseDown(e, dateStr)}
                  onMouseMove={(e) => handleColumnMouseMove(e, dateStr)}
                >
                  {/* Solid hour lines */}
                  {hourLabels.map((h) => (
                    <div
                      key={h}
                      className="absolute left-0 right-0 border-t border-border/50"
                      style={{ top: (h - startHour) * HOUR_PX }}
                    />
                  ))}

                  {/* Dashed half-hour lines */}
                  {hourLabels.slice(0, -1).map((h) => (
                    <div
                      key={`${h}-half`}
                      className="absolute left-0 right-0 border-t border-dashed border-border/25"
                      style={{ top: (h - startHour) * HOUR_PX + HOUR_PX / 2 }}
                    />
                  ))}

                  {/* Current time line */}
                  {isToday && nowInRange && (
                    <div
                      className="absolute left-0 right-0 z-20 pointer-events-none"
                      style={{ top: nowTopPx }}
                    >
                      <div className="flex items-center">
                        <div className="w-2 h-2 rounded-full bg-surface-2 -ml-1 flex-shrink-0" />
                        <div className="flex-1 h-[1.5px] bg-surface-2" />
                      </div>
                    </div>
                  )}

                  {/* Drag ghost */}
                  {isDragCol && drag && drag.endHour > drag.startHour && (
                    <div
                      className="absolute left-1 right-1 z-10 rounded-md border border-border bg-accent pointer-events-none"
                      style={{
                        top:    (drag.startHour - startHour) * HOUR_PX,
                        height: Math.max((drag.endHour - drag.startHour) * HOUR_PX, 6),
                      }}
                    >
                      <span className="text-[10px] font-semibold text-accent px-1.5 block leading-tight mt-0.5">
                        {hoursToTime(drag.startHour)} – {hoursToTime(drag.endHour)}
                      </span>
                    </div>
                  )}

                  {/* Event blocks */}
                  {dayEvents.map((event) => (
                    <EventBlock
                      key={event.id}
                      event={event}
                      startHour={startHour}
                      isChained={Boolean(event.chainId && (chainIdCounts.get(event.chainId) ?? 0) > 1)}
                      onClick={() => onEventClick(event)}
                      onContextMenu={(e) =>
                        setContextMenu({ x: e.clientX, y: e.clientY, event })
                      }
                    />
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Context menu */}
      {contextMenu && (
        <EventContextMenu
          menu={contextMenu}
          onEdit={() => onEventClick(contextMenu.event)}
          onViewChain={
            contextMenu.event.chainId && onViewChain
              ? () => onViewChain(contextMenu.event.chainId!)
              : undefined
          }
          onDelete={async () => {
            await deleteEvent(contextMenu.event.id);
          }}
          onClose={() => setContextMenu(null)}
        />
      )}
    </>
  );
}
