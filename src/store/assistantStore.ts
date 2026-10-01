import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { useAuthStore } from './authStore';
import { useTaskStore } from './taskStore';
import { useTimelineStore } from './timelineStore';
import { useEmailStore } from './emailStore';
import type {
  AssistantConversation,
  AssistantMessage,
  AssistantProposal,
  CreateTasksProposal,
  StartTaskProposal,
  PauseTaskProposal,
  ResumeTaskProposal,
  FinishTaskProposal,
  AttachWorkSummaryProposal,
  CreateProjectProposal,
  UpdateProjectProposal,
  CreateWorkEventProposal,
  CreateMeetingEventProposal,
  UpdateMeetingEventProposal,
  CarryOverTasksProposal,
  DailyWrapUpProposal,
  WorkTask,
  SegmentEndReason,
} from '../types';
import { formatTime, toDateStr } from '../utils/taskTime';
import { toast } from 'react-hot-toast';

interface RawConversation {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface RawMessage {
  id: string;
  conversation_id: string;
  user_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  proposals: AssistantProposal[];
  created_at: string;
}

interface AssistantState {
  conversations: AssistantConversation[];
  currentConversationId: string | null;
  messages: AssistantMessage[];
  isLoadingConversations: boolean;
  isLoadingMessages: boolean;
  isSending: boolean;
  error: string | null;

  fetchConversations: () => Promise<void>;
  selectConversation: (conversationId: string) => Promise<void>;
  startNewConversation: () => void;
  sendMessage: (
    text: string,
    options?: {
      mode?: 'assistant' | 'prompt_engineer' | 'technical_qa';
      promptRefinementTarget?: string;
    }
  ) => Promise<void>;
  executeProposal: (messageId: string, proposal: AssistantProposal) => Promise<void>;
  rejectProposal: (messageId: string, proposalId: string) => Promise<void>;
  deleteConversation: (conversationId: string) => Promise<void>;
  undoAction: (messageId: string, proposal: AssistantProposal) => Promise<void>;
  updateActionTime: (messageId: string, proposalId: string, newTimestampISO: string) => Promise<void>;
}

const ensureISO = (val?: unknown): string => {
  if (typeof val === 'string' && val.length > 5 && !isNaN(Date.parse(val))) {
    return new Date(val).toISOString();
  }
  return new Date().toISOString();
};

function timeToHours(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return (h || 0) + (m || 0) / 60;
}

const findTaskInStoreOrDb = async (
  userId: string,
  rawTaskId?: string,
  rawTaskTitle?: string,
  filter?: (t: WorkTask) => boolean
): Promise<WorkTask | null> => {
  const taskStore = useTaskStore.getState();
  const candidateTasks = [...taskStore.tasks];

  const cleanTitle = (rawTaskTitle || '').trim().toLowerCase();
  const isUUID = Boolean(rawTaskId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawTaskId));

  const matchFromList = (list: WorkTask[]): WorkTask | null => {
    if (isUUID) {
      const byId = list.find((t) => t.id === rawTaskId);
      if (byId) return byId;
    }
    if (cleanTitle) {
      const exact = list.find((t) => t.title.trim().toLowerCase() === cleanTitle);
      if (exact) return exact;
      const sub = list.find((t) => {
        const tc = t.title.trim().toLowerCase();
        return tc.includes(cleanTitle) || cleanTitle.includes(tc);
      });
      if (sub) return sub;
      const words = cleanTitle.split(/\s+/).filter((w) => w.length > 2);
      if (words.length > 0) {
        const overlap = list.find((t) => {
          const tc = t.title.trim().toLowerCase();
          return words.filter((w) => tc.includes(w)).length >= 1;
        });
        if (overlap) return overlap;
      }
    }
    if (filter) {
      const filtered = list.find(filter);
      if (filtered) return filtered;
    }
    return null;
  };

  const memMatch = matchFromList(candidateTasks);
  if (memMatch) return memMatch;

  try {
    const { data: dbTasks } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (dbTasks && dbTasks.length > 0) {
      const mapped: WorkTask[] = dbTasks.map((row: any) => ({
        id: row.id,
        userId: row.user_id,
        title: row.title,
        description: row.description || '',
        status: row.status,
        priority: row.priority || 'medium',
        plannedDate: row.planned_date,
        startedAt: row.started_at,
        completedAt: row.completed_at,
        isPaused: Boolean(row.is_paused),
        trackedSeconds: row.tracked_seconds || 0,
        orderIndex: row.order_index || 0,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
      const dbMatch = matchFromList(mapped);
      if (dbMatch) return dbMatch;
    }
  } catch (err) {
    console.warn('findTaskInStoreOrDb error:', err);
  }

  return null;
};

export const useAssistantStore = create<AssistantState>((set, get) => ({
  conversations: [],
  currentConversationId: null,
  messages: [],
  isLoadingConversations: false,
  isLoadingMessages: false,
  isSending: false,
  error: null,

  // ── fetchConversations ──────────────────────────────────────────────────
  fetchConversations: async () => {
    const { user } = useAuthStore.getState();
    if (!user) return;

    set({ isLoadingConversations: true, error: null });

    try {
      const { data, error } = await supabase
        .from('assistant_conversations')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      const convs = (data as RawConversation[]).map((c) => ({
        id: c.id,
        userId: c.user_id,
        title: c.title,
        createdAt: c.created_at,
        updatedAt: c.updated_at,
      }));

      set({ conversations: convs, isLoadingConversations: false });

      // Automatically select the most recent conversation if none is active
      if (!get().currentConversationId && convs.length > 0) {
        void get().selectConversation(convs[0].id);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch conversations';
      set({ error: msg, isLoadingConversations: false });
    }
  },

  // ── selectConversation ──────────────────────────────────────────────────
  selectConversation: async (conversationId: string) => {
    const { user } = useAuthStore.getState();
    if (!user) return;

    set({ currentConversationId: conversationId, isLoadingMessages: true, error: null });

    try {
      const { data, error } = await supabase
        .from('assistant_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const msgs = (data as RawMessage[]).map((m) => {
        let promptContent: string | undefined = undefined;
        let displayContent = m.content;
        const promptMatch = m.content.match(/```prompt\s*([\s\S]*?)\s*```/);
        if (promptMatch) {
          promptContent = promptMatch[1].trim();
          displayContent = m.content.replace(/```prompt\s*[\s\S]*?\s*```/, '').trim();
        }
        return {
          id: m.id,
          conversationId: m.conversation_id,
          userId: m.user_id,
          role: m.role,
          content: displayContent,
          proposals: Array.isArray(m.proposals) ? m.proposals : [],
          createdAt: m.created_at,
          engineeredPrompt: promptContent,
        };
      });

      set({ messages: msgs, isLoadingMessages: false });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load messages';
      set({ error: msg, isLoadingMessages: false });
    }
  },

  // ── startNewConversation ────────────────────────────────────────────────
  startNewConversation: () => {
    set({ currentConversationId: null, messages: [], error: null });
  },

  // ── sendMessage ─────────────────────────────────────────────────────────
  sendMessage: async (
    text: string,
    options?: {
      mode?: 'assistant' | 'prompt_engineer' | 'technical_qa';
      promptRefinementTarget?: string;
      enableSearch?: boolean;
    }
  ) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const { user } = useAuthStore.getState();
    if (!user) {
      toast.error('Please sign in to use the AI Assistant.');
      return;
    }

    const { currentConversationId, messages } = get();
    const taskStore = useTaskStore.getState();
    const timelineStore = useTimelineStore.getState();

    // Ensure projects are available for assistant context
    let currentProjects = timelineStore.projects;
    if (currentProjects.length === 0) {
      currentProjects = await timelineStore.fetchProjects();
    }

    // 1. Build compact context snapshot
    const today = toDateStr(new Date());
    const runningTask = taskStore.runningTaskId
      ? taskStore.tasks.find((t) => t.id === taskStore.runningTaskId) ?? null
      : null;

    const lastPausedTask = taskStore.lastPausedTaskId
      ? taskStore.tasks.find((t) => t.id === taskStore.lastPausedTaskId) ?? null
      : null;

    const yesterdayDate = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const recentTimelineMeetings = [
      ...(timelineStore.eventsByDate[yesterdayDate] || []),
      ...(timelineStore.eventsByDate[today] || []),
    ].filter((e) => e.type === 'meeting');

    const recentMeetings = recentTimelineMeetings.map((e) => {
      const m = e as any;
      return {
        id: e.id,
        date: e.date,
        title: e.title,
        startTime: e.startTime,
        endTime: e.endTime,
        projectTag: e.projectTag,
        hasSummary: Boolean(m.discussionSummary && m.discussionSummary.trim().length > 0),
      };
    });

    const todaysEvents = (timelineStore.eventsByDate[today] || []).map((e) => ({
      id: e.id,
      title: e.title,
      type: e.type,
      startTime: e.startTime,
      endTime: e.endTime,
      projectId: e.projectId,
      projectTag: e.projectTag,
      hasSummary: e.type === 'meeting' ? Boolean((e as any).discussionSummary?.trim()) : undefined,
    }));

    const pastUnfinished = await taskStore.fetchPastUnfinishedTasks();

    // Fetch today's segments for active tasks
    const todaysTaskIds = taskStore.tasks.map((t) => t.id);
    let todaysSegments: Array<{
      id: string;
      taskId: string;
      taskTitle: string;
      startedAt: string;
      endedAt: string | null;
      durationMinutes: number;
    }> = [];

    if (todaysTaskIds.length > 0) {
      try {
        const segMap = await taskStore.fetchSegmentsForTasks(todaysTaskIds);
        todaysSegments = Object.entries(segMap).flatMap(([taskId, segs]) => {
          const task = taskStore.tasks.find((t) => t.id === taskId);
          return segs.map((s) => {
            const startMs = new Date(s.startedAt).getTime();
            const endMs = s.endedAt ? new Date(s.endedAt).getTime() : Date.now();
            const durationMinutes = Math.max(0, Math.round((endMs - startMs) / 60000));
            return {
              id: s.id,
              taskId: s.taskId,
              taskTitle: task?.title ?? 'Task',
              startedAt: s.startedAt,
              endedAt: s.endedAt,
              durationMinutes,
            };
          });
        });
      } catch (err) {
        console.error('Failed to fetch segments for assistant context:', err);
      }
    }

    const contextSnapshot = {
      today,
      currentTimeLocal: formatTime(new Date().toISOString()),
      existingProjects: currentProjects.map((p) => ({
        id: p.id,
        name: p.name,
        status: p.status,
        description: p.description,
        createdAt: p.createdAt,
      })),
      runningTask: runningTask
        ? {
            id: runningTask.id,
            title: runningTask.title,
            startedAt: runningTask.startedAt ?? '',
            trackedSeconds: runningTask.trackedSeconds,
            activeSegmentStartedAt: runningTask.activeSegmentStartedAt ?? null,
          }
        : null,
      lastPausedTask: lastPausedTask
        ? {
            id: lastPausedTask.id,
            title: lastPausedTask.title,
          }
        : null,
      todaysTasks: taskStore.tasks.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        isPaused: t.isPaused,
        trackedSeconds: t.trackedSeconds,
        descriptionSnippet: t.description ? t.description.slice(0, 120) : '',
      })),
      todaysSegments,
      todaysEvents,
      recentMeetings,
      pastUnfinishedTasks: pastUnfinished.slice(0, 10).map((t) => ({
        id: t.id,
        title: t.title,
        plannedDate: t.plannedDate,
        priority: t.priority,
      })),
      recentEmailMeetings: useEmailStore
        .getState()
        .getMeetingInvites()
        .map((e) => ({
          id: e.id,
          sender: e.sender,
          subject: e.subject,
          date: e.date,
          meetingDetails: e.meetingDetails,
        })),
    };

    // 2. Optimistic user message
    const tempUserMsg: AssistantMessage = {
      id: `temp-${Date.now()}`,
      conversationId: currentConversationId || '',
      userId: user.id,
      role: 'user',
      content: trimmed,
      proposals: [],
      createdAt: new Date().toISOString(),
    };

    set({
      messages: [...messages, tempUserMsg],
      isSending: true,
      error: null,
    });

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Active user session expired.');

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const fnUrl = `${supabaseUrl}/functions/v1/ai-assistant-chat`;

      const res = await fetch(fnUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
        },
        body: JSON.stringify({
          conversationId: currentConversationId || undefined,
          message: trimmed,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
          currentTimeISO: new Date().toISOString(),
          context: contextSnapshot,
          mode: options?.mode,
          promptRefinementTarget: options?.promptRefinementTarget,
          enableSearch: options?.enableSearch,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to call assistant.');

      const { conversationId, messageId, replyText, engineeredPrompt, proposals, searchSources } = json;

      const isPromptRequest =
        options?.mode === 'prompt_engineer' ||
        Boolean(engineeredPrompt) ||
        /\b(prompt|prompts|context engineer|context engineering|system prompt|agent prompt)\b/i.test(trimmed);

      // If it's a prompt request, strictly suppress any stray proposals
      const rawProposals: AssistantProposal[] = isPromptRequest ? [] : (proposals || []);
      const processedProposals: AssistantProposal[] = [];

      let resolvedEngineeredPrompt = engineeredPrompt;
      if (!resolvedEngineeredPrompt && isPromptRequest && replyText) {
        const promptBlockMatch = replyText.match(/```(?:prompt|markdown)?\s*([\s\S]*?)\s*```/);
        if (promptBlockMatch) {
          resolvedEngineeredPrompt = promptBlockMatch[1].trim();
        } else if (replyText.length > 50) {
          resolvedEngineeredPrompt = replyText.trim();
        }
      }

      // Guard for midnight rollover in past work reports:
      // If current local time is early morning (< 5am) and event date is today with late evening startTime (> 17:00),
      // anchor date to yesterdayDate!
      const currentH = new Date().getHours();
      for (const prop of rawProposals) {
        if (
          (prop.type === 'create_work_event' || prop.type === 'create_meeting_event') &&
          prop.payload?.date === today &&
          prop.payload?.startTime
        ) {
          if (currentH < 5 && timeToHours(prop.payload.startTime) > 17) {
            prop.payload.date = yesterdayDate;
          }
        }
      }

      for (const prop of rawProposals) {
        const isTier1Candidate =
          prop.type === 'pause_task' ||
          prop.type === 'pause_all' ||
          prop.type === 'resume_task' ||
          prop.type === 'resume_last_paused' ||
          prop.type === 'start_task' ||
          prop.type === 'finish_task';

        if (!isTier1Candidate) {
          processedProposals.push(prop);
          continue;
        }

        // For start_task, ensure it refers to an existing task
        if (prop.type === 'start_task') {
          const isCompanionNewTask = rawProposals.some(
            (other) =>
              other.type === 'create_tasks' &&
              other.payload.tasks.some((t) => t.tempId && t.tempId === prop.payload.taskId)
          );

          if (isCompanionNewTask) {
            // Must wait for create_tasks to be approved first!
            processedProposals.push(prop);
            continue;
          }

          const targetTask = await findTaskInStoreOrDb(
            user.id,
            prop.payload?.taskId,
            prop.payload?.taskTitle
          );

          if (!targetTask) {
            processedProposals.push(prop);
            continue;
          }

          const safeIso = ensureISO(prop.payload?.timestampISO);
          try {
            const previousState = {
              status: targetTask.status,
              isPaused: targetTask.isPaused,
              startedAt: targetTask.startedAt,
            };
            await taskStore.startTask(targetTask.id, safeIso);
            processedProposals.push({
              ...prop,
              status: 'auto_executed',
              executedAt: new Date().toISOString(),
              previousState,
              payload: {
                ...prop.payload,
                taskId: targetTask.id,
                taskTitle: targetTask.title,
                timestampISO: safeIso,
              },
            });
            toast.success(`Started "${targetTask.title}"!`);
          } catch (execErr) {
            console.error('Failed to auto-execute start_task:', execErr);
            processedProposals.push(prop);
          }
          continue;
        }

        if (prop.type === 'pause_task') {
          const taskStore = useTaskStore.getState();
          const safeIso = ensureISO(prop.payload?.timestampISO);
          let runningTask: WorkTask | null | undefined = taskStore.runningTaskId
            ? taskStore.tasks.find((t) => t.id === taskStore.runningTaskId)
            : taskStore.tasks.find((t) => t.status === 'in_progress' && !t.isPaused);

          if (!runningTask) {
            runningTask = await findTaskInStoreOrDb(
              user.id,
              prop.payload?.taskId,
              prop.payload?.taskTitle,
              (t) => t.status === 'in_progress' && !t.isPaused
            );
          }

          const runningId = runningTask?.id || taskStore.runningTaskId || prop.payload?.taskId || 'running';
          const taskTitle = runningTask?.title || prop.payload?.taskTitle || 'Task';
          const reason = (prop.payload?.reason || 'paused') as SegmentEndReason;
          const timeDisplay = prop.payload?.timeDisplay || formatTime(safeIso);

          if (runningTask || runningId !== 'running') {
            try {
              const previousState = runningTask
                ? {
                    status: runningTask.status,
                    isPaused: runningTask.isPaused,
                    startedAt: runningTask.startedAt,
                  }
                : {
                    status: 'in_progress' as const,
                    isPaused: false,
                    startedAt: safeIso,
                  };
              await taskStore.pauseTask(runningId, safeIso, reason);
              processedProposals.push({
                ...prop,
                type: 'pause_task',
                status: 'auto_executed',
                executedAt: new Date().toISOString(),
                previousState,
                payload: {
                  taskId: runningId,
                  taskTitle,
                  timestampISO: safeIso,
                  timeDisplay,
                  reason,
                },
              });
              toast.success(`Paused "${taskTitle}". Enjoy your break! ☕`);
            } catch (execErr) {
              console.error('Failed to auto-execute pause_task:', execErr);
              processedProposals.push({
                ...prop,
                type: 'pause_task',
                status: 'auto_executed',
                executedAt: new Date().toISOString(),
                payload: {
                  taskId: runningId,
                  taskTitle,
                  timestampISO: safeIso,
                  timeDisplay,
                  reason,
                },
              });
              toast.success(`Paused "${taskTitle}". Enjoy your break! ☕`);
            }
          } else {
            processedProposals.push({
              ...prop,
              type: 'pause_task',
              status: 'auto_executed',
              executedAt: new Date().toISOString(),
              payload: {
                taskId: 'none',
                taskTitle,
                timestampISO: safeIso,
                timeDisplay,
                reason,
              },
            });
            toast.success('Break started. No active task was running! ☕');
          }
          continue;
        }

        if (prop.type === 'pause_all') {
          const taskStore = useTaskStore.getState();
          const safeIso = ensureISO(prop.payload?.timestampISO);
          const runningId = taskStore.runningTaskId || prop.payload?.taskId;
          const targetTask = runningId ? taskStore.tasks.find((t) => t.id === runningId) : null;
          const taskTitle = targetTask?.title || prop.payload?.taskTitle || 'All tasks';
          const timeDisplay = prop.payload?.timeDisplay || formatTime(safeIso);

          if (runningId) {
            try {
              await taskStore.pauseAll(safeIso);
              processedProposals.push({
                ...prop,
                type: 'pause_all',
                status: 'auto_executed',
                executedAt: new Date().toISOString(),
                payload: {
                  taskId: runningId,
                  taskTitle,
                  timestampISO: safeIso,
                  timeDisplay,
                },
              });
              toast.success('Running task paused. Enjoy your break! ☕');
            } catch (execErr) {
              console.error('Failed to auto-execute pause_all:', execErr);
              processedProposals.push({
                ...prop,
                type: 'pause_all',
                status: 'auto_executed',
                executedAt: new Date().toISOString(),
                payload: {
                  taskId: runningId,
                  taskTitle,
                  timestampISO: safeIso,
                  timeDisplay,
                },
              });
            }
          } else {
            processedProposals.push({
              ...prop,
              type: 'pause_all',
              status: 'auto_executed',
              executedAt: new Date().toISOString(),
              payload: {
                taskTitle,
                timestampISO: safeIso,
                timeDisplay,
              },
            });
            toast.success('Break started. No active task was running! ☕');
          }
          continue;
        }

        if (prop.type === 'resume_task') {
          const taskStore = useTaskStore.getState();
          const safeIso = ensureISO(prop.payload?.timestampISO);
          let targetTask: WorkTask | null | undefined =
            (prop.payload?.taskId ? taskStore.tasks.find((t) => t.id === prop.payload.taskId) : null) ||
            (taskStore.lastPausedTaskId ? taskStore.tasks.find((t) => t.id === taskStore.lastPausedTaskId) : null) ||
            taskStore.tasks.find((t) => t.status === 'in_progress' && t.isPaused);

          if (!targetTask) {
            targetTask = await findTaskInStoreOrDb(
              user.id,
              prop.payload?.taskId,
              prop.payload?.taskTitle,
              (t) => t.status === 'in_progress' && t.isPaused
            );
          }

          const targetId = targetTask?.id || prop.payload?.taskId || taskStore.lastPausedTaskId || 'active';
          const targetTitle = targetTask?.title || prop.payload?.taskTitle || 'Task';
          const timeDisplay = prop.payload?.timeDisplay || formatTime(safeIso);

          if (targetId !== 'active') {
            try {
              const previousState = targetTask
                ? {
                    status: targetTask.status,
                    isPaused: targetTask.isPaused,
                    startedAt: targetTask.startedAt,
                  }
                : {
                    status: 'in_progress' as const,
                    isPaused: true,
                    startedAt: safeIso,
                  };
              await taskStore.resumeTask(targetId, safeIso);
              processedProposals.push({
                ...prop,
                type: 'resume_task',
                status: 'auto_executed',
                executedAt: new Date().toISOString(),
                previousState,
                payload: {
                  taskId: targetId,
                  taskTitle: targetTitle,
                  timestampISO: safeIso,
                  timeDisplay,
                  autoPauseTaskId: prop.payload?.autoPauseTaskId,
                },
              });
              toast.success(`Resumed "${targetTitle}"!`);
            } catch (execErr) {
              console.error('Failed to auto-execute resume_task:', execErr);
              processedProposals.push({
                ...prop,
                type: 'resume_task',
                status: 'auto_executed',
                executedAt: new Date().toISOString(),
                payload: {
                  taskId: targetId,
                  taskTitle: targetTitle,
                  timestampISO: safeIso,
                  timeDisplay,
                },
              });
              toast.success(`Resumed "${targetTitle}"!`);
            }
          } else {
            processedProposals.push({
              ...prop,
              type: 'resume_task',
              status: 'auto_executed',
              executedAt: new Date().toISOString(),
              payload: {
                taskId: 'active',
                taskTitle: targetTitle,
                timestampISO: safeIso,
                timeDisplay,
              },
            });
            toast.success('Resumed task timer!');
          }
          continue;
        }

        if (prop.type === 'resume_last_paused') {
          const taskStore = useTaskStore.getState();
          const safeIso = ensureISO(prop.payload?.timestampISO);
          const lastPausedId = taskStore.lastPausedTaskId || prop.payload?.taskId;
          const targetTask = lastPausedId ? taskStore.tasks.find((t) => t.id === lastPausedId) : null;
          const targetTitle = targetTask?.title || prop.payload?.taskTitle || 'Last paused task';
          const timeDisplay = prop.payload?.timeDisplay || formatTime(safeIso);

          if (lastPausedId) {
            try {
              await taskStore.resumeLastPaused(safeIso);
              processedProposals.push({
                ...prop,
                type: 'resume_last_paused',
                status: 'auto_executed',
                executedAt: new Date().toISOString(),
                payload: {
                  taskId: lastPausedId,
                  taskTitle: targetTitle,
                  timestampISO: safeIso,
                  timeDisplay,
                },
              });
              toast.success(`Resumed "${targetTitle}"!`);
            } catch (execErr) {
              console.error('Failed to auto-execute resume_last_paused:', execErr);
              processedProposals.push({
                ...prop,
                type: 'resume_last_paused',
                status: 'auto_executed',
                executedAt: new Date().toISOString(),
                payload: {
                  taskId: lastPausedId,
                  taskTitle: targetTitle,
                  timestampISO: safeIso,
                  timeDisplay,
                },
              });
            }
          } else {
            processedProposals.push({
              ...prop,
              type: 'resume_last_paused',
              status: 'auto_executed',
              executedAt: new Date().toISOString(),
              payload: {
                taskTitle: targetTitle,
                timestampISO: safeIso,
                timeDisplay,
              },
            });
            toast.success('Task resumed!');
          }
          continue;
        }

        if (prop.type === 'finish_task') {
          const taskStore = useTaskStore.getState();
          let targetTask =
            (prop.payload?.taskId ? taskStore.tasks.find((t) => t.id === prop.payload.taskId) : null) ||
            (taskStore.runningTaskId ? taskStore.tasks.find((t) => t.id === taskStore.runningTaskId) : null) ||
            (prop.payload?.taskTitle
              ? taskStore.tasks.find(
                  (t) => t.title.trim().toLowerCase() === prop.payload.taskTitle.trim().toLowerCase()
                )
              : null);

          if (!targetTask) {
            targetTask = await findTaskInStoreOrDb(
              user.id,
              prop.payload?.taskId,
              prop.payload?.taskTitle
            );
          }

          const targetId = targetTask?.id || prop.payload?.taskId || taskStore.runningTaskId;
          const targetTitle = targetTask?.title || prop.payload?.taskTitle || 'Task';
          const safeIso = ensureISO(prop.payload?.timestampISO);

          if (targetId) {
            // Guard: If the task is already completed, do NOT re-execute finishTask or toast again
            if (targetTask?.status === 'done') {
              processedProposals.push({
                ...prop,
                status: 'auto_executed',
                executedAt: new Date().toISOString(),
                payload: {
                  ...prop.payload,
                  taskId: targetId,
                  taskTitle: targetTitle,
                  timestampISO: safeIso,
                },
              });
              continue;
            }

            try {
              const previousState = targetTask
                ? {
                    status: targetTask.status,
                    isPaused: targetTask.isPaused,
                    startedAt: targetTask.startedAt,
                  }
                : {
                    status: 'in_progress',
                    isPaused: false,
                    startedAt: safeIso,
                  };
              await taskStore.finishTask(targetId, safeIso);
              processedProposals.push({
                ...prop,
                status: 'auto_executed',
                executedAt: new Date().toISOString(),
                previousState,
                payload: {
                  ...prop.payload,
                  taskId: targetId,
                  taskTitle: targetTitle,
                  timestampISO: safeIso,
                },
              });
              toast.success(`Completed "${targetTitle}"! 🎉`);
            } catch (execErr) {
              console.error('Failed to auto-execute finish_task:', execErr);
              processedProposals.push({
                ...prop,
                status: 'auto_executed',
                executedAt: new Date().toISOString(),
                payload: {
                  ...prop.payload,
                  taskId: targetId,
                  taskTitle: targetTitle,
                  timestampISO: safeIso,
                },
              });
              toast.success(`Completed "${targetTitle}"! 🎉`);
            }
          } else {
            processedProposals.push({
              ...prop,
              status: 'auto_executed',
              executedAt: new Date().toISOString(),
              payload: {
                ...prop.payload,
                taskTitle: targetTitle,
                timestampISO: safeIso,
              },
            });
          }
          continue;
        }

        processedProposals.push(prop);
      }

      // If any proposal was auto-executed, sync to DB
      const hasAutoExecuted = processedProposals.some((p) => p.status === 'auto_executed');
      if (hasAutoExecuted) {
        await supabase
          .from('assistant_messages')
          .update({ proposals: processedProposals })
          .eq('id', messageId);
      }

      const assistantMsg: AssistantMessage = {
        id: messageId,
        conversationId,
        userId: user.id,
        role: 'assistant',
        content: replyText,
        proposals: processedProposals,
        createdAt: new Date().toISOString(),
        engineeredPrompt: resolvedEngineeredPrompt || undefined,
        searchSources: Array.isArray(searchSources) && searchSources.length > 0 ? searchSources : undefined,
      };

      set((state) => ({
        currentConversationId: conversationId,
        messages: state.messages.map((m) => (m.id === tempUserMsg.id ? { ...tempUserMsg, conversationId } : m)).concat(assistantMsg),
        isSending: false,
      }));

      // Refresh conversations list to update title and updated_at
      void get().fetchConversations();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to send message';
      toast.error(msg);
      set({ error: msg, isSending: false });
      throw err;
    }
  },

  // ── executeProposal (Approve action) ─────────────────────────────────────
  executeProposal: async (messageId: string, proposal: AssistantProposal) => {
    const taskStore = useTaskStore.getState();
    const timelineStore = useTimelineStore.getState();

    // Helper to resolve task UUID if proposal referenced a tempId or task title
    const resolveTaskId = async (rawId: string, taskTitle?: string): Promise<string> => {
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawId);

      // 1. If it's already a valid UUID and matches a known task in memory
      if (isUUID && taskStore.tasks.some((t) => t.id === rawId)) {
        return rawId;
      }

      // 2. Check if a companion create_tasks proposal in this message created a task
      const currentMsg = get().messages.find((m) => m.id === messageId);
      if (currentMsg?.proposals) {
        const createProp = currentMsg.proposals.find((pr) => pr.type === 'create_tasks');
        if (createProp?.createdRecordIds?.taskIds?.length) {
          if (createProp.createdRecordIds.taskIds.length === 1) {
            return createProp.createdRecordIds.taskIds[0];
          }
        } else if (createProp && createProp.status !== 'approved') {
          // If companion create_tasks has not been executed yet, execute it automatically first!
          await get().executeProposal(messageId, createProp);
          const refreshedMsg = get().messages.find((m) => m.id === messageId);
          const refreshedCreateProp = refreshedMsg?.proposals.find((pr) => pr.type === 'create_tasks');
          if (refreshedCreateProp?.createdRecordIds?.taskIds?.length) {
            return refreshedCreateProp.createdRecordIds.taskIds[0];
          }
        }
      }

      // 3. Search taskStore.tasks by title
      if (taskTitle) {
        const cleanTitle = taskTitle.trim().toLowerCase();
        const match = taskStore.tasks.find((t) => t.title.trim().toLowerCase() === cleanTitle);
        if (match) return match.id;
      }

      // 4. Try fetching latest tasks in case it was just inserted
      await taskStore.fetchTasks();
      const latestTasks = useTaskStore.getState().tasks;
      if (taskTitle) {
        const cleanTitle = taskTitle.trim().toLowerCase();
        const match = latestTasks.find((t) => t.title.trim().toLowerCase() === cleanTitle);
        if (match) return match.id;
      }

      // 5. If it's a UUID, return as-is
      if (isUUID) return rawId;

      throw new Error(`Could not find a matching task for "${taskTitle || rawId}". Please ensure it exists on your board.`);
    };

    // Helper to resolve project UUID if proposal referenced a projectTag or companion project
    const resolveProjectId = async (rawProjectId?: string | null, projectTag?: string | null): Promise<string | null> => {
      // 1. If valid UUID and exists in timelineStore
      if (rawProjectId && timelineStore.projects.some((p) => p.id === rawProjectId)) {
        return rawProjectId;
      }

      // 2. Check if companion create_project proposal in this message created a project
      const currentMsg = get().messages.find((m) => m.id === messageId);
      if (currentMsg?.proposals) {
        const createProjProp = currentMsg.proposals.find((pr) => pr.type === 'create_project');
        if (createProjProp?.createdRecordIds?.projectIds?.length) {
          return createProjProp.createdRecordIds.projectIds[0];
        } else if (createProjProp && createProjProp.status === 'pending') {
          // If companion create_project hasn't executed yet, execute it first!
          await get().executeProposal(messageId, createProjProp);
          const refreshedMsg = get().messages.find((m) => m.id === messageId);
          const refreshedProjProp = refreshedMsg?.proposals.find((pr) => pr.type === 'create_project');
          if (refreshedProjProp?.createdRecordIds?.projectIds?.length) {
            return refreshedProjProp.createdRecordIds.projectIds[0];
          }
        }
      }

      // 3. Search timelineStore.projects by projectTag or rawProjectId (name match)
      const lookupName = (projectTag || rawProjectId || '').trim().toLowerCase();
      if (lookupName) {
        const match = timelineStore.projects.find((p) => p.name.trim().toLowerCase() === lookupName);
        if (match) return match.id;
      }

      // 4. Try fetching latest projects
      await timelineStore.fetchProjects();
      const latestProjects = useTimelineStore.getState().projects;
      if (lookupName) {
        const match = latestProjects.find((p) => p.name.trim().toLowerCase() === lookupName);
        if (match) return match.id;
      }

      const isUUID = rawProjectId ? /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawProjectId) : false;
      if (isUUID) return rawProjectId!;

      return null;
    };

    try {
      const createdRecordIds: { taskIds?: string[]; eventIds?: string[]; projectIds?: string[] } = {};

      switch (proposal.type) {
        case 'create_project': {
          const p = proposal as CreateProjectProposal;
          const createdProj = await timelineStore.createProject(
            p.payload.name,
            p.payload.description,
            p.payload.status || 'active'
          );
          if (createdProj) {
            createdRecordIds.projectIds = [createdProj.id];
            toast.success(`Created project "${createdProj.name}"! 🚀`);
          }
          break;
        }

        case 'update_project': {
          const p = proposal as UpdateProjectProposal;
          const targetId = await resolveProjectId(p.payload.projectId, p.payload.projectName);
          if (targetId) {
            await timelineStore.updateProject(targetId, {
              status: p.payload.status,
              description: p.payload.description,
            });
            toast.success(`Project "${p.payload.projectName}" marked as ${p.payload.status}! 🏆`);
          }
          break;
        }

        case 'create_tasks': {
          const p = proposal as CreateTasksProposal;
          const createdIds: string[] = [];
          let targetDate = taskStore.selectedDate;
          for (const item of p.payload.tasks) {
            if (item.plannedDate) targetDate = item.plannedDate;
            const created = await taskStore.createTask({
              title: item.title,
              description: item.description,
              priority: item.priority,
              plannedDate: item.plannedDate,
            });
            if (created) createdIds.push(created.id);
          }
          createdRecordIds.taskIds = createdIds;

          // Sync active view to the date of the created tasks and reload
          if (targetDate) {
            taskStore.setSelectedDate(targetDate);
            await taskStore.fetchTasks();
          }
          toast.success(`Created ${createdIds.length} tasks in To Do (${targetDate})!`);
          break;
        }

        case 'start_task': {
          const p = proposal as StartTaskProposal;
          const targetId = await resolveTaskId(p.payload.taskId, p.payload.taskTitle);
          p.payload.taskId = targetId;
          await taskStore.startTask(targetId, p.payload.timestampISO);
          toast.success(`Started "${p.payload.taskTitle}"!`);
          break;
        }

        case 'pause_task': {
          const p = proposal as PauseTaskProposal;
          const targetId = await resolveTaskId(p.payload.taskId, p.payload.taskTitle);
          p.payload.taskId = targetId;
          await taskStore.pauseTask(targetId, p.payload.timestampISO, p.payload.reason);
          toast.success(`Paused "${p.payload.taskTitle}".`);
          break;
        }

        case 'resume_task': {
          const p = proposal as ResumeTaskProposal;
          const targetId = await resolveTaskId(p.payload.taskId, p.payload.taskTitle);
          p.payload.taskId = targetId;
          await taskStore.resumeTask(targetId, p.payload.timestampISO);
          toast.success(`Resumed "${p.payload.taskTitle}"!`);
          break;
        }

        case 'finish_task': {
          const p = proposal as FinishTaskProposal;
          const targetId = await resolveTaskId(p.payload.taskId, p.payload.taskTitle);
          p.payload.taskId = targetId;
          await taskStore.finishTask(targetId, p.payload.timestampISO);
          toast.success(`Marked "${p.payload.taskTitle}" as Done! 🎉`);
          break;
        }

        case 'pause_all': {
          const runningId = taskStore.runningTaskId;
          if (runningId) {
            await taskStore.pauseTask(runningId, proposal.payload.timestampISO, 'paused');
            toast.success('Running task paused. Enjoy your break! ☕');
          } else if (proposal.payload.taskId) {
            const targetId = await resolveTaskId(proposal.payload.taskId, proposal.payload.taskTitle);
            await taskStore.pauseTask(targetId, proposal.payload.timestampISO, 'paused');
            toast.success('Running task paused. Enjoy your break! ☕');
          }
          break;
        }

        case 'resume_last_paused': {
          const lastId = taskStore.lastPausedTaskId;
          if (lastId) {
            await taskStore.resumeTask(lastId, proposal.payload.timestampISO);
            toast.success('Task resumed!');
          } else if (proposal.payload.taskId) {
            const targetId = await resolveTaskId(proposal.payload.taskId, proposal.payload.taskTitle);
            await taskStore.resumeTask(targetId, proposal.payload.timestampISO);
            toast.success('Task resumed!');
          }
          break;
        }

        case 'attach_work_summary': {
          const p = proposal as AttachWorkSummaryProposal;
          const targetId = await resolveTaskId(p.payload.taskId, p.payload.taskTitle);
          p.payload.taskId = targetId;
          const latestTasks = useTaskStore.getState().tasks;
          const existing = latestTasks.find((t) => t.id === targetId);
          const newDesc =
            p.payload.mode === 'replace'
              ? p.payload.summaryMarkdown
              : existing?.description
              ? `${existing.description}\n\n---\n### Work Summary\n${p.payload.summaryMarkdown}`
              : p.payload.summaryMarkdown;

          await taskStore.updateTask(targetId, { description: newDesc });
          toast.success(`Summary attached to "${p.payload.taskTitle}"!`);
          break;
        }

        case 'create_work_event': {
          const p = proposal as CreateWorkEventProposal;
          const targetProjectId = await resolveProjectId(p.payload.projectId, p.payload.projectTag);
          p.payload.projectId = targetProjectId;

          const startH = p.payload.startTime ? timeToHours(p.payload.startTime) : 0;
          const endH = p.payload.endTime ? timeToHours(p.payload.endTime) : 0;
          const crossesMidnight = Boolean(p.payload.startTime && p.payload.endTime && startH > endH);

          if (crossesMidnight) {
            const startD = new Date(`${p.payload.date}T12:00:00`);
            const nextD = new Date(startD);
            nextD.setDate(nextD.getDate() + 1);
            const nextDateStr = toDateStr(nextD);

            // Part 1: start date from startTime to 24:00
            const ev1Id = await timelineStore.createWorkEvent({
              date: p.payload.date,
              startTime: p.payload.startTime,
              endTime: '24:00',
              title: `${p.payload.title} (Part 1)`,
              projectId: targetProjectId,
              projectTag: p.payload.projectTag,
              description: p.payload.description,
              implementationNotes: p.payload.implementationNotes,
              status: p.payload.status,
              links: [],
              sourceSegmentId: p.payload.sourceSegmentId,
              sourceTaskId: p.payload.sourceTaskId,
              previousEventId: p.payload.previousEventId ?? null,
            });

            // Part 2: next date from 00:00 to endTime
            const ev2Id = await timelineStore.createWorkEvent({
              date: nextDateStr,
              startTime: '00:00',
              endTime: p.payload.endTime,
              title: `${p.payload.title} (Part 2)`,
              projectId: targetProjectId,
              projectTag: p.payload.projectTag,
              description: p.payload.description,
              implementationNotes: p.payload.implementationNotes,
              status: p.payload.status,
              links: [],
              sourceSegmentId: p.payload.sourceSegmentId,
              sourceTaskId: p.payload.sourceTaskId,
              previousEventId: ev1Id ?? null,
            });

            if (ev1Id && ev2Id) {
              createdRecordIds.eventIds = [ev1Id, ev2Id];
            } else if (ev1Id) {
              createdRecordIds.eventIds = [ev1Id];
            }
          } else {
            const evId = await timelineStore.createWorkEvent({
              date: p.payload.date,
              startTime: p.payload.startTime,
              endTime: p.payload.endTime,
              title: p.payload.title,
              projectId: targetProjectId,
              projectTag: p.payload.projectTag,
              description: p.payload.description,
              implementationNotes: p.payload.implementationNotes,
              status: p.payload.status,
              links: [],
              sourceSegmentId: p.payload.sourceSegmentId,
              sourceTaskId: p.payload.sourceTaskId,
              previousEventId: p.payload.previousEventId ?? null,
            });
            if (evId) createdRecordIds.eventIds = [evId];
          }

          const shouldSyncToTask = p.payload.syncToTaskLog ?? true;
          let targetTaskId = p.payload.linkedTaskId || p.payload.sourceTaskId;
          if (!targetTaskId && p.payload.title) {
            const matched = taskStore.tasks.find(
              (t) => t.title.trim().toLowerCase() === p.payload.title.trim().toLowerCase()
            );
            if (matched) targetTaskId = matched.id;
          }

          if (shouldSyncToTask && targetTaskId) {
            try {
              const targetTask = taskStore.tasks.find((t) => t.id === targetTaskId);
              if (targetTask) {
                const existing = targetTask.description || '';
                const summarySection = p.payload.implementationNotes
                  ? `**Summary:**\n${p.payload.description}\n\n**Implementation Notes:**\n${p.payload.implementationNotes}`
                  : p.payload.description;

                const newDesc = existing
                  ? `${existing}\n\n---\n### Work Summary\n${summarySection}`
                  : summarySection;

                await taskStore.updateTask(targetTaskId, { description: newDesc });
                toast.success(`Saved to Work Journal and updated "${targetTask.title}" in Task Log! 💼`);
              } else {
                toast.success(`Logged work event "${p.payload.title}" in Work Journal!`);
              }
            } catch (taskUpdateErr) {
              console.error('Failed to sync summary to task description:', taskUpdateErr);
              toast.success(`Logged work event "${p.payload.title}" in Work Journal!`);
            }
          } else {
            toast.success(`Logged work event "${p.payload.title}" in Work Journal!`);
          }
          break;
        }

        case 'create_meeting_event': {
          const p = proposal as CreateMeetingEventProposal;
          const targetProjectId = await resolveProjectId(p.payload.projectId, p.payload.projectTag);
          p.payload.projectId = targetProjectId;

          const meetingLinks = [...(p.payload.links || [])];
          if (p.payload.meetingUrl && !meetingLinks.some((l) => l.url === p.payload.meetingUrl)) {
            const platformLabel = p.payload.meetingUrl.includes('meet.google')
              ? 'Google Meet'
              : p.payload.meetingUrl.includes('zoom.us')
              ? 'Zoom Meeting'
              : p.payload.meetingUrl.includes('teams.microsoft')
              ? 'Microsoft Teams'
              : 'Join Meeting';
            meetingLinks.unshift({ label: platformLabel, url: p.payload.meetingUrl });
          }

          const evId = await timelineStore.createMeetingEvent({
            date: p.payload.date,
            startTime: p.payload.startTime,
            endTime: p.payload.endTime,
            title: p.payload.title,
            projectId: targetProjectId,
            projectTag: p.payload.projectTag,
            isOptional: p.payload.isOptional,
            discussionSummary: p.payload.discussionSummary,
            decisions: p.payload.decisions,
            tasksAssigned: p.payload.tasksAssigned,
            links: meetingLinks,
            previousEventId: p.payload.previousEventId ?? null,
          });
          if (evId) createdRecordIds.eventIds = [evId];

          // Check if action items should also be added to Kanban To Do
          const shouldAddTasks = p.payload.addTasksToKanban ?? true;
          const userActionItems = p.payload.actionItems?.filter((item) => item.isForUser !== false) || [];

          // Fallback if rich actionItems wasn't provided: parse from tasksAssigned
          const itemsToProcess =
            userActionItems.length > 0
              ? userActionItems
              : (p.payload.tasksAssigned || [])
                  .filter((t) => {
                    const text = t.text.toLowerCase();
                    // If assigned to someone else (e.g. "[Dave]" or "Sarah:"), skip
                    const isForSomeoneElse =
                      text.startsWith('[') && !text.includes('salitha') && !text.includes('you');
                    return !isForSomeoneElse;
                  })
                  .map((t) => ({
                    text: t.text,
                    isForUser: true,
                    priority: 'medium' as const,
                    deadlineDate: p.payload.date,
                  }));

          if (shouldAddTasks && itemsToProcess.length > 0) {
            const createdIds: string[] = [];
            let targetDate = taskStore.selectedDate;
            for (const item of itemsToProcess) {
              const cleanTitle = item.text
                .replace(/^\[.*?\]\s*/, '')
                .replace(/\s*\([^)]*due[^)]*\)/i, '')
                .trim();
              const plannedDate = item.deadlineDate || p.payload.date;
              if (plannedDate) targetDate = plannedDate;
              const created = await taskStore.createTask({
                title: cleanTitle,
                description: `*Action item from meeting: "${p.payload.title}" (${p.payload.date})*`,
                priority: item.priority || 'medium',
                plannedDate,
              });
              if (created) createdIds.push(created.id);
            }

            if (createdIds.length > 0) {
              createdRecordIds.taskIds = createdIds;
              if (targetDate) {
                taskStore.setSelectedDate(targetDate);
                await taskStore.fetchTasks();
              }
              toast.success(
                `Logged meeting & added ${createdIds.length} task${createdIds.length === 1 ? '' : 's'} to Kanban To Do (${targetDate})! 📋`
              );
            } else {
              toast.success(`Logged meeting "${p.payload.title}" in Work Journal!`);
            }
          } else {
            toast.success(`Logged meeting "${p.payload.title}" in Work Journal!`);
          }
          break;
        }

        case 'update_meeting_event': {
          const p = proposal as UpdateMeetingEventProposal;
          const targetId = p.payload.targetEventId;
          if (!targetId) {
            throw new Error('No target meeting event ID specified to update.');
          }

          const allEvents = Object.values(timelineStore.eventsByDate).flat();
          const existing = allEvents.find((e) => e.id === targetId);

          const eventUpdates: Partial<Pick<import('../types').TimelineEvent, 'title'>> = {};
          if (p.payload.title && p.payload.title.trim()) {
            eventUpdates.title = p.payload.title.trim();
          }

          const existingLinks = (existing && existing.type === 'meeting' ? existing.links : []) || [];
          const meetingLinks = [...(p.payload.links || existingLinks)];
          if (p.payload.meetingUrl && !meetingLinks.some((l) => l.url === p.payload.meetingUrl)) {
            const platformLabel = p.payload.meetingUrl.includes('meet.google')
              ? 'Google Meet'
              : p.payload.meetingUrl.includes('zoom.us')
              ? 'Zoom Meeting'
              : p.payload.meetingUrl.includes('teams.microsoft')
              ? 'Microsoft Teams'
              : 'Join Meeting';
            meetingLinks.unshift({ label: platformLabel, url: p.payload.meetingUrl });
          }

          const detailUpdates: Partial<import('../types').MeetingDetails> = {
            discussionSummary: p.payload.discussionSummary,
            decisions: p.payload.decisions,
            tasksAssigned: p.payload.tasksAssigned,
            links: meetingLinks,
          };

          await timelineStore.updateEvent(targetId, eventUpdates, detailUpdates);

          // Check if action items should also be added to Kanban To Do
          const shouldAddTasks = p.payload.addTasksToKanban ?? true;
          const userActionItems = p.payload.actionItems?.filter((item) => item.isForUser !== false) || [];

          const itemsToProcess =
            userActionItems.length > 0
              ? userActionItems
              : (p.payload.tasksAssigned || [])
                  .filter((t) => {
                    const text = t.text.toLowerCase();
                    const isForSomeoneElse =
                      text.startsWith('[') && !text.includes('salitha') && !text.includes('you');
                    return !isForSomeoneElse;
                  })
                  .map((t) => ({
                    text: t.text,
                    isForUser: true,
                    priority: 'medium' as const,
                    deadlineDate: existing?.date || new Date().toISOString().slice(0, 10),
                  }));

          if (shouldAddTasks && itemsToProcess.length > 0) {
            const createdIds: string[] = [];
            for (const item of itemsToProcess) {
              const cleanTitle = item.text
                .replace(/^\[.*?\]\s*/, '')
                .replace(/\s*\([^)]*due[^)]*\)/i, '')
                .trim();
              const plannedDate = item.deadlineDate || existing?.date || new Date().toISOString().slice(0, 10);
              const created = await taskStore.createTask({
                title: cleanTitle,
                description: `*Action item from updated meeting: "${p.payload.title || existing?.title || 'Meeting'}"*`,
                priority: item.priority || 'medium',
                plannedDate,
              });
              if (created) createdIds.push(created.id);
            }

            if (createdIds.length > 0) {
              createdRecordIds.taskIds = createdIds;
              toast.success(
                `Meeting updated & added ${createdIds.length} task${createdIds.length === 1 ? '' : 's'} to Kanban To Do! 📋`
              );
            } else {
              toast.success('Meeting log updated in Work Journal! 📅');
            }
          } else {
            toast.success('Meeting log updated in Work Journal! 📅');
          }
          break;
        }

        case 'carry_over_tasks': {
          const p = proposal as CarryOverTasksProposal;
          if (p.payload.taskIds && p.payload.taskIds.length > 0) {
            await taskStore.carryoverTasksToDate(p.payload.taskIds, p.payload.targetDate);
            toast.success(`Carried over ${p.payload.taskIds.length} task${p.payload.taskIds.length === 1 ? '' : 's'} to ${p.payload.targetDate}!`);
          } else {
            toast('No tasks selected for carryover.');
          }
          break;
        }

        case 'daily_wrap_up': {
          const p = proposal as DailyWrapUpProposal;
          if (p.payload.carryoverTaskIds && p.payload.carryoverTaskIds.length > 0) {
            await taskStore.carryoverTasksToDate(
              p.payload.carryoverTaskIds,
              p.payload.targetCarryoverDate
            );
          }
          if (p.payload.proposedJournalEvents && p.payload.proposedJournalEvents.length > 0) {
            for (const ev of p.payload.proposedJournalEvents) {
              await timelineStore.createWorkEvent({
                date: ev.date,
                startTime: ev.startTime,
                endTime: ev.endTime,
                title: ev.title,
                projectTag: ev.projectTag,
                description: ev.description,
                implementationNotes: ev.implementationNotes,
                status: ev.status,
                links: [],
                sourceSegmentId: ev.sourceSegmentId,
                sourceTaskId: ev.sourceTaskId,
              });
            }
          }
          toast.success('Daily wrap-up completed! 🌙');
          break;
        }
      }

      // Mark proposal as approved in local state & database
      const updatedMessages = get().messages.map((m) => {
        if (m.id !== messageId) return m;
        return {
          ...m,
          proposals: m.proposals.map((prop) =>
            prop.id === proposal.id
              ? ({
                  ...prop,
                  status: 'approved' as const,
                  executedAt: new Date().toISOString(),
                  createdRecordIds,
                } as AssistantProposal)
              : prop
          ),
        };
      });

      set({ messages: updatedMessages });

      // Persist status change to Supabase
      const targetMessage = updatedMessages.find((m) => m.id === messageId);
      if (targetMessage) {
        await supabase
          .from('assistant_messages')
          .update({ proposals: targetMessage.proposals })
          .eq('id', messageId);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Execution failed';
      toast.error(msg);

      // Mark proposal as failed
      set((state) => ({
        messages: state.messages.map((m) => {
          if (m.id !== messageId) return m;
          return {
            ...m,
            proposals: m.proposals.map((prop) =>
              prop.id === proposal.id
                ? ({ ...prop, status: 'failed' as const, error: msg } as AssistantProposal)
                : prop
            ),
          };
        }),
      }));
    }
  },

  // ── rejectProposal ──────────────────────────────────────────────────────
  rejectProposal: async (messageId: string, proposalId: string) => {
    const updatedMessages = get().messages.map((m) => {
      if (m.id !== messageId) return m;
      return {
        ...m,
        proposals: m.proposals.map((prop) =>
          prop.id === proposalId ? ({ ...prop, status: 'rejected' as const } as AssistantProposal) : prop
        ),
      };
    });

    set({ messages: updatedMessages });

    const targetMessage = updatedMessages.find((m) => m.id === messageId);
    if (targetMessage) {
      await supabase
        .from('assistant_messages')
        .update({ proposals: targetMessage.proposals })
        .eq('id', messageId);
    }

    toast('Proposal rejected', { icon: '🚫' });
  },

  // ── deleteConversation ──────────────────────────────────────────────────
  deleteConversation: async (conversationId: string) => {
    const { currentConversationId, conversations } = get();
    try {
      await supabase.from('assistant_conversations').delete().eq('id', conversationId);
      set({
        conversations: conversations.filter((c) => c.id !== conversationId),
        ...(currentConversationId === conversationId
          ? { currentConversationId: null, messages: [] }
          : {}),
      });
      toast.success('Conversation deleted');
    } catch (err: unknown) {
      console.error('Failed to delete conversation:', err);
      toast.error('Failed to delete conversation');
    }
  },

  // ── undoAction ──────────────────────────────────────────────────────────
  undoAction: async (messageId: string, proposal: AssistantProposal) => {
    const taskStore = useTaskStore.getState();
    const timestamp = new Date().toISOString();

    try {
      if (proposal.type === 'start_task') {
        const p = proposal as StartTaskProposal;
        await taskStore.revertToTodo(p.payload.taskId, timestamp);
        if (p.payload.autoPauseTaskId) {
          try {
            await taskStore.resumeTask(p.payload.autoPauseTaskId, timestamp);
          } catch (autoErr) {
            console.warn('Could not auto-resume previous task on undo:', autoErr);
          }
        }
        toast.success(`Undone: Moved "${p.payload.taskTitle}" back to To Do`);
      } else if (proposal.type === 'pause_task' || proposal.type === 'pause_all') {
        const p = proposal as PauseTaskProposal;
        const taskId = p.payload.taskId || taskStore.lastPausedTaskId;
        if (taskId) {
          await taskStore.resumeTask(taskId, timestamp);
          toast.success('Undone: Resumed task');
        }
      } else if (proposal.type === 'resume_task' || proposal.type === 'resume_last_paused') {
        const p = proposal as ResumeTaskProposal;
        const taskId = p.payload.taskId || taskStore.runningTaskId;
        if (taskId) {
          await taskStore.pauseTask(taskId, timestamp, 'paused');
          toast.success('Undone: Paused task');
        }
      } else if (proposal.type === 'finish_task') {
        const p = proposal as FinishTaskProposal;
        const taskId = p.payload.taskId || taskStore.tasks.find((t) => t.title === p.payload.taskTitle)?.id;
        if (taskId) {
          await taskStore.revertToInProgress(taskId, timestamp);
          toast.success(`Undone: Moved "${p.payload.taskTitle}" back to In Progress`);
        }
      } else if (proposal.type === 'attach_work_summary') {
        const p = proposal as AttachWorkSummaryProposal;
        if (p.payload.taskId && p.previousState?.description !== undefined) {
          await taskStore.updateTask(p.payload.taskId, { description: p.previousState.description });
          toast.success(`Undone: Restored description on "${p.payload.taskTitle}"`);
        }
      } else if (proposal.type === 'create_project') {
        const projId = proposal.createdRecordIds?.projectIds?.[0];
        if (projId) {
          await supabase.from('projects').delete().eq('id', projId);
          await useTimelineStore.getState().fetchProjects();
          toast.success('Undone: Removed project');
        }
      } else if (proposal.type === 'create_work_event' || proposal.type === 'create_meeting_event') {
        const evId = proposal.createdRecordIds?.eventIds?.[0];
        if (evId) {
          await useTimelineStore.getState().deleteEvent(evId);
          toast.success(`Undone: Removed event from Work Journal`);
        }
      } else if (proposal.type === 'create_tasks') {
        const createdTaskIds = proposal.createdRecordIds?.taskIds;
        if (createdTaskIds && createdTaskIds.length > 0) {
          for (const tId of createdTaskIds) {
            await supabase.from('tasks').delete().eq('id', tId);
          }
          await taskStore.fetchTasks();
          toast.success(`Undone: Removed ${createdTaskIds.length} created task${createdTaskIds.length === 1 ? '' : 's'} from To Do`);
        } else {
          toast.success('Undone: Created tasks reverted');
        }
      } else if (proposal.type === 'update_meeting_event') {
        const createdTaskIds = proposal.createdRecordIds?.taskIds;
        if (createdTaskIds && createdTaskIds.length > 0) {
          for (const tId of createdTaskIds) {
            await supabase.from('tasks').delete().eq('id', tId);
          }
          await taskStore.fetchTasks();
          toast.success('Undone: Removed meeting action items from To Do');
        } else {
          toast.success('Undone');
        }
      }

      const updatedMessages = get().messages.map((m) => {
        if (m.id !== messageId) return m;
        return {
          ...m,
          proposals: m.proposals.map((pr) =>
            pr.id === proposal.id ? ({ ...pr, status: 'undone' as const } as AssistantProposal) : pr
          ),
        };
      });
      set({ messages: updatedMessages });

      const targetMsg = updatedMessages.find((m) => m.id === messageId);
      if (targetMsg) {
        await supabase
          .from('assistant_messages')
          .update({ proposals: targetMsg.proposals })
          .eq('id', messageId);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to undo action';
      toast.error(message);
    }
  },

  // ── updateActionTime ────────────────────────────────────────────────────
  updateActionTime: async (messageId: string, proposalId: string, newTimestampISO: string) => {
    const taskStore = useTaskStore.getState();
    const targetMsg = get().messages.find((m) => m.id === messageId);
    const proposal = targetMsg?.proposals.find((p) => p.id === proposalId);
    if (!proposal || !('payload' in proposal)) return;

    const taskId = (proposal.payload as { taskId?: string }).taskId;
    if (!taskId) return;

    try {
      const timeDisplay = formatTime(newTimestampISO);

      if (proposal.type === 'start_task' || proposal.type === 'resume_task' || proposal.type === 'resume_last_paused') {
        const { data: openEntries } = await supabase
          .from('task_time_entries')
          .select('id')
          .eq('task_id', taskId)
          .is('ended_at', null)
          .order('started_at', { ascending: false })
          .limit(1);

        if (openEntries && openEntries.length > 0) {
          await supabase
            .from('task_time_entries')
            .update({ started_at: newTimestampISO })
            .eq('id', openEntries[0].id);
        }

        if (proposal.type === 'start_task') {
          await supabase
            .from('tasks')
            .update({ started_at: newTimestampISO })
            .eq('id', taskId);
        }
      } else if (proposal.type === 'pause_task' || proposal.type === 'pause_all') {
        const { data: closedEntries } = await supabase
          .from('task_time_entries')
          .select('id')
          .eq('task_id', taskId)
          .not('ended_at', 'is', null)
          .order('ended_at', { ascending: false })
          .limit(1);

        if (closedEntries && closedEntries.length > 0) {
          await supabase
            .from('task_time_entries')
            .update({ ended_at: newTimestampISO })
            .eq('id', closedEntries[0].id);
        }
      } else if (proposal.type === 'finish_task') {
        const { data: closedEntries } = await supabase
          .from('task_time_entries')
          .select('id')
          .eq('task_id', taskId)
          .not('ended_at', 'is', null)
          .order('ended_at', { ascending: false })
          .limit(1);

        if (closedEntries && closedEntries.length > 0) {
          await supabase
            .from('task_time_entries')
            .update({ ended_at: newTimestampISO })
            .eq('id', closedEntries[0].id);
        }

        await supabase
          .from('tasks')
          .update({ completed_at: newTimestampISO })
          .eq('id', taskId);
      }

      await supabase.rpc('recalc_task_tracked_seconds', { p_task_id: taskId });
      await taskStore.fetchTaskSegments(taskId);
      await taskStore.fetchTasks();

      const updatedMessages = get().messages.map((m) => {
        if (m.id !== messageId) return m;
        return {
          ...m,
          proposals: m.proposals.map((pr) => {
            if (pr.id !== proposalId) return pr;
            return {
              ...pr,
              payload: {
                ...pr.payload,
                timestampISO: newTimestampISO,
                timeDisplay,
              },
            } as AssistantProposal;
          }),
        };
      });

      set({ messages: updatedMessages });

      const refreshedTarget = updatedMessages.find((m) => m.id === messageId);
      if (refreshedTarget) {
        await supabase
          .from('assistant_messages')
          .update({ proposals: refreshedTarget.proposals })
          .eq('id', messageId);
      }

      toast.success('Timestamp updated');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update time';
      toast.error(message);
    }
  },
}));

