/** Read models and ports. These do not define a second persisted task store. */
export type EntityId = string;
export type Instant = string;
export type Provider = 'google' | 'microsoft';

export interface TaskView {
  readonly id: EntityId;
  readonly title: string;
  readonly done: boolean;
  readonly projectId?: EntityId;
  readonly estimateMs: number;
  readonly trackedMs: number;
}

export interface ProjectView {
  readonly id: EntityId;
  readonly title: string;
  readonly archived: boolean;
}

/** Local commands map to upstream persistent actions and existing timer actions. */
export type TaskCommand =
  | { kind: 'task.create'; title: string; projectId?: EntityId }
  | { kind: 'task.complete'; taskId: EntityId; done: boolean }
  | { kind: 'timer.start'; taskId: EntityId }
  | { kind: 'timer.stop' }
  | { kind: 'task.schedule'; taskId: EntityId; start: Instant; durationMs: number; timeZone: string };

export interface CommandReceipt {
  readonly commandId: string;
  readonly durability: 'local-durable';
  readonly entityId?: EntityId;
}

/** Resolve only after upstream persistence commits. No network prerequisite. */
export interface LocalCommandPort {
  execute(commandId: string, command: TaskCommand): Promise<CommandReceipt>;
}

export interface LocalQueryPort {
  tasks(): Promise<readonly TaskView[]>;
  projects(): Promise<readonly ProjectView[]>;
}

export interface TrackingView {
  readonly taskId: EntityId;
  readonly deviceId: string;
  readonly startedAt: Instant;
  readonly elapsedMs: number;
}

/** OAuth tokens and PKCE verifiers never enter sync, exports or task models. */
export interface TokenVault {
  read(accountId: string, provider: Provider): Promise<string | undefined>;
  write(accountId: string, provider: Provider, token: string): Promise<void>;
  remove(accountId: string, provider: Provider): Promise<void>;
}
