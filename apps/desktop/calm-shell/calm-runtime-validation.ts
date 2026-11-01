import { CalmDocument } from './calm-runtime.model';

const validDate = (date: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T12:00:00`);
  return (
    Number.isFinite(parsed.getTime()) &&
    `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}` ===
      date
  );
};
const validTime = (time: string): boolean => /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
const validDailyMs = (daily: Record<string, number> | undefined): boolean =>
  !daily ||
  (typeof daily === 'object' &&
    Object.entries(daily).every(
      ([day, amount]) => validDate(day) && Number.isFinite(amount) && amount >= 0,
    ));

export const validateCalmDocument = (value: unknown): CalmDocument => {
  if (!value || typeof value !== 'object') throw new Error('Missing workspace');
  const document = value as CalmDocument;
  if (
    !Array.isArray(document.tasks) ||
    !Array.isArray(document.projects) ||
    !Array.isArray(document.sessions) ||
    !Array.isArray(document.events) ||
    !document.drafts ||
    typeof document.drafts !== 'object'
  )
    throw new Error('Invalid workspace');
  if (
    document.tasks.length > 10000 ||
    document.sessions.length > 10000 ||
    document.events.length > 10000
  )
    throw new Error('Workspace is too large');

  if (
    document.projects.some(
      (name) => typeof name !== 'string' || !name.trim() || name !== name.trim(),
    ) ||
    new Set(document.projects.map((name) => name.toLowerCase())).size !==
      document.projects.length
  )
    throw new Error('Invalid projects');
  if (
    document.deletedTaskIds &&
    (!Array.isArray(document.deletedTaskIds) ||
      document.deletedTaskIds.some(
        (id) =>
          typeof id !== 'string' || !id || document.tasks.some((task) => task.id === id),
      ))
  )
    throw new Error('Invalid task deletion');
  if (
    document.deletedProjects !== undefined &&
    (!Array.isArray(document.deletedProjects) ||
      document.deletedProjects.some(
        (name) =>
          typeof name !== 'string' ||
          !name.trim() ||
          document.projects.includes(name) ||
          document.tasks.some((task) => task.project === name),
      ))
  )
    throw new Error('Invalid project deletion');
  const ids = new Set<string>();
  for (const task of document.tasks) {
    if (
      !task ||
      typeof task.id !== 'string' ||
      !task.id ||
      ids.has(task.id) ||
      typeof task.title !== 'string' ||
      !task.title.trim() ||
      typeof task.project !== 'string' ||
      typeof task.done !== 'boolean' ||
      typeof task.date !== 'string' ||
      (task.date !== '' && !validDate(task.date)) ||
      typeof task.schedule !== 'string' ||
      (task.schedule !== '' && !validTime(task.schedule)) ||
      (task.estimate !== null &&
        (!Number.isFinite(task.estimate) ||
          task.estimate < 0 ||
          task.estimate > 100000)) ||
      (task.notes !== undefined && typeof task.notes !== 'string') ||
      (task.calendar !== undefined &&
        (typeof task.calendar !== 'string' || task.calendar.length > 600)) ||
      !validDailyMs(task.nativeDays)
    )
      throw new Error('Invalid task');
    if (task.project && !document.projects.includes(task.project))
      throw new Error('Task project unavailable');
    if (task.repeatRule) {
      const rule = task.repeatRule;
      if (
        !['weekly', 'monthly'].includes(rule.cycle) ||
        !Number.isInteger(rule.every) ||
        rule.every < 1 ||
        rule.every > 52 ||
        !Array.isArray(rule.weekdays) ||
        !rule.weekdays.length ||
        new Set(rule.weekdays).size !== rule.weekdays.length ||
        rule.weekdays.some((day) => !Number.isInteger(day) || day < 0 || day > 6) ||
        (rule.cycle === 'monthly' &&
          (rule.weekdays.length !== 1 ||
            ![1, 2, 3, 4, -1].includes(rule.weekOfMonth || 0)))
      )
        throw new Error('Invalid repeat rule');
    }
    ids.add(task.id);
  }

  const sessionKeys = new Set<string>();
  for (const session of document.sessions) {
    if (
      !session ||
      typeof session.sessionKey !== 'string' ||
      !session.sessionKey ||
      sessionKeys.has(session.sessionKey) ||
      !ids.has(session.id) ||
      typeof session.title !== 'string' ||
      typeof session.project !== 'string' ||
      !Number.isFinite(session.focusedSeconds) ||
      session.focusedSeconds < 0 ||
      !Number.isFinite(session.duration) ||
      session.duration < 0 ||
      !Number.isFinite(session.startMinute) ||
      !Number.isFinite(session.endMinute) ||
      session.endMinute < session.startMinute ||
      typeof session.date !== 'string' ||
      !validDate(session.date) ||
      !validTime(session.start) ||
      !validTime(session.end) ||
      typeof session.recorded !== 'boolean' ||
      (session.estimate !== null &&
        (!Number.isFinite(session.estimate) || session.estimate < 0)) ||
      !validDailyMs(session.dailyMs) ||
      !validDailyMs(session.nativeStartDays)
    )
      throw new Error('Invalid session');
    const durationSeconds = session.duration * 60;
    if (Math.abs(durationSeconds - session.focusedSeconds) > 0.01)
      throw new Error('Session duration disagrees with focused time');
    sessionKeys.add(session.sessionKey);
  }

  for (const event of document.events) {
    if (
      !event ||
      typeof event.id !== 'string' ||
      typeof event.title !== 'string' ||
      !event.title.trim() ||
      typeof event.date !== 'string' ||
      !validDate(event.date) ||
      !validTime(event.start) ||
      !validTime(event.end) ||
      event.start >= event.end ||
      typeof event.owned !== 'boolean' ||
      typeof event.calendar !== 'string' ||
      (event.attendees !== undefined && typeof event.attendees !== 'string') ||
      (event.meetingUrl !== undefined && typeof event.meetingUrl !== 'string') ||
      (event.notes !== undefined && typeof event.notes !== 'string')
    )
      throw new Error('Invalid event');
  }

  if (
    document.clock &&
    (!ids.has(document.clock.active || '') ||
      typeof document.clock.running !== 'boolean' ||
      !Number.isFinite(document.clock.elapsedMs) ||
      document.clock.elapsedMs < 0 ||
      !Number.isFinite(document.clock.nativeStartMs) ||
      document.clock.nativeStartMs < 0 ||
      (document.clock.estimate !== null &&
        (!Number.isFinite(document.clock.estimate) || document.clock.estimate < 0)) ||
      !validDailyMs(document.clock.dailyMs) ||
      !validDailyMs(document.clock.nativeStartDays) ||
      !Number.isFinite(document.clock.resumedAt) ||
      !Number.isFinite(document.clock.startedAt) ||
      (document.clock.lastActiveAt !== undefined &&
        !Number.isFinite(document.clock.lastActiveAt)))
  )
    throw new Error('Invalid clock');

  if (
    Object.values(document.drafts).some(
      (draft) =>
        !draft ||
        typeof draft !== 'object' ||
        Object.values(draft).some(
          (entry) => typeof entry !== 'string' && typeof entry !== 'boolean',
        ),
    ) ||
    (document.mergeBase !== undefined &&
      (!document.mergeBase ||
        typeof document.mergeBase !== 'object' ||
        Object.values(document.mergeBase).some(
          (entry) => typeof entry !== 'string' || entry.length > 500000,
        ))) ||
    (document.projectRenames !== undefined &&
      Object.entries(document.projectRenames).some(
        ([oldName, newName]) =>
          !oldName.trim() || typeof newName !== 'string' || !newName.trim(),
      ))
  )
    throw new Error('Invalid workspace metadata');

  return document;
};
