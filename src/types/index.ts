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

export interface TimelineEvent {
  id: string;
  userId: string;
  date: string;            // ISO date string — YYYY-MM-DD
  startTime: string | null; // HH:MM
  endTime: string | null;   // HH:MM
  type: EventType;
  title: string;
  projectTag: string | null;
  chainId: string | null;
  previousEventId: string | null;
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


