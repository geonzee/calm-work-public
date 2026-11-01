import type { Instant } from '../../core/src/index.js';

export interface WeeklyAvailability {
  readonly weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  readonly startLocalTime: string;
  readonly endLocalTime: string;
}

export interface BookingPage {
  readonly id: string;
  readonly title: string;
  readonly durationMs: number;
  readonly timeZone: string;
  readonly bufferMs: number;
  readonly minimumNoticeMs: number;
  readonly availability: readonly WeeklyAvailability[];
}

export interface BookingRequest {
  readonly pageId: string;
  readonly start: Instant;
  readonly attendeeName: string;
  readonly attendeeEmail: string;
  readonly idempotencyKey: string;
}

export type BookingResult =
  | { state: 'confirmed'; bookingId: string; eventId: string }
  | { state: 'pending'; bookingId: string }
  | { state: 'unavailable' };

/** Public service rechecks availability and reserves slots transactionally. */
export interface BookingPort {
  publish(page: BookingPage): Promise<{ publicUrl: string }>;
  reserve(request: BookingRequest): Promise<BookingResult>;
  cancel(bookingId: string, cancellationToken: string): Promise<void>;
}

export interface PollOption {
  readonly id: string;
  readonly start: Instant;
  readonly end: Instant;
  readonly timeZone: string;
}

export interface PollDraft {
  readonly id: string;
  readonly title: string;
  readonly options: readonly PollOption[];
}

export interface PollVote {
  readonly optionId: string;
  readonly availability: 'yes' | 'if-needed' | 'no';
}

export interface PollPort {
  publish(draft: PollDraft): Promise<{ publicUrl: string }>;
  vote(pollId: string, participantToken: string, votes: readonly PollVote[]): Promise<void>;
  /** Selection alone never creates an invitation; that requires an explicit command. */
  finalize(pollId: string, optionId: string, expectedRevision: string): Promise<void>;
}
