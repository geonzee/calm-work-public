import { CalmDocument } from './calm-runtime.model';
import { validateCalmDocument } from './calm-runtime-validation';

/** Validate and normalize a versioned export before any native action is dispatched. */
export async function prepareCalmRestore(
  value: unknown,
  now = Date.now(),
): Promise<{
  hash: string;
  document: CalmDocument;
  totals: Record<string, Record<string, number>>;
}> {
  const archive = value as { format?: string; version?: number; document?: unknown };
  if (!archive || archive.format !== 'calm-work-workspace' || archive.version !== 1)
    throw new Error('Choose a Calm Work version 1 workspace export.');
  if (JSON.stringify(value).length > 20 * 1024 * 1024)
    throw new Error('Workspace export exceeds 20 MB.');
  const document = structuredClone(validateCalmDocument(archive.document));
  const safeId = (id: string): boolean => /^[A-Za-z0-9_.:-]{1,200}$/.test(id);
  if (
    document.tasks.some((task) => !safeId(task.id)) ||
    document.sessions.some((session) => !safeId(session.sessionKey)) ||
    document.events.some((event) => !safeId(event.id)) ||
    new Set(document.events.map((event) => event.id)).size !== document.events.length
  )
    throw new Error('Workspace contains invalid or duplicate identities.');
  if (
    document.tasks.some(
      (task) =>
        task.nativeMs !== undefined &&
        (!Number.isFinite(task.nativeMs) || task.nativeMs < 0),
    )
  )
    throw new Error('Workspace contains invalid tracked totals.');
  for (const session of document.sessions) {
    if (
      (session.startTimestamp !== undefined || session.endTimestamp !== undefined) &&
      (!Number.isFinite(session.startTimestamp) ||
        !Number.isFinite(session.endTimestamp) ||
        session.endTimestamp! < session.startTimestamp!)
    )
      throw new Error('Workspace contains invalid recorded timestamps.');
  }
  for (const [key, draft] of Object.entries(document.drafts)) {
    if (
      ['__proto__', 'prototype', 'constructor'].includes(key) ||
      Object.keys(draft).some((name) =>
        ['__proto__', 'prototype', 'constructor'].includes(name),
      )
    )
      throw new Error('Workspace contains invalid draft fields.');
  }
  // Deletions/renames were already applied before export; never replay them into recovery.
  delete document.deletedTaskIds;
  delete document.projectRenames;
  const hash = [
    ...new Uint8Array(
      await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(JSON.stringify(document)),
      ),
    ),
  ]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  if (document.clock) {
    const pausedAt = document.clock.lastActiveAt || document.clock.resumedAt;
    document.clock.running = false;
    document.clock.resumedAt = now;
    document.clock.lastActiveAt = pausedAt;
    document.clock.nativeStartMs = 0;
    document.clock.nativeStartDays = {};
  }
  // Historic native baseline excludes imported sessions and the separately paused timer.
  const totals: Record<string, Record<string, number>> = {};
  for (const task of document.tasks) {
    const baseline = { ...(task.nativeDays || {}) };
    for (const session of document.sessions.filter((session) => session.id === task.id)) {
      for (const [day, ms] of Object.entries(
        session.dailyMs || { [session.date]: Math.round(session.focusedSeconds * 1000) },
      ))
        baseline[day] = Math.max(0, (baseline[day] || 0) - ms);
      delete session.nativeStartMs;
      delete session.nativeStartDays;
    }
    if (document.clock?.active === task.id)
      for (const [day, ms] of Object.entries(document.clock.dailyMs || {}))
        baseline[day] = Math.max(0, (baseline[day] || 0) - ms);
    task.nativeDays = baseline;
    totals[task.id] = { ...baseline };
    for (const session of document.sessions.filter((session) => session.id === task.id))
      for (const [day, ms] of Object.entries(
        session.dailyMs || { [session.date]: Math.round(session.focusedSeconds * 1000) },
      ))
        totals[task.id][day] = (totals[task.id][day] || 0) + ms;
  }
  return { hash, document, totals };
}
