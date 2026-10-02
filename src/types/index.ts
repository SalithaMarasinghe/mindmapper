export type NodeType = 'root' | 'branch' | 'leaf';
export type NodeDirection = 'left' | 'right' | 'top' | 'bottom';

export interface Waypoint {
  id: string;
  x: number;
  y: number;
}

export type EdgeWaypoints = Record<string, Waypoint[]>;

export interface MindmapNode {
  id: string;
  mapId: string;
  label: string;
  parentId: string | null;
  type: NodeType;
  direction?: NodeDirection;
  order: number;
  color: string;
  bgColor: string;
  emoji?: string;
  position?: { x: number; y: number };
}

export interface KeyPoint {
  id: string;
  text: string;
  order: number;
}

export interface Resource {
  id: string;
  title: string;
  url?: string;
  note?: string;
}

export interface NodeContent {
  nodeId: string;
  mapId: string;
  richContent?: unknown[];
  definition: string;
  keyPoints: KeyPoint[];
  mentalModel: string;
  goodExample: string;
  badExample: string;
  notes: string;
  resources: Resource[];
  isCompleted: boolean;
  completedAt: string | null;
  lastEdited: string | null;
  createdAt: string;
}

export interface MindmapMeta {
  id: string;
  userId: string;
  title: string;
  description?: string;
  emoji: string;
  color: string;
  tags: string[];
  isPublic: boolean;
  shareToken: string | null;
  nodeCount: number;
  completedCount: number;
  createdAt: string;
  updatedAt: string;
  edgeWaypoints?: EdgeWaypoints;
}

export type SharePermission = 'view' | 'edit';

export interface MapShare {
  id: string;
  mapId: string;
  sharedByUserId: string;
  sharedWithEmail: string;
  permission: SharePermission;
  accepted: boolean;
  createdAt: string;
}

export interface UserProfile {
  id: string;
  displayName: string | null;
  avatarUrl: string | null;
  createdAt: string;
}

export interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  defaultBranchColors: string[];
  autoSave: boolean;
  lastVisitedMapId: string | null;
  sidebarCollapsed: boolean;
}

export interface ApiResult<T> {
  data: T | null;
  error: string | null;
}

export interface ExportedMap {
  exportVersion: '2.0.0';
  exportedAt: string;
  meta: MindmapMeta;
  nodes: MindmapNode[];
  content: Record<string, NodeContent>;
}

export const STORAGE_VERSION = '2.0.0';

export const DEFAULT_BRANCH_COLORS = [
  '#01696f',
  '#437a22',
  '#964219',
  '#006494',
  '#7a39bb',
  '#da7101',
  '#d19900',
  '#a12c7b',
  '#a13544',
  '#2563eb'
];

export function isApiError(e: unknown): e is Error {
  return e instanceof Error;
}

// ─── Timeline Feature ────────────────────────────────────────────────────────

export type EventType = 'work' | 'meeting';
export type WorkStatus = 'done' | 'in_progress' | 'blocked';

export interface EventLink {
  label: string;
  url: string;
}

export interface Project {
  id: string;
  userId: string;
  name: string;
  description?: string | null;
  status: 'active' | 'completed' | 'on_hold' | 'planning';
  createdAt: string;
  updatedAt: string;
}

export interface TimelineEvent {
  id: string;
  userId: string;
  date: string;            // ISO date string — YYYY-MM-DD
  startTime: string | null; // HH:MM
  endTime: string | null;   // HH:MM
  type: EventType;
  title: string;
  projectId?: string | null;
  projectTag: string | null;
  chainId: string | null;
  previousEventId: string | null;
  sourceSegmentId?: string | null;
  sourceTaskId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkDetails {
  eventId: string;
  description: string;
  implementationNotes: string;
  status: WorkStatus;
  links: EventLink[];
}

export interface MeetingDetails {
  eventId: string;
  isOptional: boolean;
  discussionSummary: string;
  tasksAssigned: TaskItem[];
  decisions: string;
  links: EventLink[];
}

export interface TaskItem {
  text: string;
  done: boolean;
}

export interface WeeklySummary {
  id: string;
  userId: string;
  weekStartDate: string;   // ISO date string — YYYY-MM-DD (always a Monday)
  generatedText: string;
  sourceEventIds: string[];
  createdAt: string;
}

// Discriminated union — narrow with `event.type === 'work'` or `'meeting'`
export type TimelineEventFull =
  | (TimelineEvent & { type: 'work' } & WorkDetails)
  | (TimelineEvent & { type: 'meeting' } & MeetingDetails);

// ─── Kanban Work Task Log Feature ───────────────────────────────────────────

export type TaskStatus = 'todo' | 'in_progress' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high';
export type SegmentEndReason = 'paused' | 'done' | 'auto_closed' | 'manual';

export interface TaskTimeEntry {
  id: string;
  taskId: string;
  userId: string;
  startedAt: string; // ISO timestamp
  endedAt: string | null; // ISO timestamp (null = currently running)
  endReason: SegmentEndReason | null;
  createdAt: string; // ISO timestamp
}

export interface WorkTask {
  id: string;
  userId: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  plannedDate: string; // YYYY-MM-DD
  startedAt: string | null; // ISO timestamp (first segment start)
  completedAt: string | null; // ISO timestamp (final segment end)
  isPaused: boolean; // true if status is in_progress but currently paused
  trackedSeconds: number; // cached sum of closed segments in seconds
  activeSegmentStartedAt?: string | null; // ISO timestamp if segment is currently running
  projectId?: string | null;
  projectTag?: string | null;
  orderIndex: number;
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
}

export interface TaskStatusHistory {
  id: string;
  taskId: string;
  userId: string;
  fromStatus: string;
  toStatus: string;
  changedAt: string; // ISO timestamp
  isManualEdit: boolean;
  notes: string | null;
}

// ─── AI Assistant Feature ───────────────────────────────────────────────────

export type ProposalType =
  | 'create_tasks'
  | 'start_task'
  | 'pause_task'
  | 'resume_task'
  | 'finish_task'
  | 'pause_all'
  | 'resume_last_paused'
  | 'update_task'
  | 'delete_task'
  | 'switch_active_project'
  | 'attach_work_summary'
  | 'create_project'
  | 'update_project'
  | 'create_work_event'
  | 'create_meeting_event'
  | 'update_meeting_event'
  | 'carry_over_tasks'
  | 'daily_wrap_up';

export type ProposalStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'failed'
  | 'auto_executed'
  | 'undone';

export interface BaseProposal {
  id: string;
  type: ProposalType;
  summary: string;
  status: ProposalStatus;
  error?: string;
  executedAt?: string;
  previousState?: {
    status: string;
    isPaused: boolean;
    startedAt?: string | null;
    description?: string;
  };
  createdRecordIds?: {
    taskIds?: string[];
    eventIds?: string[];
    projectIds?: string[];
  };
}

export interface CreateTasksProposal extends BaseProposal {
  type: 'create_tasks';
  payload: {
    tasks: Array<{
      tempId?: string;
      title: string;
      description: string;
      priority: TaskPriority;
      plannedDate: string;
      isLikelyDuplicate?: boolean;
    }>;
  };
}

export interface StartTaskProposal extends BaseProposal {
  type: 'start_task';
  payload: {
    taskId: string;
    taskTitle: string;
    timestampISO: string;
    timeDisplay: string;
    autoPauseTaskId?: string | null;
    autoPauseTaskTitle?: string | null;
  };
}

export interface PauseTaskProposal extends BaseProposal {
  type: 'pause_task';
  payload: {
    taskId: string;
    taskTitle: string;
    timestampISO: string;
    timeDisplay: string;
    reason: SegmentEndReason;
  };
}

export interface ResumeTaskProposal extends BaseProposal {
  type: 'resume_task';
  payload: {
    taskId: string;
    taskTitle: string;
    timestampISO: string;
    timeDisplay: string;
    autoPauseTaskId?: string | null;
  };
}

export interface FinishTaskProposal extends BaseProposal {
  type: 'finish_task';
  payload: {
    taskId: string;
    taskTitle: string;
    timestampISO: string;
    timeDisplay: string;
    trackedDurationDisplay?: string;
  };
}

export interface PauseAllProposal extends BaseProposal {
  type: 'pause_all';
  payload: {
    taskId?: string;
    taskTitle?: string;
    timestampISO: string;
    timeDisplay: string;
  };
}

export interface ResumeLastPausedProposal extends BaseProposal {
  type: 'resume_last_paused';
  payload: {
    taskId?: string;
    taskTitle?: string;
    timestampISO: string;
    timeDisplay: string;
  };
}

export interface AttachWorkSummaryProposal extends BaseProposal {
  type: 'attach_work_summary';
  payload: {
    taskId: string;
    taskTitle: string;
    summaryMarkdown: string;
    mode: 'append' | 'replace';
  };
}

export interface CreateWorkEventProposal extends BaseProposal {
  type: 'create_work_event';
  payload: {
    date: string;
    startTime: string | null;
    endTime: string | null;
    title: string;
    projectId?: string | null;
    projectTag: string | null;
    description: string;
    implementationNotes: string;
    status: WorkStatus;
    linkedTaskId?: string;
    sourceSegmentId?: string;
    sourceTaskId?: string;
    syncToTaskLog?: boolean;
    previousEventId?: string | null;
    previousEventTitle?: string | null;
  };
}

export interface MeetingActionItem {
  text: string;
  assignee?: string;
  isForUser?: boolean;
  deadlineDate?: string;
  deadlineDisplay?: string;
  priority?: TaskPriority;
  done?: boolean;
}

export interface CreateMeetingEventProposal extends BaseProposal {
  type: 'create_meeting_event';
  payload: {
    date: string;
    startTime: string | null;
    endTime: string | null;
    title: string;
    projectId?: string | null;
    projectTag: string | null;
    isOptional: boolean;
    discussionSummary: string;
    decisions: string;
    tasksAssigned: TaskItem[];
    actionItems?: MeetingActionItem[];
    addTasksToKanban?: boolean;
    attendees?: string[];
    links?: EventLink[];
    meetingUrl?: string;
    previousEventId?: string | null;
    previousEventTitle?: string | null;
  };
}

export interface CandidateMeetingEvent {
  id: string;
  title: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  projectTag: string | null;
}

export interface UpdateMeetingEventProposal extends BaseProposal {
  type: 'update_meeting_event';
  payload: {
    targetEventId: string;
    candidateEvents?: CandidateMeetingEvent[];
    title?: string;
    discussionSummary: string;
    decisions: string;
    tasksAssigned: TaskItem[];
    actionItems?: MeetingActionItem[];
    addTasksToKanban?: boolean;
    links?: EventLink[];
    meetingUrl?: string;
  };
}

export interface CarryOverTasksProposal extends BaseProposal {
  type: 'carry_over_tasks';
  payload: {
    taskIds: string[];
    taskTitles?: string[];
    carryoverTasks?: Array<{ id: string; title: string; priority?: string }>;
    targetDate: string;
  };
}

export interface DailyWrapUpProposal extends BaseProposal {
  type: 'daily_wrap_up';
  payload: {
    completedTasksCount: number;
    totalTrackedSeconds: number;
    summaryNarrative: string;
    carryoverTaskIds: string[];
    carryoverTasks?: Array<{ id: string; title: string; priority?: string }>;
    targetCarryoverDate: string;
    proposedJournalEvents: Array<CreateWorkEventProposal['payload']>;
  };
}

export interface UpdateProjectProposal extends BaseProposal {
  type: 'update_project';
  payload: {
    projectId: string;
    projectName: string;
    status: 'active' | 'completed' | 'on_hold' | 'planning';
    description?: string;
  };
}

export interface CreateProjectProposal extends BaseProposal {
  type: 'create_project';
  payload: {
    name: string;
    description?: string;
    status?: 'active' | 'completed' | 'on_hold' | 'planning';
  };
}

export interface UpdateTaskProposal extends BaseProposal {
  type: 'update_task';
  payload: {
    taskId?: string;
    taskTitle?: string;
    status?: string;
    is_paused?: boolean;
    isPaused?: boolean;
    trackedSeconds?: number;
    description?: string;
  };
}

export type AssistantProposal =
  | UpdateTaskProposal
  | CreateTasksProposal
  | StartTaskProposal
  | PauseTaskProposal
  | ResumeTaskProposal
  | FinishTaskProposal
  | PauseAllProposal
  | ResumeLastPausedProposal
  | AttachWorkSummaryProposal
  | CreateProjectProposal
  | UpdateProjectProposal
  | CreateWorkEventProposal
  | CreateMeetingEventProposal
  | UpdateMeetingEventProposal
  | CarryOverTasksProposal
  | DailyWrapUpProposal;

export interface AssistantConversation {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface SearchSource {
  title: string;
  url: string;
  snippet?: string;
}

export interface AssistantMessage {
  id: string;
  conversationId: string;
  userId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  proposals: AssistantProposal[];
  createdAt: string;
  engineeredPrompt?: string;
  searchSources?: SearchSource[];
}

// ─── Email & Meeting Notification System ────────────────────────────────────

export interface ParsedMeeting {
  title: string;
  date: string; // YYYY-MM-DD
  startTime: string; // e.g. "10:00 AM" or "10:00"
  endTime?: string; // e.g. "11:00 AM" or "11:00"
  meetingUrl?: string; // Google Meet, Zoom, Teams URL
  platform: 'google_meet' | 'zoom' | 'teams' | 'other';
  organizer?: string;
  organizerEmail?: string;
  attendees?: string[];
  summary?: string;
  isConfirmed?: boolean;
}

export interface EmailMessage {
  id: string;
  sender: string;
  senderEmail: string;
  subject: string;
  date: string; // ISO date string
  snippet: string;
  body: string;
  hasMeetingInvite: boolean;
  meetingDetails?: ParsedMeeting;
}

export interface AppNotification {
  id: string;
  type: 'meeting_invite' | 'meeting_upcoming' | 'meeting_live' | 'system';
  title: string;
  message: string;
  meetingLink?: string;
  meetingDate?: string;
  meetingTime?: string;
  platform?: 'google_meet' | 'zoom' | 'teams' | 'other';
  eventId?: string;
  read: boolean;
  createdAt: string; // ISO string
  actionLabel?: string;
  actionUrl?: string;
}

