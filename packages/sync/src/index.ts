/** Facade over upstream sync, not a new protocol or merge implementation. */
export type SyncStatus =
  | { state: 'disabled' }
  | { state: 'offline'; pendingOperations: number }
  | { state: 'syncing'; pendingOperations: number }
  | { state: 'current'; lastSyncedAt: string }
  | { state: 'needs-review'; conflictCount: number }
  | { state: 'error'; retryable: boolean; message: string };

export interface SyncPort {
  status(): SyncStatus;
  /** Local commands must never await this call. */
  synchronize(): Promise<void>;
  exportBackup(): Promise<Uint8Array>;
}

export const persistencePolicy = {
  tasks: 'upstream-operation-log',
  projects: 'upstream-operation-log',
  trackedTime: 'upstream-operation-log',
  calendarCache: 'device-local',
  calendarCursor: 'device-local',
  calendarOutbox: 'device-local',
  oauthCredentials: 'device-vault',
  pkceVerifier: 'ephemeral',
  publicBookings: 'scheduling-service',
  publicVotes: 'scheduling-service',
  teamMembership: 'team-service',
} as const;
