import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { useAuthStore } from './authStore';
import type {
  WorkTask,
  TaskStatus,
  TaskPriority,
  TaskStatusHistory,
  TaskTimeEntry,
  SegmentEndReason,
} from '../types';
import { toDateStr } from '../utils/taskTime';

// ─── Raw Supabase Row Interfaces ──────────────────────────────────────────────

interface RawTask {
  id: string;
  user_id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  planned_date: string;
  started_at: string | null;
  completed_at: string | null;
  is_paused: boolean;
  tracked_seconds: number;
  order_index: number;
  created_at: string;
  updated_at: string;
}

interface RawTaskTimeEntry {
  id: string;
  task_id: string;
  user_id: string;
  started_at: string;
  ended_at: string | null;
  end_reason: SegmentEndReason | null;
  created_at: string;
}

interface RawTaskStatusHistory {
  id: string;
  task_id: string;
  user_id: string;
  from_status: string;
  to_status: string;
  changed_at: string;
  is_manual_edit: boolean;
  notes: string | null;
}

// ─── Mappers ──────────────────────────────────────────────────────────────────

function toWorkTask(row: RawTask, activeSegmentStartedAt?: string | null): WorkTask {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    plannedDate: row.planned_date,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    isPaused: row.is_paused ?? false,
    trackedSeconds: row.tracked_seconds ?? 0,
    activeSegmentStartedAt: activeSegmentStartedAt ?? null,
    orderIndex: row.order_index,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toTaskTimeEntry(row: RawTaskTimeEntry): TaskTimeEntry {
  return {
    id: row.id,
    taskId: row.task_id,
    userId: row.user_id,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    endReason: row.end_reason,
    createdAt: row.created_at,
  };
}

function toTaskStatusHistory(row: RawTaskStatusHistory): TaskStatusHistory {
  return {
    id: row.id,
    taskId: row.task_id,
    userId: row.user_id,
    fromStatus: row.from_status,
    toStatus: row.to_status,
    changedAt: row.changed_at,
    isManualEdit: row.is_manual_edit,
    notes: row.notes,
  };
}

// ─── Store Interface ──────────────────────────────────────────────────────────

export type TaskSortField =
  | 'order'
  | 'created_at'
  | 'planned_date'
  | 'priority'
  | 'started_at'
  | 'duration'
  | 'title';

export interface CreateTaskPayload {
  title: string;
  description?: string;
  priority?: TaskPriority;
  plannedDate?: string;
}

export interface UpdateTaskPayload {
  title?: string;
  description?: string;
  priority?: TaskPriority;
  plannedDate?: string;
  startedAt?: string | null;
  completedAt?: string | null;
  isPaused?: boolean;
}

interface TaskState {
  tasks: WorkTask[];
  selectedDate: string; // YYYY-MM-DD
  isLoading: boolean;
  error: string | null;
  pastUnfinishedCount: number;
  includePastUnfinished: boolean;

  // Running & Paused task tracking
  runningTaskId: string | null;
  lastPausedTaskId: string | null;

  // Cached segments by taskId
  segmentsByTaskId: Record<string, TaskTimeEntry[]>;

  // Filter & Sort State
  searchQuery: string;
  priorityFilter: 'all' | TaskPriority;
  sortBy: TaskSortField;
  sortOrder: 'asc' | 'desc';

  // State Mutators
  setSelectedDate: (date: string) => void;
  setIncludePastUnfinished: (include: boolean) => void;
  setSearchQuery: (query: string) => void;
  setPriorityFilter: (filter: 'all' | TaskPriority) => void;
  setSortBy: (sortBy: TaskSortField) => void;
  setSortOrder: (order: 'asc' | 'desc') => void;

  // Async Database Actions
  fetchTasks: () => Promise<void>;
  fetchPastUnfinishedCount: () => Promise<void>;
  fetchPastUnfinishedTasks: () => Promise<WorkTask[]>;
  createTask: (payload: CreateTaskPayload) => Promise<WorkTask | null>;
  updateTask: (taskId: string, payload: UpdateTaskPayload) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;

  // Pure UI-independent Transitions
  startTask: (taskId: string, timestampISO: string) => Promise<void>;
  pauseTask: (taskId: string, timestampISO: string, reason?: SegmentEndReason) => Promise<void>;
  resumeTask: (taskId: string, timestampISO: string) => Promise<void>;
  finishTask: (taskId: string, timestampISO: string) => Promise<void>;
  completeTask: (taskId: string, timestampISO: string) => Promise<void>;
  pauseAll: (timestampISO: string) => Promise<void>;
  resumeLastPaused: (timestampISO: string) => Promise<void>;

  // Backward moves
  revertToInProgress: (taskId: string, timestampISO?: string) => Promise<void>;
  revertToTodo: (taskId: string, timestampISO?: string) => Promise<void>;

  // History & Carryover
  fetchTaskHistory: (taskId: string) => Promise<TaskStatusHistory[]>;
  carryoverTasksToDate: (taskIds: string[], targetDate: string) => Promise<void>;

  // Segment CRUD
  fetchTaskSegments: (taskId: string) => Promise<TaskTimeEntry[]>;
  fetchSegmentsForTasks: (taskIds: string[]) => Promise<Record<string, TaskTimeEntry[]>>;
  updateSegment: (
    segmentId: string,
    taskId: string,
    startedAtISO: string,
    endedAtISO: string | null,
    reason?: SegmentEndReason | null
  ) => Promise<void>;
  deleteSegment: (segmentId: string, taskId: string) => Promise<void>;

  // Stale segment check
  checkStaleRunningSegment: () => Promise<{ task: WorkTask; entry: TaskTimeEntry } | null>;
  closeStaleSegment: (segmentId: string, taskId: string, stopTimeISO: string) => Promise<void>;
}

// ─── Store Implementation ─────────────────────────────────────────────────────

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  selectedDate: toDateStr(new Date()),
  isLoading: false,
  error: null,
  pastUnfinishedCount: 0,
  includePastUnfinished: false,

  runningTaskId: null,
  lastPausedTaskId: null,
  segmentsByTaskId: {},

  searchQuery: '',
  priorityFilter: 'all',
  sortBy: 'order',
  sortOrder: 'asc',

  setSelectedDate: (date: string) => {
    set({ selectedDate: date });
    void get().fetchTasks();
    void get().fetchPastUnfinishedCount();
  },

  setIncludePastUnfinished: (include: boolean) => {
    set({ includePastUnfinished: include });
    void get().fetchTasks();
  },

  setSearchQuery: (query: string) => set({ searchQuery: query }),
  setPriorityFilter: (filter: 'all' | TaskPriority) => set({ priorityFilter: filter }),
  setSortBy: (sortBy: TaskSortField) => set({ sortBy }),
  setSortOrder: (sortOrder: 'asc' | 'desc') => set({ sortOrder }),

  // ── fetchTasks ──────────────────────────────────────────────────────────
  fetchTasks: async () => {
    const { user } = useAuthStore.getState();
    if (!user) return;

    const { selectedDate, includePastUnfinished } = get();

    set({ isLoading: true, error: null });

    try {
      // 1. Fetch active open segment for this user (if any)
      const { data: openEntries, error: openError } = await supabase
        .from('task_time_entries')
        .select('*')
        .eq('user_id', user.id)
        .is('ended_at', null);

      if (openError) throw openError;

      const runningEntry = openEntries && openEntries.length > 0 ? (openEntries[0] as RawTaskTimeEntry) : null;
      const runningTaskId = runningEntry?.task_id || null;

      // 2. Fetch tasks for current view
      let query = supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id);

      if (includePastUnfinished) {
        query = query.or(
          `planned_date.eq.${selectedDate},and(planned_date.lt.${selectedDate},status.in.(todo,in_progress))`
        );
      } else {
        query = query.eq('planned_date', selectedDate);
      }

      query = query
        .order('order_index', { ascending: true })
        .order('created_at', { ascending: true });

      const { data, error } = await query;
      if (error) throw error;

      const tasks = (data as RawTask[]).map((row) => {
        const activeStartedAt = row.id === runningTaskId ? runningEntry?.started_at : null;
        return toWorkTask(row, activeStartedAt);
      });

      set({
        tasks,
        runningTaskId,
        isLoading: false,
      });

      // Background batch-fetch segments for these tasks to power table & analysis
      const taskIds = tasks.map((t) => t.id);
      if (taskIds.length > 0) {
        void get().fetchSegmentsForTasks(taskIds);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch tasks';
      set({ error: message, isLoading: false });
    }
  },

  // ── fetchPastUnfinishedCount ────────────────────────────────────────────
  fetchPastUnfinishedCount: async () => {
    const { user } = useAuthStore.getState();
    if (!user) return;

    const { selectedDate } = get();

    try {
      const { count, error } = await supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .lt('planned_date', selectedDate)
        .in('status', ['todo', 'in_progress']);

      if (error) throw error;
      set({ pastUnfinishedCount: count || 0 });
    } catch (err) {
      console.error('Failed to fetch past unfinished tasks count:', err);
    }
  },

  // ── fetchPastUnfinishedTasks ────────────────────────────────────────────
  fetchPastUnfinishedTasks: async () => {
    const { user } = useAuthStore.getState();
    if (!user) return [];

    const { selectedDate } = get();

    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .lt('planned_date', selectedDate)
        .in('status', ['todo', 'in_progress'])
        .order('planned_date', { ascending: false });

      if (error) throw error;
      return (data as RawTask[]).map((row) => toWorkTask(row));
    } catch (err) {
      console.error('Failed to fetch past unfinished tasks:', err);
      return [];
    }
  },

  // ── createTask ──────────────────────────────────────────────────────────
  createTask: async (payload: CreateTaskPayload) => {
    const { user } = useAuthStore.getState();
    if (!user) return null;

    const { selectedDate, tasks } = get();
    const plannedDate = payload.plannedDate || selectedDate;
    const priority = payload.priority || 'medium';

    try {
      const todoTasks = tasks.filter((t) => t.status === 'todo');
      const nextOrder =
        todoTasks.length > 0 ? Math.max(...todoTasks.map((t) => t.orderIndex)) + 1 : 0;

      const insertData = {
        user_id: user.id,
        title: payload.title.trim(),
        description: payload.description?.trim() || '',
        status: 'todo',
        priority,
        planned_date: plannedDate,
        order_index: nextOrder,
        is_paused: false,
        tracked_seconds: 0,
      };

      const { data, error } = await supabase
        .from('tasks')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;

      const created = toWorkTask(data as RawTask);

      await supabase.from('task_status_history').insert({
        task_id: created.id,
        user_id: user.id,
        from_status: 'created',
        to_status: 'todo',
        notes: 'Task created',
      });

      if (plannedDate === selectedDate) {
        set({ tasks: [...tasks, created] });
      }

      void get().fetchPastUnfinishedCount();
      return created;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create task';
      set({ error: message });
      throw err;
    }
  },

  // ── updateTask ──────────────────────────────────────────────────────────
  updateTask: async (taskId: string, payload: UpdateTaskPayload) => {
    const { user } = useAuthStore.getState();
    if (!user) return;

    const currentTask = get().tasks.find((t) => t.id === taskId);

    const updateData: Record<string, unknown> = {};
    if (payload.title !== undefined) updateData.title = payload.title.trim();
    if (payload.description !== undefined) updateData.description = payload.description;
    if (payload.priority !== undefined) updateData.priority = payload.priority;
    if (payload.plannedDate !== undefined) updateData.planned_date = payload.plannedDate;
    if (payload.startedAt !== undefined) updateData.started_at = payload.startedAt;
    if (payload.completedAt !== undefined) updateData.completed_at = payload.completedAt;
    if (payload.isPaused !== undefined) updateData.is_paused = payload.isPaused;

    try {
      const { data, error } = await supabase
        .from('tasks')
        .update(updateData)
        .eq('id', taskId)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;

      const updated = toWorkTask(data as RawTask, currentTask?.activeSegmentStartedAt);

      if (
        (payload.startedAt !== undefined && payload.startedAt !== currentTask?.startedAt) ||
        (payload.completedAt !== undefined && payload.completedAt !== currentTask?.completedAt)
      ) {
        await supabase.from('task_status_history').insert({
          task_id: taskId,
          user_id: user.id,
          from_status: updated.status,
          to_status: updated.status,
          is_manual_edit: true,
          notes: 'Timestamps updated manually',
        });
      }

      set((state) => ({
        tasks: state.tasks.map((t) => (t.id === taskId ? updated : t)),
      }));

      void get().fetchPastUnfinishedCount();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update task';
      set({ error: message });
      throw err;
    }
  },

  // ── deleteTask ──────────────────────────────────────────────────────────
  deleteTask: async (taskId: string) => {
    const { user } = useAuthStore.getState();
    if (!user) return;

    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId)
        .eq('user_id', user.id);

      if (error) throw error;

      set((state) => ({
        tasks: state.tasks.filter((t) => t.id !== taskId),
        runningTaskId: state.runningTaskId === taskId ? null : state.runningTaskId,
        lastPausedTaskId: state.lastPausedTaskId === taskId ? null : state.lastPausedTaskId,
      }));

      void get().fetchPastUnfinishedCount();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete task';
      set({ error: message });
      throw err;
    }
  },

  // ── startTask (To Do -> In Progress) ────────────────────────────────────
  startTask: async (taskId: string, timestampISO: string) => {
    try {
      const { error } = await supabase.rpc('rpc_start_or_resume_task', {
        p_task_id: taskId,
        p_timestamp: timestampISO,
        p_is_resume: false,
      });

      if (error) throw error;

      set({ runningTaskId: taskId });
      await get().fetchTasks();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to start task';
      set({ error: message });
      throw err;
    }
  },

  // ── pauseTask (In Progress running -> Paused) ───────────────────────────
  pauseTask: async (taskId: string, timestampISO: string, reason = 'paused') => {
    try {
      const { error } = await supabase.rpc('rpc_pause_task', {
        p_task_id: taskId,
        p_timestamp: timestampISO,
        p_reason: reason,
      });

      if (error) throw error;

      set({
        runningTaskId: null,
        lastPausedTaskId: taskId,
      });
      await get().fetchTasks();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to pause task';
      set({ error: message });
      throw err;
    }
  },

  // ── resumeTask (Paused -> In Progress running) ──────────────────────────
  resumeTask: async (taskId: string, timestampISO: string) => {
    try {
      const { error } = await supabase.rpc('rpc_start_or_resume_task', {
        p_task_id: taskId,
        p_timestamp: timestampISO,
        p_is_resume: true,
      });

      if (error) throw error;

      set({ runningTaskId: taskId });
      await get().fetchTasks();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to resume task';
      set({ error: message });
      throw err;
    }
  },

  // ── finishTask (In Progress -> Done) ────────────────────────────────────
  finishTask: async (taskId: string, timestampISO: string) => {
    try {
      const { error } = await supabase.rpc('rpc_complete_task', {
        p_task_id: taskId,
        p_timestamp: timestampISO,
      });

      if (error) throw error;

      set((state) => ({
        runningTaskId: state.runningTaskId === taskId ? null : state.runningTaskId,
        lastPausedTaskId: state.lastPausedTaskId === taskId ? null : state.lastPausedTaskId,
      }));
      await get().fetchTasks();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to complete task';
      set({ error: message });
      throw err;
    }
  },

  // ── completeTask (alias to finishTask) ───────────────────────────────────
  completeTask: async (taskId: string, timestampISO: string) => {
    return get().finishTask(taskId, timestampISO);
  },

  // ── pauseAll (Take a break) ─────────────────────────────────────────────
  pauseAll: async (timestampISO: string) => {
    const { runningTaskId } = get();
    if (!runningTaskId) return;
    await get().pauseTask(runningTaskId, timestampISO, 'paused');
  },

  // ── resumeLastPaused ────────────────────────────────────────────────────
  resumeLastPaused: async (timestampISO: string) => {
    const { lastPausedTaskId } = get();
    if (!lastPausedTaskId) return;
    await get().resumeTask(lastPausedTaskId, timestampISO);
  },

  // ── revertToInProgress (Done -> In Progress) ────────────────────────────
  revertToInProgress: async (taskId: string, timestampISO?: string) => {
    const ts = timestampISO || new Date().toISOString();
    try {
      const { error } = await supabase.rpc('rpc_revert_to_in_progress', {
        p_task_id: taskId,
        p_timestamp: ts,
      });

      if (error) throw error;

      set({ runningTaskId: taskId });
      await get().fetchTasks();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to revert task';
      set({ error: message });
      throw err;
    }
  },

  // ── revertToTodo (In Progress -> To Do) ─────────────────────────────────
  revertToTodo: async (taskId: string, timestampISO?: string) => {
    const ts = timestampISO || new Date().toISOString();
    try {
      const { error } = await supabase.rpc('rpc_revert_to_todo', {
        p_task_id: taskId,
        p_timestamp: ts,
      });

      if (error) throw error;

      set((state) => ({
        runningTaskId: state.runningTaskId === taskId ? null : state.runningTaskId,
        lastPausedTaskId: state.lastPausedTaskId === taskId ? null : state.lastPausedTaskId,
      }));
      await get().fetchTasks();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to move back to To Do';
      set({ error: message });
      throw err;
    }
  },

  // ── fetchTaskSegments ───────────────────────────────────────────────────
  fetchTaskSegments: async (taskId: string) => {
    const { user } = useAuthStore.getState();
    if (!user) return [];

    try {
      const { data, error } = await supabase
        .from('task_time_entries')
        .select('*')
        .eq('task_id', taskId)
        .eq('user_id', user.id)
        .order('started_at', { ascending: true });

      if (error) throw error;

      const segments = (data as RawTaskTimeEntry[]).map(toTaskTimeEntry);
      set((state) => ({
        segmentsByTaskId: {
          ...state.segmentsByTaskId,
          [taskId]: segments,
        },
      }));
      return segments;
    } catch (err) {
      console.error('Failed to fetch task segments:', err);
      return [];
    }
  },

  // ── fetchSegmentsForTasks ───────────────────────────────────────────────
  fetchSegmentsForTasks: async (taskIds: string[]) => {
    const { user } = useAuthStore.getState();
    if (!user || taskIds.length === 0) return {};

    try {
      const { data, error } = await supabase
        .from('task_time_entries')
        .select('*')
        .in('task_id', taskIds)
        .eq('user_id', user.id)
        .order('started_at', { ascending: true });

      if (error) throw error;

      const map: Record<string, TaskTimeEntry[]> = {};
      for (const id of taskIds) {
        map[id] = [];
      }
      for (const row of (data as RawTaskTimeEntry[])) {
        const entry = toTaskTimeEntry(row);
        if (!map[entry.taskId]) map[entry.taskId] = [];
        map[entry.taskId].push(entry);
      }

      set((state) => ({
        segmentsByTaskId: {
          ...state.segmentsByTaskId,
          ...map,
        },
      }));
      return map;
    } catch (err) {
      console.error('Failed to fetch segments for tasks:', err);
      return {};
    }
  },

  // ── updateSegment ───────────────────────────────────────────────────────
  updateSegment: async (
    segmentId: string,
    taskId: string,
    startedAtISO: string,
    endedAtISO: string | null,
    reason: SegmentEndReason | null = null
  ) => {
    const { user } = useAuthStore.getState();
    if (!user) return;

    try {
      const { error } = await supabase
        .from('task_time_entries')
        .update({
          started_at: startedAtISO,
          ended_at: endedAtISO,
          end_reason: endedAtISO ? (reason || 'manual') : null,
        })
        .eq('id', segmentId)
        .eq('user_id', user.id);

      if (error) throw error;

      // Recalculate tracked_seconds on task
      await supabase.rpc('recalc_task_tracked_seconds', { p_task_id: taskId });

      // Log manual edit
      await supabase.from('task_status_history').insert({
        task_id: taskId,
        user_id: user.id,
        from_status: 'in_progress',
        to_status: 'in_progress',
        is_manual_edit: true,
        notes: 'Work segment edited manually',
      });

      await get().fetchTaskSegments(taskId);
      await get().fetchTasks();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update segment';
      set({ error: message });
      throw err;
    }
  },

  // ── deleteSegment ───────────────────────────────────────────────────────
  deleteSegment: async (segmentId: string, taskId: string) => {
    const { user } = useAuthStore.getState();
    if (!user) return;

    try {
      const { error } = await supabase
        .from('task_time_entries')
        .delete()
        .eq('id', segmentId)
        .eq('user_id', user.id);

      if (error) throw error;

      await supabase.rpc('recalc_task_tracked_seconds', { p_task_id: taskId });

      await supabase.from('task_status_history').insert({
        task_id: taskId,
        user_id: user.id,
        from_status: 'in_progress',
        to_status: 'in_progress',
        is_manual_edit: true,
        notes: 'Work segment deleted manually',
      });

      await get().fetchTaskSegments(taskId);
      await get().fetchTasks();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete segment';
      set({ error: message });
      throw err;
    }
  },

  // ── checkStaleRunningSegment ────────────────────────────────────────────
  checkStaleRunningSegment: async () => {
    const { user } = useAuthStore.getState();
    if (!user) return null;

    try {
      const { data: openEntries } = await supabase
        .from('task_time_entries')
        .select('*')
        .eq('user_id', user.id)
        .is('ended_at', null)
        .limit(1);

      if (!openEntries || openEntries.length === 0) return null;

      const entry = toTaskTimeEntry(openEntries[0] as RawTaskTimeEntry);
      const startTime = new Date(entry.startedAt).getTime();
      const elapsedHours = (Date.now() - startTime) / (1000 * 3600);
      const isPastDay = entry.startedAt.slice(0, 10) < toDateStr(new Date());

      // Trigger if started on prior calendar day OR has been running > 12h
      if (isPastDay || elapsedHours >= 12) {
        // Fetch task details
        const { data: taskData } = await supabase
          .from('tasks')
          .select('*')
          .eq('id', entry.taskId)
          .single();

        if (taskData) {
          return {
            task: toWorkTask(taskData as RawTask, entry.startedAt),
            entry,
          };
        }
      }

      return null;
    } catch (err) {
      console.error('Failed to check stale segments:', err);
      return null;
    }
  },

  // ── closeStaleSegment ───────────────────────────────────────────────────
  closeStaleSegment: async (segmentId: string, taskId: string, stopTimeISO: string) => {
    const { user } = useAuthStore.getState();
    if (!user) return;

    try {
      const { error } = await supabase
        .from('task_time_entries')
        .update({
          ended_at: stopTimeISO,
          end_reason: 'manual',
        })
        .eq('id', segmentId)
        .eq('user_id', user.id);

      if (error) throw error;

      await supabase.rpc('recalc_task_tracked_seconds', { p_task_id: taskId });

      await supabase.from('task_status_history').insert({
        task_id: taskId,
        user_id: user.id,
        from_status: 'in_progress',
        to_status: 'paused',
        is_manual_edit: true,
        notes: 'Stale segment closed on session check',
      });

      set({ runningTaskId: null });
      await get().fetchTasks();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to close stale segment';
      set({ error: message });
      throw err;
    }
  },

  // ── fetchTaskHistory ────────────────────────────────────────────────────
  fetchTaskHistory: async (taskId: string) => {
    const { user } = useAuthStore.getState();
    if (!user) return [];

    try {
      const { data, error } = await supabase
        .from('task_status_history')
        .select('*')
        .eq('task_id', taskId)
        .eq('user_id', user.id)
        .order('changed_at', { ascending: false });

      if (error) throw error;
      return (data as RawTaskStatusHistory[]).map(toTaskStatusHistory);
    } catch (err) {
      console.error('Failed to fetch task history:', err);
      return [];
    }
  },

  // ── carryoverTasksToDate ────────────────────────────────────────────────
  carryoverTasksToDate: async (taskIds: string[], targetDate: string) => {
    const { user } = useAuthStore.getState();
    if (!user || taskIds.length === 0) return;

    try {
      const { error } = await supabase
        .from('tasks')
        .update({ planned_date: targetDate })
        .in('id', taskIds)
        .eq('user_id', user.id);

      if (error) throw error;

      const historyEntries = taskIds.map((taskId) => ({
        task_id: taskId,
        user_id: user.id,
        from_status: 'todo',
        to_status: 'todo',
        is_manual_edit: true,
        notes: `Carried over to ${targetDate}`,
      }));
      await supabase.from('task_status_history').insert(historyEntries);

      await get().fetchTasks();
      await get().fetchPastUnfinishedCount();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to carry over tasks';
      set({ error: message });
      throw err;
    }
  },
}));
