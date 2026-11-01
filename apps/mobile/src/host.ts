import type { LocalCommandPort, LocalQueryPort } from '../../../packages/core/src/index.js';
import type { SyncPort } from '../../../packages/sync/src/index.js';

/** Implement in the upstream Capacitor/PWA app; foreground sync is explicit. */
export interface MobileHost {
  readonly commands: LocalCommandPort;
  readonly queries: LocalQueryPort;
  readonly sync: SyncPort;
  onForeground(): Promise<void>;
}
