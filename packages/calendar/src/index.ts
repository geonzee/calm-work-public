import type { EntityId, Instant, Provider } from '../../core/src/index.js';

export interface CalendarRef {
  readonly provider: Provider;
  readonly accountId: string;
  readonly calendarId: string;
}

/** Zoned instants for timed events; date-only ranges remain date-only. */
export type CalendarRange =
  | { kind: 'timed'; start: Instant; end: Instant; timeZone: string }
  | { kind: 'all-day'; startDate: string; endDateExclusive: string; timeZone: string };

export interface CalendarEvent {
  readonly id: string;
  readonly calendar: CalendarRef;
  readonly title: string;
  readonly range: CalendarRange;
  readonly revision: string;
  readonly busy: boolean;
  readonly ownership: 'external' | 'app-mirror';
  readonly taskId?: EntityId;
}

/** Provider cache/cursor is device-local. Commit cursor after all pages commit. */
export type CalendarCursor =
  | { provider: 'google'; syncToken: string; queryKey: string }
  | { provider: 'microsoft'; deltaLink: string; windowStart: Instant; windowEnd: Instant };

export interface CalendarChangeSet {
  readonly events: readonly CalendarEvent[];
  readonly removedIds: readonly string[];
  readonly cursor: CalendarCursor;
}

export interface CalendarQuery {
  readonly windowStart: Instant;
  readonly windowEnd: Instant;
}

export interface MirrorIntent {
  readonly taskId: EntityId;
  readonly calendar: CalendarRef;
  readonly title: string;
  readonly range: Extract<CalendarRange, { kind: 'timed' }>;
  readonly idempotencyKey: string;
  readonly expectedRevision?: string;
}

export interface CalendarAdapter {
  pull(calendar: CalendarRef, query: CalendarQuery, cursor?: CalendarCursor): Promise<CalendarChangeSet>;
  upsertMirror(intent: MirrorIntent): Promise<CalendarEvent>;
  deleteMirror(event: CalendarEvent, expectedRevision: string): Promise<void>;
}

export interface CalendarWritePolicy {
  readonly enabled: boolean;
  readonly destination: CalendarRef;
}

export function assertMirrorWritable(event: CalendarEvent, policy: CalendarWritePolicy): void {
  if (!policy.enabled) throw new Error('Calendar writes are disabled');
  if (event.ownership !== 'app-mirror' || !event.taskId) throw new Error('External event is read-only');
  const actual = event.calendar;
  const target = policy.destination;
  if (actual.provider !== target.provider || actual.accountId !== target.accountId || actual.calendarId !== target.calendarId) {
    throw new Error('Calendar destination mismatch');
  }
}

export function validateTimedRange(range: Extract<CalendarRange, { kind: 'timed' }>): void {
  // Require an offset so parsing never silently depends on the device timezone.
  const zoned = /(?:Z|[+-]\d{2}:\d{2})$/;
  const start = Date.parse(range.start);
  const end = Date.parse(range.end);
  if (!zoned.test(range.start) || !zoned.test(range.end) || !Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    throw new Error('Time block requires an ordered pair of zoned instants');
  }
  new Intl.DateTimeFormat('en', { timeZone: range.timeZone });
}
