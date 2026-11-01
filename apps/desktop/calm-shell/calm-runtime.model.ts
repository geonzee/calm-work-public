export interface CalmSharedTaskRef {
  connectionId: string;
  projectId: string;
  taskId: string;
}
export interface CalmSharedTaskData {
  id: string;
  title: string;
  done: boolean;
  plannedFor: string | null;
  plannedDate?: string | null;
  estimateMinutes: number | null;
  notes: string;
  assignee: string | null;
}
export interface CalmSharedRow {
  base?: CalmSharedTaskData | null;
  projectId: string;
  taskId: string;
  task: CalmSharedTaskData | null;
}
export interface CalmSharedConnection {
  id: string;
  workspaceId: string;
  name: string;
  role: string;
  error: string;
  ignored: string[];
  preserveKeys?: string[];
  conflicts: { key: string }[];
  snapshot: {
    id: string;
    name: string;
    projects: { id: string; name: string; tasks: CalmSharedTaskData[] }[];
  };
}
export interface CalmRepeatRule {
  cycle: 'weekly' | 'monthly';
  every: number;
  weekdays: number[];
  weekOfMonth?: 1 | 2 | 3 | 4 | -1;
}
export interface CalmTask {
  shared?: CalmSharedTaskRef;
  id: string;
  title: string;
  project: string;
  date: string;
  schedule: string;
  estimate: number | null;
  done: boolean;
  today: boolean;
  notes?: string;
  repeat?: string;
  repeatRule?: CalmRepeatRule | null;
  /** Calendar for this task's time block: '' default, 'none' local only, or account|calendar. */
  calendar?: string;
  actual?: CalmSession | null;
  nativeMs?: number;
  nativeDays?: Record<string, number>;
}
export interface CalmSession {
  sessionKey: string;
  id: string;
  title: string;
  project: string;
  date: string;
  start: string;
  end: string;
  startMinute: number;
  endMinute: number;
  startTimestamp?: number;
  endTimestamp?: number;
  focusedSeconds: number;
  duration: number;
  estimate: number | null;
  nativeStartMs?: number;
  nativeStartDays?: Record<string, number>;
  dailyMs?: Record<string, number>;
  recorded: boolean;
}
export interface CalmEvent {
  id: string;
  title: string;
  date: string;
  start: string;
  end: string;
  calendar: string;
  attendees?: string;
  meetingUrl?: string;
  notes?: string;
  owned: boolean;
}
export interface CalmClock {
  active: string | null;
  running: boolean;
  startedAt: number;
  elapsedMs: number;
  lastActiveAt?: number;
  resumedAt: number;
  estimate: number | null;
  nativeStartMs: number;
  nativeStartDays?: Record<string, number>;
  dailyMs?: Record<string, number>;
}
export interface CalmDocument {
  tasks: CalmTask[];
  projects: string[];
  sessions: CalmSession[];
  events: CalmEvent[];
  clock: CalmClock | null;
  drafts: Record<string, Record<string, string | boolean>>;
  /**
   * The `$projectCalendars` and `$eventMeta` JSON this device last loaded or saved.
   * The host saves only the difference from it, so a stale or empty map here can
   * never delete links made on another device.
   */
  mergeBase?: { projectCalendars?: string; eventMeta?: string };
  today?: string;
  recoveryPending?: boolean;
  sharedProjects?: string[];
  projectRenames?: Record<string, string>;
  deletedTaskIds?: string[];
  /** Projects removed in this save; their tasks were moved to Inbox or deleted first. */
  deletedProjects?: string[];
}
export interface CalmRequest {
  channel: 'calm-work-v1';
  requestId: string;
  command:
    | 'load'
    | 'save'
    | 'seed'
    | 'restore'
    | 'refresh'
    | 'backfill'
    | 'backfill-undo';
  /** For `backfill`: false (default) only reports what would change. */
  apply?: boolean;
  /** For `backfill`: `open` (default) or `done` (finished past tasks). */
  scope?: 'open' | 'done';
  document?: CalmDocument;
  archive?: unknown;
}
