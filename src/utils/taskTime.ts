/**
 * Task Log Date and Time Utilities
 * Handles timezone conversions between user local time and UTC ISO strings,
 * segment duration calculation, formatting, and timestamp validations.
 */

/**
 * Returns YYYY-MM-DD from a Date object using local timezone
 */
export function toDateStr(d: Date = new Date()): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Converts a UTC ISO string (or now if null) to local datetime-local format: YYYY-MM-DDTHH:mm
 */
export function toLocalInputValue(isoString?: string | null): string {
  const d = isoString ? new Date(isoString) : new Date();
  if (isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

/**
 * Converts a datetime-local input string (YYYY-MM-DDTHH:mm in local time) to a UTC ISO string
 */
export function fromLocalInputValue(inputValue: string): string {
  if (!inputValue) return '';
  const d = new Date(inputValue);
  if (isNaN(d.getTime())) return '';
  return d.toISOString();
}

/**
 * Formats a UTC ISO string to local time: "h:mm A" (e.g. "2:30 PM")
 */
export function formatTime(isoString: string | null | undefined): string {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/**
 * Formats a UTC ISO string to local datetime: "MMM d, h:mm A" (e.g. "Sep 30, 2:30 PM")
 */
export function formatDateTime(isoString: string | null | undefined): string {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Formats duration seconds into human-readable string: "2h 15m", "45m", or "< 1m"
 */
export function formatDuration(seconds: number): string {
  if (seconds <= 0) return '0m';
  if (seconds < 60) return '< 1m';

  const totalMinutes = Math.floor(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  return `${minutes}m`;
}

/**
 * Computes live duration in seconds including any actively running segment
 */
export function calculateLiveTrackedSeconds(
  trackedSeconds: number = 0,
  activeSegmentStartedAt?: string | null
): number {
  if (!activeSegmentStartedAt) return trackedSeconds;
  const startTime = new Date(activeSegmentStartedAt).getTime();
  if (isNaN(startTime)) return trackedSeconds;
  const activeSec = Math.max(0, Math.floor((Date.now() - startTime) / 1000));
  return trackedSeconds + activeSec;
}

/**
 * Legacy duration helper: calculates duration in seconds between two timestamps
 */
export function calculateDurationSeconds(
  startedAt: string | null | undefined,
  completedAt?: string | null | undefined
): number {
  if (!startedAt) return 0;
  const start = new Date(startedAt).getTime();
  const end = completedAt ? new Date(completedAt).getTime() : Date.now();
  if (isNaN(start) || isNaN(end) || end < start) return 0;
  return Math.floor((end - start) / 1000);
}

/**
 * Formats duration between two timestamps directly
 */
export function formatDurationFromTimestamps(
  startedAt: string | null | undefined,
  completedAt?: string | null | undefined
): string {
  const seconds = calculateDurationSeconds(startedAt, completedAt);
  return formatDuration(seconds);
}

/**
 * Validates timestamp consistency and ensures no future dates (with 60-second drift tolerance)
 */
export function validateTimestamps(
  startedAt: string | null | undefined,
  completedAt?: string | null | undefined,
  allowFuture: boolean = false
): { valid: boolean; error?: string } {
  const now = Date.now() + 60 * 1000; // 60s tolerance for clock drift

  if (startedAt) {
    const startTime = new Date(startedAt).getTime();
    if (isNaN(startTime)) {
      return { valid: false, error: 'Invalid start time.' };
    }
    if (!allowFuture && startTime > now) {
      return { valid: false, error: 'Start time cannot be in the future.' };
    }
  }

  if (completedAt) {
    const completeTime = new Date(completedAt).getTime();
    if (isNaN(completeTime)) {
      return { valid: false, error: 'Invalid completion time.' };
    }
    if (!allowFuture && completeTime > now) {
      return { valid: false, error: 'Completion time cannot be in the future.' };
    }

    if (startedAt) {
      const startTime = new Date(startedAt).getTime();
      if (completeTime < startTime) {
        return { valid: false, error: 'Completion time cannot be earlier than start time.' };
      }
    }
  }

  return { valid: true };
}

/**
 * Validates a single work segment: endedAt >= startedAt, not in future
 */
export function validateSegmentTimes(
  startedAt: string,
  endedAt?: string | null,
  allowFuture: boolean = false
): { valid: boolean; error?: string } {
  return validateTimestamps(startedAt, endedAt, allowFuture);
}

/**
 * Validates that segments do not overlap with each other within the same task
 */
export function validateSegmentOverlap(
  segments: Array<{ id?: string; startedAt: string; endedAt: string | null }>
): { valid: boolean; error?: string } {
  // Sort segments by startedAt
  const sorted = [...segments].sort(
    (a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()
  );

  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i];
    const currentStart = new Date(current.startedAt).getTime();
    const currentEnd = current.endedAt ? new Date(current.endedAt).getTime() : null;

    if (currentEnd !== null && currentEnd < currentStart) {
      return { valid: false, error: `Segment #${i + 1} end time is before its start time.` };
    }

    // Check if open segment is not the last one
    if (currentEnd === null && i < sorted.length - 1) {
      return { valid: false, error: 'Only the latest segment can be currently running.' };
    }

    // Check overlap with next segment
    if (i < sorted.length - 1) {
      const next = sorted[i + 1];
      const nextStart = new Date(next.startedAt).getTime();

      if (currentEnd === null || currentEnd > nextStart) {
        return {
          valid: false,
          error: `Segment #${i + 1} overlaps with Segment #${i + 2}.`,
        };
      }
    }
  }

  return { valid: true };
}

/**
 * Returns a friendly relative label for a date (e.g. "Today", "Yesterday", "Tomorrow", "Mon, Sep 28")
 */
export function getRelativeDateLabel(dateStr: string): string {
  const today = toDateStr(new Date());
  if (dateStr === today) return 'Today';

  const d = new Date(`${dateStr}T12:00:00`);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (dateStr === toDateStr(yesterday)) return 'Yesterday';

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (dateStr === toDateStr(tomorrow)) return 'Tomorrow';

  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

// ─── Break & Timeline Analysis ────────────────────────────────────────────────

export interface TaskBreakItem {
  id: string;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number;
  isOngoing: boolean;
  afterSegmentIndex: number;
}

export interface TaskTimelineItem {
  type: 'work' | 'break';
  index: number;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number;
  endReason?: string | null;
  isOngoing?: boolean;
}

export interface TaskTimeAnalysis {
  totalWorkSeconds: number;
  totalBreakSeconds: number;
  totalSpanSeconds: number;
  breaks: TaskBreakItem[];
  timeline: TaskTimelineItem[];
  segmentCount: number;
}

export function analyzeTaskTimeAndBreaks(
  task: {
    id: string;
    status: string;
    isPaused: boolean;
    trackedSeconds: number;
    activeSegmentStartedAt?: string | null;
    startedAt: string | null;
    completedAt: string | null;
  },
  segments: Array<{
    id: string;
    taskId: string;
    startedAt: string;
    endedAt: string | null;
    endReason?: string | null;
  }> = []
): TaskTimeAnalysis {
  // Sort segments chronologically
  const sortedSegs = [...segments].sort(
    (a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()
  );

  const breaks: TaskBreakItem[] = [];
  const timeline: TaskTimelineItem[] = [];

  let workIdx = 0;
  let breakIdx = 0;

  for (let i = 0; i < sortedSegs.length; i++) {
    const seg = sortedSegs[i];
    workIdx++;
    const isOngoingSeg = !seg.endedAt;
    const segDuration = isOngoingSeg
      ? Math.max(0, Math.floor((Date.now() - new Date(seg.startedAt).getTime()) / 1000))
      : calculateDurationSeconds(seg.startedAt, seg.endedAt);

    timeline.push({
      type: 'work',
      index: workIdx,
      startedAt: seg.startedAt,
      endedAt: seg.endedAt,
      durationSeconds: segDuration,
      endReason: seg.endReason,
      isOngoing: isOngoingSeg,
    });

    // Check gap between this segment and the next segment
    if (i < sortedSegs.length - 1) {
      const nextSeg = sortedSegs[i + 1];
      if (seg.endedAt) {
        const breakStart = new Date(seg.endedAt).getTime();
        const breakEnd = new Date(nextSeg.startedAt).getTime();
        const breakSec = Math.max(0, Math.floor((breakEnd - breakStart) / 1000));

        if (breakSec > 0) {
          breakIdx++;
          const breakItem: TaskBreakItem = {
            id: `break-${seg.id}-${nextSeg.id}`,
            startedAt: seg.endedAt,
            endedAt: nextSeg.startedAt,
            durationSeconds: breakSec,
            isOngoing: false,
            afterSegmentIndex: workIdx,
          };
          breaks.push(breakItem);
          timeline.push({
            type: 'break',
            index: breakIdx,
            startedAt: seg.endedAt,
            endedAt: nextSeg.startedAt,
            durationSeconds: breakSec,
            isOngoing: false,
          });
        }
      }
    }
  }

  // If task is currently in progress and paused, add ongoing break
  if (task.status === 'in_progress' && task.isPaused && sortedSegs.length > 0) {
    const lastSeg = sortedSegs[sortedSegs.length - 1];
    if (lastSeg.endedAt) {
      const breakStart = new Date(lastSeg.endedAt).getTime();
      const ongoingBreakSec = Math.max(0, Math.floor((Date.now() - breakStart) / 1000));
      breakIdx++;
      const breakItem: TaskBreakItem = {
        id: `break-ongoing-${task.id}`,
        startedAt: lastSeg.endedAt,
        endedAt: null,
        durationSeconds: ongoingBreakSec,
        isOngoing: true,
        afterSegmentIndex: workIdx,
      };
      breaks.push(breakItem);
      timeline.push({
        type: 'break',
        index: breakIdx,
        startedAt: lastSeg.endedAt,
        endedAt: null,
        durationSeconds: ongoingBreakSec,
        isOngoing: true,
      });
    }
  }

  // Work seconds: sum of segments or live tracked seconds
  const totalWorkSeconds = calculateLiveTrackedSeconds(
    task.trackedSeconds,
    task.status === 'in_progress' && !task.isPaused ? task.activeSegmentStartedAt : null
  );

  const totalBreakSeconds = breaks.reduce((acc, b) => acc + b.durationSeconds, 0);
  const totalSpanSeconds = totalWorkSeconds + totalBreakSeconds;

  return {
    totalWorkSeconds,
    totalBreakSeconds,
    totalSpanSeconds,
    breaks,
    timeline,
    segmentCount: sortedSegs.length,
  };
}

/**
 * Resolves a natural relative or time phrase (e.g. "half an hour ago", "10m ago", "1:30 PM", "now")
 * into a UTC ISO string anchored to a given reference Date (defaulting to new Date()).
 */
export function resolveRelativeTimeToISO(
  phrase: string,
  referenceDate: Date = new Date()
): string | null {
  const clean = phrase.trim().toLowerCase();
  if (!clean || clean === 'now') {
    return referenceDate.toISOString();
  }

  // "X minutes ago" / "X min ago" / "X mins ago" / "Xm ago"
  const minAgoMatch = clean.match(/^(\d+)\s*(?:minutes?|mins?|m)\s*ago$/);
  if (minAgoMatch) {
    const mins = parseInt(minAgoMatch[1], 10);
    return new Date(referenceDate.getTime() - mins * 60 * 1000).toISOString();
  }

  // "half an hour ago" / "half hour ago"
  if (clean.includes('half an hour ago') || clean.includes('half hour ago')) {
    return new Date(referenceDate.getTime() - 30 * 60 * 1000).toISOString();
  }

  // "X hours ago" / "X hr ago" / "X hrs ago" / "Xh ago"
  const hrAgoMatch = clean.match(/^(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\s*ago$/);
  if (hrAgoMatch) {
    const hours = parseFloat(hrAgoMatch[1]);
    return new Date(referenceDate.getTime() - hours * 3600 * 1000).toISOString();
  }

  // "at HH:mm [am|pm]" or "HH:mm [am|pm]" or "1pm" or "2:30pm"
  const timeMatch = clean.match(/(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  if (timeMatch) {
    let hours = parseInt(timeMatch[1], 10);
    const minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
    const meridiem = timeMatch[3];

    if (meridiem === 'pm' && hours < 12) hours += 12;
    if (meridiem === 'am' && hours === 12) hours = 0;

    const d = new Date(referenceDate);
    d.setHours(hours, minutes, 0, 0);

    return d.toISOString();
  }

  return null;
}

