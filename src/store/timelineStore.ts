import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { useAuthStore } from './authStore';
import type {
  TimelineEvent,
  TimelineEventFull,
  WorkDetails,
  MeetingDetails,
  EventLink,
  TaskItem,
  WorkStatus,
  Project,
} from '../types';
import { nanoid } from 'nanoid';

// ─── Raw Supabase row shapes ──────────────────────────────────────────────────
// These match the snake_case column names returned by the joined query.

interface RawWorkDetails {
  event_id: string;
  description: string;
  implementation_notes: string;
  status: WorkStatus;
  links: EventLink[];
}

interface RawMeetingDetails {
  event_id: string;
  is_optional: boolean;
  discussion_summary: string;
  tasks_assigned: TaskItem[];
  decisions: string;
  links: EventLink[];
}

interface RawEvent {
  id: string;
  user_id: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  type: 'work' | 'meeting';
  title: string;
  project_id?: string | null;
  project_tag: string | null;
  chain_id: string | null;
  previous_event_id: string | null;
  source_segment_id?: string | null;
  source_task_id?: string | null;
  created_at: string;
  updated_at: string;
  work_details: RawWorkDetails | null;
  meeting_details: RawMeetingDetails | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toTimelineEvent(row: RawEvent): TimelineEvent {
  return {
    id: row.id,
    userId: row.user_id,
    date: row.date,
    startTime: row.start_time,
    endTime: row.end_time,
    type: row.type,
    title: row.title,
    projectId: row.project_id ?? null,
    projectTag: row.project_tag,
    chainId: row.chain_id,
    previousEventId: row.previous_event_id,
    sourceSegmentId: row.source_segment_id ?? null,
    sourceTaskId: row.source_task_id ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toWorkDetails(raw: RawWorkDetails): WorkDetails {
  return {
    eventId: raw.event_id,
    description: raw.description,
    implementationNotes: raw.implementation_notes,
    status: raw.status,
    links: raw.links ?? [],
  };
}

function toMeetingDetails(raw: RawMeetingDetails): MeetingDetails {
  return {
    eventId: raw.event_id,
    isOptional: raw.is_optional,
    discussionSummary: raw.discussion_summary,
    tasksAssigned: raw.tasks_assigned ?? [],
    decisions: raw.decisions,
    links: raw.links ?? [],
  };
}

function toTimelineEventFull(row: RawEvent): TimelineEventFull {
  const base = toTimelineEvent(row);
  if (row.type === 'work') {
    const details = row.work_details
      ? toWorkDetails(row.work_details)
      : { eventId: row.id, description: '', implementationNotes: '', status: 'in_progress' as WorkStatus, links: [] };
    return { ...base, type: 'work', ...details };
  }
  const details = row.meeting_details
    ? toMeetingDetails(row.meeting_details)
    : { eventId: row.id, isOptional: false, discussionSummary: '', tasksAssigned: [], decisions: '', links: [] };
  return { ...base, type: 'meeting', ...details };
}

// ─── State interface ──────────────────────────────────────────────────────────

interface TimelineState {
  // Primary event store keyed by date (YYYY-MM-DD) for O(1) calendar lookup
  eventsByDate: Record<string, TimelineEventFull[]>;
  projects: Project[];
  isLoading: boolean;
  error: string | null;

  // Projects
  fetchProjects: () => Promise<Project[]>;
  createProject: (
    name: string,
    description?: string,
    status?: 'active' | 'completed' | 'on_hold' | 'planning'
  ) => Promise<Project | null>;

  // Fetch all events in a date range (inclusive), with details joined
  fetchWeek: (weekStart: string, weekEnd: string) => Promise<void>;
  fetchRange: (startDate: string, endDate: string) => Promise<TimelineEventFull[]>;

  // Mutations
  createWorkEvent: (
    payload: Pick<TimelineEvent, 'date' | 'startTime' | 'endTime' | 'title' | 'projectTag'> &
      Pick<WorkDetails, 'description' | 'implementationNotes' | 'status' | 'links'> & {
        projectId?: string | null;
        sourceSegmentId?: string | null;
        sourceTaskId?: string | null;
        previousEventId?: string | null;
        chainId?: string | null;
      }
  ) => Promise<string | null>;

  createMeetingEvent: (
    payload: Pick<TimelineEvent, 'date' | 'startTime' | 'endTime' | 'title' | 'projectTag'> &
      Pick<MeetingDetails, 'isOptional' | 'discussionSummary' | 'tasksAssigned' | 'decisions' | 'links'> & {
        projectId?: string | null;
        previousEventId?: string | null;
        chainId?: string | null;
      }
  ) => Promise<string | null>;

  updateEvent: (
    eventId: string,
    eventUpdates: Partial<Pick<TimelineEvent, 'date' | 'startTime' | 'endTime' | 'title' | 'projectTag' | 'projectId'>>,
    detailUpdates: Partial<WorkDetails> | Partial<MeetingDetails>
  ) => Promise<void>;

  deleteEvent: (eventId: string) => Promise<void>;

  // Links two events into a chain. If previousEvent already has a chain_id,
  // that chain_id is propagated to eventId. Otherwise a new chain_id is minted.
  linkEventToPrevious: (eventId: string, previousEventId: string) => Promise<void>;

  // Selector — returns all events in a chain sorted by date asc, then start_time asc
  getChain: (chainId: string) => TimelineEventFull[];
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useTimelineStore = create<TimelineState>((set, get) => ({
  eventsByDate: {},
  projects: [],
  isLoading: false,
  error: null,

  // ── fetchProjects ────────────────────────────────────────────────────────
  fetchProjects: async () => {
    const { user } = useAuthStore.getState();
    if (!user) return [];
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      const projects: Project[] = (data || []).map((row) => ({
        id: row.id,
        userId: row.user_id,
        name: row.name,
        description: row.description,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
      set({ projects });
      return projects;
    } catch (err: unknown) {
      console.error('Failed to fetch projects:', err);
      return [];
    }
  },

  // ── createProject ────────────────────────────────────────────────────────
  createProject: async (name, description, status = 'active') => {
    const { user } = useAuthStore.getState();
    if (!user) return null;
    try {
      const { data, error } = await supabase
        .from('projects')
        .insert({
          user_id: user.id,
          name: name.trim(),
          description: description?.trim() || null,
          status,
        })
        .select()
        .single();

      if (error) throw error;
      const newProj: Project = {
        id: data.id,
        userId: data.user_id,
        name: data.name,
        description: data.description,
        status: data.status,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };
      set((state) => ({ projects: [...state.projects, newProj] }));
      return newProj;
    } catch (err: unknown) {
      console.error('Failed to create project:', err);
      return null;
    }
  },

  // ── fetchWeek ────────────────────────────────────────────────────────────
  fetchWeek: async (weekStart, weekEnd) => {
    const { user } = useAuthStore.getState();
    if (!user) return;

    if (!navigator.onLine) {
      set({ error: 'Cannot load timeline while offline.' });
      return;
    }

    set({ isLoading: true, error: null });

    try {
      const { data, error } = await supabase
        .from('events')
        .select('*, work_details(*), meeting_details(*)')
        .eq('user_id', user.id)
        .gte('date', weekStart)
        .lte('date', weekEnd)
        .order('date', { ascending: true })
        .order('start_time', { ascending: true, nullsFirst: true });

      if (error) throw error;

      // Group events by date, merging over any existing dates outside this window
      const incoming = (data as RawEvent[]).map(toTimelineEventFull);
      const eventsByDate: Record<string, TimelineEventFull[]> = { ...get().eventsByDate };

      // Clear only the dates covered by this fetch to avoid stale entries
      for (let d = new Date(weekStart); d <= new Date(weekEnd); d.setDate(d.getDate() + 1)) {
        const key = d.toISOString().slice(0, 10);
        eventsByDate[key] = [];
      }

      for (const event of incoming) {
        if (!eventsByDate[event.date]) eventsByDate[event.date] = [];
        eventsByDate[event.date].push(event);
      }

      set({ eventsByDate, isLoading: false });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      if ((err as { status?: number })?.status === 401) {
        useAuthStore.getState().signOut();
      }
      set({ error: message, isLoading: false });
    }
  },

  // ── fetchRange ───────────────────────────────────────────────────────────
  fetchRange: async (startDate: string, endDate: string): Promise<TimelineEventFull[]> => {
    const { user } = useAuthStore.getState();
    if (!user) return [];

    try {
      const { data, error } = await supabase
        .from('events')
        .select('*, work_details(*), meeting_details(*)')
        .eq('user_id', user.id)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true })
        .order('start_time', { ascending: true, nullsFirst: true });

      if (error) throw error;
      return (data as RawEvent[]).map(toTimelineEventFull);
    } catch (err: unknown) {
      console.error('Failed to fetch events in range:', err);
      return [];
    }
  },

  // ── createWorkEvent ──────────────────────────────────────────────────────
  createWorkEvent: async (payload) => {
    const { user } = useAuthStore.getState();
    if (!user) return null;

    if (!navigator.onLine) {
      set({ error: 'Cannot create event while offline.' });
      return null;
    }

    set({ isLoading: true, error: null });

    try {
      // Idempotency check: if sourceSegmentId is present, avoid duplicate creation
      if (payload.sourceSegmentId) {
        const { data: existing } = await supabase
          .from('events')
          .select('id')
          .eq('user_id', user.id)
          .eq('source_segment_id', payload.sourceSegmentId)
          .maybeSingle();

        if (existing) {
          set({ isLoading: false });
          return existing.id;
        }
      }

      let chainId: string | null = payload.chainId ?? null;
      let prevDate: string | null = null;

      if (payload.previousEventId) {
        const allEvents = Object.values(get().eventsByDate).flat();
        const prev = allEvents.find((e) => e.id === payload.previousEventId);
        if (prev) {
          prevDate = prev.date;
          chainId = prev.chainId ?? nanoid();
          if (!prev.chainId) {
            await supabase
              .from('events')
              .update({ chain_id: chainId })
              .eq('id', payload.previousEventId);
          }
        } else {
          const { data: dbPrev } = await supabase
            .from('events')
            .select('chain_id, date')
            .eq('id', payload.previousEventId)
            .maybeSingle();

          if (dbPrev) {
            prevDate = dbPrev.date;
            chainId = dbPrev.chain_id ?? nanoid();
            if (!dbPrev.chain_id) {
              await supabase
                .from('events')
                .update({ chain_id: chainId })
                .eq('id', payload.previousEventId);
            }
          }
        }
      }

      const { data: eventRow, error: eventError } = await supabase
        .from('events')
        .insert({
          user_id: user.id,
          date: payload.date,
          start_time: payload.startTime,
          end_time: payload.endTime,
          type: 'work',
          title: payload.title,
          project_id: payload.projectId ?? null,
          project_tag: payload.projectTag,
          source_segment_id: payload.sourceSegmentId ?? null,
          source_task_id: payload.sourceTaskId ?? null,
          previous_event_id: payload.previousEventId ?? null,
          chain_id: chainId,
        })
        .select('id')
        .single();

      if (eventError) throw eventError;

      const eventId: string = eventRow.id;

      const { error: detailError } = await supabase
        .from('work_details')
        .insert({
          event_id: eventId,
          description: payload.description,
          implementation_notes: payload.implementationNotes,
          status: payload.status,
          links: payload.links,
        });

      if (detailError) throw detailError;

      // Refresh the date this event lands on (and prevDate if different)
      await get().fetchWeek(payload.date, payload.date);
      if (prevDate && prevDate !== payload.date) {
        await get().fetchWeek(prevDate, prevDate);
      }
      return eventId;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      set({ error: message, isLoading: false });
      return null;
    }
  },

  // ── createMeetingEvent ───────────────────────────────────────────────────
  createMeetingEvent: async (payload) => {
    const { user } = useAuthStore.getState();
    if (!user) return null;

    if (!navigator.onLine) {
      set({ error: 'Cannot create event while offline.' });
      return null;
    }

    set({ isLoading: true, error: null });

    try {
      let chainId: string | null = payload.chainId ?? null;
      let prevDate: string | null = null;

      if (payload.previousEventId) {
        const allEvents = Object.values(get().eventsByDate).flat();
        const prev = allEvents.find((e) => e.id === payload.previousEventId);
        if (prev) {
          prevDate = prev.date;
          chainId = prev.chainId ?? nanoid();
          if (!prev.chainId) {
            await supabase
              .from('events')
              .update({ chain_id: chainId })
              .eq('id', payload.previousEventId);
          }
        } else {
          const { data: dbPrev } = await supabase
            .from('events')
            .select('chain_id, date')
            .eq('id', payload.previousEventId)
            .maybeSingle();

          if (dbPrev) {
            prevDate = dbPrev.date;
            chainId = dbPrev.chain_id ?? nanoid();
            if (!dbPrev.chain_id) {
              await supabase
                .from('events')
                .update({ chain_id: chainId })
                .eq('id', payload.previousEventId);
            }
          }
        }
      }

      const { data: eventRow, error: eventError } = await supabase
        .from('events')
        .insert({
          user_id: user.id,
          date: payload.date,
          start_time: payload.startTime,
          end_time: payload.endTime,
          type: 'meeting',
          title: payload.title,
          project_id: payload.projectId ?? null,
          project_tag: payload.projectTag,
          previous_event_id: payload.previousEventId ?? null,
          chain_id: chainId,
        })
        .select('id')
        .single();

      if (eventError) throw eventError;

      const eventId: string = eventRow.id;

      const { error: detailError } = await supabase
        .from('meeting_details')
        .insert({
          event_id: eventId,
          is_optional: payload.isOptional,
          discussion_summary: payload.discussionSummary,
          tasks_assigned: payload.tasksAssigned,
          decisions: payload.decisions,
          links: payload.links,
        });

      if (detailError) throw detailError;

      await get().fetchWeek(payload.date, payload.date);
      if (prevDate && prevDate !== payload.date) {
        await get().fetchWeek(prevDate, prevDate);
      }
      return eventId;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      set({ error: message, isLoading: false });
      return null;
    }
  },

  // ── updateEvent ──────────────────────────────────────────────────────────
  updateEvent: async (eventId, eventUpdates, detailUpdates) => {
    if (!navigator.onLine) {
      set({ error: 'Cannot update event while offline.' });
      return;
    }

    set({ isLoading: true, error: null });

    try {
      // Find the event in local state to know its date and type
      const allEvents = Object.values(get().eventsByDate).flat();
      const existing = allEvents.find(e => e.id === eventId);
      if (!existing) throw new Error(`Event ${eventId} not found in local state.`);

      // Update base event row (only send keys that are present)
      if (Object.keys(eventUpdates).length > 0) {
        const dbEventUpdates: Record<string, unknown> = {};
        if (eventUpdates.date !== undefined)       dbEventUpdates.date        = eventUpdates.date;
        if (eventUpdates.startTime !== undefined)  dbEventUpdates.start_time  = eventUpdates.startTime;
        if (eventUpdates.endTime !== undefined)    dbEventUpdates.end_time    = eventUpdates.endTime;
        if (eventUpdates.title !== undefined)      dbEventUpdates.title       = eventUpdates.title;
        if (eventUpdates.projectId !== undefined)  dbEventUpdates.project_id  = eventUpdates.projectId;
        if (eventUpdates.projectTag !== undefined) dbEventUpdates.project_tag = eventUpdates.projectTag;

        const { error } = await supabase
          .from('events')
          .update(dbEventUpdates)
          .eq('id', eventId);

        if (error) throw error;
      }

      // Update type-specific detail row
      if (Object.keys(detailUpdates).length > 0) {
        if (existing.type === 'work') {
          const wd = detailUpdates as Partial<WorkDetails>;
          const dbWorkUpdates: Record<string, unknown> = {};
          if (wd.description !== undefined)           dbWorkUpdates.description           = wd.description;
          if (wd.implementationNotes !== undefined)   dbWorkUpdates.implementation_notes  = wd.implementationNotes;
          if (wd.status !== undefined)                dbWorkUpdates.status                = wd.status;
          if (wd.links !== undefined)                 dbWorkUpdates.links                 = wd.links;

          const { error } = await supabase
            .from('work_details')
            .update(dbWorkUpdates)
            .eq('event_id', eventId);

          if (error) throw error;
        } else {
          const md = detailUpdates as Partial<MeetingDetails>;
          const dbMeetingUpdates: Record<string, unknown> = {};
          if (md.isOptional !== undefined)          dbMeetingUpdates.is_optional          = md.isOptional;
          if (md.discussionSummary !== undefined)   dbMeetingUpdates.discussion_summary   = md.discussionSummary;
          if (md.tasksAssigned !== undefined)       dbMeetingUpdates.tasks_assigned       = md.tasksAssigned;
          if (md.decisions !== undefined)           dbMeetingUpdates.decisions            = md.decisions;
          if (md.links !== undefined)               dbMeetingUpdates.links                = md.links;

          const { error } = await supabase
            .from('meeting_details')
            .update(dbMeetingUpdates)
            .eq('event_id', eventId);

          if (error) throw error;
        }
      }

      // Re-fetch the affected date (and new date if moved)
      const datesToRefresh = new Set<string>([existing.date]);
      if (eventUpdates.date) datesToRefresh.add(eventUpdates.date);

      for (const date of datesToRefresh) {
        await get().fetchWeek(date, date);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      set({ error: message, isLoading: false });
    }
  },

  // ── deleteEvent ──────────────────────────────────────────────────────────
  deleteEvent: async (eventId) => {
    if (!navigator.onLine) {
      set({ error: 'Cannot delete event while offline.' });
      return;
    }

    set({ isLoading: true, error: null });

    try {
      // Capture the date before deleting so we can refresh that bucket
      const allEvents = Object.values(get().eventsByDate).flat();
      const existing = allEvents.find(e => e.id === eventId);

      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', eventId);

      if (error) throw error;

      // Optimistically remove from local state
      if (existing) {
        set(state => ({
          eventsByDate: {
            ...state.eventsByDate,
            [existing.date]: (state.eventsByDate[existing.date] ?? []).filter(e => e.id !== eventId),
          },
          isLoading: false,
        }));
      } else {
        set({ isLoading: false });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      set({ error: message, isLoading: false });
    }
  },

  // ── linkEventToPrevious ──────────────────────────────────────────────────
  // Sets previous_event_id on eventId.
  // If previousEvent has a chain_id, it is propagated; otherwise a new UUID is minted
  // and written to both events so they share a chain.
  linkEventToPrevious: async (eventId, previousEventId) => {
    if (!navigator.onLine) {
      set({ error: 'Cannot link events while offline.' });
      return;
    }

    set({ isLoading: true, error: null });

    try {
      // Resolve the chain_id to use
      const allEvents = Object.values(get().eventsByDate).flat();
      const previousEvent = allEvents.find(e => e.id === previousEventId);

      const chainId: string = previousEvent?.chainId ?? nanoid();

      // If the previousEvent didn't yet have a chain_id, backfill it
      if (previousEvent && !previousEvent.chainId) {
        const { error } = await supabase
          .from('events')
          .update({ chain_id: chainId })
          .eq('id', previousEventId);

        if (error) throw error;
      }

      // Write previous_event_id + chain_id to the target event
      const { error } = await supabase
        .from('events')
        .update({ previous_event_id: previousEventId, chain_id: chainId })
        .eq('id', eventId);

      if (error) throw error;

      // Refresh both events' dates
      const eventDate = allEvents.find(e => e.id === eventId)?.date;
      const prevDate  = previousEvent?.date;

      const datesToRefresh = new Set<string>();
      if (eventDate) datesToRefresh.add(eventDate);
      if (prevDate)  datesToRefresh.add(prevDate);

      for (const date of datesToRefresh) {
        await get().fetchWeek(date, date);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      set({ error: message, isLoading: false });
    }
  },

  // ── getChain ─────────────────────────────────────────────────────────────
  getChain: (chainId) => {
    const allEvents = Object.values(get().eventsByDate).flat();
    return allEvents
      .filter(e => e.chainId === chainId)
      .sort((a, b) => {
        const dateDiff = a.date.localeCompare(b.date);
        if (dateDiff !== 0) return dateDiff;
        // Null start times sort last within the same date
        if (!a.startTime) return 1;
        if (!b.startTime) return -1;
        return a.startTime.localeCompare(b.startTime);
      });
  },
}));
