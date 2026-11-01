import { Task } from '../tasks/task.model';
import { plannedFields, sortedTodayTasks, taskPlannedTime } from './calm-task-view';

describe('Calm task views', () => {
  it('orders timed work before untimed work without mutating store records', () => {
    const tasks = [
      { id: 'untimed', dueDay: '2026-10-14' },
      { id: 'late', dueWithTime: new Date('2026-10-14T14:00:00').getTime() },
      { id: 'early', dueWithTime: new Date('2026-10-14T09:00:00').getTime() },
      { id: 'done', dueDay: '2026-10-14', isDone: true },
      { id: 'other', dueDay: '2026-10-15' },
      { id: 'child', dueDay: '2026-10-14', parentId: 'early' },
    ] as Task[];
    expect(sortedTodayTasks(tasks, '2026-10-14').map((task) => task.id)).toEqual([
      'early',
      'late',
      'untimed',
    ]);
    expect(tasks[0].id).toBe('untimed');
  });
  it('keeps timed and day-only plans mutually exclusive, including clearing', () => {
    const timed = plannedFields('2026-10-14', '09:30');
    expect(timed.dueDay).toBeNull();
    expect(taskPlannedTime(timed as Task)).toBe('09:30');
    expect(plannedFields('2026-10-14', '')).toEqual({
      dueDay: '2026-10-14',
      dueWithTime: null,
    });
    expect(plannedFields('', '')).toEqual({ dueDay: null, dueWithTime: null });
  });
  it('rejects impossible calendar dates rather than silently moving work', () => {
    expect(() => plannedFields('2026-02-30', '10:00')).toThrow();
    expect(() => plannedFields('bad-date', '')).toThrow();
  });
});
