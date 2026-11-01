/**
 * One-time backfill of a 15 minute estimate on tasks that have neither an estimate
 * nor any recorded time. It is never applied to new tasks, and the plan is pure so
 * it can be shown as a dry run before anything is written.
 */
import { CalmDocument, CalmTask } from './calm-runtime.model';

export const BACKFILL_MINUTES = 15;

export interface EstimateBackfillItem {
  id: string;
  title: string;
}
/** `open` fills unfinished tasks; `done` fills finished (past) tasks. Each runs once. */
export type EstimateBackfillScope = 'open' | 'done';
export interface EstimateBackfillPlan {
  minutes: number;
  scope: EstimateBackfillScope;
  /** Tasks in the chosen scope that will receive the estimate. */
  tasks: EstimateBackfillItem[];
  /** Tasks in the other scope, left alone. */
  skippedDone: number;
  /** Tasks that are calendar events (imported by an issue provider), never changed. */
  skippedEvents: number;
  /** Tasks shared with someone else, left alone. */
  skippedShared: number;
  /** Tasks that have recorded time or a live timer, so they already have a duration. */
  skippedTracked: number;
}

const hasRecordedTime = (task: CalmTask, document: CalmDocument): boolean =>
  (task.nativeMs || 0) > 0 ||
  Object.values(task.nativeDays || {}).some((ms) => ms > 0) ||
  !!task.actual ||
  document.clock?.active === task.id ||
  document.sessions.some(
    (session) => session.id === task.id && (session.focusedSeconds > 0 || session.duration > 0),
  );

export const planEstimateBackfill = (
  document: CalmDocument,
  minutes = BACKFILL_MINUTES,
  options: { scope?: EstimateBackfillScope; events?: ReadonlySet<string> } = {},
): EstimateBackfillPlan => {
  const scope = options.scope || 'open';
  const plan: EstimateBackfillPlan = {
    minutes,
    scope,
    tasks: [],
    skippedDone: 0,
    skippedEvents: 0,
    skippedShared: 0,
    skippedTracked: 0,
  };
  for (const task of document.tasks) {
    if (task.estimate != null && task.estimate > 0) continue;
    if (hasRecordedTime(task, document)) {
      plan.skippedTracked++;
      continue;
    }
    if (options.events?.has(task.id)) plan.skippedEvents++;
    else if (task.shared) plan.skippedShared++;
    else if (task.done !== (scope === 'done')) plan.skippedDone++;
    else plan.tasks.push({ id: task.id, title: task.title });
  }
  return plan;
};
