import { planEstimateBackfill } from './calm-estimate-backfill';
import { CalmDocument, CalmSession, CalmTask } from './calm-runtime.model';

const task = (id: string, overrides: Partial<CalmTask> = {}): CalmTask => ({
  id,
  title: 'Task ' + id,
  project: '',
  date: '',
  schedule: '',
  estimate: null,
  done: false,
  today: false,
  ...overrides,
});
const doc = (tasks: CalmTask[], sessions: CalmSession[] = []): CalmDocument => ({
  tasks,
  projects: [],
  sessions,
  events: [],
  clock: null,
  drafts: {},
});

describe('estimate backfill plan', () => {
  it('picks open tasks with no estimate and no recorded time', () => {
    const plan = planEstimateBackfill(doc([task('a'), task('b', { estimate: 30 })]));
    expect(plan.tasks.map((item) => item.id)).toEqual(['a']);
    expect(plan.minutes).toBe(15);
  });

  it('never touches a task that has any estimate', () => {
    const plan = planEstimateBackfill(doc([task('a', { estimate: 5 })]));
    expect(plan.tasks).toEqual([]);
  });

  it('skips tasks with recorded time, a session or a live timer', () => {
    const plan = planEstimateBackfill({
      ...doc(
        [
          task('t1', { nativeMs: 60000 }),
          task('t2', { nativeDays: { '2026-10-20': 1000 } }),
          task('t3'),
          task('t4'),
        ],
        [{ id: 't3', focusedSeconds: 30, duration: 0.5 } as CalmSession],
      ),
      clock: { active: 't4' } as CalmDocument['clock'],
    });
    expect(plan.tasks).toEqual([]);
    expect(plan.skippedTracked).toBe(4);
  });

  it('leaves finished and shared tasks alone and counts them', () => {
    const plan = planEstimateBackfill(
      doc([
        task('done', { done: true }),
        task('shared', { shared: { connectionId: 'c', projectId: 'p', taskId: 't' } }),
        task('open'),
      ]),
    );
    expect(plan.tasks.map((item) => item.id)).toEqual(['open']);
    expect(plan.skippedDone).toBe(1);
    expect(plan.skippedShared).toBe(1);
  });

  it('is idempotent: once estimates are set a second plan is empty', () => {
    const tasks = [task('a'), task('b')];
    const first = planEstimateBackfill(doc(tasks));
    for (const item of first.tasks) tasks.find((t) => t.id === item.id)!.estimate = 15;
    expect(planEstimateBackfill(doc(tasks)).tasks).toEqual([]);
  });

  it('done scope picks only finished tasks, never events, shared or tracked ones', () => {
    const plan = planEstimateBackfill(
      doc([
        task('past', { done: true }),
        task('past-event', { done: true }),
        task('past-tracked', { done: true, nativeMs: 1000 }),
        task('past-estimated', { done: true, estimate: 10 }),
        task('past-shared', { done: true, shared: { connectionId: 'c', projectId: 'p', taskId: 't' } }),
        task('open'),
      ]),
      15,
      { scope: 'done', events: new Set(['past-event']) },
    );
    expect(plan.tasks.map((item) => item.id)).toEqual(['past']);
    expect(plan.skippedEvents).toBe(1);
    expect(plan.skippedShared).toBe(1);
    expect(plan.skippedTracked).toBe(1);
    expect(plan.skippedDone).toBe(1); // the open task, left alone in this scope
  });
});
