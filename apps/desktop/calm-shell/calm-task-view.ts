import { Task } from '../tasks/task.model';

export const taskPlannedDate = (task: Task): string => {
  if (task.dueWithTime) {
    const date = new Date(task.dueWithTime);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
  return task.dueDay || '';
};

export const taskPlannedTime = (task: Task): string => {
  if (!task.dueWithTime) return '';
  const date = new Date(task.dueWithTime);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

export const sortedTodayTasks = (tasks: Task[], today: string): Task[] =>
  tasks
    .filter((task) => !task.parentId && !task.isDone && taskPlannedDate(task) === today)
    .sort((a, b) => (a.dueWithTime || Infinity) - (b.dueWithTime || Infinity));

export const plannedFields = (
  date: string,
  time: string,
): Pick<Task, 'dueDay' | 'dueWithTime'> => {
  if (!date) return { dueDay: null, dueWithTime: null };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Invalid date');
  const timestamp = new Date(`${date}T${time || '12:00'}:00`).getTime();
  if (!Number.isFinite(timestamp)) throw new Error('Invalid date or time');
  if (taskPlannedDate({ dueWithTime: timestamp } as Task) !== date)
    throw new Error('Invalid date');
  return time
    ? { dueDay: null, dueWithTime: timestamp }
    : { dueDay: date, dueWithTime: null };
};
