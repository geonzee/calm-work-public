import type { CommandReceipt, LocalCommandPort, TaskCommand } from '../../core/src/index.js';

export interface AutomationRequest {
  readonly commandId: string;
  readonly command: TaskCommand;
}

/** UI, tray and trusted AI tooling share the same command boundary. */
export function executeAutomation(request: AutomationRequest, local: LocalCommandPort): Promise<CommandReceipt> {
  if (!request.commandId.trim()) throw new Error('A retry-safe command ID is required');
  return local.execute(request.commandId, request.command);
}
