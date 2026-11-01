import {
  TaskRepeatCfg,
  DEFAULT_TASK_REPEAT_CFG,
} from '../task-repeat-cfg/task-repeat-cfg.model';
import { TaskReminderOptionId } from '../tasks/task.model';
import { CalmTask, CalmRepeatRule } from './calm-runtime.model';

const dayNames = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;

// The upstream repeat engine owns generation. This adapter only maps visible choices.
export const calmRepeatConfig = (
  task: CalmTask,
  today: string,
): Omit<TaskRepeatCfg, 'id'> | null => {
  const repeat = (task.repeat || '').toLowerCase();
  if (!repeat || repeat === 'does not repeat') return null;
  const anchor = task.date || today;
  const weekday = new Date(`${anchor}T12:00:00`).getDay();
  const rule = task.repeatRule;
  let weekdays: number[];
  if (repeat === 'every day') weekdays = [0, 1, 2, 3, 4, 5, 6];
  else if (repeat === 'every weekday') weekdays = [1, 2, 3, 4, 5];
  else if (repeat === 'every friday') weekdays = [5];
  else if (repeat === 'custom weekly' && rule?.cycle === 'weekly')
    weekdays = rule.weekdays;
  else weekdays = [weekday];
  const monthly = repeat === 'every month' || repeat === 'monthly weekday';
  return {
    ...DEFAULT_TASK_REPEAT_CFG,
    title: task.title,
    notes: task.notes || undefined,
    defaultEstimate: (task.estimate || 0) * 60000 || undefined,
    startDate: anchor,
    startTime: task.schedule || undefined,
    remindAt: task.schedule ? TaskReminderOptionId.DoNotRemind : undefined,
    lastTaskCreationDay: anchor,
    lastTaskCreation: new Date(`${anchor}T12:00:00`).getTime(),
    quickSetting: 'CUSTOM',
    repeatCycle: monthly ? 'MONTHLY' : 'WEEKLY',
    repeatEvery: rule?.every || 1,
    ...Object.fromEntries(
      dayNames.map((name, index) => [name, weekdays.includes(index)]),
    ),
    monthlyWeekOfMonth: repeat === 'monthly weekday' ? rule?.weekOfMonth : undefined,
    monthlyWeekday:
      repeat === 'monthly weekday'
        ? (rule?.weekdays[0] as 0 | 1 | 2 | 3 | 4 | 5 | 6)
        : undefined,
  };
};

export const calmRepeatFromNative = (
  config: TaskRepeatCfg | undefined,
): { repeat: string; repeatRule: CalmRepeatRule | null } => {
  if (!config) return { repeat: '', repeatRule: null };
  const weekdays = dayNames.flatMap((name, index) => (config[name] ? [index] : []));
  if (config.repeatCycle === 'MONTHLY') {
    if (config.monthlyWeekOfMonth !== undefined && config.monthlyWeekday !== undefined)
      return {
        repeat: 'Monthly weekday',
        repeatRule: {
          cycle: 'monthly',
          every: config.repeatEvery,
          weekdays: [config.monthlyWeekday],
          weekOfMonth: config.monthlyWeekOfMonth,
        },
      };
    return { repeat: 'Every month', repeatRule: null };
  }
  if (config.repeatEvery === 1 && weekdays.length === 7)
    return { repeat: 'Every day', repeatRule: null };
  if (config.repeatEvery === 1 && weekdays.join(',') === '1,2,3,4,5')
    return { repeat: 'Every weekday', repeatRule: null };
  return {
    repeat: 'Custom weekly',
    repeatRule: { cycle: 'weekly', every: config.repeatEvery, weekdays },
  };
};
