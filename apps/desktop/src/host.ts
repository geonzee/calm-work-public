import type { LocalCommandPort, LocalQueryPort, TrackingView } from '../../../packages/core/src/index.js';
import type { FeatureId } from '../../../packages/modules/src/index.js';

/** Implement in the upstream Electron main process through validated IPC. */
export interface DesktopHost {
  readonly commands: LocalCommandPort;
  readonly queries: LocalQueryPort;
  showTrayPanel(): void;
  showToday(): void;
  updateTray(timer: TrackingView | undefined): void;
  loadModule(feature: FeatureId): Promise<void>;
}
