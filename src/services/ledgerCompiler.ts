import type { TimelineEventFull, Project } from '../types';

export type MeetingEventFull = TimelineEventFull & { type: 'meeting' };
export type WorkEventFull = TimelineEventFull & { type: 'work' };

export interface StorylineThread {
  chainId: string;
  projectId?: string | null;
  projectCreatedAt?: string | null;
  projectStatus?: string | null;
  title: string;
  projectTag: string | null;
  startDate: string;
  endDate: string;
  events: TimelineEventFull[];
  originMeeting?: MeetingEventFull;
  meetings: MeetingEventFull[];
  workSessions: WorkEventFull[];
  keyDecisions: string[];
  keyOutcomes: string[];
}

export interface ChronologicalDay {
  date: string;
  dayOfWeek: string;
  events: TimelineEventFull[];
}

export interface ChronologicalWeek {
  weekKey: string;
  weekNumber: number;
  weekLabel: string;
  startDate: string;
  endDate: string;
  days: ChronologicalDay[];
  totalEvents: number;
}

export interface CompiledLedger {
  startDate: string;
  endDate: string;
  totalEvents: number;
  workEventsCount: number;
  meetingEventsCount: number;
  projectTags: string[];
  storylines: StorylineThread[];
  standaloneEvents: TimelineEventFull[];
  weeks: ChronologicalWeek[];
}

// ── Helper: ISO Week Number ──────────────────────────────────────────────────
function getISOWeekNumber(dateStr: string): { year: number; week: number; weekLabel: string; startOfWeek: string; endOfWeek: string } {
  const d = new Date(dateStr + 'T00:00:00Z');
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  const year = d.getUTCFullYear();

  // Find Monday of this week
  const curr = new Date(dateStr + 'T00:00:00Z');
  const distanceToMonday = (curr.getUTCDay() + 6) % 7;
  const monday = new Date(curr.getTime() - distanceToMonday * 86400000);
  const sunday = new Date(monday.getTime() + 6 * 86400000);

  const startOfWeek = monday.toISOString().slice(0, 10);
  const endOfWeek = sunday.toISOString().slice(0, 10);

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const weekLabel = `Week ${weekNo} (${monthNames[monday.getUTCMonth()]} ${monday.getUTCDate()} – ${monthNames[sunday.getUTCMonth()]} ${sunday.getUTCDate()}, ${year})`;

  return { year, week: weekNo, weekLabel, startOfWeek, endOfWeek };
}

// ── Compile Storylines (Chained Initiatives) ─────────────────────────────────
export function compileStorylines(
  events: TimelineEventFull[],
  sortOrder: 'asc' | 'desc' = 'asc',
  projects: Project[] = []
): {
  storylines: StorylineThread[];
  standaloneEvents: TimelineEventFull[];
} {
  const chainsMap = new Map<string, TimelineEventFull[]>();
  const standaloneEvents: TimelineEventFull[] = [];

  for (const event of events) {
    if (event.chainId) {
      if (!chainsMap.has(event.chainId)) {
        chainsMap.set(event.chainId, []);
      }
      chainsMap.get(event.chainId)!.push(event);
    } else {
      standaloneEvents.push(event);
    }
  }

  const storylines: StorylineThread[] = [];

  for (const [chainId, chainEvents] of chainsMap.entries()) {
    // Sort chronologically by date then startTime to form strict causal sequence
    const sorted = [...chainEvents].sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return (a.startTime || '').localeCompare(b.startTime || '');
    });

    const originMeeting = sorted.find((e): e is MeetingEventFull => e.type === 'meeting');
    const meetings = sorted.filter((e): e is MeetingEventFull => e.type === 'meeting');
    const workSessions = sorted.filter((e): e is WorkEventFull => e.type === 'work');

    // Project tag: first non-null tag
    const projectTag = sorted.find((e) => Boolean(e.projectTag))?.projectTag || null;

    // Match with official Project entity if available
    const foundProject = projects.find(
      (p) =>
        sorted.some((e) => e.projectId === p.id) ||
        (projectTag && p.name.toLowerCase() === projectTag.toLowerCase())
    );

    const projectId = foundProject?.id ?? sorted.find((e) => Boolean(e.projectId))?.projectId ?? null;
    const projectCreatedAt = foundProject?.createdAt ?? null;
    const projectStatus = foundProject?.status ?? null;

    // Title heuristic: project entity name first, then projectTag, origin meeting title, or fallback
    const title =
      foundProject?.name ||
      projectTag ||
      originMeeting?.title ||
      sorted[0]?.title ||
      `Initiative Thread (${chainId.slice(0, 8)})`;

    const startDate = sorted[0].date;
    const endDate = sorted[sorted.length - 1].date;

    const keyDecisions: string[] = [];
    const keyOutcomes: string[] = [];

    for (const ev of sorted) {
      if (ev.type === 'meeting' && ev.decisions) {
        keyDecisions.push(ev.decisions);
      }
      if (ev.type === 'work' && ev.description) {
        // Look for standard Measured Impact or Key Accomplishments or legacy Impact sections
        const standardMatch = ev.description.match(/(?:###\s*(?:📊\s*Measured Impact & Metrics|🏆\s*Key Accomplishments)[\s\S]*?(?=\n###\s*|$))/i);
        if (standardMatch) {
          keyOutcomes.push(standardMatch[0].trim());
        } else {
          const legacyMatch = ev.description.match(/\*+\s*(?:Impact & Results|Impact|Results)[\s\S]*?(?=\n\n|\n\*|$)/i);
          if (legacyMatch) {
            keyOutcomes.push(legacyMatch[0].trim());
          }
        }
      }
    }

    storylines.push({
      chainId,
      projectId,
      projectCreatedAt,
      projectStatus,
      title,
      projectTag,
      startDate,
      endDate,
      events: sorted,
      originMeeting,
      meetings,
      workSessions,
      keyDecisions,
      keyOutcomes,
    });
  }

  // Sort storylines by project creation date (or startDate fallback)
  storylines.sort((a, b) => {
    const timeA = a.projectCreatedAt || a.startDate;
    const timeB = b.projectCreatedAt || b.startDate;
    return sortOrder === 'asc' ? timeA.localeCompare(timeB) : timeB.localeCompare(timeA);
  });

  return { storylines, standaloneEvents };
}

// ── Compile Chronological Weeks ──────────────────────────────────────────────
export function compileChronologicalWeeks(
  events: TimelineEventFull[],
  sortOrder: 'asc' | 'desc' = 'asc'
): ChronologicalWeek[] {
  const weeksMap = new Map<string, { info: ReturnType<typeof getISOWeekNumber>; daysMap: Map<string, TimelineEventFull[]> }>();

  for (const event of events) {
    const info = getISOWeekNumber(event.date);
    const weekKey = `${info.year}-W${String(info.week).padStart(2, '0')}`;

    if (!weeksMap.has(weekKey)) {
      weeksMap.set(weekKey, { info, daysMap: new Map() });
    }

    const { daysMap } = weeksMap.get(weekKey)!;
    if (!daysMap.has(event.date)) {
      daysMap.set(event.date, []);
    }
    daysMap.get(event.date)!.push(event);
  }

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const weeks: ChronologicalWeek[] = [];

  for (const [weekKey, { info, daysMap }] of weeksMap.entries()) {
    const days: ChronologicalDay[] = [];
    let totalEventsInWeek = 0;

    // Sort days ascending
    const sortedDates = Array.from(daysMap.keys()).sort();

    for (const date of sortedDates) {
      const dayEvents = daysMap.get(date)!;
      // Sort day events by startTime
      dayEvents.sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));

      const d = new Date(date + 'T00:00:00Z');
      const dayOfWeek = dayNames[d.getUTCDay()];

      days.push({
        date,
        dayOfWeek,
        events: dayEvents,
      });

      totalEventsInWeek += dayEvents.length;
    }

    weeks.push({
      weekKey,
      weekNumber: info.week,
      weekLabel: info.weekLabel,
      startDate: info.startOfWeek,
      endDate: info.endOfWeek,
      days,
      totalEvents: totalEventsInWeek,
    });
  }

  // Sort weeks: 'asc' = earliest week first (chronological); 'desc' = newest first
  if (sortOrder === 'asc') {
    weeks.sort((a, b) => a.weekKey.localeCompare(b.weekKey));
  } else {
    weeks.sort((a, b) => b.weekKey.localeCompare(a.weekKey));
  }

  return weeks;
}

// ── Master Ledger Compiler ───────────────────────────────────────────────────
export function compileLedger(
  events: TimelineEventFull[],
  startDate: string,
  endDate: string,
  filterTag?: string | null,
  sortOrder: 'asc' | 'desc' = 'asc',
  projects: Project[] = []
): CompiledLedger {
  const filtered = filterTag
    ? events.filter((e) => e.projectTag?.toLowerCase() === filterTag.toLowerCase())
    : events;

  const { storylines, standaloneEvents } = compileStorylines(filtered, sortOrder, projects);
  const weeks = compileChronologicalWeeks(filtered, sortOrder);

  const workEventsCount = filtered.filter((e) => e.type === 'work').length;
  const meetingEventsCount = filtered.filter((e) => e.type === 'meeting').length;

  const tagsSet = new Set<string>();
  for (const e of filtered) {
    if (e.projectTag) tagsSet.add(e.projectTag);
  }

  return {
    startDate,
    endDate,
    totalEvents: filtered.length,
    workEventsCount,
    meetingEventsCount,
    projectTags: Array.from(tagsSet).sort(),
    storylines,
    standaloneEvents,
    weeks,
  };
}
